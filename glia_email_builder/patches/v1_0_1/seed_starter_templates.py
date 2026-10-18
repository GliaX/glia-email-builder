"""Seed starter templates when they are missing after an install.

On some fresh installs the app, role and Page were created but the install-time
seeder did not run (the site had zero designs and no starter templates). Running
the idempotent seeder once after the full schema is in place repairs those sites
and makes future installs reliable. Existing templates with the seed names are
never overwritten.
"""

from glia_email_builder.install import seed_starter_templates


def execute():
	seed_starter_templates()
