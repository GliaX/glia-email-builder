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


def grant_email_template_access() -> None:
	"""Let the dedicated role edit Email Templates.

	The role is empty unless an administrator assigns it, and it is the only
	way non-System-Manager communications staff can use the builder. The
	custom permission is limited to Email Template and excludes delete.
	"""
	if not frappe.db.exists("Role", ROLE):
		return
	if not frappe.db.exists("DocType", "Custom DocPerm"):
		return
	try:
		filters = {"parent": TEMPLATE_DOCTYPE, "role": ROLE, "permlevel": 0}
		name = frappe.db.get_value("Custom DocPerm", filters, "name")
		if name:
			doc = frappe.get_doc("Custom DocPerm", name)
		else:
			doc = frappe.new_doc("Custom DocPerm")
			doc.parent = TEMPLATE_DOCTYPE
			doc.role = ROLE
			doc.permlevel = 0
		doc.read = 1
		doc.write = 1
		doc.create = 1
		doc.email = 1
		doc.export = 1
		doc.print = 1
		doc.share = 1
		doc.report = 1
		doc.save(ignore_permissions=True)
		frappe.clear_cache(doctype=TEMPLATE_DOCTYPE)
	except Exception:
		frappe.log_error(title="Email Builder: could not grant Email Template access")


def seed_starter_templates() -> int:
	from .builder.seeds import seed_starter_templates as _seed

	return _seed()
