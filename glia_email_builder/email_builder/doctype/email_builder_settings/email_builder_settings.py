"""Frappe controller for Email Builder Settings."""

from __future__ import annotations

import frappe
from frappe.model.document import Document


class EmailBuilderSettings(Document):
	def validate(self):
		# Keep the child table tidy: expressions are required by the API.
		for row in self.get("merge_fields") or []:
			row.label = (row.label or "").strip()
			row.expression = (row.expression or "").strip()
			if row.expression and not row.label:
				row.label = row.expression
		if self.sample_values_json:
			try:
				frappe.parse_json(self.sample_values_json)
			except Exception:
				frappe.throw("Sample Preview Values must be valid JSON.")

	def on_update(self):
		frappe.clear_cache(doctype="Email Builder Settings")
