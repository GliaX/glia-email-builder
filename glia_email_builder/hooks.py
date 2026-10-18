from . import __version__ as app_version

app_name = "glia_email_builder"
app_title = "Glia Email Builder"
app_publisher = "Glia"
app_description = (
	"Block-based WYSIWYG email template builder for donor communications, "
	"modelled on EveryAction's drag-and-drop email editor."
)
app_email = "info@glia.org"
app_license = "AGPL-3.0-or-later"
app_version = app_version
app_icon = "mail"
app_color = "#00A89E"

# ---------------------------------------------------------------------------
# Desk integrations
# ---------------------------------------------------------------------------

# Add the block-builder launcher to the standard Email Template form and list.
doctype_js = {
	"Email Template": "public/js/email_template_form.js",
	"Email Builder Settings": "public/js/email_builder_settings.js",
}
doctype_list_js = {
	"Email Template": "public/js/email_template_list.js",
}

# Keep the builder's design record in step with the core Email Template.
doc_events = {
	"Email Template": {
		"validate": "glia_email_builder.integration.on_email_template_validate",
		"on_trash": "glia_email_builder.integration.on_email_template_trash",
		"after_rename": "glia_email_builder.integration.on_email_template_rename",
	},
	# Core Email Campaign calls sendmail() with only the Communication link, so
	# the queue has no reference DocType and Frappe cannot build a signed
	# unsubscribe URL. Copy the campaign reference onto the queue entry so the
	# builder's footer unsubscribe link works.
	"Email Queue": {
		"before_insert": "glia_email_builder.integration.set_campaign_unsubscribe_reference",
	},
}

# Responsive rules for the builder's .geb-* classes. Frappe renders the body
# inside templates/emails/standard.html, so these media queries must live in
# that wrapper's <head> (premailer keeps them) rather than only in the template
# body, where Gmail can ignore them.
email_css = ["/assets/glia_email_builder/css/email_builder_email.css"]

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

after_install = "glia_email_builder.install.after_install"
after_migrate = "glia_email_builder.install.after_migrate"
before_uninstall = "glia_email_builder.install.before_uninstall"

# ---------------------------------------------------------------------------
# Apps screen (Frappe v16+)
# ---------------------------------------------------------------------------

add_to_apps_screen = [
	{
		"name": "glia_email_builder",
		"logo": "/assets/glia_email_builder/images/glia-email-builder.svg",
		"title": "Email Builder",
		"route": "/desk/email-builder",
		"has_permission": "glia_email_builder.api.has_app_permission",
	}
]
