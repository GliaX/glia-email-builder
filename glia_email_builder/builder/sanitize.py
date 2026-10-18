"""HTML sanitisation for rich-text blocks and raw HTML blocks.

Only trusted, authenticated staff can author messages, but the builder still
accepts pasted HTML. Two levels are provided:

* ``sanitize_text_html`` - conservative allow-list for text/paragraph/list and
  title blocks (formatting only, no images, tables or scripts).
* ``sanitize_raw_html``   - keeps arbitrary email-safe markup (used by the HTML
  block) but strips scripts, event handlers and javascript: URLs.

Both preserve Jinja tags and the ``<!--unsubscribe_url-->`` placeholder that
Frappe's email queue replaces per recipient.
"""

from __future__ import annotations

import html
import re
from html.parser import HTMLParser

JINJA_TOKEN = "__GEB_JINJA_{}__"
JINJA_RE = re.compile(r"(\{\{.*?\}\}|\{%.*?%\})", re.DOTALL)


def protect_jinja(value: str) -> tuple[str, list[str]]:
	"""Replace Jinja tags with inert tokens so the HTML parser cannot mangle
	``<``/``>``/``&`` inside conditions. Returns (text, originals)."""
	originals: list[str] = []

	def repl(match: re.Match) -> str:
		originals.append(match.group(1))
		return JINJA_TOKEN.format(len(originals) - 1)

	return JINJA_RE.sub(repl, value), originals


def restore_jinja(value: str, originals: list[str]) -> str:
	for index, original in enumerate(originals):
		value = value.replace(JINJA_TOKEN.format(index), original)
	return value


TEXT_TAGS = {
	"p",
	"br",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"strike",
	"del",
	"sub",
	"sup",
	"span",
	"div",
	"a",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"font",
	"hr",
}

RAW_DROP_TAGS = {
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"form",
	"input",
	"button",
	"textarea",
	"select",
	"option",
	"meta",
	"link",
	"base",
	"applet",
	"frame",
	"frameset",
}

VOID_TAGS = {"br", "hr", "img", "wbr"}

STYLE_ONLY_ATTRS = {"style", "class", "align", "dir", "id", "title"}

ATTR_ALLOWLIST = {
	"a": {"href", "title", "target", "rel", "style", "class"},
	"font": {"color", "face", "size", "style", "class"},
	"ol": {"start", "type", "style", "class", "reversed"},
	"ul": {"type", "style", "class"},
	"li": {"value", "style", "class"},
	"img": {
		"src",
		"alt",
		"width",
		"height",
		"style",
		"class",
		"title",
		"border",
		"hspace",
		"vspace",
	},
	"table": {
		"width",
		"align",
		"border",
		"cellpadding",
		"cellspacing",
		"style",
		"class",
		"role",
		"bgcolor",
		"background",
	},
	"td": {
		"width",
		"align",
		"valign",
		"colspan",
		"rowspan",
		"style",
		"class",
		"bgcolor",
		"height",
		"background",
	},
	"th": {
		"width",
		"align",
		"valign",
		"colspan",
		"rowspan",
		"style",
		"class",
		"bgcolor",
		"height",
	},
	"tr": {"style", "class", "align", "valign", "bgcolor"},
	"div": {"style", "class", "align", "dir"},
	"p": {"style", "class", "align", "dir"},
}

BAD_URL_RE = re.compile(r"^\s*(?:javascript|vbscript|data):", re.IGNORECASE)
BAD_STYLE_RE = re.compile(
	r"(expression\s*\(|javascript\s*:|vbscript\s*:|behavior\s*:|@import|position\s*:\s*fixed)",
	re.IGNORECASE,
)
DYNAMIC_RE = re.compile(r"\{\{|\{%|<!--unsubscribe_url-->")
SAFE_URL_PREFIXES = ("http://", "https://", "mailto:", "tel:", "#", "/", "?", ".", "./", "../")


class _Sanitizer(HTMLParser):
	def __init__(self, allow_all: bool = False):
		super().__init__(convert_charrefs=False)
		self.allow_all = allow_all
		self.out: list[str] = []
		self.stack: list[str] = []
		self.dropping = 0

	def handle_starttag(self, tag, attrs):
		tag = tag.lower()
		if tag in RAW_DROP_TAGS:
			self.dropping += 1
			return
		if self.dropping:
			return
		allowed = self.allow_all or tag in TEXT_TAGS
		if not allowed:
			return
		self.out.append("<" + tag + self._attrs(tag, attrs) + ">")
		if tag not in VOID_TAGS:
			self.stack.append(tag)

	def handle_startendtag(self, tag, attrs):
		tag = tag.lower()
		if tag in RAW_DROP_TAGS or self.dropping:
			return
		allowed = self.allow_all or tag in TEXT_TAGS
		if not allowed:
			return
		self.out.append("<" + tag + self._attrs(tag, attrs) + " />")

	def handle_endtag(self, tag):
		tag = tag.lower()
		if tag in RAW_DROP_TAGS:
			if self.dropping:
				self.dropping -= 1
			return
		if self.dropping:
			return
		if tag in VOID_TAGS:
			return
		if tag in self.stack:
			while self.stack and self.stack[-1] != tag:
				self.stack.pop()
			if self.stack:
				self.stack.pop()
				self.out.append("</" + tag + ">")

	def handle_data(self, data):
		if self.dropping:
			return
		self.out.append(_escape_text(data))

	def handle_entityref(self, name):
		if self.dropping:
			return
		self.out.append("&" + name + ";")

	def handle_charref(self, name):
		if self.dropping:
			return
		self.out.append("&#" + name + ";")

	def handle_comment(self, data):
		if self.dropping:
			return
		# Keep conditional comments and the unsubscribe placeholder.
		self.out.append("<!--" + data + "-->")

	def _attrs(self, tag: str, attrs) -> str:
		allowed = ATTR_ALLOWLIST.get(tag)
		rendered: list[str] = []
		seen: set[str] = set()
		for raw_name, raw_value in attrs:
			name = (raw_name or "").lower()
			if name in seen or name.startswith("on"):
				continue
			value = raw_value if raw_value is not None else ""
			if not self.allow_all:
				if allowed is not None and name not in allowed:
					continue
				if allowed is None and name not in STYLE_ONLY_ATTRS and tag not in {"a", "img"}:
					continue
			if name in {"href", "src"} and not _safe_url(value):
				continue
			if name == "style" and BAD_STYLE_RE.search(value):
				value = BAD_STYLE_RE.sub("", value)
			if name == "target":
				value = "_blank"
			rendered.append(f' {name}="{html.escape(value, quote=True)}"')
			seen.add(name)
		if tag == "a" and "target" in seen and "rel" not in seen:
			rendered.append(' rel="noopener"')
		return "".join(rendered)


def _escape_text(value: str) -> str:
	# Keep Jinja and already-written entities readable, but neutralise stray
	# angle brackets/ampersands so the browser cannot re-interpret them.
	value = value.replace("&", "&amp;")
	value = value.replace("<", "&lt;")
	return value.replace(">", "&gt;")


def _safe_url(value: str) -> bool:
	value = (value or "").strip()
	if not value:
		return True
	if DYNAMIC_RE.search(value):
		return True
	if BAD_URL_RE.search(value):
		return False
	lower = value.lower()
	if lower.startswith(SAFE_URL_PREFIXES):
		return True
	# Bare domains and relative paths without a scheme are fine.
	return ":" not in value.split("/")[0]


def sanitize_text_html(value: str) -> str:
	value = value or ""
	if not value.strip():
		return value
	value, originals = protect_jinja(value)
	parser = _Sanitizer(allow_all=False)
	try:
		parser.feed(value)
		parser.close()
	except Exception:
		# Never lose content because of a malformed fragment.
		return restore_jinja(html.escape(value), originals)
	return restore_jinja("".join(parser.out), originals)


def sanitize_raw_html(value: str) -> str:
	value = value or ""
	if not value.strip():
		return value
	value, originals = protect_jinja(value)
	parser = _Sanitizer(allow_all=True)
	try:
		parser.feed(value)
		parser.close()
	except Exception:
		return ""
	return restore_jinja("".join(parser.out), originals)


def strip_tags(value: str) -> str:
	"""Best-effort text extraction used for plain-text versions."""
	value = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "", value or "")
	value = re.sub(r"(?i)<br\s*/?>", "\n", value)
	value = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)>", "\n", value)
	value = re.sub(r"<[^>]+>", "", value)
	value = html.unescape(value)
	value = re.sub(r"[ \t]+\n", "\n", value)
	value = re.sub(r"\n{3,}", "\n\n", value)
	return value.strip()
