"""Frappe-aware compilation: settings, merge fields and Jinja validation."""

from __future__ import annotations

import json

import frappe
import jinja2
from frappe.utils import get_url, now_datetime

from .defaults import (
	DEFAULT_SETTINGS,
	GMAIL_CLIP_BYTES,
	MAX_EMAIL_HTML_BYTES,
)
from .render import render_email
from .schema import DesignError, count_blocks, normalize_design



def get_app_settings() -> dict:
	"""Return Email Builder Settings as a plain dict with defaults filled in."""
	defaults = dict(DEFAULT_SETTINGS)
	try:
		doc = frappe.get_cached_doc("Email Builder Settings")
	except Exception:
		return defaults

	for key in defaults:
		value = doc.get(key)
		if value not in (None, ""):
			defaults[key] = value
	return defaults


def compile_design_for_template(
	design: dict,
	*,
	subject: str = "",
	reference_doctype: str | None = None,
	app_settings: dict | None = None,
	merge_fields: list[dict] | None = None,
	base_url: str | None = None,
) -> dict:
	"""Compile a design and validate the generated Jinja.

	Raises:
		DesignError: the design is invalid or the output is too large.
		frappe.ValidationError: the generated Jinja has a syntax error.
	"""
	from .merge_fields import get_merge_fields

	app_settings = app_settings or get_app_settings()
	merge_fields = (
		merge_fields
		if merge_fields is not None
		else get_merge_fields(reference_doctype or app_settings.get("default_reference_doctype"))
	)
	base_url = base_url if base_url is not None else get_url()

	try:
		result = render_email(
			design,
			subject=subject,
			app_settings=app_settings,
			base_url=base_url,
			merge_fields=merge_fields,
		)
	except DesignError:
		raise
	except Exception as exc:
		raise DesignError(f"Could not render this design: {exc}") from exc

	# Parse with Jinja directly. Frappe's validate_template initialises its
	# restricted globals (and therefore the locale), which is not available in
	# every install/patch console context. Only syntax is needed here; the
	# final send still uses Frappe's own renderer.
	_validate_jinja(result["html"])
	_validate_jinja(result["subject"])

	size = len(result["html"].encode("utf-8"))
	if size > MAX_EMAIL_HTML_BYTES:
		raise DesignError(
			f"This email is {size:,} bytes. The limit is {MAX_EMAIL_HTML_BYTES:,} bytes "
			"(Gmail clips messages over ~102 KB). Remove content or images and try again."
		)

	result["size"] = size
	result["warn_clipped"] = size > GMAIL_CLIP_BYTES
	result["block_count"] = count_blocks(normalize_design(design))
	result["compiled_on"] = now_datetime()
	return result


def _ensure_lang() -> None:
	if not getattr(frappe.local, "lang", None):
		frappe.local.lang = frappe.db.get_default("lang") or "en"


def render_preview(
	design: dict,
	*,
	subject: str = "",
	sample_doc: dict | None = None,
	app_settings: dict | None = None,
	merge_fields: list[dict] | None = None,
	base_url: str | None = None,
	reference_doctype: str | None = None,
) -> dict:
	"""Compile and render with a sample/doc context for the preview iframe."""
	from frappe.utils.jinja import render_template

	_ensure_lang()
	compiled = compile_design_for_template(
		design,
		subject=subject,
		app_settings=app_settings,
		merge_fields=merge_fields,
		base_url=base_url,
		reference_doctype=reference_doctype,
	)
	context = {"doc": sample_doc or {}}
	html = render_template(compiled["html"], context, restrict_globals=True)
	subject_rendered = render_template(compiled["subject"], context, restrict_globals=True)
	# The queue replaces this placeholder per recipient; in a preview there is
	# no recipient, so make the link inert instead of empty.
	html = html.replace("<!--unsubscribe_url-->", "#")
	return {
		"html": html,
		"subject": subject_rendered,
		"text": compiled["text"],
		"size": compiled["size"],
		"warn_clipped": compiled["warn_clipped"],
	}


def _validate_jinja(template: str) -> None:
	if not template:
		return
	try:
		jinja2.Environment().parse(template)
	except jinja2.TemplateSyntaxError as exc:
		raise DesignError(
			f"Template syntax error at line {exc.lineno}: {exc.message}"
		) from exc


def serialize_design(design: dict) -> str:
	return json.dumps(normalize_design(design), ensure_ascii=False, separators=(",", ":"))
