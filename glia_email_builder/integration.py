"""Keep Email Builder Design records in step with core Email Templates."""

from __future__ import annotations

import frappe

DESIGN_DOCTYPE = "Email Builder Design"


def on_email_template_trash(doc, method=None) -> None:
	if frappe.db.exists(DESIGN_DOCTYPE, doc.name):
		frappe.delete_doc(DESIGN_DOCTYPE, doc.name, ignore_permissions=True, force=True)


def on_email_template_rename(doc, method=None, old=None, new=None, merge=False) -> None:
	if not old or not new or old == new:
		return
	if not frappe.db.exists(DESIGN_DOCTYPE, old):
		return
	if merge:
		# The destination template already exists; its design (if any) wins.
		frappe.delete_doc(DESIGN_DOCTYPE, old, ignore_permissions=True, force=True)
		return
	try:
		frappe.rename_doc(DESIGN_DOCTYPE, old, new, force=True, ignore_permissions=True)
		frappe.db.set_value(DESIGN_DOCTYPE, new, "email_template", new, update_modified=False)
	except Exception:
		frappe.log_error(
			title="Email Builder: could not rename design",
			message=f"old={old} new={new}",
		)


def on_email_template_validate(doc, method=None) -> None:
	"""A template that has a block design must be sent as HTML."""
	if doc.is_new():
		return
	if frappe.db.exists(DESIGN_DOCTYPE, doc.name):
		if not doc.use_html:
			doc.use_html = 1


def set_campaign_unsubscribe_reference(doc, method=None) -> None:
	"""Give Email Campaign queue entries a reference so unsubscribe works.

	ERPNext's Email Campaign job calls ``frappe.sendmail(communication=...)``
	without reference_doctype/reference_name. At queue-build time Frappe needs a
	reference to sign the ``<!--unsubscribe_url-->`` placeholder used in the
	builder footer. The Communication already links to the campaign, so copy it.
	"""
	try:
		if doc.get("reference_doctype") or not doc.get("communication"):
			return
		if "<!--unsubscribe_url-->" not in (doc.get("message") or ""):
			return
		reference = frappe.db.get_value(
			"Communication",
			doc.communication,
			["reference_doctype", "reference_name"],
			as_dict=True,
		)
		if reference and reference.reference_doctype == "Email Campaign" and reference.reference_name:
			doc.reference_doctype = "Email Campaign"
			doc.reference_name = reference.reference_name
			if not doc.add_unsubscribe_link:
				doc.add_unsubscribe_link = 1
	except Exception:
		frappe.log_error(
			title="Email Builder: could not set campaign unsubscribe reference",
			message=frappe.get_traceback(),
		)
