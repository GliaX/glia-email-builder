"""Merge-field discovery and sample-data generation."""

from __future__ import annotations

import json
from collections import OrderedDict

import frappe
from frappe.utils import today

from .defaults import DEFAULT_MERGE_FIELDS, DEFAULT_SETTINGS

DATA_FIELDTYPES = {
	"Data",
	"Small Text",
	"Text",
	"Long Text",
	"Link",
	"Dynamic Link",
	"Select",
	"Date",
	"Datetime",
	"Time",
	"Currency",
	"Float",
	"Int",
	"Check",
	"Percent",
	"Rating",
	"Read Only",
}

SKIP_FIELDS = {
	"name",
	"owner",
	"creation",
	"modified",
	"modified_by",
	"docstatus",
	"idx",
	"parent",
	"parentfield",
	"parenttype",
	"amended_from",
	"_user_tags",
	"_comments",
	"_assign",
	"_liked_by",
	"password",
	"api_key",
	"api_secret",
	"user",
}

SAMPLE_VALUES = {
	"first_name": "Sarah",
	"last_name": "Chen",
	"full_name": "Sarah Chen",
	"salutation": "Ms.",
	"email_id": "sarah.chen@example.org",
	"company_name": "Northside Clinic",
	"designation": "Program Director",
	"department": "Community Health",
	"phone": "+1 555 010 1234",
	"mobile_no": "+1 555 010 5678",
	"state": "CA",
	"gender": "Female",
	"birth_date": "1985-06-02",
	"website": "https://example.org",
	"linkedin": "https://www.linkedin.com/in/example",
	"twitter": "https://twitter.com/example",
	"facebook": "https://facebook.com/example",
	"last_donation_amount": "50.00",
	"total_donated": "1250.00",
	"last_donation_date": "2026-03-12",
	"donor_since": "2021",
	"donation_count": "7",
	"is_recurring_donor": "1",
}

GROUP_ORDER = [
	"Donor details",
	"Gift history (map to your donor fields)",
	"Organization",
	"Links",
]


def _settings_merge_fields() -> list[dict]:
	rows: list[dict] = []
	try:
		doc = frappe.get_cached_doc("Email Builder Settings")
		for row in doc.get("merge_fields") or []:
			rows.append(
				{
					"group": row.get("group") or "Custom",
					"label": row.get("label") or row.get("expression"),
					"expression": row.get("expression") or "",
					"fallback": row.get("fallback") or "",
					"aliases": row.get("aliases") or "",
					"sample_value": row.get("sample_value") or "",
				}
			)
	except Exception:
		pass
	if not rows:
		rows = [dict(row) for row in DEFAULT_MERGE_FIELDS]
	return [row for row in rows if row["expression"]]


def _grouped(fields: list[dict]) -> list[dict]:
	groups: OrderedDict[str, list[dict]] = OrderedDict()
	for field in fields:
		groups.setdefault(field.get("group") or "Other", []).append(field)
	ordered: list[dict] = []
	for name in GROUP_ORDER + [g for g in groups if g not in GROUP_ORDER]:
		if name in groups:
			ordered.append({"group": name, "fields": groups.pop(name)})
	for name, items in groups.items():
		ordered.append({"group": name, "fields": items})
	return ordered


def get_merge_fields(reference_doctype: str | None = None) -> list[dict]:
	"""Flat merge-field list for compilation (ordered and de-duplicated)."""
	fields = _settings_merge_fields()
	seen_expressions = {field["expression"] for field in fields}

	if reference_doctype and frappe.db.exists("DocType", reference_doctype):
		meta = frappe.get_meta(reference_doctype)
		auto_group = f"{reference_doctype} fields"
		for df in meta.fields:
			if df.fieldname in SKIP_FIELDS or df.fieldtype not in DATA_FIELDTYPES:
				continue
			expression = f"doc.{df.fieldname}"
			if expression in seen_expressions:
				continue
			seen_expressions.add(expression)
			fields.append(
				{
					"group": auto_group,
					"label": df.label or df.fieldname.replace("_", " ").title(),
					"expression": expression,
					"fallback": "",
					"aliases": "",
					"sample_value": _sample_for_field(df),
				}
			)
	return fields


def get_grouped_merge_fields(reference_doctype: str | None = None) -> list[dict]:
	return _grouped(get_merge_fields(reference_doctype))


def _sample_for_field(df) -> str:
	if df.fieldname in SAMPLE_VALUES:
		return SAMPLE_VALUES[df.fieldname]
	if df.fieldtype == "Select" and df.options:
		options = [option for option in df.options.split("\n") if option]
		return options[0] if options else ""
	if df.fieldtype in {"Int"}:
		return "12"
	if df.fieldtype in {"Float", "Currency", "Percent"}:
		return "50.00"
	if df.fieldtype == "Check":
		return "1"
	if df.fieldtype in {"Date", "Datetime"}:
		return str(today())
	if df.fieldtype == "Time":
		return "10:00:00"
	if df.fieldtype in {"Link", "Dynamic Link"}:
		return f"Sample {df.label or df.fieldname}"
	return f"Sample {df.label or df.fieldname}"


def build_sample_doc(reference_doctype: str | None = None, overrides: dict | None = None) -> dict:
	"""A plausible donor document for the preview and library thumbnails."""
	reference_doctype = reference_doctype or DEFAULT_SETTINGS["default_reference_doctype"]
	doc: dict = dict(SAMPLE_VALUES)
	doc["name"] = "SAMPLE-DONOR"
	doc["doctype"] = reference_doctype or "Contact"

	if reference_doctype and frappe.db.exists("DocType", reference_doctype):
		meta = frappe.get_meta(reference_doctype)
		for df in meta.fields:
			if df.fieldname in doc or df.fieldname in SKIP_FIELDS:
				continue
			if df.fieldtype in DATA_FIELDTYPES:
				doc[df.fieldname] = _sample_for_field(df)

	# Values defined on the app settings take precedence over generated samples.
	for field in _settings_merge_fields():
		expression = field.get("expression") or ""
		if expression.startswith("doc.") and field.get("sample_value"):
			doc[expression[4:]] = field["sample_value"]

	try:
		settings = frappe.get_cached_doc("Email Builder Settings")
		if settings.get("sample_values_json"):
			custom = json.loads(settings.sample_values_json)
			if isinstance(custom, dict):
				doc.update(custom)
	except Exception:
		pass

	if overrides:
		doc.update(overrides)
	return doc


def load_doc_for_preview(reference_doctype: str, name: str) -> dict:
	"""Load a real record for previewing personalisation (permission checked)."""
	if not reference_doctype or not name:
		return build_sample_doc(reference_doctype)
	if not frappe.db.exists(reference_doctype, name):
		frappe.throw(f"{reference_doctype} {name} does not exist")
	doc = frappe.get_doc(reference_doctype, name)
	if not frappe.has_permission(reference_doctype, "read", doc=doc):
		raise frappe.PermissionError
	values = doc.as_dict()
	# Keep the payload small; only top-level primitive values are useful.
	values = {key: value for key, value in values.items() if isinstance(value, (str, int, float, bool)) or value is None}
	return values
