"""Build the standalone Email Builder dev harness data.

Run from the app root:
    python3 dev/build_harness_data.py

It renders the seed templates with the same Python renderer used in production
and writes ``dev/harness/mock-data.js`` plus a copy of the page stylesheet.
This is a development aid only; production reads everything from Frappe.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import sys

import jinja2

APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP_ROOT)

from glia_email_builder.builder.defaults import (  # noqa: E402
	DEFAULT_DESIGN_SETTINGS,
	DEFAULT_MERGE_FIELDS,
	DEFAULT_SETTINGS,
	GMAIL_CLIP_BYTES,
	MAX_EMAIL_HTML_BYTES,
	TEMPLATE_CATEGORIES,
)
from glia_email_builder.builder.render import render_email  # noqa: E402
from glia_email_builder.builder.schema import blank_design, normalize_design  # noqa: E402
from glia_email_builder.builder.seed_data import get_seed_templates  # noqa: E402

HARNESS = os.path.join(APP_ROOT, "dev", "harness")
PAGE_CSS = os.path.join(
	APP_ROOT, "glia_email_builder", "email_builder", "page", "email_builder", "email_builder.css"
)
PUBLIC = os.path.join(APP_ROOT, "glia_email_builder", "public")

SAMPLE = {
	"first_name": "Sarah",
	"last_name": "Chen",
	"full_name": "Sarah Chen",
	"email_id": "sarah.chen@example.org",
	"company_name": "Northside Clinic",
	"designation": "Program Director",
	"state": "CA",
	"gender": "Female",
	"birth_date": "1985-06-02",
	"is_recurring_donor": "1",
	"last_donation_amount": "50.00",
	"last_donation_date": "2026-03-12",
	"total_donated": "1250.00",
	"donation_count": "7",
	"donor_since": "2021",
	"name": "SAMPLE-DONOR",
	"doctype": "Contact",
}


def slug(value: str) -> str:
	return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def grouped_merge_fields() -> list[dict]:
	groups: dict[str, list[dict]] = {}
	for field in DEFAULT_MERGE_FIELDS:
		groups.setdefault(field["group"], []).append(dict(field))
	return [{"group": name, "fields": fields} for name, fields in groups.items()]


def main() -> None:
	os.makedirs(HARNESS, exist_ok=True)
	assets_link = os.path.join(HARNESS, "assets", "glia_email_builder")
	os.makedirs(os.path.dirname(assets_link), exist_ok=True)
	if not os.path.islink(assets_link) and not os.path.exists(assets_link):
		os.symlink("../../../glia_email_builder/public", assets_link)
	app_settings = dict(DEFAULT_SETTINGS)
	app_settings.update(
		{
			"asset_base": "/assets/glia_email_builder",
			"site_url": "",
			"max_bytes": MAX_EMAIL_HTML_BYTES,
			"gmail_clip_bytes": GMAIL_CLIP_BYTES,
		}
	)
	env = jinja2.Environment()
	seeds = get_seed_templates()
	library = []
	previews = {}
	designs = {}
	subjects = {}
	for seed in seeds:
		design = normalize_design({"settings": seed["settings"], "rows": seed["rows"]})
		compiled = render_email(
			design,
			subject=seed["subject"],
			app_settings=app_settings,
			base_url="",
			merge_fields=DEFAULT_MERGE_FIELDS,
		)
		preview_html = env.from_string(compiled["html"]).render(doc=SAMPLE).replace(
			"<!--unsubscribe_url-->", "#"
		)
		previews[seed["name"]] = preview_html
		designs[seed["name"]] = design
		subjects[seed["name"]] = seed["subject"]
		subject_preview = env.from_string(compiled["subject"]).render(doc=SAMPLE)
		library.append(
			{
				"name": seed["name"],
				"title": seed["name"],
				"description": seed["description"],
				"category": seed["category"],
				"subject": seed["subject"],
				"subject_preview": subject_preview,
				"preview_html": preview_html,
				"seeded": 1,
				"modified": "2026-10-01 10:00:00",
				"email_size": len(compiled["html"].encode("utf-8")),
				"compiled_on": "2026-10-01 10:00:00",
			}
		)

	default_name = library[0]["title"]
	default_design = designs[default_name]

	blank = normalize_design(blank_design(DEFAULT_DESIGN_SETTINGS, with_scaffold=True))
	blank_compiled = render_email(
		blank,
		subject="Your email subject",
		app_settings=app_settings,
		base_url="",
		merge_fields=DEFAULT_MERGE_FIELDS,
	)
	blank_preview = env.from_string(blank_compiled["html"]).render(doc=SAMPLE).replace(
		"<!--unsubscribe_url-->", "#"
	)
	context = {
		"template": {
			"name": default_name,
			"subject": subjects[default_name],
			"reference_doctype": "Contact",
			"modified": "2026-10-01 10:00:00",
			"use_html": 1,
		},
		"design": default_design,
		"settings": app_settings,
		"merge_field_groups": grouped_merge_fields(),
		"sample_doc": SAMPLE,
		"can_write": True,
		"can_create": True,
		"has_design": True,
		"imported": False,
		"design_meta": {
			"name": default_name,
			"category": library[0]["category"],
			"description": library[0]["description"],
			"seeded": 1,
			"compiled_on": "2026-10-01 10:00:00",
			"email_size": library[0]["email_size"],
		},
		"reference_doctypes": ["Contact", "Lead", "Donor"],
		"categories": TEMPLATE_CATEGORIES,
		"user": "you@glia.org",
		"is_system_manager": True,
	}

	images = {
		"files": [
			{
				"file_name": "story-workshop.jpg",
				"file_url": "/assets/glia_email_builder/images/story-workshop.jpg",
			},
			{
				"file_name": "hero-gaza.jpg",
				"file_url": "/assets/glia_email_builder/images/hero-gaza.jpg",
			},
			{
				"file_name": "device-stethoscope.jpg",
				"file_url": "/assets/glia_email_builder/images/device-stethoscope.jpg",
			},
			{
				"file_name": "impact-report.jpg",
				"file_url": "/assets/glia_email_builder/images/impact-report.jpg",
			},
			{
				"file_name": "story-stethoscope.jpg",
				"file_url": "/assets/glia_email_builder/images/story-stethoscope.jpg",
			},
			{
				"file_name": "device-otoscope.jpg",
				"file_url": "/assets/glia_email_builder/images/device-otoscope.jpg",
			},
		],
		"stock": [
			{
				"file_name": "Glia logo (white)",
				"file_url": "/assets/glia_email_builder/images/glia-logo-white.png",
				"stock": 1,
			},
			{
				"file_name": "Glia logo (dark)",
				"file_url": "/assets/glia_email_builder/images/glia-logo-dark.png",
				"stock": 1,
			},
			{
				"file_name": "Video placeholder",
				"file_url": "/assets/glia_email_builder/images/video-placeholder.jpg",
				"stock": 1,
			},
			{
				"file_name": "Play button",
				"file_url": "/assets/glia_email_builder/images/play.png",
				"stock": 1,
			},
		],
	}

	payload = {
		"context": context,
		"library": library,
		"previews": previews,
		"designs": designs,
		"blankDesign": blank,
		"blankPreview": blank_preview,
		"blankSubject": "Your email subject",
		"images": images,
		"contacts": [
			{
				"name": "SAMPLE-DONOR",
				"full_name": "Sarah Chen",
				"email_id": "sarah.chen@example.org",
				"company_name": "Northside Clinic",
			},
			{
				"name": "DONOR-2",
				"full_name": "Mateo Rivera",
				"email_id": "mateo@example.org",
				"company_name": "",
			},
			{
				"name": "DONOR-3",
				"full_name": "Amina Yusuf",
				"email_id": "amina@example.org",
				"company_name": "Crescent Health",
			},
		],
		"startContext": {
			"template": None,
			"design": None,
			"settings": app_settings,
			"merge_field_groups": grouped_merge_fields(),
			"sample_doc": SAMPLE,
			"can_write": True,
			"can_create": True,
			"has_design": False,
			"imported": False,
			"design_meta": {},
			"reference_doctypes": ["Contact", "Lead", "Donor"],
			"categories": TEMPLATE_CATEGORIES,
			"user": "you@glia.org",
			"is_system_manager": True,
		},
	}

	with open(os.path.join(HARNESS, "mock-data.js"), "w") as f:
		f.write("window.__GEB_HARNESS__ = ")
		json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
		f.write(";\n")

	shutil.copyfile(PAGE_CSS, os.path.join(HARNESS, "builder.css"))
	print(f"wrote {HARNESS}/mock-data.js and builder.css ({len(library)} templates)")


if __name__ == "__main__":
	main()
