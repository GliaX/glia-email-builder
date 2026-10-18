"""Create the starter Email Templates and their block designs.

Idempotent: an existing Email Template with the same name is never overwritten.
This runs from ``after_install`` and from a post-model-sync patch for sites that
add the app later.
"""

from __future__ import annotations

import json

import frappe

from .compiler import compile_design_for_template, get_app_settings
from .render import to_email_fragment
from .schema import normalize_design
from .seed_data import get_seed_templates

TEMPLATE = "Email Template"
DESIGN = "Email Builder Design"


def _ensure_lang() -> None:
	if not getattr(frappe.local, "lang", None):
		frappe.local.lang = frappe.db.get_default("lang") or "en"


def _site_base_url() -> str:
	"""Absolute base URL for images compiled into seeded emails.

	``bench install-app`` runs outside a request, so ``get_url()`` falls back to
	the site name with an ``http://`` scheme. Production Glia is served over TLS
	(terminated by the ingress), and seeding HTTP asset URLs into every starter
	email would make those images insecure for anyone who sends a starter without
	editing it first. Prefer the configured host name, otherwise assume HTTPS for
	a real (dotted) site name; local development keeps its plain URL.
	"""
	try:
		url = frappe.utils.get_url()
	except Exception:
		url = ""
	host = str(frappe.conf.get("host_name") or frappe.conf.get("hostname") or "").strip().rstrip("/")
	if host:
		return host if host.startswith(("http://", "https://")) else "https://" + host
	site = str(getattr(frappe.local, "site", "") or "").split(":")[0]
	if (
		url.startswith("http://")
		and site
		and "." in site
		and not site.endswith((".local", ".test", ".localhost"))
		and site not in ("localhost", "127.0.0.1")
	):
		return "https://" + site
	return url


def seed_starter_templates() -> int:
	_ensure_lang()
	created = 0
	app_settings = get_app_settings()
	reference_doctype = app_settings.get("default_reference_doctype") or "Contact"
	if not frappe.db.exists("DocType", reference_doctype):
		reference_doctype = "Contact" if frappe.db.exists("DocType", "Contact") else None

	for seed in get_seed_templates():
		name = seed.get("name")
		if not name or frappe.db.exists(TEMPLATE, name):
			continue
		if frappe.db.exists(DESIGN, name):
			frappe.log_error(
				title="Email Builder: orphan design skipped",
				message=f"A design named {name} exists without an Email Template.",
			)
			continue

		try:
			settings = dict(seed.get("settings") or {})
			settings["subject_template"] = seed.get("subject") or ""
			design = normalize_design(
				{
					"settings": settings,
					"rows": seed.get("rows") or [],
				}
			)
			compiled = compile_design_for_template(
				design,
				subject=seed.get("subject") or "",
				reference_doctype=reference_doctype,
				app_settings=app_settings,
				base_url=_site_base_url(),
			)
			template_doc = frappe.get_doc(
				{
					"doctype": TEMPLATE,
					"name": name,
					"subject": compiled["subject"],
					"use_html": 1,
					"reference_doctype": reference_doctype,
					"response_html": to_email_fragment(compiled["html"]),
				}
			)
			template_doc.insert(ignore_permissions=True)

			design_doc = frappe.get_doc(
				{
					"doctype": DESIGN,
					"email_template": name,
					"reference_doctype": reference_doctype,
					"category": seed.get("category") or "Custom",
					"description": seed.get("description") or "",
					"design_json": json.dumps(design, ensure_ascii=False, separators=(",", ":")),
					"seeded": 1,
				}
			)
			design_doc.insert(ignore_permissions=True)
			created += 1
		except Exception:
			frappe.log_error(
				title=f"Email Builder: could not seed {name}",
				message=frappe.get_traceback(),
			)
			# Roll back the partial template so a later migrate can retry cleanly.
			try:
				if frappe.db.exists(DESIGN, name):
					frappe.delete_doc(DESIGN, name, ignore_permissions=True, force=True)
				if frappe.db.exists(TEMPLATE, name):
					frappe.delete_doc(TEMPLATE, name, ignore_permissions=True, force=True)
			except Exception:
				pass

	if created:
		frappe.clear_cache(doctype=TEMPLATE)
	return created
