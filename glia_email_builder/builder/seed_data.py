"""Pre-loaded donor email templates.

Every template is expressed with the same block schema the builder edits, so
staff can open a starter, change the copy, rearrange blocks and save it without
touching HTML. The sample impact language is deliberately non-numeric where a
claim would need verification; replace the calls to action and links with the
campaign of the moment.
"""

from __future__ import annotations

from .defaults import DEFAULT_DESIGN_SETTINGS
from .schema import new_block, new_row

ASSET = "/assets/glia_email_builder/images"
TEAL = "#00A89E"
DARK = "#001F27"
INK = "#1D2B2F"
MUTED = "#4A5C62"
LIGHT = "#F3F6F5"
MINT = "#E6F5F3"
BORDER = "#DDE5E3"
WHITE = "#FFFFFF"

ZERO = {"top": 0, "right": 0, "bottom": 0, "left": 0}
PAD = {"top": 24, "right": 32, "bottom": 24, "left": 32}
PAD_SM = {"top": 16, "right": 24, "bottom": 16, "left": 24}
PAD_CTA = {"top": 32, "right": 32, "bottom": 32, "left": 32}

BASE_SETTINGS = {
	**DEFAULT_DESIGN_SETTINGS,
	"width": 600,
	"align": "center",
	"background_color": LIGHT,
	"content_background": WHITE,
	"text_color": INK,
	"link_color": "#005AB9",
	"button_color": TEAL,
	"button_text_color": WHITE,
	"font_family": "",
	"font_size": 16,
	"border_radius": 0,
}


# ---------------------------------------------------------------------------
# Block helpers
# ---------------------------------------------------------------------------


def title(
	text: str,
	*,
	level: int = 2,
	size: int = 24,
	color: str = DARK,
	align: str = "left",
	line_height: float = 1.25,
	padding: dict | None = None,
) -> dict:
	return new_block(
		"title",
		content={"text": text, "level": level},
		styles={
			"font_size": size,
			"color": color,
			"align": align,
			"line_height": line_height,
			"padding": padding or ZERO,
		},
	)


def paragraph(
	html: str,
	*,
	size: int = 16,
	color: str = INK,
	align: str = "left",
	line_height: float = 1.6,
	spacing: int = 12,
	padding: dict | None = None,
) -> dict:
	return new_block(
		"paragraph",
		content={"html": html},
		styles={
			"font_size": size,
			"color": color,
			"align": align,
			"line_height": line_height,
			"paragraph_spacing": spacing,
			"padding": padding or ZERO,
		},
	)


def text(
	html: str,
	*,
	size: int = 16,
	color: str = INK,
	align: str = "left",
	line_height: float = 1.5,
	padding: dict | None = None,
) -> dict:
	return new_block(
		"text",
		content={"html": html},
		styles={
			"font_size": size,
			"color": color,
			"align": align,
			"line_height": line_height,
			"padding": padding or ZERO,
		},
	)


def image(
	src: str,
	alt: str,
	*,
	link: str = "",
	width: int = 100,
	align: str = "center",
	radius: int = 0,
	padding: dict | None = None,
) -> dict:
	return new_block(
		"image",
		content={
			"src": src,
			"alt": alt,
			"link": link,
			"width": width,
			"align": align,
			"border_radius": radius,
		},
		styles={"padding": padding or ZERO},
	)


def button(
	text_value: str,
	link: str = "{{ DonateURL }}",
	*,
	background: str = TEAL,
	text_color: str = WHITE,
	align: str = "center",
	full_width: bool = False,
	radius: int = 8,
	size: int = 16,
) -> dict:
	return new_block(
		"button",
		content={"text": text_value, "link": link, "align": align, "full_width": full_width},
		styles={
			"background_color": background,
			"text_color": text_color,
			"border_radius": radius,
			"font_size": size,
			"bold": True,
			"padding": {"top": 6, "right": 0, "bottom": 6, "left": 0},
		},
	)


def divider(*, color: str = BORDER, padding: dict | None = None) -> dict:
	return new_block(
		"divider",
		content={"width": 100, "thickness": 1, "color": color, "align": "center"},
		styles={"padding": padding or {"top": 20, "right": 0, "bottom": 20, "left": 0}},
	)


def spacer(height: int = 20) -> dict:
	return new_block("spacer", content={"height": height}, styles={"padding": ZERO})


def social(*, size: int = 22, padding: dict | None = None) -> dict:
	return new_block(
		"social",
		content={
			"networks": [
				{"key": "facebook", "url": ""},
				{"key": "instagram", "url": ""},
				{"key": "twitter", "url": ""},
				{"key": "linkedin", "url": ""},
				{"key": "youtube", "url": ""},
			],
			"icon_size": size,
			"spacing": 14,
			"align": "center",
		},
		styles={"padding": padding or {"top": 8, "right": 0, "bottom": 8, "left": 0}},
	)


def list_block(items: list[str], *, size: int = 16) -> dict:
	body = "".join(f"<li>{item}</li>" for item in items)
	return new_block(
		"list",
		content={"html": f"<ul>{body}</ul>", "list_style": "disc", "list_start": 1},
		styles={"font_size": size, "color": INK, "line_height": 1.7, "padding": ZERO},
	)


def quote(html: str) -> dict:
	return paragraph(
		'<blockquote style="margin:0;padding:2px 0 2px 18px;border-left:4px solid '
		+ TEAL
		+ ';font-style:italic;">'
		+ html
		+ "</blockquote>",
		size=19,
		color=DARK,
		line_height=1.5,
	)


def link_paragraph(label: str, href: str, *, align: str = "left") -> dict:
	return paragraph(
		f'<p><a href="{href}" style="color:#005AB9;font-weight:bold;">{label} →</a></p>',
		align=align,
	)


# ---------------------------------------------------------------------------
# Row helpers
# ---------------------------------------------------------------------------


def row(
	columns: list,
	*,
	padding: dict | None = None,
	background: str = "",
	gap: int = 20,
	reverse: bool = False,
	condition: dict | None = None,
	vertical: str = "top",
) -> dict:
	# Allow both row(block, block, ...) for a single column and
	# row([block, block], [block]) for multiple columns.
	if columns and all(isinstance(item, dict) and item.get("type") for item in columns):
		columns = [columns]

	col_defs = []
	count = len(columns)
	for column in columns:
		if isinstance(column, dict) and "blocks" in column:
			blocks = column.get("blocks") or []
			width = column.get("width") or (100 / count)
		elif isinstance(column, list):
			blocks = column
			width = 100 / count
		else:
			blocks = [column]
			width = 100 / count
		col_defs.append({"width": width, "blocks": blocks})
	return new_row(
		count,
		styles={
			"padding": padding or PAD,
			"background_color": background,
			"columns_gap": gap,
			"reverse_stack": reverse,
			"vertical_align": vertical,
		},
		columns=col_defs,
		condition=condition
		or {"enabled": False, "field": "", "operator": "equals", "value": "", "expression": ""},
	)


def header() -> dict:
	return row(
		[
			image(
				f"{ASSET}/glia-logo-white.png",
				"Glia — equal care",
				link="{{ WebsiteURL }}",
				width=20,
				align="center",
			)
		],
		padding={"top": 18, "right": 24, "bottom": 18, "left": 24},
		background=DARK,
	)


def footer() -> list[dict]:
	return [
		row(
			[social()],
			padding={"top": 18, "right": 32, "bottom": 4, "left": 32},
			background=LIGHT,
		),
		row(
			[
				text(
					'<p style="margin:0 0 8px;"><strong style="color:#001F27;">{{ OrganizationName }}</strong></p>'
					'<p style="margin:0 0 8px;">{{ OrganizationAddress }}</p>'
					'<p style="margin:0 0 10px;">{{ Disclaimer }}</p>'
					'<p style="margin:0;">{{ UnsubscribeLink }}</p>',
					size=12,
					color=MUTED,
					align="center",
					line_height=1.7,
				)
			],
			padding={"top": 4, "right": 32, "bottom": 24, "left": 32},
			background=LIGHT,
		),
	]


def cta(
	heading: str = "Keep care moving",
	body: str = "Your gift helps equip health workers with the tools and training they need.",
	button_text: str = "Donate today",
	*,
	link: str = "{{ DonateURL }}",
	note: str = "Monthly gifts give Glia steady, reliable support.",
) -> dict:
	blocks = [
		title(heading, size=26, align="center", color=DARK),
		paragraph(
			f'<p style="text-align:center;">{body}</p>',
			align="center",
			color=MUTED,
			size=16,
		),
		button(button_text, link),
		paragraph(
			f'<p style="text-align:center;font-size:13px;color:#4A5C62;">{note}</p>',
			align="center",
			size=13,
			color=MUTED,
			spacing=0,
		),
	]
	return row(blocks, padding=PAD_CTA, background=MINT)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------


def newsletter_impact() -> dict:
	return {
		"name": "Newsletter - Impact Update",
		"category": "Newsletter",
		"description": "A warm donor newsletter with a hero image, two field stories and a donation call to action.",
		"subject": "{{ FirstName }}, care that reaches the last mile",
		"preheader": "Stories from the field, a device update, and a way to keep care moving.",
		"settings": {**BASE_SETTINGS, "email_title": "Newsletter - Impact Update"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/story-workshop.jpg",
						"A Glia team member teaching students to assemble open-source medical tools.",
						link="{{ WebsiteURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("Care that reaches the last mile", level=1, size=34, line_height=1.2),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>Every day, health workers in Gaza are finding ways to keep care going under "
						"extraordinary conditions. Your support is part of that story.</p>"
						"<p>This month we are sharing two glimpses of what your generosity makes possible: "
						"tools that can be built and repaired locally, and training that passes skills from "
						"one pair of hands to the next.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 8, "left": 32},
			),
			row([divider()], padding={"top": 0, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					image(
						f"{ASSET}/device-stethoscope.jpg",
						"The Glia stethoscope compared with a conventional stethoscope",
						link="{{ WebsiteURL }}",
					),
					[
						title("A stethoscope designed to travel light", size=22),
						paragraph(
							"<p>Our open-source stethoscope is built to perform like the gold standard — "
							"while being easier to make, repair and share.</p>"
							"<p>When a tool can be manufactured locally, a broken part is not the end of "
							"the story. It is a repair, a lesson, and another day of care.</p>"
						),
						link_paragraph("Read the story", "{{ WebsiteURL }}"),
					],
				],
				padding={"top": 20, "right": 32, "bottom": 20, "left": 32},
				gap=24,
			),
			row(
				[
					[
						title("Training the next generation", size=22),
						paragraph(
							"<p>Skills are the most portable medical technology of all. In workshops and "
							"classrooms, students learn to assemble, troubleshoot and teach others.</p>"
							"<p>Your support keeps that chain of knowledge growing.</p>"
						),
						link_paragraph("See how we train", "{{ WebsiteURL }}"),
					],
					image(
						f"{ASSET}/story-workshop.jpg",
						"Students learning to assemble open-source medical equipment",
						link="{{ WebsiteURL }}",
					),
				],
				padding={"top": 4, "right": 32, "bottom": 20, "left": 32},
				gap=24,
				reverse=True,
			),
			row(
				[
					[
						title("Care", size=15, align="center", color=TEAL),
						paragraph(
							'<p style="text-align:center;">Practical support for frontline health workers and the people they serve.</p>',
							size=13,
							color=MUTED,
							align="center",
							spacing=0,
						),
					],
					[
						title("Tools", size=15, align="center", color=TEAL),
						paragraph(
							'<p style="text-align:center;">Open-source devices that can be made and repaired close to where they are needed.</p>',
							size=13,
							color=MUTED,
							align="center",
							spacing=0,
						),
					],
					[
						title("Knowledge", size=15, align="center", color=TEAL),
						paragraph(
							'<p style="text-align:center;">Training and shared designs that outlast any single shipment.</p>',
							size=13,
							color=MUTED,
							align="center",
							spacing=0,
						),
					],
				],
				padding={"top": 24, "right": 24, "bottom": 24, "left": 24},
				background=LIGHT,
				gap=16,
			),
			cta(
				"Keep this work going",
				"Your gift helps Glia respond to urgent needs while building care that lasts.",
			),
			*footer(),
		],
	}


def newsletter_two_column() -> dict:
	return {
		"name": "Newsletter - Two Column",
		"category": "Newsletter",
		"description": "A compact two-column newsletter layout for short updates and links.",
		"subject": "News from Glia: tools, training and the people behind them",
		"preheader": "A short update on the work you make possible.",
		"settings": {**BASE_SETTINGS, "email_title": "Newsletter - Two Column"},
		"rows": [
			header(),
			row(
				[
					title("News from Glia", level=1, size=32),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>Here is a short update on the work your support makes possible — and a few "
						"ways to stay connected.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					[
						image(
							f"{ASSET}/device-stethoscope.jpg",
							"The Glia stethoscope",
							link="{{ WebsiteURL }}",
						),
						title("Built to be repaired", size=20),
						paragraph(
							"<p>Open-source design means a local workshop can keep a device in service "
							"instead of waiting for a replacement.</p>",
							spacing=6,
						),
						link_paragraph("Learn more", "{{ WebsiteURL }}"),
					],
					[
						image(
							f"{ASSET}/story-workshop.jpg",
							"Students learning medical device assembly",
							link="{{ WebsiteURL }}",
						),
						title("Skills that stay", size=20),
						paragraph(
							"<p>Workshops give students and health workers the confidence to build, "
							"maintain and teach.</p>",
							spacing=6,
						),
						link_paragraph("Meet the learners", "{{ WebsiteURL }}"),
					],
				],
				padding={"top": 12, "right": 32, "bottom": 20, "left": 32},
				gap=24,
			),
			row([divider()], padding={"top": 0, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					title("Three things you can do today", size=20),
					list_block(
						[
							"Forward this email to someone who should know about Glia.",
							'<a href="{{ DonateURL }}">Make a one-time or monthly gift.</a>',
							'<a href="{{ WebsiteURL }}">Explore our open-source designs.</a>',
						]
					),
				],
				padding={"top": 8, "right": 32, "bottom": 16, "left": 32},
			),
			cta(
				"Stay close to the work",
				"Your support keeps the tools, training and partnerships moving.",
				"Donate today",
				note="You can also reply to this email — a real person will read it.",
			),
			*footer(),
		],
	}


def newsletter_impact_report() -> dict:
	return {
		"name": "Newsletter - Impact Report",
		"category": "Newsletter",
		"description": "An editorial impact-report layout with three programme pillars, a quote and a report link.",
		"subject": "Your impact: a year of care, tools and shared knowledge",
		"preheader": "A look back at what your support made possible — and what comes next.",
		"settings": {**BASE_SETTINGS, "email_title": "Newsletter - Impact Report"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/impact-report.jpg",
						"An illustration representing Glia's year-end impact report",
						link="{{ WebsiteURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("Your year in care", level=1, size=34),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>When we look back at this year, we do not see a single moment of impact. "
						"We see a chain of people, skills and tools — each one made possible by supporters "
						"like you.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 8, "left": 32},
			),
			row(
				[
					[
						title("Care in Gaza", size=18, color=TEAL),
						paragraph(
							"<p>Support for frontline health workers responding to urgent medical needs "
							"and strengthening care for the future.</p>",
							size=14,
							color=MUTED,
						),
					],
					[
						title("Local manufacturing", size=18, color=TEAL),
						paragraph(
							"<p>Open-source devices designed so that local teams can produce, repair and "
							"maintain them.</p>",
							size=14,
							color=MUTED,
						),
					],
					[
						title("Shared knowledge", size=18, color=TEAL),
						paragraph(
							"<p>Workshops, designs and training that turn one investment into many.</p>",
							size=14,
							color=MUTED,
						),
					],
				],
				padding={"top": 24, "right": 24, "bottom": 24, "left": 24},
				background=LIGHT,
				gap=18,
			),
			row(
				[
					quote(
						"Care that is built locally is care that lasts. Your support helps make that "
						"idea real, one device and one workshop at a time."
					)
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					paragraph(
						"<p>Our full report is being prepared now. In the meantime, the stories on our "
						"site show the people behind these numbers.</p>"
					),
					button("Read the stories", "{{ WebsiteURL }}"),
				],
				padding={"top": 4, "right": 32, "bottom": 12, "left": 32},
			),
			cta(
				"Build the next chapter",
				"Your year-end gift helps us plan care that continues beyond the headlines.",
			),
			*footer(),
		],
	}


def appeal_year_end() -> dict:
	return {
		"name": "Appeal - Year End",
		"category": "Appeal",
		"description": "A year-end fundraising appeal with a hero, year-in-care story, matching-gift note and donate CTA.",
		"subject": "{{ FirstName }}, a year of care made possible by you",
		"preheader": "Make a year-end gift to keep care moving into the new year.",
		"settings": {**BASE_SETTINGS, "email_title": "Appeal - Year End"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/impact-report.jpg",
						"An illustration of Glia's impact report",
						link="{{ DonateURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("A year of care, made possible by you", level=1, size=34, line_height=1.2),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>This year, health workers kept showing up for their patients — through "
						"shortages, uncertainty and extraordinary pressure.</p>"
						"<p>Glia kept showing up with them. And you made that possible.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					title("Your year-end gift", size=24, color=WHITE),
					paragraph(
						"<p style=\"color:#D8E6E3;\">Help us enter the new year ready to respond: with "
						"medical tools, practical supplies, local manufacturing and training.</p>",
						color="#D8E6E3",
						size=16,
					),
					button("Make a year-end gift", "{{ DonateURL }}"),
				],
				padding={"top": 28, "right": 32, "bottom": 28, "left": 32},
				background=DARK,
			),
			row(
				[
					title("What your support makes possible", size=20),
					list_block(
						[
							"Open-source medical devices that can be made and repaired locally.",
							"Training and workshops for health workers, students and makers.",
							"Practical support for frontline teams responding to urgent needs.",
							"Shared designs that let one breakthrough reach many communities.",
						]
					),
				],
				padding={"top": 24, "right": 32, "bottom": 16, "left": 32},
			),
			row(
				[
					quote(
						"Equip a team today, and the skills and tools stay in the community long after "
						"the shipment arrives."
					)
				],
				padding={"top": 8, "right": 32, "bottom": 20, "left": 32},
			),
			row(
				[
					paragraph(
						"<p><strong>Did you know?</strong> Many employers match charitable gifts. "
						"If yours does, your year-end support could go twice as far — just ask your HR "
						"team for the matching form.</p>",
						size=14,
						color=MUTED,
					)
				],
				padding={"top": 0, "right": 32, "bottom": 16, "left": 32},
			),
			cta(
				"Care cannot wait for the calendar to turn",
				"Please make your year-end gift today.",
				"Donate today",
			),
			*footer(),
		],
	}


def appeal_urgent() -> dict:
	return {
		"name": "Appeal - Urgent Gaza",
		"category": "Appeal",
		"description": "A short, urgent fundraising appeal for frontline medical support in Gaza.",
		"subject": "Help keep care moving in Gaza",
		"preheader": "Frontline teams need supplies, tools and support now.",
		"settings": {**BASE_SETTINGS, "email_title": "Appeal - Urgent Gaza"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/hero-gaza.jpg",
						"A surgical team caring for a patient",
						link="{{ DonateURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("Care cannot wait", level=1, size=36, color=DARK),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>In Gaza, health workers are treating patients in conditions no one should "
						"have to work in. They are improvising, repairing and sharing whatever they can.</p>"
						"<p>Your gift today helps Glia stand with them — with medical tools, practical "
						"supplies, local manufacturing and training that keeps care going.</p>",
						line_height=1.65,
					),
					button("Donate now", "{{ DonateURL }}"),
				],
				padding={"top": 28, "right": 32, "bottom": 24, "left": 32},
			),
			row([divider()], padding={"top": 0, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					title("Your gift helps provide", size=20),
					list_block(
						[
							"Open-source devices that can be produced and repaired locally.",
							"Training for health workers and local makers.",
							"Practical support for frontline care teams.",
							"A network that shares designs and lessons across communities.",
						]
					),
				],
				padding={"top": 8, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					paragraph(
						"<p>Monthly gifts are especially valuable in an emergency: they let us plan, "
						"respond and keep our promises.</p>",
						size=14,
						color=MUTED,
					)
				],
				padding={"top": 0, "right": 32, "bottom": 8, "left": 32},
			),
			cta(
				"Stand with frontline care",
				"Every gift, at every size, helps a health worker keep going.",
				"Give today",
				note="Thank you for showing up when it matters.",
			),
			*footer(),
		],
	}


def thank_you() -> dict:
	return {
		"name": "Thank You - Donation",
		"category": "Thank You",
		"description": "A warm thank-you for a donation, with an impact overview and a share-the-work section.",
		"subject": "Thank you, {{ FirstName }}",
		"preheader": "Your generosity is already at work.",
		"settings": {**BASE_SETTINGS, "email_title": "Thank You - Donation"},
		"rows": [
			header(),
			row(
				[
					title("Thank you, {{ FirstName }}", level=1, size=34, color=DARK),
					paragraph(
						"<p>Your generosity means a health worker has one more tool, one more option, "
						"one more reason to keep going.</p>"
						"<p>Thank you for choosing to stand with care.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					image(
						f"{ASSET}/story-workshop.jpg",
						"Students and a Glia team member assembling medical devices",
						link="{{ WebsiteURL }}",
					)
				],
				padding={"top": 0, "right": 32, "bottom": 20, "left": 32},
			),
			row(
				[
					title("Your gift at work", size=20),
					list_block(
						[
							"Supporting health workers with practical, locally appropriate tools.",
							"Keeping open-source designs free for anyone to use and improve.",
							"Funding workshops where skills are shared and multiplied.",
						]
					),
				],
				padding={"top": 4, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					title("Share the work", size=20, align="center"),
					paragraph(
						'<p style="text-align:center;">If this work matters to you, invite someone else '
						"into it. Share Glia's story or forward this email.</p>",
						align="center",
						color=MUTED,
					),
					social(),
				],
				padding={"top": 24, "right": 32, "bottom": 24, "left": 32},
				background=LIGHT,
			),
			cta(
				"Make it a monthly habit",
				"Monthly gifts give Glia steady support to plan care and keep promises.",
				"Give monthly",
				note="Questions about your gift? Just reply to this email.",
			),
			*footer(),
		],
	}


def invitation() -> dict:
	return {
		"name": "Invitation - Event",
		"category": "Invitation",
		"description": "An event invitation with image, date/venue columns, RSVP and an agenda.",
		"subject": "You're invited: An evening with Glia",
		"preheader": "Join us online on 12 November to hear what your support makes possible.",
		"settings": {**BASE_SETTINGS, "email_title": "Invitation - Event"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/story-workshop.jpg",
						"Glia team members and students at a workshop",
						link="{{ WebsiteURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("An evening with Glia", level=1, size=34),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>You are invited to an evening of stories, questions and conversation about "
						"care, open-source medical tools and the people who make them possible.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					[
						title("When", size=15, color=TEAL),
						paragraph("<p>Thursday, 12 November<br />7:00 PM – 8:15 PM</p>", size=15),
					],
					[
						title("Where", size=15, color=TEAL),
						paragraph("<p>Online<br />A link will be sent with your RSVP</p>", size=15),
					],
				],
				padding={"top": 16, "right": 24, "bottom": 16, "left": 24},
				background=LIGHT,
				gap=24,
			),
			row(
				[
					button("RSVP today", "{{ WebsiteURL }}"),
					paragraph(
						'<p style="text-align:center;font-size:13px;color:#4A5C62;">Free to attend · '
						"Bring a friend</p>",
						align="center",
						size=13,
						color=MUTED,
						spacing=0,
					),
				],
				padding={"top": 20, "right": 32, "bottom": 8, "left": 32},
			),
			row([divider()], padding={"top": 8, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					title("What to expect", size=20),
					list_block(
						[
							"A short film from a recent Glia workshop.",
							"Stories from the health workers and makers behind the tools.",
							"Time for your questions — and a chance to meet other supporters.",
						]
					),
				],
				padding={"top": 8, "right": 32, "bottom": 20, "left": 32},
			),
			cta(
				"Bring a friend",
				"Forward this invitation to someone who would enjoy the evening.",
				"RSVP today",
				link="{{ WebsiteURL }}",
				note="Can't make it? The recording will be shared with supporters.",
			),
			*footer(),
		],
	}


def announcement() -> dict:
	return {
		"name": "Announcement - New Device",
		"category": "Announcement",
		"description": "A product/device announcement with a feature grid and a link to the device page.",
		"subject": "A closer look at the Glia Otoscope",
		"preheader": "A tool designed to be made, repaired and shared locally.",
		"settings": {**BASE_SETTINGS, "email_title": "Announcement - New Device"},
		"rows": [
			header(),
			row(
				[
					image(
						f"{ASSET}/device-otoscope.jpg",
						"The Glia open-source otoscope",
						link="{{ WebsiteURL }}",
					)
				],
				padding=ZERO,
			),
			row(
				[
					title("A closer look at the Glia Otoscope", level=1, size=32),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>Good tools should not be a luxury. The Glia Otoscope is an open-source "
						"design that can be produced with accessible materials and repaired locally.</p>"
						"<p>Here is what makes it different.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					[
						title("Made for local production", size=17, color=TEAL),
						paragraph(
							"<p>Designed around accessible parts and local manufacturing.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
					[
						title("Open source by default", size=17, color=TEAL),
						paragraph(
							"<p>Designs and knowledge are shared so anyone can build, adapt and improve.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
					[
						title("Built for bedside care", size=17, color=TEAL),
						paragraph(
							"<p>Developed with clinicians for the realities of low-resource settings.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
				],
				padding={"top": 20, "right": 24, "bottom": 20, "left": 24},
				background=LIGHT,
				gap=16,
			),
			row(
				[
					paragraph(
						"<p><strong>Open source is a promise.</strong> When a tool can be understood, "
						"repaired and rebuilt by the people who use it, it becomes more than equipment. "
						"It becomes local capacity.</p>"
					),
					button("Explore our devices", "{{ WebsiteURL }}"),
				],
				padding={"top": 24, "right": 32, "bottom": 16, "left": 32},
			),
			cta(
				"Help more tools reach more hands",
				"Your support funds design, workshops and the path from prototype to patient.",
			),
			*footer(),
		],
	}


def letter() -> dict:
	return {
		"name": "Letter - From the Field",
		"category": "Letter",
		"description": "A personal, letter-style update with a serif typeface, photo and donation link.",
		"subject": "A letter from the field",
		"preheader": "A note of thanks from all of us at Glia.",
		"settings": {**BASE_SETTINGS, "email_title": "Letter - From the Field", "font_family": "Georgia"},
		"rows": [
			header(),
			row(
				[
					title("A letter from the field", level=1, size=32, color=DARK),
					paragraph("<p>Dear {{ FirstName }},</p>"),
					paragraph(
						"<p>There is a moment in every workshop when the room goes quiet. "
						"Someone has just assembled a device on their own for the first time. "
						"Then the questions start — and the teaching begins.</p>"
					),
					paragraph(
						"<p>That moment is why we do this work. Not because a tool arrives, but "
						"because a person now knows how to make it, fix it and show someone else.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					image(
						f"{ASSET}/story-workshop.jpg",
						"Students learning to assemble open-source medical tools",
						link="{{ WebsiteURL }}",
					)
				],
				padding={"top": 0, "right": 32, "bottom": 20, "left": 32},
			),
			row(
				[
					paragraph(
						"<p>Your support is what makes those quiet moments possible. It buys the "
						"materials, creates the space and gives our team the time to show up — again "
						"and again.</p>"
					),
					paragraph(
						"<p>From all of us at Glia: thank you for believing that care should be "
						"built with communities, not just delivered to them.</p>"
					),
					paragraph(
						"<p>With gratitude,<br /><strong>The Glia team</strong></p>",
						spacing=0,
					),
				],
				padding={"top": 0, "right": 32, "bottom": 20, "left": 32},
			),
			row([divider()], padding={"top": 0, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					button("Support care that lasts", "{{ DonateURL }}"),
				],
				padding={"top": 20, "right": 32, "bottom": 20, "left": 32},
			),
			*footer(),
		],
	}


def recurring() -> dict:
	return {
		"name": "Recurring Giving - Monthly Donor",
		"category": "Recurring Giving",
		"description": "A monthly-giving ask with benefits, a conditional thank-you for existing monthly donors and FAQs.",
		"subject": "{{ FirstName }}, become a monthly lifeline",
		"preheader": "Steady support keeps care steady. Join our monthly donors.",
		"settings": {**BASE_SETTINGS, "email_title": "Recurring Giving - Monthly Donor"},
		"rows": [
			header(),
			row(
				[
					title("Steady support, lasting care", level=1, size=34),
					paragraph(
						"<p>Dear {{ FirstName }},</p>"
						"<p>Medical care does not arrive in a single moment. It is built through "
						"consistent training, maintenance and trust.</p>"
						"<p>Monthly giving is how many supporters help us plan for the long term.</p>"
					),
				],
				padding={"top": 28, "right": 32, "bottom": 12, "left": 32},
			),
			row(
				[
					image(
						f"{ASSET}/story-stethoscope.jpg",
						"A Glia stethoscope",
						link="{{ WebsiteURL }}",
						width=52,
					)
				],
				padding={"top": 0, "right": 32, "bottom": 20, "left": 32},
			),
			row(
				[
					[
						title("Predictable", size=17, color=TEAL),
						paragraph(
							"<p>Regular support lets us plan workshops and production runs.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
					[
						title("Efficient", size=17, color=TEAL),
						paragraph(
							"<p>Fewer appeals, less administration, more resources to the work.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
					[
						title("Powerful", size=17, color=TEAL),
						paragraph(
							"<p>A steady base of support lets us say yes when a community asks.</p>",
							size=14,
							color=MUTED,
							spacing=0,
						),
					],
				],
				padding={"top": 20, "right": 24, "bottom": 20, "left": 24},
				background=LIGHT,
				gap=16,
			),
			row(
				[
					title("Thank you for showing up every month", size=22),
					paragraph(
						"<p>As a monthly donor, you are already part of the steady foundation this "
						"work depends on. Thank you — and please reply if you ever want to talk about "
						"where your gift goes.</p>"
					),
				],
				padding={"top": 22, "right": 32, "bottom": 22, "left": 32},
				condition={
					"enabled": True,
					"field": "doc.is_recurring_donor",
					"operator": "equals",
					"value": "1",
					"expression": "",
				},
			),
			row(
				[
					title("Make a monthly commitment", size=22),
					paragraph(
						"<p>Become a monthly donor and give Glia the confidence to plan, train and "
						"build for the long term. You can change or pause your gift at any time.</p>"
					),
					button("Give monthly", "{{ DonateURL }}"),
				],
				padding={"top": 22, "right": 32, "bottom": 22, "left": 32},
				condition={
					"enabled": True,
					"field": "doc.is_recurring_donor",
					"operator": "not_equals",
					"value": "1",
					"expression": "",
				},
			),
			row([divider()], padding={"top": 0, "right": 32, "bottom": 0, "left": 32}),
			row(
				[
					title("A few common questions", size=20),
					list_block(
						[
							"<strong>Can I change the amount?</strong> Yes, at any time.",
							"<strong>Can I pause?</strong> Yes — just let us know.",
							"<strong>Where does it go?</strong> Into the same work this email describes: care, tools and training.",
						]
					),
				],
				padding={"top": 8, "right": 32, "bottom": 20, "left": 32},
			),
			cta(
				"Plan for the long term",
				"Monthly support is the most useful kind of support we receive.",
				"Become a monthly donor",
				note="You can update or cancel your gift at any time.",
			),
			*footer(),
		],
	}


def blank() -> dict:
	return {
		"name": "Blank - Logo & Footer",
		"category": "Blank",
		"description": "A clean starting point with the Glia header and supporter footer already in place.",
		"subject": "Your email subject",
		"preheader": "",
		"settings": {**BASE_SETTINGS, "email_title": "Blank - Logo & Footer"},
		"rows": [
			header(),
			row(
				[
					title("Your headline", level=1, size=32),
					paragraph(
						"<p>Hi {{ FirstName }},</p>"
						"<p>Start writing your message here. Add rows and content blocks from the "
						"right-hand panel, or pick a starter from the template library.</p>"
					),
					button("Donate today", "{{ DonateURL }}"),
				],
				padding={"top": 28, "right": 32, "bottom": 24, "left": 32},
			),
			*footer(),
		],
	}


def _finalize(seed: dict) -> dict:
	"""Keep the display metadata (preheader, raw subject) inside design settings.

	The seed dicts are authored with these fields at the top level for
	readability; the builder consumes them from design settings.
	"""
	settings = dict(seed.get("settings") or {})
	if not settings.get("preheader"):
		settings["preheader"] = seed.get("preheader") or ""
	if not settings.get("subject_template"):
		settings["subject_template"] = seed.get("subject") or ""
	seed["settings"] = settings
	return seed


def get_seed_templates() -> list[dict]:
	return [_finalize(seed) for seed in [
		newsletter_impact(),
		newsletter_two_column(),
		newsletter_impact_report(),
		appeal_year_end(),
		appeal_urgent(),
		thank_you(),
		invitation(),
		announcement(),
		letter(),
		recurring(),
		blank(),
	]]
