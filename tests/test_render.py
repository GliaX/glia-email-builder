"""Pure-Python tests for the Glia Email Builder renderer.

These do not require a bench; run them with:

    cd apps/glia_email_builder
    python3 -m pytest tests/
"""

from __future__ import annotations

import os
import sys

import jinja2
import pytest

APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP_ROOT)

from glia_email_builder.builder.defaults import (  # noqa: E402
	DEFAULT_MERGE_FIELDS,
	DEFAULT_SETTINGS,
	MAX_EMAIL_HTML_BYTES,
)
from glia_email_builder.builder.macros import (  # noqa: E402
	MacroError,
	build_alias_map,
	build_condition_expression,
	replace_globals,
	translate_template,
)
from glia_email_builder.builder.render import (  # noqa: E402
	build_global_values,
	render_email,
	to_email_fragment,
	translate_subject,
)
from glia_email_builder.builder.sanitize import (  # noqa: E402
	sanitize_raw_html,
	sanitize_text_html,
)
from glia_email_builder.builder.schema import (  # noqa: E402
	DesignError,
	new_block,
	new_row,
	normalize_design,
)
from glia_email_builder.builder.seed_data import get_seed_templates  # noqa: E402

ALIASES = build_alias_map(DEFAULT_MERGE_FIELDS)
SAMPLE = {
	"first_name": "Sarah",
	"last_name": "Chen",
	"full_name": "Sarah Chen",
	"email_id": "sarah@example.org",
	"state": "CA",
	"is_recurring_donor": "1",
}


def render(design, subject="Hello {{ FirstName }}", base_url=""):
	design = normalize_design(design)
	return render_email(
		design,
		subject=subject,
		app_settings=DEFAULT_SETTINGS,
		base_url=base_url,
		merge_fields=DEFAULT_MERGE_FIELDS,
	)


def render_jinja(compiled, doc=None):
	return jinja2.Environment().from_string(compiled["html"]).render(doc=doc or SAMPLE)


# ---------------------------------------------------------------------------
# EveryAction syntax
# ---------------------------------------------------------------------------


def test_condition_macro_translation():
	translated = translate_template(
		"{{ if equals(FirstName,'Sarah') }}A{{ else }}B{{ end }}", ALIASES
	)
	assert "{% if (doc.first_name == 'Sarah') %}" in translated
	assert "{% else %}" in translated
	assert "{% endif %}" in translated


def test_alias_in_text_uses_fallback():
	translated = translate_template("Hello {{ FirstName }}", ALIASES)
	assert "{{ doc.first_name|default('Friend', true) }}" in translated


def test_comparison_operators_are_plain_jinja():
	translated = translate_template(
		"{{ if greater_than(TotalDonated, 100) }}big{{ end }}", ALIASES
	)
	assert "doc.total_donated > 100" in translated
	assert "greater_than" not in translated


def test_nested_conditions_balance():
	translated = translate_template(
		"{{ if equals(StateOrProvince,'CA') }}"
		"{{ if FirstName }}Hi{{ end }}"
		"{{ else }}Else{{ end }}",
		ALIASES,
	)
	assert translated.count("{% if ") == 2
	assert translated.count("{% endif %}") == 2


def test_unclosed_condition_is_rejected():
	with pytest.raises(MacroError):
		translate_template("{{ if FirstName }}missing end", ALIASES)


def test_each_loop_translation():
	translated = translate_template("{{each GenderArray}}{{loop_var}}{{end}}")
	assert "{% for loop_var in GenderArray %}" in translated
	assert "{% endfor %}" in translated


def test_global_tokens():
	values = build_global_values(
		{
			**DEFAULT_SETTINGS,
			"organization_name": "Glia & Co",
			"organization_address": "Line one\nLine two",
		},
		for_html=True,
	)
	html = replace_globals(
		"<p>{{ OrganizationName }} — {{ OrganizationAddress }}</p>", values
	)
	assert "Glia &amp; Co" in html
	assert "Line one<br />Line two" in html


# ---------------------------------------------------------------------------
# Sanitisation
# ---------------------------------------------------------------------------


def test_sanitizer_keeps_jinja_lt():
	fragment = sanitize_text_html("{{ if doc.count < 5 }}small{{ end }}")
	assert "doc.count < 5" in fragment
	translated = translate_template(fragment, ALIASES)
	assert "{% if doc.count < 5 %}" in translated


def test_text_sanitizer_removes_scripts_and_images():
	fragment = sanitize_text_html(
		'<p onclick="x()">Hi<script>alert(1)</script><img src="x.png"></p>'
	)
	assert "<script" not in fragment
	assert "onclick" not in fragment
	assert "<img" not in fragment
	assert "Hi" in fragment


def test_raw_sanitizer_keeps_tables_but_strips_scripts():
	fragment = sanitize_raw_html(
		'<table><tr><td style="color:#000">Hi</td></tr></table><script>x()</script>'
	)
	assert "<table" in fragment
	assert "<td" in fragment
	assert "<script" not in fragment


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def test_every_block_type_renders():
	design = {
		"rows": [
			new_row(
				1,
				columns=[
					{
						"width": 100,
						"blocks": [
							new_block("title", content={"text": "Title", "level": 1}),
							new_block("paragraph", content={"html": "<p>Paragraph</p>"}),
							new_block("text", content={"html": "Text"}),
							new_block("list", content={"html": "<ul><li>One</li></ul>"}),
							new_block(
								"image",
								content={"src": "/files/photo.jpg", "alt": "A photo", "link": "{{ WebsiteURL }}"},
							),
							new_block("button", content={"text": "Give", "link": "{{ DonateURL }}"}),
							new_block("divider"),
							new_block("spacer", content={"height": 10}),
							new_block("social"),
							new_block("video", content={"url": "https://www.youtube.com/watch?v=abcdef12345"}),
							new_block("html", content={"html": "<strong>Raw</strong>"}),
						],
					}
				],
			)
		]
	}
	compiled = render(design, subject="Hi")
	html = compiled["html"]
	for marker in (
		"<h1",
		"Paragraph",
		"A photo",
		"Give",
		"border-top:1px solid",
		"Watch the video",
		"img.youtube.com/vi/abcdef12345",
		"<strong>Raw</strong>",
		"geb-content",
	):
		assert marker in html
	assert len(html.encode("utf-8")) < MAX_EMAIL_HTML_BYTES


def test_subject_and_body_personalisation():
	compiled = render(
		{"rows": [new_row(1, columns=[{"width": 100, "blocks": [new_block("paragraph", content={"html": "<p>Dear {{ FirstName }}</p>"})]}])]},
		subject="{{ FirstName }}, news from Glia",
	)
	assert "{{ doc.first_name|default('Friend', true) }}" in compiled["subject"]
	assert "{{ doc.first_name|default('Friend', true) }}" in compiled["html"]
	rendered = render_jinja(compiled)
	assert "Sarah" in rendered


def test_row_condition_hides_row():
	design = {
		"rows": [
			new_row(
				1,
				condition={
					"enabled": True,
					"field": "doc.is_recurring_donor",
					"operator": "equals",
					"value": "1",
					"expression": "",
				},
				columns=[
					{
						"width": 100,
						"blocks": [new_block("paragraph", content={"html": "<p>Monthly donor</p>"})],
					}
				],
			)
		]
	}
	compiled = render(design)
	assert "{% if (doc.is_recurring_donor or '') == '1' %}" in compiled["html"]
	env = jinja2.Environment()
	assert "Monthly donor" in env.from_string(compiled["html"]).render(doc={"is_recurring_donor": "1"})
	assert "Monthly donor" not in env.from_string(compiled["html"]).render(doc={"is_recurring_donor": "0"})


def test_condition_builder_from_simple_fields():
	expr = build_condition_expression(
		{"field": "StateOrProvince", "operator": "equals", "value": "CA"}, ALIASES
	)
	assert "doc.state" in expr and "'CA'" in expr


def test_unsubscribe_placeholder_is_emitted():
	compiled = render(
		{
			"rows": [
				new_row(
					1,
					columns=[
						{
							"width": 100,
							"blocks": [
								new_block("text", content={"html": '{{ UnsubscribeLink }}'}),
								new_block("text", content={"html": '<a href="{{ UnsubscribeURL }}">Unsub</a>'}),
							],
						}
					],
				)
			]
		}
	)
	assert compiled["html"].count("<!--unsubscribe_url-->") == 2
	assert "__GEB_UNSUBSCRIBE_URL__" not in compiled["html"]


def test_absolute_image_urls():
	compiled = render(
		{
			"rows": [
				new_row(
					1,
					columns=[
						{
							"width": 100,
							"blocks": [new_block("image", content={"src": "/files/photo.jpg", "alt": "x"})],
						}
					],
				)
			]
		},
		base_url="https://asset.example.org",
	)
	assert 'src="https://asset.example.org/files/photo.jpg"' in compiled["html"]


def test_button_width():
	compiled = render(
		{
			"rows": [
				new_row(
					1,
					columns=[
						{
							"width": 100,
							"blocks": [
								new_block("button", content={"text": "Give", "link": "https://example.org"}),
								new_block(
									"button",
									content={
										"text": "Give wide",
										"link": "https://example.org",
										"full_width": True,
									},
								),
							],
						}
					],
				)
			]
		}
	)
	assert 'width="100%"' in compiled["html"]
	assert "display:inline-block" in compiled["html"]
	assert "display:block" in compiled["html"]


def test_hidden_classes_emitted():
	compiled = render(
		{
			"rows": [
				new_row(
					1,
					styles={"hide_mobile": True},
					columns=[
						{
							"width": 100,
							"blocks": [
								new_block(
									"paragraph",
									styles={"hide_desktop": True},
									content={"html": "<p>Hidden</p>"},
								)
							],
						}
					],
				)
			]
		}
	)
	assert "geb-hide-mobile" in compiled["html"]
	assert "geb-hide-desktop" in compiled["html"]


def test_email_fragment_for_frappe_wrapper():
	compiled = render(
		{
			"rows": [
				new_row(
					1,
					columns=[
						{
							"width": 100,
							"blocks": [
								new_block(
									"paragraph",
									content={"html": "<p>Fragment content</p>"},
								)
							],
						}
					],
				)
			]
		}
	)
	fragment = to_email_fragment(compiled["html"])
	assert fragment.startswith("<style")
	assert "Fragment content" in fragment
	assert "<style" in fragment and "@media" in fragment
	assert "<!DOCTYPE" not in fragment
	assert "<html" not in fragment
	assert "<body" not in fragment
	assert to_email_fragment(fragment) == fragment


# ---------------------------------------------------------------------------
# Seeds
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("seed", get_seed_templates(), ids=lambda seed: seed["name"])
def test_seed_templates_compile(seed):
	design = normalize_design({"settings": seed["settings"], "rows": seed["rows"]})
	compiled = render(design, subject=seed["subject"])
	assert compiled["block_count"] > 0
	assert len(compiled["html"].encode("utf-8")) < MAX_EMAIL_HTML_BYTES
	assert compiled["settings"]["preheader"] == seed["preheader"]
	rendered = render_jinja(compiled)
	assert "Unsubscribe" in rendered
	assert "{{" not in rendered
	jinja2.Environment().from_string(compiled["html"])


def test_seed_names_unique():
	names = [seed["name"] for seed in get_seed_templates()]
	assert len(names) == len(set(names))
	assert len(names) >= 10


def test_subject_translation_is_idempotent():
	first = translate_subject("{{ FirstName }}, hello", DEFAULT_MERGE_FIELDS, DEFAULT_SETTINGS)
	second = translate_subject(first, DEFAULT_MERGE_FIELDS, DEFAULT_SETTINGS)
	assert first == second
	assert "{{ FirstName }}" not in first


def test_unknown_block_is_rejected():
	with pytest.raises(DesignError):
		normalize_design(
			{
				"rows": [
					new_row(
						1,
						columns=[{"width": 100, "blocks": [{"type": "nope", "id": "x"}]}],
					)
				]
			}
		)
