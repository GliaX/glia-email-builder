"""Frappe controller for Email Builder Design."""

from __future__ import annotations

import json

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

from glia_email_builder.builder.compiler import (
	compile_design_for_template,
	get_app_settings,
)
from glia_email_builder.builder.render import to_email_fragment
from glia_email_builder.builder.schema import DesignError, coerce_design_json


class EmailBuilderDesign(Document):
	def validate(self):
		if not self.email_template:
			frappe.throw("Please select the Email Template this design belongs to.")
		if not frappe.db.exists("Email Template", self.email_template):
			frappe.throw(f"Email Template {frappe.bold(self.email_template)} does not exist.")

		try:
			design = coerce_design_json(self.design_json or {"rows": []})
		except DesignError as exc:
			frappe.throw(str(exc))

		self.design_json = json.dumps(design, ensure_ascii=False, separators=(",", ":"))
		template = frappe.get_doc("Email Template", self.email_template)
		app_settings = get_app_settings()
		reference_doctype = self.reference_doctype or app_settings.get("default_reference_doctype")
		if reference_doctype and not frappe.db.exists("DocType", reference_doctype):
			frappe.throw(f"Unknown Reference DocType: {reference_doctype}")

		try:
			compiled = compile_design_for_template(
				design,
				subject=template.subject or "",
				reference_doctype=reference_doctype,
				app_settings=app_settings,
			)
		except DesignError as exc:
			frappe.throw(str(exc))

		self.compiled_html = compiled["html"]
		self.plain_text = compiled["text"]
		self.block_count = compiled["block_count"]
		self.email_size = compiled["size"]
		self.compiled_on = now_datetime()
		self.builder_version = 1

	def on_update(self):
		"""Keep a directly-edited design in step with the Email Template.

		The builder API updates the Email Template explicitly; this covers the
		case where an administrator edits the design JSON in the Desk.
		"""
		if not (self.email_template and self.compiled_html):
			return
		try:
			if frappe.db.exists("Email Template", self.email_template):
				frappe.db.set_value(
					"Email Template",
					self.email_template,
					{"response_html": to_email_fragment(self.compiled_html), "use_html": 1},
					update_modified=False,
				)
		except Exception:
			frappe.log_error(
				title="Email Builder: could not sync design to template",
				message=frappe.get_traceback(),
			)
