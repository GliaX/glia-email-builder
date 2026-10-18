"""Email-safe HTML renderer for block-based designs.

The output is a complete HTML document with table-based layout and inline CSS,
suitable for Outlook, Gmail, Apple Mail and other clients. Every user-authored
fragment is sanitised and translated from EveryAction syntax to protocol-
portable Jinja before it is placed in the document.

The renderer has no Frappe imports; ERPNext's Jinja environment renders the
result at preview/send time.
"""

from __future__ import annotations

import html
import re
from typing import Any

from .defaults import FONT_STACKS, SOCIAL_ICON_BASE, SOCIAL_NETWORKS
from .macros import (
	build_alias_map,
	build_condition_expression,
	replace_globals,
	translate_template,
)
from .sanitize import sanitize_raw_html, sanitize_text_html, strip_tags
from .schema import count_blocks, normalize_design

YOUTUBE_RE = re.compile(
	r"(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{6,})"
)
SAFE_HREF_RE = re.compile(r"^\s*(?:https?:|mailto:|tel:|#|/|\.{0,2}/|\?)", re.I)
BAD_HREF_RE = re.compile(r"^\s*(?:javascript|vbscript|data):", re.I)
UNSUBSCRIBE_TOKEN = "__GEB_UNSUBSCRIBE_URL__"

_BODY_RE = re.compile(r"(?is)<body[^>]*>(.*?)</body>")
_HEAD_STYLE_RE = re.compile(r"(?is)<style[^>]*>.*?</style>")


def to_email_fragment(html: str) -> str:
	"""Turn the compiled document into the content Frappe's email wrapper expects.

	ERPNext's ``Email Campaign`` passes the template body to
	``frappe.sendmail(content=...)``, which wraps it in
	``templates/emails/standard.html``. Storing a complete ``<html>`` document in
	``Email Template.response_html`` would nest two documents inside that
	wrapper, so the Email Template gets the body content plus the document's
	``<style>`` blocks. The full document is still kept on the design record and
	used by the builder preview.
	"""
	html = html or ""
	match = _BODY_RE.search(html)
	if not match:
		return html.strip()
	styles = "".join(_HEAD_STYLE_RE.findall(html))
	return (styles + match.group(1)).strip()


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def _esc(value: Any, quote: bool = False) -> str:
	return html.escape("" if value is None else str(value), quote=quote)


def _attr(value: Any) -> str:
	"""Escape an attribute while leaving Jinja expressions unescaped."""
	value = "" if value is None else str(value)
	if "{{" in value or "{%" in value:
		return value
	return html.escape(value, quote=True)


def _safe_href(value: str) -> str:
	value = (value or "").strip()
	if not value:
		return ""
	if "{{" in value or "{%" in value:
		return value
	if BAD_HREF_RE.match(value):
		return "#"
	if SAFE_HREF_RE.match(value):
		return value
	if ":" not in value.split("/")[0]:
		return value
	return "#"


def absolutize(value: str, base_url: str = "") -> str:
	"""Turn a site-relative asset/file URL into an absolute URL for email."""
	value = (value or "").strip()
	if not value:
		return ""
	if "{{" in value or "{%" in value or "<!--" in value:
		return value
	lower = value.lower()
	if lower.startswith(("http://", "https://", "//", "data:", "cid:", "mailto:", "tel:", "#")):
		return value
	if not base_url:
		return value
	base = base_url.rstrip("/")
	if value.startswith("/"):
		return base + value
	return base + "/" + value


def _px(value: Any, default: float = 0) -> str:
	try:
		number = float(value)
	except (TypeError, ValueError):
		number = default
	if abs(number - round(number)) < 0.001:
		number = int(round(number))
	return f"{number}px"


def _padding(styles: dict, default: dict | None = None) -> str:
	padding = (styles or {}).get("padding") or default or {}
	return " ".join(
		_px(padding.get(side, 0)) for side in ("top", "right", "bottom", "left")
	)


def _font_family(name: str, app_settings: dict) -> str:
	name = name or app_settings.get("default_font") or "Arial"
	return FONT_STACKS.get(name, FONT_STACKS["Arial"])


def _classes(*values: Any) -> str:
	return " ".join(str(value) for value in values if value)


def _block_classes(block: dict) -> str:
	styles = block.get("styles") or {}
	return _classes(
		"geb-block",
		"geb-" + block.get("type", "block"),
		"geb-hide-mobile" if styles.get("hide_mobile") else "",
		"geb-hide-desktop" if styles.get("hide_desktop") else "",
	)


def _block_visibility(styles: dict) -> str:
	# Do not use mso-hide: keep Outlook desktop showing elements that are only
	# hidden on mobile (media queries do the mobile hiding).
	return ""


# ---------------------------------------------------------------------------
# Global merge values
# ---------------------------------------------------------------------------


def build_global_values(app_settings: dict | None = None, *, for_html: bool = True) -> dict[str, str]:
	app_settings = app_settings or {}
	get = lambda key, default="": app_settings.get(key, default) or default  # noqa: E731

	org_name = get("organization_name", "Glia")
	address = get("organization_address", "")
	disclaimer = get("disclaimer", "")
	donation = get("donation_url", "")
	website = get("website_url", "")
	unsubscribe_text = get("unsubscribe_text", "Unsubscribe") or "Unsubscribe"

	if for_html:
		address_html = _esc(address).replace("\n", "<br />")
		disclaimer_html = _esc(disclaimer).replace("\n", "<br />")
		unsubscribe_link = (
			'<a href="' + UNSUBSCRIBE_TOKEN + '" target="_blank" '
			'style="color:' + _esc(get("default_link_color", "#005AB9")) + ';'
			'text-decoration:underline;">' + _esc(unsubscribe_text) + "</a>"
		)
		return {
			"OrganizationName": _esc(org_name),
			"OrganizationAddress": address_html,
			"Disclaimer": disclaimer_html,
			"UnsubscribeLink": unsubscribe_link,
			"UnsubscribeURL": UNSUBSCRIBE_TOKEN,
			"DonateURL": _esc(donation, quote=True),
			"WebsiteURL": _esc(website, quote=True),
			"FacebookURL": _esc(get("social_facebook"), quote=True),
			"InstagramURL": _esc(get("social_instagram"), quote=True),
			"TwitterURL": _esc(get("social_twitter"), quote=True),
			"LinkedInURL": _esc(get("social_linkedin"), quote=True),
			"YouTubeURL": _esc(get("social_youtube"), quote=True),
		}

	return {
		"OrganizationName": org_name,
		"OrganizationAddress": address.replace("\n", ", "),
		"Disclaimer": disclaimer.replace("\n", " "),
		"UnsubscribeLink": unsubscribe_text,
		"UnsubscribeURL": "#",
		"DonateURL": donation,
		"WebsiteURL": website,
		"FacebookURL": get("social_facebook"),
		"InstagramURL": get("social_instagram"),
		"TwitterURL": get("social_twitter"),
		"LinkedInURL": get("social_linkedin"),
		"YouTubeURL": get("social_youtube"),
	}


def _merge_aliases(merge_fields: list[dict] | None) -> dict[str, dict]:
	return build_alias_map(merge_fields or [])


def translate_subject(subject: str, merge_fields: list[dict] | None, app_settings: dict | None) -> str:
	subject = subject or ""
	subject = replace_globals(subject, build_global_values(app_settings, for_html=False))
	return translate_template(subject, _merge_aliases(merge_fields))


def translate_plain(value: str, merge_fields: list[dict] | None, app_settings: dict | None) -> str:
	value = value or ""
	value = replace_globals(value, build_global_values(app_settings, for_html=False))
	return translate_template(value, _merge_aliases(merge_fields))


# ---------------------------------------------------------------------------
# Content post-processing
# ---------------------------------------------------------------------------


def add_link_styles(fragment: str, link_color: str) -> str:
	if not fragment:
		return fragment

	def repl(match: re.Match) -> str:
		attrs = match.group(1) or ""
		style_match = re.search(r'\bstyle\s*=\s*"([^"]*)"', attrs, re.I)
		if style_match:
			style = style_match.group(1)
			if "color:" not in style.lower():
				style = style.rstrip(";") + f";color:{link_color};"
			attrs = attrs[: style_match.start(1)] + style + attrs[style_match.end(1) :]
		else:
			attrs += f' style="color:{link_color};text-decoration:underline;"'
		if not re.search(r"\btarget\s*=", attrs, re.I):
			attrs += ' target="_blank"'
		if not re.search(r"\brel\s*=", attrs, re.I):
			attrs += ' rel="noopener"'
		return "<a" + attrs + ">"

	return re.sub(r"<a\b([^>]*)>", repl, fragment, flags=re.I)


def add_paragraph_margins(fragment: str, spacing: int) -> str:
	"""Email clients vary on default <p> margins; always set them inline."""
	if not fragment:
		return fragment

	def repl(match: re.Match) -> str:
		attrs = match.group(1) or ""
		style_match = re.search(r'\bstyle\s*=\s*"([^"]*)"', attrs, re.I)
		margin = f"margin:0 0 {spacing}px;" if spacing else "margin:0;"
		if style_match:
			style = style_match.group(1)
			if "margin" not in style.lower():
				style = style.rstrip(";") + ";" + margin
			attrs = attrs[: style_match.start(1)] + style + attrs[style_match.end(1) :]
		else:
			attrs += f' style="{margin}"'
		return "<p" + attrs + ">"

	return re.sub(r"<p\b([^>]*)>", repl, fragment, flags=re.I)


def style_lists(fragment: str, block: dict) -> str:
	content = block.get("content") or {}
	list_style = content.get("list_style") or "disc"
	list_start = content.get("list_start") or 1
	if not fragment:
		return fragment

	def ul_repl(match: re.Match) -> str:
		return (
			'<ul role="presentation" style="margin:0 0 12px;padding-left:24px;'
			+ f'list-style-type:{list_style};">'
		)

	def ol_repl(match: re.Match) -> str:
		start_attr = ""
		if list_start and int(list_start) > 1:
			start_attr = f' start="{int(list_start)}"'
		list_type = list_style if list_style in {"decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman"} else "decimal"
		return (
			'<ol role="presentation"'
			+ start_attr
			+ ' style="margin:0 0 12px;padding-left:24px;'
			+ f'list-style-type:{list_type};">'
		)

	fragment = re.sub(r"<ul\b[^>]*>", ul_repl, fragment, flags=re.I)
	fragment = re.sub(r"<ol\b[^>]*>", ol_repl, fragment, flags=re.I)
	fragment = re.sub(
		r"<li\b[^>]*>",
		'<li style="margin:0 0 6px;padding:0;">',
		fragment,
		flags=re.I,
	)
	return fragment


def _prepare_fragment(
	value: str,
	*,
	block: dict,
	aliases: dict[str, dict],
	globals_for_html: dict[str, str],
	link_color: str,
	paragraph_spacing: int,
	kind: str,
) -> str:
	value = sanitize_text_html(value or "")
	value = replace_globals(value, globals_for_html)
	value = translate_template(value, aliases)
	value = add_link_styles(value, link_color)
	if kind == "list":
		value = style_lists(value, block)
		value = add_paragraph_margins(value, paragraph_spacing)
	elif kind == "paragraph":
		value = add_paragraph_margins(value, paragraph_spacing)
	elif kind == "text":
		value = add_paragraph_margins(value, 0)
	return value


def _text_style(block: dict, app_settings: dict, design_settings: dict) -> str:
	styles = block.get("styles") or {}
	font_size = styles.get("font_size") or 16
	line_height = styles.get("line_height") or 1.6
	letter_spacing = styles.get("letter_spacing") or 0
	return (
		f"font-family:{_font_family(styles.get('font_family', ''), app_settings)};"
		f"font-size:{_px(font_size)};"
		f"line-height:{line_height};"
		f"letter-spacing:{_px(letter_spacing)};"
		f"color:{styles.get('color') or design_settings.get('text_color') or '#1D2B2F'};"
		f"text-align:{styles.get('align') or 'left'};"
		"mso-line-height-rule:exactly;"
	)


# ---------------------------------------------------------------------------
# Block renderers
# ---------------------------------------------------------------------------


def _render_block(block: dict, ctx: dict) -> str:
	block_type = block.get("type")
	styles = block.get("styles") or {}
	content = block.get("content") or {}
	padding = _padding(styles)
	wrapper_background = "" if block_type == "button" else (styles.get("background_color") or "")
	base_style = (
		"padding:" + padding + ";"
		"background-color:" + (wrapper_background or "transparent") + ";"
		"text-align:" + (styles.get("align") or "left") + ";"
		+ _block_visibility(styles)
	)
	classes = _block_classes(block)
	inner = ""

	if block_type == "title":
		level = int(content.get("level") or 2)
		level = min(3, max(1, level))
		text = html.escape(content.get("text") or "", quote=False)
		text = replace_globals(text, ctx["globals_html"])
		text = translate_template(text, ctx["aliases"])
		margin = "0 0 12px" if level < 3 else "0 0 8px"
		inner = (
			f'<h{level} style="margin:{margin};{_text_style(block, ctx["app"], ctx["settings"])}'
			f'font-weight:700;">{text}</h{level}>'
		)
	elif block_type == "paragraph":
		fragment = _prepare_fragment(
			content.get("html") or "",
			block=block,
			aliases=ctx["aliases"],
			globals_for_html=ctx["globals_html"],
			link_color=ctx["link_color"],
			paragraph_spacing=int(styles.get("paragraph_spacing") or 12),
			kind="paragraph",
		)
		direction = ' dir="rtl"' if styles.get("direction") == "rtl" else ""
		inner = f"<div{direction} style=\"{_text_style(block, ctx['app'], ctx['settings'])}\">{fragment}</div>"
	elif block_type == "text":
		fragment = _prepare_fragment(
			content.get("html") or "",
			block=block,
			aliases=ctx["aliases"],
			globals_for_html=ctx["globals_html"],
			link_color=ctx["link_color"],
			paragraph_spacing=0,
			kind="text",
		)
		inner = f"<div style=\"{_text_style(block, ctx['app'], ctx['settings'])}\">{fragment}</div>"
	elif block_type == "list":
		fragment = _prepare_fragment(
			content.get("html") or "",
			block=block,
			aliases=ctx["aliases"],
			globals_for_html=ctx["globals_html"],
			link_color=ctx["link_color"],
			paragraph_spacing=int(styles.get("paragraph_spacing") or 12),
			kind="list",
		)
		inner = f"<div style=\"{_text_style(block, ctx['app'], ctx['settings'])}\">{fragment}</div>"
	elif block_type == "image":
		inner = _render_image(block, ctx)
	elif block_type == "button":
		inner = _render_button(block, ctx)
	elif block_type == "divider":
		inner = _render_divider(block, ctx)
	elif block_type == "spacer":
		inner = _render_spacer(block)
	elif block_type == "social":
		inner = _render_social(block, ctx)
	elif block_type == "video":
		inner = _render_video(block, ctx)
	elif block_type == "html":
		raw = sanitize_raw_html(content.get("html") or "")
		raw = replace_globals(raw, ctx["globals_html"])
		raw = translate_template(raw, ctx["aliases"])
		inner = raw
	else:
		inner = ""

	if not inner:
		return ""
	return f'<div class="{classes}" style="{base_style}">{inner}</div>'


def _render_image(block: dict, ctx: dict) -> str:
	content = block.get("content") or {}
	src = absolutize(content.get("src") or "", ctx["base_url"])
	src = replace_globals(src, ctx["globals_plain"])
	src = translate_template(src, ctx["aliases"])
	if not src:
		return ""
	alt = html.escape(content.get("alt") or "", quote=True)
	alt = replace_globals(alt, ctx["globals_html"])
	alt = translate_template(alt, ctx["aliases"])
	width = int(content.get("width") or 100)
	align = content.get("align") or "center"
	border_radius = int(content.get("border_radius") or 0)
	link = _safe_href(absolutize(content.get("link") or "", ctx["base_url"]))
	link = replace_globals(link, ctx["globals_plain"])
	link = translate_template(link, ctx["aliases"])

	img_style = (
		"display:block;width:100%;max-width:100%;height:auto;border:0;outline:none;"
		"text-decoration:none;-ms-interpolation-mode:bicubic;"
	)
	if border_radius:
		img_style += f"border-radius:{border_radius}px;"
	img = f'<img src="{_attr(src)}" alt="{alt}" border="0" style="{img_style}" />'
	if link:
		img = f'<a href="{_attr(link)}" target="_blank" style="text-decoration:none;">{img}</a>'
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" '
		f'width="{width}%" align="{align}" style="width:{width}%;">'
		f"<tr><td>{img}</td></tr></table>"
	)


def _render_button(block: dict, ctx: dict) -> str:
	content = block.get("content") or {}
	styles = block.get("styles") or {}
	text = html.escape(content.get("text") or "Donate now", quote=False)
	text = replace_globals(text, ctx["globals_html"])
	text = translate_template(text, ctx["aliases"])
	link = absolutize(content.get("link") or "", ctx["base_url"])
	link = replace_globals(link, ctx["globals_plain"])
	link = translate_template(link, ctx["aliases"])
	link = _safe_href(link)
	background = styles.get("background_color") or ctx["button_color"]
	text_color = styles.get("text_color") or ctx["button_text_color"]
	radius = int(styles.get("border_radius") or 6)
	font_size = int(styles.get("font_size") or 16)
	font_weight = "700" if styles.get("bold", True) else "400"
	align = content.get("align") or "center"
	full_width = bool(content.get("full_width") or styles.get("full_width"))
	font = _font_family(styles.get("font_family", ""), ctx["app"])

	if not link:
		return (
			'<table role="presentation" border="0" cellpadding="0" cellspacing="0" '
			f'align="{align}"><tr><td bgcolor="{_esc(background)}" style="border-radius:{radius}px;">'
			f'<span style="display:inline-block;padding:12px 24px;font-family:{font};'
			f"font-size:{_px(font_size)};font-weight:{font_weight};color:{_esc(text_color)};"
			f'border-radius:{radius}px;">{text}</span></td></tr></table>'
		)

	href = _attr(link)
	table_width = 'width="100%"' if full_width else ""
	table_style = "width:100%;" if full_width else ""
	anchor_display = "block" if full_width else "inline-block"
	anchor_style = (
		f"display:{anchor_display};padding:12px 24px;font-family:{font};"
		f"font-size:{_px(font_size)};font-weight:{font_weight};line-height:1.3;"
		f"color:{_esc(text_color)};text-decoration:none;border-radius:{radius}px;"
		f"background-color:{_esc(background)};text-align:center;"
	)
	vml_width = "100%" if full_width else "220"
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" '
		f'{table_width} align="{align}" style="{table_style}">'
		"<tr>"
		f'<td align="center" bgcolor="{_esc(background)}" style="border-radius:{radius}px;">'
		"<!--[if mso]>"
		f'<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" '
		f'href="{href}" style="height:44px;v-text-anchor:middle;width:{vml_width};" arcsize="{max(8, int(radius * 2))}%" '
		f'strokecolor="{_esc(background)}" fillcolor="{_esc(background)}">'
		"<w:anchorlock/>"
		f'<center style="color:{_esc(text_color)};font-family:{font};font-size:{_px(font_size)};'
		f'font-weight:{font_weight};">{text}</center>'
		"</v:roundrect>"
		"<![endif]-->"
		"<!--[if !mso]><!-- -->"
		f'<a href="{href}" target="_blank" style="{anchor_style}">{text}</a>'
		"<!--<![endif]-->"
		"</td></tr></table>"
	)


def _render_divider(block: dict, ctx: dict) -> str:
	content = block.get("content") or {}
	width = int(content.get("width") or 100)
	thickness = max(1, int(content.get("thickness") or 1))
	color = content.get("color") or "#DDE5E3"
	align = content.get("align") or "center"
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" '
		f'width="{width}%" align="{align}" style="width:{width}%;">'
		f'<tr><td style="border-top:{thickness}px solid {_esc(color)};font-size:1px;'
		f'line-height:1px;height:{thickness}px;">&nbsp;</td></tr></table>'
	)


def _render_spacer(block: dict) -> str:
	height = max(1, int((block.get("content") or {}).get("height") or 24))
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">'
		f'<tr><td height="{height}" style="height:{height}px;font-size:1px;line-height:1px;">'
		"&nbsp;</td></tr></table>"
	)


def _social_url(network: dict, ctx: dict) -> str:
	url = (network.get("url") or "").strip()
	if not url:
		url = (ctx["app"].get("social_" + network.get("key")) or "").strip()
	return absolutize(url, ctx["base_url"])


def _render_social(block: dict, ctx: dict) -> str:
	content = block.get("content") or {}
	networks = content.get("networks") or []
	known = {net["key"]: net for net in SOCIAL_NETWORKS}
	icon_size = int(content.get("icon_size") or 24)
	spacing = int(content.get("spacing") or 12)
	align = content.get("align") or "center"
	cells = []
	for network in networks:
		meta = known.get(network.get("key"))
		if not meta:
			continue
		url = _social_url(network, ctx)
		url = replace_globals(url, ctx["globals_plain"])
		url = translate_template(url, ctx["aliases"])
		if not url:
			continue
		icon = absolutize(f"{SOCIAL_ICON_BASE}/{meta['icon']}", ctx["base_url"])
		cells.append(
			f'<td style="padding:0 {_px(spacing / 2)};">'
			f'<a href="{_esc(url, quote=True)}" target="_blank" style="text-decoration:none;">'
			f'<img src="{_esc(icon, quote=True)}" width="{icon_size}" height="{icon_size}" '
			f'alt="{_esc(meta["label"], quote=True)}" border="0" '
			f'style="display:block;width:{icon_size}px;height:{icon_size}px;border:0;" />'
			"</a></td>"
		)
	if not cells:
		return ""
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="{align}">'
		"<tr>" + "".join(cells) + "</tr></table>"
	)


def _video_thumbnail(content: dict) -> str:
	url = (content.get("url") or "").strip()
	if content.get("thumbnail"):
		return content["thumbnail"]
	match = YOUTUBE_RE.search(url)
	if match:
		return f"https://img.youtube.com/vi/{match.group(1)}/hqdefault.jpg"
	return ""


def _render_video(block: dict, ctx: dict) -> str:
	content = block.get("content") or {}
	url = absolutize(content.get("url") or "", ctx["base_url"])
	url = replace_globals(url, ctx["globals_plain"])
	url = translate_template(url, ctx["aliases"])
	url = _safe_href(url)
	if not url:
		return ""
	width = int(content.get("width") or 100)
	align = content.get("align") or "center"
	thumbnail = absolutize(_video_thumbnail(content), ctx["base_url"])
	play_icon = absolutize("/assets/glia_email_builder/images/play.png", ctx["base_url"])
	if not thumbnail:
		thumbnail = absolutize("/assets/glia_email_builder/images/video-placeholder.jpg", ctx["base_url"])
	bg_style = (
		f"background-image:url('{_esc(thumbnail, quote=True)}');"
		"background-size:cover;background-position:center;background-color:#001F27;"
	)
	return (
		f'<table role="presentation" border="0" cellpadding="0" cellspacing="0" '
		f'width="{width}%" align="{align}" style="width:{width}%;">'
		f'<tr><td height="200" align="center" valign="middle" background="{_attr(thumbnail)}" '
		f'style="{bg_style}">'
		f'<a href="{_attr(url)}" target="_blank" style="text-decoration:none;">'
		f'<img src="{_attr(play_icon)}" width="64" height="64" alt="Play video" border="0" '
		'style="display:block;width:64px;height:64px;border:0;" />'
		"</a>"
		"<div style=\"font-family:" + _font_family("", ctx["app"]) + ";font-size:13px;color:#FFFFFF;"
		'padding-top:8px;">Watch the video</div>'
		"</td></tr></table>"
	)


# ---------------------------------------------------------------------------
# Rows and document
# ---------------------------------------------------------------------------


def _render_row(row: dict, ctx: dict) -> str:
	styles = row.get("styles") or {}
	columns = row.get("columns") or []
	if not columns:
		return ""
	padding = _padding(styles)
	row_bg = styles.get("background_color") or ""
	bg_image = absolutize(styles.get("background_image") or "", ctx["base_url"])
	bg_style = ""
	if bg_image:
		bg_style = (
			f"background-image:url('{_esc(bg_image, quote=True)}');"
			"background-size:cover;background-position:center;"
		)
	if not row_bg:
		row_bg = "transparent"
	row_classes = _classes(
		"geb-row-cell",
		"geb-hide-mobile" if styles.get("hide_mobile") else "",
		"geb-hide-desktop" if styles.get("hide_desktop") else "",
	)
	if styles.get("no_stack"):
		stack_class = "geb-no-stack"
	else:
		stack_class = "geb-stack"
	reverse = " geb-reverse" if styles.get("reverse_stack") else ""
	valign = styles.get("vertical_align") or "top"
	gap = int(styles.get("columns_gap") or 0)

	condition = ""
	if (row.get("condition") or {}).get("enabled"):
		condition = build_condition_expression(row.get("condition") or {}, ctx["aliases"])
		condition = replace_globals(condition, ctx["globals_plain"])

	html_parts: list[str] = []
	if condition:
		html_parts.append("{% if " + condition + " %}")
	html_parts.append("<tr>")
	bgcolor_attr = ""
	if re.match(r"^(#[0-9a-fA-F]{3,8}|rgba?\()", row_bg):
		bgcolor_attr = f' bgcolor="{_esc(row_bg)}"'
	html_parts.append(
		f'<td class="{row_classes}"{bgcolor_attr} '
		f'style="background-color:{_esc(row_bg)};{bg_style}padding:{padding};'
		f'border-radius:{int(styles.get("border_radius") or 0)}px;">'
	)
	html_parts.append(
		f'<table role="presentation" class="geb-row-table{reverse}" border="0" '
		f'cellpadding="0" cellspacing="0" width="100%" '
		f'style="width:100%;border-collapse:separate;border-spacing:{gap}px 0;'
		'mso-table-lspace:0pt;mso-table-rspace:0pt;">'
		"<tr>"
	)
	for column in columns:
		width = float(column.get("width") or 100 / len(columns))
		width = max(1, min(100, width))
		col_id = column.get("id") or ""
		blocks_html = "".join(_render_block(block, ctx) for block in (column.get("blocks") or []))
		if not blocks_html:
			blocks_html = '<div style="height:1px;font-size:1px;line-height:1px;">&nbsp;</div>'
		html_parts.append(
			f'<td class="geb-col {stack_class}" data-col="{_esc(col_id, quote=True)}" '
			f'width="{width:g}%" valign="{_esc(valign, quote=True)}" '
			f'style="width:{width:g}%;vertical-align:{_esc(valign)};">'
			+ blocks_html
			+ "</td>"
		)
	html_parts.append("</tr></table></td></tr>")
	if condition:
		html_parts.append("{% endif %}")
	return "".join(html_parts)


def _media_css(width: int) -> str:
	# Built with concatenation so CSS braces remain literal.
	return (
		"@media only screen and (max-width:" + str(width + 20) + "px){\n"
		".geb-content{width:100%!important;max-width:100%!important;}\n"
		".geb-stack{display:block!important;width:100%!important;max-width:100%!important;}\n"
		".geb-stack + .geb-stack{padding-top:8px!important;}\n"
		".geb-no-stack{display:table-cell!important;}\n"
		".geb-hide-mobile{display:none!important;max-height:0!important;overflow:hidden!important;}\n"
		".geb-reverse{direction:rtl!important;}\n"
		".geb-reverse>tbody>tr>td{direction:ltr!important;}\n"
		".geb-full-width{width:100%!important;}\n"
		"}\n"
		"@media only screen and (min-width:" + str(width + 21) + "px){\n"
		".geb-hide-desktop{display:none!important;}\n"
		"}\n"
	)


def render_email(
	design: dict,
	*,
	subject: str = "",
	app_settings: dict | None = None,
	base_url: str = "",
	merge_fields: list[dict] | None = None,
) -> dict:
	"""Compile a design into an email-safe HTML document (Jinja-ready).

	Returns a dict with ``html``, ``subject``, ``text`` and metadata. The caller
	is responsible for validating the Jinja and for rendering it with a context.
	"""
	design = normalize_design(design)
	app_settings = app_settings or {}
	settings = design["settings"]
	width = int(settings.get("width") or 600)
	aliases = _merge_aliases(merge_fields)
	globals_html = build_global_values(app_settings, for_html=True)
	globals_plain = build_global_values(app_settings, for_html=False)

	font = _font_family(settings.get("font_family", ""), app_settings)
	text_color = settings.get("text_color") or "#1D2B2F"
	link_color = settings.get("link_color") or app_settings.get("default_link_color") or "#005AB9"
	button_color = settings.get("button_color") or app_settings.get("default_button_color") or "#00A89E"
	button_text_color = (
		settings.get("button_text_color")
		or app_settings.get("default_button_text_color")
		or "#FFFFFF"
	)

	ctx = {
		"app": app_settings,
		"settings": settings,
		"aliases": aliases,
		"globals_html": globals_html,
		"globals_plain": globals_plain,
		"base_url": base_url,
		"link_color": link_color,
		"button_color": button_color,
		"button_text_color": button_text_color,
	}

	rows_html = "".join(_render_row(row, ctx) for row in design.get("rows", []))
	preheader = sanitize_text_html(settings.get("preheader") or "")
	preheader = replace_globals(preheader, globals_html)
	preheader = translate_template(preheader, aliases)
	preheader = strip_tags(preheader) if "{{" not in preheader and "{%" not in preheader else preheader

	subject_jinja = translate_subject(subject, merge_fields, app_settings)
	title = settings.get("email_title") or subject_jinja or "Email"
	body_font = f"font-family:{font};"

	html_parts: list[str] = []
	html_parts.append('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ')
	html_parts.append('"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">')
	html_parts.append(
		'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" '
		'xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">'
	)
	html_parts.append("<head>")
	html_parts.append('<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />')
	html_parts.append('<meta name="viewport" content="width=device-width, initial-scale=1" />')
	html_parts.append('<meta name="x-apple-disable-message-reformatting" />')
	html_parts.append('<meta name="color-scheme" content="light only" />')
	html_parts.append('<meta name="supported-color-schemes" content="light only" />')
	html_parts.append("<title>" + title + "</title>")
	html_parts.append("<!--[if mso]><style>table,td{mso-table-lspace:0pt!important;")
	html_parts.append("mso-table-rspace:0pt!important;}</style><![endif]-->")
	html_parts.append("<style>")
	html_parts.append("html,body{margin:0!important;padding:0!important;width:100%!important;")
	html_parts.append("background-color:" + _esc(settings.get("background_color") or "#F3F6F5") + ";}")
	html_parts.append("*{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%;}")
	html_parts.append("table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}")
	html_parts.append("img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}")
	html_parts.append("a{text-decoration:underline;}")
	html_parts.append("p{margin:0;}")
	html_parts.append(_media_css(width))
	html_parts.append("</style>")
	html_parts.append("</head>")
	html_parts.append(
		'<body style="margin:0;padding:0;width:100%;' + body_font + 'font-size:16px;'
		"color:" + _esc(text_color) + ";background-color:"
		+ _esc(settings.get("background_color") or "#F3F6F5") + ";"
		'-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">'
	)
	if preheader:
		html_parts.append(
			'<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;'
			"max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;\">"
			+ preheader
			+ "&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>"
		)
	html_parts.append(
		'<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" '
		'style="width:100%;background-color:' + _esc(settings.get("background_color") or "#F3F6F5") + ';">'
		'<tr><td align="' + _esc(settings.get("align") or "center") + '" style="padding:0;">'
	)
	html_parts.append(
		f'<table role="presentation" class="geb-content" border="0" cellpadding="0" cellspacing="0" '
		f'width="{width}" bgcolor="{_esc(settings.get("content_background") or "#FFFFFF")}" '
		f'style="width:{width}px;max-width:{width}px;background-color:'
		+ _esc(settings.get("content_background") or "#FFFFFF")
		+ f';border-radius:{int(settings.get("border_radius") or 0)}px;">'
	)
	html_parts.append(rows_html)
	html_parts.append("</table>")
	html_parts.append("</td></tr></table>")
	html_parts.append("</body></html>")

	final_html = "".join(html_parts).replace(UNSUBSCRIBE_TOKEN, "<!--unsubscribe_url-->")
	return {
		"html": final_html,
		"subject": subject_jinja,
		"text": design_to_text(design),
		"settings": settings,
		"block_count": count_blocks(design),
	}


# ---------------------------------------------------------------------------
# Plain text
# ---------------------------------------------------------------------------


def design_to_text(design: dict) -> str:
	"""A readable plain-text version of the design (best effort)."""
	parts: list[str] = []
	for row in design.get("rows", []):
		for column in row.get("columns", []):
			for block in column.get("blocks", []):
				block_type = block.get("type")
				content = block.get("content") or {}
				if block_type == "title":
					parts.append(content.get("text") or "")
				elif block_type in {"paragraph", "text", "list"}:
					parts.append(strip_tags(content.get("html") or ""))
				elif block_type == "button":
					text = content.get("text") or ""
					link = content.get("link") or ""
					parts.append(f"{text}: {link}" if link else text)
				elif block_type == "image":
					if content.get("alt"):
						parts.append(content["alt"])
				elif block_type == "social":
					parts.append(" · ".join(net.get("key", "") for net in content.get("networks") or []))
				elif block_type == "html":
					parts.append(strip_tags(content.get("html") or ""))
				elif block_type == "video":
					parts.append(content.get("url") or "")
	text = "\n\n".join(part.strip() for part in parts if (part or "").strip())
	text = re.sub(r"\n{3,}", "\n\n", text)
	return text.strip()
