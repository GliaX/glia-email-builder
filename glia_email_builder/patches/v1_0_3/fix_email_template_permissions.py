"""Restore standard Email Template permissions alongside the builder role.

Creating only an Email Builder User Custom DocPerm caused Frappe to ignore the
standard System Manager and Desk User rows, so System Managers lost read/create
access and the builder library appeared empty. This patch mirrors the standard
rows and keeps the builder role.
"""

from glia_email_builder.install import grant_email_template_access


def execute():
	grant_email_template_access()
