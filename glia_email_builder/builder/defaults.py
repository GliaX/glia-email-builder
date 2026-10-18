"""Shared constants and defaults for the Glia Email Builder.

This module intentionally has no Frappe imports so that the email rendering
core can be unit-tested without a bench.
"""

BUILDER_VERSION = 1

# EveryAction stops accepting messages above 150,000 characters. Gmail clips
# messages above ~102 KB, so we warn earlier than the hard limit.
MAX_EMAIL_HTML_BYTES = 150_000
GMAIL_CLIP_BYTES = 102_000

FONT_STACKS = {
	"Arial": "'Helvetica Neue', Helvetica, Arial, sans-serif",
	"Helvetica": "'Helvetica Neue', Helvetica, Arial, sans-serif",
	"Verdana": "Verdana, Geneva, sans-serif",
	"Tahoma": "Tahoma, Verdana, Segoe, sans-serif",
	"Trebuchet MS": "'Trebuchet MS', 'Lucida Grande', sans-serif",
	"Georgia": "Georgia, 'Times New Roman', serif",
	"Times New Roman": "'Times New Roman', Times, serif",
	"Courier New": "'Courier New', Courier, monospace",
}

FONT_CHOICES = list(FONT_STACKS.keys())

SOCIAL_NETWORKS = [
	{"key": "facebook", "label": "Facebook", "icon": "facebook.png"},
	{"key": "instagram", "label": "Instagram", "icon": "instagram.png"},
	{"key": "twitter", "label": "X / Twitter", "icon": "x.png"},
	{"key": "linkedin", "label": "LinkedIn", "icon": "linkedin.png"},
	{"key": "youtube", "label": "YouTube", "icon": "youtube.png"},
]

SOCIAL_ICON_BASE = "/assets/glia_email_builder/images/social"

BLOCK_TYPES = (
	"title",
	"paragraph",
	"list",
	"image",
	"button",
	"divider",
	"spacer",
	"social",
	"html",
	"video",
	"text",
)

# ---------------------------------------------------------------------------
# Application settings defaults
# ---------------------------------------------------------------------------

DEFAULT_SETTINGS = {
	"organization_name": "Glia",
	"organization_address": "Glia · info@glia.org · glia.org",
	"disclaimer": (
		"You are receiving this email because you support Glia's medical solidarity work."
	),
	"brand_primary_color": "#00A89E",
	"brand_dark_color": "#001F27",
	"brand_accent_color": "#005AB9",
	"default_font": "Arial",
	"default_link_color": "#005AB9",
	"default_button_color": "#00A89E",
	"default_button_text_color": "#FFFFFF",
	"donation_url": "https://glia.org/products/donate-glia-project",
	"website_url": "https://glia.org",
	"social_facebook": "https://www.facebook.com/glia.project",
	"social_instagram": "https://www.instagram.com/glia_intl",
	"social_twitter": "https://twitter.com/glia_intl",
	"social_linkedin": "https://www.linkedin.com/company/gliaorg",
	"social_youtube": "https://www.youtube.com/@glia_intl",
	"unsubscribe_text": "Unsubscribe",
	"default_reference_doctype": "Contact",
	"prompt_editor_on_new": 0,
}

# ---------------------------------------------------------------------------
# Merge fields
#
# expression: what gets inserted into the message. ``doc.<field>`` values are
# resolved by ERPNext's own Jinja renderer when the Email Campaign is sent.
# ``{{ Token }}`` values are resolved at compile time from the settings above.
# ---------------------------------------------------------------------------

DEFAULT_MERGE_FIELDS = [
	# Donor details -------------------------------------------------------
	{
		"group": "Donor details",
		"label": "First Name",
		"expression": "doc.first_name",
		"fallback": "Friend",
		"aliases": "First Name, FirstName, first_name, First",
		"sample_value": "Sarah",
	},
	{
		"group": "Donor details",
		"label": "Last Name",
		"expression": "doc.last_name",
		"fallback": "",
		"aliases": "Last Name, LastName, last_name, Last",
		"sample_value": "Chen",
	},
	{
		"group": "Donor details",
		"label": "Full Name",
		"expression": "doc.full_name",
		"fallback": "Friend",
		"aliases": "Full Name, FullName, full_name, Name",
		"sample_value": "Sarah Chen",
	},
	{
		"group": "Donor details",
		"label": "Salutation",
		"expression": "doc.salutation",
		"fallback": "",
		"aliases": "Salutation, salutation",
		"sample_value": "Ms.",
	},
	{
		"group": "Donor details",
		"label": "Email",
		"expression": "doc.email_id",
		"fallback": "",
		"aliases": "Email, EmailAddress, email, email_id",
		"sample_value": "sarah.chen@example.org",
	},
	{
		"group": "Donor details",
		"label": "Organization / Employer",
		"expression": "doc.company_name",
		"fallback": "",
		"aliases": "Organization, Organisation, Employer, EmployerName, company_name",
		"sample_value": "Northside Clinic",
	},
	{
		"group": "Donor details",
		"label": "Job Title",
		"expression": "doc.designation",
		"fallback": "",
		"aliases": "Job Title, Title, designation",
		"sample_value": "Program Director",
	},
	{
		"group": "Donor details",
		"label": "Phone",
		"expression": "doc.phone",
		"fallback": "",
		"aliases": "Phone, phone",
		"sample_value": "+1 555 010 1234",
	},
	{
		"group": "Donor details",
		"label": "Mobile",
		"expression": "doc.mobile_no",
		"fallback": "",
		"aliases": "Mobile, MobileNo, mobile_no",
		"sample_value": "+1 555 010 5678",
	},
	{
		"group": "Donor details",
		"label": "State / Province",
		"expression": "doc.state",
		"fallback": "",
		"aliases": "State, StateOrProvince, state, province",
		"sample_value": "CA",
	},
	{
		"group": "Donor details",
		"label": "Gender",
		"expression": "doc.gender",
		"fallback": "",
		"aliases": "Gender, gender",
		"sample_value": "Female",
	},
	{
		"group": "Donor details",
		"label": "Birthday",
		"expression": "doc.birth_date",
		"fallback": "",
		"aliases": "Birthday, BirthdayDate, birth_date",
		"sample_value": "June 2",
	},
	# Gift history --------------------------------------------------------
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Last Gift Amount",
		"expression": "doc.last_donation_amount",
		"fallback": "",
		"aliases": "LastGiftAmount, Last Donation Amount, last_donation_amount",
		"sample_value": "$50.00",
	},
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Total Given",
		"expression": "doc.total_donated",
		"fallback": "",
		"aliases": "TotalGiven, Total Donated, total_donated",
		"sample_value": "$1,250.00",
	},
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Last Gift Date",
		"expression": "doc.last_donation_date",
		"fallback": "",
		"aliases": "LastGiftDate, Last Donation Date, last_donation_date",
		"sample_value": "March 12, 2026",
	},
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Donor Since",
		"expression": "doc.donor_since",
		"fallback": "",
		"aliases": "DonorSince, donor_since",
		"sample_value": "2021",
	},
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Gift Count",
		"expression": "doc.donation_count",
		"fallback": "",
		"aliases": "GiftCount, DonationCount, donation_count",
		"sample_value": "7",
	},
	{
		"group": "Gift history (map to your donor fields)",
		"label": "Monthly Donor",
		"expression": "doc.is_recurring_donor",
		"fallback": "",
		"aliases": "MonthlyDonor, RecurringDonor, is_recurring_donor",
		"sample_value": "Yes",
	},
	# Organization --------------------------------------------------------
	{
		"group": "Organization",
		"label": "Organization Name",
		"expression": "{{ OrganizationName }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "Glia",
	},
	{
		"group": "Organization",
		"label": "Organization Address",
		"expression": "{{ OrganizationAddress }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "Glia · info@glia.org · glia.org",
	},
	{
		"group": "Organization",
		"label": "Disclaimer",
		"expression": "{{ Disclaimer }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "You are receiving this email because you support Glia.",
	},
	{
		"group": "Organization",
		"label": "Unsubscribe Link",
		"expression": "{{ UnsubscribeLink }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "Unsubscribe",
	},
	{
		"group": "Organization",
		"label": "Unsubscribe URL",
		"expression": "{{ UnsubscribeURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "#",
	},
	# Links ---------------------------------------------------------------
	{
		"group": "Links",
		"label": "Donate URL",
		"expression": "{{ DonateURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://glia.org/products/donate-glia-project",
	},
	{
		"group": "Links",
		"label": "Website URL",
		"expression": "{{ WebsiteURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://glia.org",
	},
	{
		"group": "Links",
		"label": "Facebook URL",
		"expression": "{{ FacebookURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://www.facebook.com/glia.project",
	},
	{
		"group": "Links",
		"label": "Instagram URL",
		"expression": "{{ InstagramURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://www.instagram.com/glia_intl",
	},
	{
		"group": "Links",
		"label": "X / Twitter URL",
		"expression": "{{ TwitterURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://twitter.com/glia_intl",
	},
	{
		"group": "Links",
		"label": "LinkedIn URL",
		"expression": "{{ LinkedInURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://www.linkedin.com/company/gliaorg",
	},
	{
		"group": "Links",
		"label": "YouTube URL",
		"expression": "{{ YouTubeURL }}",
		"fallback": "",
		"aliases": "",
		"sample_value": "https://www.youtube.com/@glia_intl",
	},
]

# Tokens resolved at compile time from Email Builder Settings. The key is the
# casefolded, whitespace-stripped token name.
GLOBAL_TOKEN_SETTINGS = {
	"organizationname": "organization_name",
	"organizationaddress": "organization_address",
	"disclaimer": "disclaimer",
	"donateurl": "donation_url",
	"websiteurl": "website_url",
	"facebookurl": "social_facebook",
	"instagramurl": "social_instagram",
	"twitterurl": "social_twitter",
	"linkedinurl": "social_linkedin",
	"youtubeurl": "social_youtube",
}

# ---------------------------------------------------------------------------
# Design defaults
# ---------------------------------------------------------------------------

DEFAULT_DESIGN_SETTINGS = {
	"width": 600,
	"align": "center",
	"background_color": "#F3F6F5",
	"content_background": "#FFFFFF",
	"font_family": "",
	"font_size": 16,
	"text_color": "#1D2B2F",
	"link_color": "",
	"button_color": "",
	"button_text_color": "",
	"preheader": "",
	"email_title": "",
	"subject_template": "",
	"border_radius": 0,
}

DEFAULT_BLOCK_STYLES = {
	"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0},
	"background_color": "",
	"hide_mobile": False,
	"hide_desktop": False,
	"locked": False,
}

DEFAULT_ROW_STYLES = {
	"background_color": "",
	"background_image": "",
	"padding": {"top": 10, "right": 20, "bottom": 10, "left": 20},
	"columns_gap": 20,
	"vertical_align": "top",
	"border_radius": 0,
	"hide_mobile": False,
	"hide_desktop": False,
	"reverse_stack": False,
	"no_stack": False,
	"locked": False,
}

TEMPLATE_CATEGORIES = [
	"Newsletter",
	"Appeal",
	"Thank You",
	"Invitation",
	"Announcement",
	"Letter",
	"Recurring Giving",
	"Blank",
	"Custom",
]
