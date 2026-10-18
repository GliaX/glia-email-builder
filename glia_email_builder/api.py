"""Whitelisted API for the Glia Email Builder page.

All methods check permissions. Designs are stored in ``Email Builder Design``
and compiled into the linked core ``Email Template`` so ERPNext campaigns keep
working without any custom sending code.
"""

from __future__ import annotations

import json
import re

import frappe
from frappe import _
from frappe.utils import cint, get_url, now_datetime, validate_email_address

from .builder.compiler import (
	compile_design_for_template,
	get_app_settings,
	render_preview,
)
from .builder.defaults import (
	DEFAULT_DESIGN_SETTINGS,
	GMAIL_CLIP_BYTES,
	MAX_EMAIL_HTML_BYTES,
	TEMPLATE_CATEGORIES,
)
from .builder.merge_fields import (
	build_sample_doc,
	get_grouped_merge_fields,
	get_merge_fields,
	load_doc_for_preview,
)
from .builder.render import to_email_fragment, translate_subject
from .builder.sanitize import sanitize_raw_html
from .builder.schema import (
	DesignError,
	blank_design,
	coerce_design_json,
	count_blocks,
	new_block,
	new_row,
	normalize_design,
)

DESIGN = "Email Builder Design"
SETTINGS = "Email Builder Settings"
TEMPLATE = "Email Template"
ROLE = "Email Builder User"

STOCK_IMAGES = [
	{"file_name": "Glia logo (white, for dark headers)", "file_url": "/assets/glia_email_builder/images/glia-logo-white.png", "stock": 1},
	{"file_name": "Glia logo (dark, for light headers)", "file_url": "/assets/glia_email_builder/images/glia-logo-dark.png", "stock": 1},
	{"file_name": "Video placeholder", "file_url": "/assets/glia_email_builder/images/video-placeholder.jpg", "stock": 1},
	{"file_name": "Play button", "file_url": "/assets/glia_email_builder/images/play.png", "stock": 1},
]

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".webp")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ensure_lang() -> None:
	if not getattr(frappe.local, "lang", None):
		frappe.local.lang = frappe.db.get_default("lang") or "en"


def _require_user() -> None:
	if frappe.session.user in ("Guest", None):
		raise frappe.PermissionError


def _template_doc(name: str):
	_require_user()
	if not name:
		frappe.throw(_("Please choose an Email Template."))
	if not frappe.db.exists(TEMPLATE, name):
		frappe.throw(_("Email Template {0} does not exist.").format(frappe.bold(name)))
	doc = frappe.get_doc(TEMPLATE, name)
	if not frappe.has_permission(TEMPLATE, "read", doc=doc):
		raise frappe.PermissionError
	return doc


def _can_write(template_doc) -> bool:
	return bool(frappe.has_permission(TEMPLATE, "write", doc=template_doc))


def _design_doc(template: str):
	if frappe.db.exists(DESIGN, template):
		return frappe.get_doc(DESIGN, template)
	return None


def _extract_body(value: str) -> str:
	"""Extract the inner body of a legacy full HTML email."""
	value = value or ""
	match = re.search(r"(?is)<body[^>]*>(.*?)</body>", value)
	if match:
		value = match.group(1)
	value = re.sub(r"(?is)<!DOCTYPE[^>]*>", "", value)
	value = re.sub(r"(?is)</?(html|head|body)[^>]*>", "", value)
	return value.strip()


def _draft_design(template_doc) -> tuple[dict, bool]:
	"""Return an editable design for a template that has none yet.

	Classic templates are imported as a single HTML block so no content is
	lost when staff open them in the builder for the first time.
	"""
	legacy = template_doc.response_html if template_doc.use_html else template_doc.response
	legacy = _extract_body(legacy) if legacy else ""
	if not legacy:
		return (
			blank_design(
				{
					**DEFAULT_DESIGN_SETTINGS,
					"email_title": template_doc.name,
					"subject_template": template_doc.subject or "",
				},
				with_scaffold=True,
			),
			False,
		)

	design = blank_design(
		{
			**DEFAULT_DESIGN_SETTINGS,
			"email_title": template_doc.name,
			"subject_template": template_doc.subject or "",
		},
		with_scaffold=False,
	)
	design["rows"] = [
		new_row(
			1,
			styles={"padding": {"top": 20, "right": 24, "bottom": 24, "left": 24}},
			columns=[
				{
					"width": 100,
					"blocks": [
						new_block(
							"html",
							styles={"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}},
							content={"html": sanitize_raw_html(legacy)},
						)
					],
				}
			],
		)
	]
	return normalize_design(design), True


def _context_for_template(template_doc) -> dict:
	app_settings = get_app_settings()
	design_doc = _design_doc(template_doc.name)
	imported = False
	if design_doc:
		try:
			design = coerce_design_json(design_doc.design_json)
		except DesignError:
			design, imported = _draft_design(template_doc)
	else:
		design, imported = _draft_design(template_doc)

	reference_doctype = (
		getattr(design_doc, "reference_doctype", None) if design_doc else None
	) or getattr(template_doc, "reference_doctype", None) or app_settings.get("default_reference_doctype")
	merge_field_groups = get_grouped_merge_fields(reference_doctype)
	merge_fields = get_merge_fields(reference_doctype)
	sample_doc = build_sample_doc(reference_doctype, _sample_overrides())
	can_write = _can_write(template_doc)

	# The Email Template stores translated Jinja so campaigns can render it.
	# Keep the friendlier EveryAction-style source in the design for editing.
	subject_for_edit = template_doc.subject or ""
	raw_subject = ((design.get("settings") or {}).get("subject_template") or "").strip()
	if raw_subject:
		try:
			if translate_subject(raw_subject, merge_fields, app_settings).strip() == (
				template_doc.subject or ""
			).strip():
				subject_for_edit = raw_subject
		except Exception:
			pass

	return {
		"template": {
			"name": template_doc.name,
			"subject": template_doc.subject or "",
			"reference_doctype": reference_doctype or "",
			"modified": str(template_doc.modified or ""),
			"use_html": cint(template_doc.use_html),
		},
		"subject": subject_for_edit,
		"reference_doctype": reference_doctype or "",
		"design": design,
		"settings": _settings_payload(app_settings),
		"merge_field_groups": merge_field_groups,
		"sample_doc": sample_doc,
		"can_write": can_write,
		"has_design": bool(design_doc),
		"imported": imported,
		"design_meta": {
			"name": design_doc.name if design_doc else None,
			"category": design_doc.category if design_doc else "Custom",
			"description": design_doc.description if design_doc else "",
			"seeded": cint(design_doc.seeded) if design_doc else 0,
			"compiled_on": str(design_doc.compiled_on) if design_doc and design_doc.compiled_on else "",
			"email_size": cint(design_doc.email_size) if design_doc else 0,
		},
	}


def _sample_overrides() -> dict:
	try:
		doc = frappe.get_cached_doc(SETTINGS)
		if doc.get("sample_values_json"):
			value = frappe.parse_json(doc.sample_values_json)
			if isinstance(value, dict):
				return value
	except Exception:
		pass
	return {}


def _settings_payload(app_settings: dict) -> dict:
	payload = dict(app_settings)
	payload["asset_base"] = "/assets/glia_email_builder"
	payload["site_url"] = get_url()
	payload["max_bytes"] = MAX_EMAIL_HTML_BYTES
	payload["gmail_clip_bytes"] = GMAIL_CLIP_BYTES
	return payload


def _design_for_payload(design, template_doc) -> dict:
	if design is None:
		design_doc = _design_doc(template_doc.name)
		if design_doc:
			return coerce_design_json(design_doc.design_json)
		return _draft_design(template_doc)[0]
	try:
		return coerce_design_json(design)
	except DesignError:
		raise


def _permission_error():
	return frappe.PermissionError(_("You do not have permission to edit Email Templates."))


# ---------------------------------------------------------------------------
# Context / library
# ---------------------------------------------------------------------------


@frappe.whitelist()
def has_app_permission() -> bool:
	if frappe.session.user == "Administrator":
		return True
	return bool(set(frappe.get_roles()) & {"System Manager", ROLE})


@frappe.whitelist()
def get_context(template: str | None = None) -> dict:
	"""Everything the builder needs to open a template or the start screen."""
	_require_user()
	if not template:
		app_settings = get_app_settings()
		can_create = bool(frappe.has_permission(TEMPLATE, "create"))
		return {
			"template": None,
			"design": None,
			"settings": _settings_payload(app_settings),
			"merge_field_groups": get_grouped_merge_fields(
				app_settings.get("default_reference_doctype")
			),
			"sample_doc": build_sample_doc(
				app_settings.get("default_reference_doctype"), _sample_overrides()
			),
			"can_write": can_create,
			"can_create": can_create,
			"has_design": False,
			"imported": False,
			"design_meta": {},
			"reference_doctypes": _reference_doctypes(),
			"categories": TEMPLATE_CATEGORIES,
			"user": frappe.session.user,
			"is_system_manager": "System Manager" in frappe.get_roles(),
		}

	template_doc = _template_doc(template)
	context = _context_for_template(template_doc)
	context.update(
		{
			"can_create": bool(frappe.has_permission(TEMPLATE, "create")),
			"reference_doctypes": _reference_doctypes(),
			"categories": TEMPLATE_CATEGORIES,
			"user": frappe.session.user,
			"is_system_manager": "System Manager" in frappe.get_roles(),
		}
	)
	return context


def _reference_doctypes() -> list[str]:
	preferred = ["Contact", "Lead", "Customer", "CRM Contact", "CRM Deal", "Donor", "Member"]
	available = [name for name in preferred if frappe.db.exists("DocType", name)]
	for name in ("Contact", "Lead"):
		if name not in available and frappe.db.exists("DocType", name):
			available.append(name)
	return available


@frappe.whitelist()
def get_reference_context(reference_doctype: str | None = None) -> dict:
	"""Merge fields and sample data for a different reference doctype."""
	_require_user()
	app_settings = get_app_settings()
	reference_doctype = reference_doctype or app_settings.get("default_reference_doctype")
	if reference_doctype and not frappe.db.exists("DocType", reference_doctype):
		frappe.throw(_("Unknown Reference DocType: {0}").format(reference_doctype))
	return {
		"reference_doctype": reference_doctype or "",
		"merge_field_groups": get_grouped_merge_fields(reference_doctype),
		"sample_doc": build_sample_doc(reference_doctype, _sample_overrides()),
	}


@frappe.whitelist()
def get_library(search: str | None = None) -> list[dict]:
	"""Starter and custom block templates, with rendered thumbnails."""
	_require_user()
	_ensure_lang()
	if not frappe.has_permission(TEMPLATE, "read"):
		raise frappe.PermissionError

	designs = frappe.get_list(
		DESIGN,
		filters={"email_template": ("is", "set")},
		fields=[
			"name",
			"email_template",
			"category",
			"reference_doctype",
			"description",
			"seeded",
			"compiled_html",
			"compiled_on",
			"email_size",
			"modified",
		],
		order_by="seeded desc, modified desc",
		limit_page_length=48,
	)

	template_names = [row.email_template for row in designs if row.email_template]
	templates = {}
	if template_names:
		for row in frappe.get_all(
			TEMPLATE,
			filters={"name": ("in", template_names)},
			fields=["name", "subject", "use_html"],
		):
			templates[row.name] = row

	sample_cache: dict[str, dict] = {}
	results: list[dict] = []
	search_lower = (search or "").strip().lower()
	for row in designs:
		template = templates.get(row.email_template)
		if not template:
			continue
		if search_lower:
			haystack = " ".join(
				[
					row.email_template or "",
					row.description or "",
					row.category or "",
					template.subject or "",
				]
			).lower()
			if search_lower not in haystack:
				continue
		reference = (
			getattr(row, "reference_doctype", None)
			or get_app_settings().get("default_reference_doctype")
		)
		if reference not in sample_cache:
			sample_cache[reference] = build_sample_doc(reference, _sample_overrides())
		subject_preview = template.subject or ""
		try:
			from frappe.utils.jinja import render_template

			subject_preview = render_template(
				template.subject or "", {"doc": sample_cache[reference]}, restrict_globals=True
			)
		except Exception:
			subject_preview = template.subject or ""
		preview = ""
		if row.compiled_html:
			try:
				from frappe.utils.jinja import render_template

				preview = render_template(
					row.compiled_html, {"doc": sample_cache[reference]}, restrict_globals=True
				).replace("<!--unsubscribe_url-->", "#")
			except Exception:
				preview = ""
		results.append(
			{
				"name": row.name,
				"title": row.email_template,
				"description": row.description or "",
				"category": row.category or "Custom",
				"subject": template.subject or "",
				"subject_preview": subject_preview,
				"preview_html": preview,
				"seeded": cint(row.seeded),
				"modified": str(row.modified or ""),
				"email_size": cint(row.email_size),
				"compiled_on": str(row.compiled_on or ""),
			}
		)
	return results


# ---------------------------------------------------------------------------
# Save / create
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_template_status(template: str) -> dict:
	template_doc = _template_doc(template)
	design = frappe.db.get_value(
		DESIGN,
		template_doc.name,
		["name", "compiled_on", "email_size", "category"],
		as_dict=True,
	)
	return {
		"has_design": bool(design),
		"compiled_on": str(design.compiled_on) if design and design.compiled_on else "",
		"email_size": cint(design.email_size) if design else 0,
		"category": design.category if design else "",
		"can_write": _can_write(template_doc),
	}


@frappe.whitelist()
def save_design(
	template: str,
	design=None,
	subject: str | None = None,
	reference_doctype: str | None = None,
	category: str | None = None,
	description: str | None = None,
	base_modified: str | None = None,
) -> dict:
	template_doc = _template_doc(template)
	if not _can_write(template_doc):
		raise _permission_error()

	if base_modified and str(template_doc.modified) and str(template_doc.modified) != str(base_modified):
		return {
			"ok": False,
			"conflict": True,
			"modified": str(template_doc.modified),
			"message": "This template was changed in another window or by another user.",
		}

	normalized = coerce_design_json(design)
	subject = (subject if subject is not None else template_doc.subject) or ""
	normalized.setdefault("settings", {})["subject_template"] = subject
	if reference_doctype is None:
		existing_design = _design_doc(template)
		reference_doctype = (
			getattr(existing_design, "reference_doctype", None)
			if existing_design
			else None
		) or getattr(template_doc, "reference_doctype", None)
	if reference_doctype and not frappe.db.exists("DocType", reference_doctype):
		frappe.throw(_("Unknown Reference DocType: {0}").format(reference_doctype))

	app_settings = get_app_settings()
	try:
		compiled = compile_design_for_template(
			normalized,
			subject=subject,
			reference_doctype=reference_doctype or app_settings.get("default_reference_doctype"),
			app_settings=app_settings,
		)
	except DesignError as exc:
		frappe.throw(str(exc))

	# 1. Update the core Email Template so campaign sending always uses the
	#    block output, even if the design record fails to save afterwards.
	_ensure_lang()
	template_doc.subject = compiled["subject"]
	template_doc.use_html = 1
	template_doc.response_html = to_email_fragment(compiled["html"])
	if reference_doctype is not None and frappe.get_meta(TEMPLATE).has_field("reference_doctype"):
		template_doc.reference_doctype = reference_doctype or None
	template_doc.save()

	# 2. Keep the design record (source of truth for editing) in sync.
	design_doc = _design_doc(template)
	if not design_doc:
		design_doc = frappe.new_doc(DESIGN)
		design_doc.email_template = template
	design_doc.design_json = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
	design_doc.reference_doctype = reference_doctype or None
	design_doc.category = category if category in TEMPLATE_CATEGORIES else (design_doc.category or "Custom")
	if description is not None:
		design_doc.description = description
	design_doc.save(ignore_permissions=True)

	# Design.validate() recompiled with the new subject; mirror the authoritative
	# values back into the response for the client.
	return {
		"ok": True,
		"conflict": False,
		"modified": str(template_doc.modified),
		"design_modified": str(design_doc.modified),
		"size": cint(design_doc.email_size),
		"warn_clipped": cint(design_doc.email_size) > GMAIL_CLIP_BYTES,
		"block_count": cint(design_doc.block_count),
		"subject": subject,
		"compiled_on": str(design_doc.compiled_on or ""),
	}


@frappe.whitelist()
def create_template(
	title: str,
	seed: str | None = None,
	reference_doctype: str | None = None,
	category: str | None = None,
) -> dict:
	_require_user()
	if not frappe.has_permission(TEMPLATE, "create"):
		raise frappe.PermissionError(_("You do not have permission to create Email Templates."))

	title = (title or "").strip()
	if not title:
		frappe.throw(_("Please give the email a name."))
	if len(title) > 140:
		frappe.throw(_("The name must be 140 characters or fewer."))
	if re.search(r"[/?#]", title):
		frappe.throw(_("The name cannot contain /, ? or #."))
	if frappe.db.exists(TEMPLATE, title):
		frappe.throw(_("An Email Template named {0} already exists.").format(frappe.bold(title)))

	app_settings = get_app_settings()
	reference_doctype = reference_doctype or app_settings.get("default_reference_doctype")
	if reference_doctype and not frappe.db.exists("DocType", reference_doctype):
		frappe.throw(_("Unknown Reference DocType: {0}").format(reference_doctype))

	seed_doc = None
	seed_template = None
	if seed:
		if not frappe.db.exists(DESIGN, seed):
			frappe.throw(_("Starter template {0} was not found.").format(frappe.bold(seed)))
		seed_doc = frappe.get_doc(DESIGN, seed)
		seed_template = frappe.get_doc(TEMPLATE, seed_doc.email_template) if frappe.db.exists(TEMPLATE, seed_doc.email_template) else None

	if seed_doc:
		design = coerce_design_json(seed_doc.design_json)
		subject = (seed_template.subject if seed_template else "") or "Your email subject"
		category = category or seed_doc.category or "Custom"
		description = seed_doc.description or ""
		seed_reference = getattr(seed_doc, "reference_doctype", None) or getattr(
			seed_template, "reference_doctype", None
		)
		if seed_reference:
			reference_doctype = reference_doctype or seed_reference
	else:
		design = blank_design(DEFAULT_DESIGN_SETTINGS, with_scaffold=True)
		subject = "Your email subject"
		category = category or "Custom"
		description = ""

	design["settings"]["email_title"] = title
	raw_subject = (design["settings"].get("subject_template") or subject).strip()
	design["settings"]["subject_template"] = raw_subject
	app_settings = get_app_settings()
	subject = translate_subject(raw_subject, get_merge_fields(reference_doctype), app_settings)

	template_payload = {
		"doctype": TEMPLATE,
		"name": title,
		"subject": subject,
		"use_html": 1,
		"response_html": "",
	}
	if frappe.get_meta(TEMPLATE).has_field("reference_doctype"):
		template_payload["reference_doctype"] = reference_doctype or None
	template_doc = frappe.get_doc(template_payload)
	_ensure_lang()
	try:
		template_doc.insert()
		design_doc = frappe.get_doc(
			{
				"doctype": DESIGN,
				"email_template": title,
				"reference_doctype": reference_doctype or None,
				"category": category if category in TEMPLATE_CATEGORIES else "Custom",
				"description": description,
				"design_json": json.dumps(design, ensure_ascii=False, separators=(",", ":")),
				"seeded": 0,
			}
		)
		design_doc.insert()
		template_doc.response_html = to_email_fragment(design_doc.compiled_html)
		template_doc.use_html = 1
		template_doc.save()
	except Exception:
		try:
			if frappe.db.exists(DESIGN, title):
				frappe.delete_doc(DESIGN, title, ignore_permissions=True, force=True)
			if frappe.db.exists(TEMPLATE, title):
				frappe.delete_doc(TEMPLATE, title, ignore_permissions=True, force=True)
		except Exception:
			pass
		raise

	return {
		"name": title,
		"modified": str(template_doc.modified),
		"has_design": True,
	}


# ---------------------------------------------------------------------------
# Preview / send
# ---------------------------------------------------------------------------


@frappe.whitelist()
def preview(
	template: str | None = None,
	design=None,
	subject: str | None = None,
	reference_doctype: str | None = None,
	contact: str | None = None,
	include_source: int = 1,
) -> dict:
	_require_user()
	_ensure_lang()
	template_doc = _template_doc(template) if template else None
	if template_doc:
		design_value = _design_for_payload(design, template_doc)
		subject_value = subject if subject is not None else template_doc.subject
		if not reference_doctype:
			existing_design = _design_doc(template_doc.name)
			reference_doctype = getattr(existing_design, "reference_doctype", None)
		if not reference_doctype:
			reference_doctype = getattr(template_doc, "reference_doctype", None)
	else:
		design_value = coerce_design_json(design or blank_design(with_scaffold=True))
		subject_value = subject or ""

	app_settings = get_app_settings()
	reference_doctype = reference_doctype or app_settings.get("default_reference_doctype")
	if reference_doctype and not frappe.db.exists("DocType", reference_doctype):
		frappe.throw(_("Unknown Reference DocType: {0}").format(reference_doctype))
	if contact:
		sample_doc = load_doc_for_preview(reference_doctype, contact)
	else:
		sample_doc = build_sample_doc(reference_doctype, _sample_overrides())

	try:
		result = render_preview(
			design_value,
			subject=subject_value or "",
			sample_doc=sample_doc,
			app_settings=app_settings,
			base_url=get_url(),
			reference_doctype=reference_doctype,
		)
	except DesignError as exc:
		frappe.throw(str(exc))

	if include_source:
		compiled = compile_design_for_template(
			design_value,
			subject=subject_value or "",
			reference_doctype=reference_doctype,
			app_settings=app_settings,
			base_url=get_url(),
		)
		result["source"] = compiled["html"]
		result["subject_source"] = compiled["subject"]
	result["block_count"] = count_blocks(design_value)
	return result


@frappe.whitelist()
def send_sample(
	template: str | None = None,
	design=None,
	subject: str | None = None,
	recipients: str | None = None,
	contact: str | None = None,
	reference_doctype: str | None = None,
) -> dict:
	_require_user()
	template_doc = _template_doc(template) if template else None
	if template_doc and not _can_write(template_doc):
		raise _permission_error()
	if not template_doc and not frappe.has_permission(TEMPLATE, "create"):
		raise frappe.PermissionError(_("You do not have permission to send email samples."))

	addresses = []
	for part in re.split(r"[,;\n]", recipients or ""):
		part = part.strip()
		if part:
			addresses.append(part)
	addresses = list(dict.fromkeys(addresses))
	if not addresses:
		frappe.throw(_("Enter at least one email address."))
	if len(addresses) > 10:
		frappe.throw(_("Send a sample to at most 10 addresses at a time."))
	for address in addresses:
		try:
			validate_email_address(address, throw=True)
		except Exception:
			frappe.throw(_("Invalid email address: {0}").format(frappe.bold(address)))

	preview_result = preview(
		template=template,
		design=design,
		subject=subject,
		reference_doctype=reference_doctype,
		contact=contact,
		include_source=0,
	)
	html = preview_result["html"]
	sender = None
	try:
		from frappe.email.doctype.email_account.email_account import EmailAccount

		account = EmailAccount.find_outgoing(match_by_doctype=TEMPLATE)
		if account:
			sender = account.email_id
	except Exception:
		sender = None

	try:
		frappe.sendmail(
			recipients=addresses,
			subject=preview_result.get("subject") or (template_doc.subject if template_doc else "Email preview"),
			message=to_email_fragment(html),
			sender=sender,
			now=True,
			add_unsubscribe_link=0,
		)
	except Exception as exc:
		frappe.log_error(title="Email Builder sample failed", message=frappe.get_traceback())
		frappe.throw(_("Could not send the sample email: {0}").format(str(exc)))

	return {"ok": True, "recipients": addresses}


# ---------------------------------------------------------------------------
# Images / contacts
# ---------------------------------------------------------------------------


@frappe.whitelist()
def list_images(search: str | None = None) -> dict:
	_require_user()
	if not frappe.has_permission(TEMPLATE, "read"):
		raise frappe.PermissionError

	filters = {"is_folder": 0, "is_private": 0}
	or_filters = None
	if search:
		or_filters = [["file_name", "like", f"%{search.strip()}%"]]
	files = frappe.get_all(
		"File",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "file_name", "file_url", "file_size", "modified"],
		order_by="modified desc",
		limit_page_length=120,
	)
	uploads = [
		{
			"name": row.name,
			"file_name": row.file_name,
			"file_url": row.file_url,
			"file_size": row.file_size,
			"thumbnail_url": row.file_url,
			"stock": 0,
		}
		for row in files
		if (row.file_name or "").lower().endswith(IMAGE_EXTENSIONS)
	]
	stock = []
	for image in STOCK_IMAGES:
		if not search or search.lower() in image["file_name"].lower():
			stock.append(dict(image))
	return {"files": uploads[:60], "stock": stock, "folder": "Public files"}


@frappe.whitelist()
def list_contacts(search: str | None = None, reference_doctype: str | None = None) -> list[dict]:
	"""Records that can be used for a personalised preview.

	The preview contact picker follows the design's reference doctype, so it can
	offer Leads or a custom Donor doctype just as well as Contacts.
	"""
	_require_user()
	reference = reference_doctype or get_app_settings().get("default_reference_doctype") or "Contact"
	if not frappe.db.exists("DocType", reference) or not frappe.has_permission(reference, "read"):
		return []
	meta = frappe.get_meta(reference)
	label_field = None
	for candidate in (meta.title_field, "full_name", "customer_name", "lead_name", "supplier_name"):
		if candidate and meta.has_field(candidate):
			label_field = candidate
			break
	email_field = next(
		(field for field in ("email_id", "email", "email_address") if meta.has_field(field)),
		None,
	)
	fields = ["name"]
	if label_field and label_field != "name":
		fields.append(label_field)
	if email_field:
		fields.append(email_field)
	if meta.has_field("company_name") and "company_name" not in fields:
		fields.append("company_name")

	or_filters = None
	if search:
		term = f"%{search.strip()}%"
		or_filters = [["name", "like", term]]
		if label_field and label_field != "name":
			or_filters.append([label_field, "like", term])
		if email_field:
			or_filters.append([email_field, "like", term])

	rows = frappe.get_list(
		reference,
		or_filters=or_filters,
		fields=fields,
		order_by="modified desc",
		limit_page_length=12,
	)
	return [
		{
			"name": row.name,
			"full_name": (row.get(label_field) or row.name) if label_field else row.name,
			"email_id": (row.get(email_field) or "") if email_field else "",
			"company_name": row.get("company_name") or "",
		}
		for row in rows
	]


# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------


@frappe.whitelist()
def recompile_all() -> dict:
	"""Recompile every block template, e.g. after changing brand settings."""
	if "System Manager" not in frappe.get_roles():
		raise frappe.PermissionError(_("Only System Managers can recompile all templates."))

	app_settings = get_app_settings()
	count = 0
	errors = []
	designs = frappe.get_all(DESIGN, fields=["name", "email_template", "design_json"])
	for row in designs:
		if not row.email_template or not frappe.db.exists(TEMPLATE, row.email_template):
			continue
		template_doc = frappe.get_doc(TEMPLATE, row.email_template)
		try:
			compiled = compile_design_for_template(
				coerce_design_json(row.design_json),
				subject=template_doc.subject,
				reference_doctype=getattr(frappe.get_doc(DESIGN, row.name), "reference_doctype", None),
				app_settings=app_settings,
			)
			design_doc = frappe.get_doc(DESIGN, row.name)
			design_doc.compiled_html = compiled["html"]
			design_doc.plain_text = compiled["text"]
			design_doc.block_count = compiled["block_count"]
			design_doc.email_size = compiled["size"]
			design_doc.compiled_on = now_datetime()
			design_doc.db_update()
			frappe.db.set_value(
				TEMPLATE,
				row.email_template,
				{"response_html": to_email_fragment(compiled["html"]), "use_html": 1},
				update_modified=False,
			)
			count += 1
		except Exception as exc:
			errors.append(f"{row.email_template}: {exc}")
			frappe.log_error(
				title="Email Builder recompile failed",
				message=f"{row.email_template}\n{frappe.get_traceback()}",
			)
	return {"ok": True, "count": count, "errors": errors}
