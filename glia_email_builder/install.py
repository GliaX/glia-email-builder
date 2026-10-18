"""Install / migrate helpers for Glia Email Builder."""

from __future__ import annotations

import frappe

from .builder.defaults import DEFAULT_MERGE_FIELDS, DEFAULT_SETTINGS

ROLE = "Email Builder User"
SETTINGS_DOCTYPE = "Email Builder Settings"
DESIGN_DOCTYPE = "Email Builder Design"
TEMPLATE_DOCTYPE = "Email Template"


def after_install() -> None:
	ensure_role()
	ensure_settings()
	grant_email_template_access()
	seed_starter_templates()


def after_migrate() -> None:
	# Idempotent setup; safe to run on every migrate.
	ensure_role()
	ensure_settings()
	grant_email_template_access()


def before_uninstall() -> None:
	try:
		for name in frappe.get_all(
			"Custom DocPerm",
			filters={"parent": TEMPLATE_DOCTYPE, "role": ROLE},
			pluck="name",
		):
			frappe.delete_doc("Custom DocPerm", name, ignore_permissions=True, force=True)
		frappe.clear_cache(doctype=TEMPLATE_DOCTYPE)
	except Exception:
		frappe.log_error(title="Email Builder: could not remove custom permissions")


def ensure_role() -> None:
	if frappe.db.exists("Role", ROLE):
		if not frappe.db.get_value("Role", ROLE, "desk_access"):
			frappe.db.set_value("Role", ROLE, "desk_access", 1)
		return
	try:
		frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": ROLE,
				"desk_access": 1,
				"description": "Can create and edit block-based Email Templates.",
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(title="Email Builder: could not create role")


def ensure_settings() -> None:
	"""Create the Single with defaults and starter merge fields if unset."""
	try:
		exists = frappe.db.get_single_value(SETTINGS_DOCTYPE, "organization_name")
	except Exception:
		exists = None

	doc = frappe.get_single(SETTINGS_DOCTYPE)
	changed = False
	for key, value in DEFAULT_SETTINGS.items():
		if doc.get(key) in (None, "") and value not in (None, ""):
			doc.set(key, value)
			changed = True

	if not doc.get("merge_fields"):
		for row in DEFAULT_MERGE_FIELDS:
			doc.append("merge_fields", dict(row))
		changed = True

	if changed or not exists:
		doc.save(ignore_permissions=True)


def _permission_fields() -> list[str]:
	"""Permission flags shared by DocPerm and Custom DocPerm."""
	standard = frappe.get_meta("DocPerm")
	custom = frappe.get_meta("Custom DocPerm")
	return [
		field
		for field in (
			"read",
			"write",
			"create",
			"delete",
			"submit",
			"cancel",
			"amend",
			"email",
			"export",
			"import",
			"print",
			"report",
			"share",
			"select",
			"if_owner",
		)
		if standard.has_field(field) and custom.has_field(field)
	]


def _upsert_custom_docperm(role: str, permlevel: int, flags: dict) -> None:
	filters = {"parent": TEMPLATE_DOCTYPE, "role": role, "permlevel": permlevel}
	name = frappe.db.get_value("Custom DocPerm", filters, "name")
	doc = frappe.get_doc("Custom DocPerm", name) if name else frappe.new_doc("Custom DocPerm")
	if not name:
		doc.parent = TEMPLATE_DOCTYPE
		doc.role = role
		doc.permlevel = permlevel
	for field in _permission_fields():
		doc.set(field, flags.get(field) or 0)
	doc.save(ignore_permissions=True)


def grant_email_template_access() -> None:
	"""Grant Email Template access without stripping the standard roles.

	Frappe treats Custom DocPerm rows as the complete permission set for a
	doctype. Creating only the Email Builder User row therefore hid Email
	Template from System Manager and Desk User. Mirror the standard DocPerm
	rows into Custom DocPerm first, then add the dedicated builder role.
	"""
	if not frappe.db.exists("Role", ROLE):
		return
	if not frappe.db.exists("DocType", "Custom DocPerm"):
		return
	try:
		fields = _permission_fields()
		standard_rows = frappe.get_all(
			"DocPerm",
			filters={"parent": TEMPLATE_DOCTYPE},
			fields=["role", "permlevel", *fields],
		)
		if not standard_rows:
			standard_rows = [
				{
					"role": "System Manager",
					"permlevel": 0,
					"read": 1,
					"write": 1,
					"create": 1,
					"delete": 1,
				},
				{"role": "Desk User", "permlevel": 0, "read": 1},
			]
		for row in standard_rows:
			if not row.get("role"):
				continue
			_upsert_custom_docperm(row["role"], row.get("permlevel") or 0, row)
		_upsert_custom_docperm(
			ROLE,
			0,
			{
				"read": 1,
				"write": 1,
				"create": 1,
				"email": 1,
				"export": 1,
				"print": 1,
				"share": 1,
				"report": 1,
			},
		)
		frappe.clear_cache(doctype=TEMPLATE_DOCTYPE)
	except Exception:
		frappe.log_error(title="Email Builder: could not grant Email Template access")


def seed_starter_templates() -> int:
	from .builder.seeds import seed_starter_templates as _seed

	return _seed()
