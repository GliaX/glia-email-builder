"""Design document schema: normalisation, defaults and validation.

The design JSON is the editable source of truth. It is always normalised
server-side before it is compiled, so the browser can be forgiving about
missing fields.
"""

from __future__ import annotations

import copy
import re
import uuid
from typing import Any

from .defaults import (
	BLOCK_TYPES,
	BUILDER_VERSION,
	DEFAULT_BLOCK_STYLES,
	DEFAULT_DESIGN_SETTINGS,
	DEFAULT_ROW_STYLES,
	FONT_CHOICES,
	SOCIAL_NETWORKS,
)

MAX_ROWS = 200
MAX_COLUMNS = 6
MAX_BLOCKS = 500
MAX_JSON_BYTES = 2_000_000


class DesignError(ValueError):
	"""Raised when a design document cannot be used."""


def new_id(prefix: str = "b") -> str:
	"""Return a short, URL-safe unique id for a row/column/block."""
	return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _as_dict(value: Any) -> dict:
	return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list:
	return value if isinstance(value, list) else []


def _num(value: Any, default: float, minimum: float = 0, maximum: float = 10000) -> float:
	try:
		number = float(value)
	except (TypeError, ValueError):
		return float(default)
	if number < minimum:
		return float(minimum)
	if number > maximum:
		return float(maximum)
	return number


def _int(value: Any, default: int, minimum: int = 0, maximum: int = 10000) -> int:
	return int(_num(value, default, minimum, maximum))


def _bool(value: Any, default: bool = False) -> bool:
	if isinstance(value, bool):
		return value
	if isinstance(value, str):
		return value.strip().lower() in {"1", "true", "yes", "on"}
	if value is None:
		return default
	return bool(value)


def _str(value: Any, default: str = "", limit: int = 200_000) -> str:
	if value is None:
		return default
	text = value if isinstance(value, str) else str(value)
	return text[:limit]


def _color(value: Any, default: str = "") -> str:
	value = _str(value, default, 32).strip()
	if not value:
		return default
	if re.fullmatch(r"#[0-9a-fA-F]{3,8}", value):
		return value
	if re.fullmatch(r"rgba?\([0-9.,%\s]+\)", value):
		return value
	# Allow Jinja expressions in colours; they are rendered before use.
	if "{{" in value or "{%" in value:
		return value
	return default


def _spacing(value: Any, default: dict) -> dict:
	value = _as_dict(value)
	return {
		"top": _int(value.get("top", default["top"]), default["top"], 0, 400),
		"right": _int(value.get("right", default["right"]), default["right"], 0, 400),
		"bottom": _int(value.get("bottom", default["bottom"]), default["bottom"], 0, 400),
		"left": _int(value.get("left", default["left"]), default["left"], 0, 400),
	}


def _common_styles(raw: Any) -> dict:
	raw = _as_dict(raw)
	return {
		"padding": _spacing(raw.get("padding"), DEFAULT_BLOCK_STYLES["padding"]),
		"background_color": _color(raw.get("background_color"), ""),
		"hide_mobile": _bool(raw.get("hide_mobile")),
		"hide_desktop": _bool(raw.get("hide_desktop")),
		"locked": _bool(raw.get("locked")),
	}


# ---------------------------------------------------------------------------
# Block factories
# ---------------------------------------------------------------------------


def _default_content(block_type: str) -> dict:
	return {
		"title": {
			"text": "I'm a new title block",
			"level": 2,
		},
		"paragraph": {
			"html": "<p>I'm a new paragraph block.</p>",
		},
		"list": {
			"html": "<ul><li>List item one</li><li>List item two</li></ul>",
			"list_style": "disc",
			"list_start": 1,
		},
		"image": {
			"src": "",
			"alt": "",
			"link": "",
			"width": 100,
			"align": "center",
			"border_radius": 0,
		},
		"button": {
			"text": "Donate now",
			"link": "{{ DonateURL }}",
			"align": "center",
			"full_width": False,
		},
		"divider": {
			"width": 100,
			"thickness": 1,
			"color": "#DDE5E3",
			"align": "center",
		},
		"spacer": {"height": 24},
		"social": {
			"networks": [
				{"key": net["key"], "url": ""} for net in SOCIAL_NETWORKS
			],
			"icon_size": 24,
			"spacing": 12,
			"align": "center",
		},
		"html": {"html": "<p>Add your HTML here.</p>"},
		"video": {
			"url": "",
			"thumbnail": "",
			"align": "center",
			"width": 100,
		},
		"text": {
			"html": "I'm a new Text block ready for your content.",
		},
	}.get(block_type, {"html": ""})


def _default_typography(block_type: str) -> dict:
	base = {
		"font_family": "",
		"font_size": 16,
		"line_height": 1.6,
		"letter_spacing": 0,
		"color": "",
		"align": "left",
	}
	if block_type == "title":
		base.update({"font_size": 32, "line_height": 1.25})
	elif block_type == "paragraph":
		base.update({"paragraph_spacing": 12, "direction": "ltr"})
	elif block_type == "text":
		base.update({"line_height": 1.5})
	return base


def new_block(block_type: str, **overrides: Any) -> dict:
	if block_type not in BLOCK_TYPES:
		raise DesignError(f"Unknown block type: {block_type}")

	block = {
		"id": b_id if (b_id := overrides.pop("id", None)) else new_id("block"),
		"type": block_type,
		"styles": {
			**_common_styles({}),
			**_default_typography(block_type),
		},
		"content": _default_content(block_type),
	}
	if block_type == "button":
		block["styles"].update(
			{
				"background_color": "",
				"text_color": "",
				"border_radius": 6,
				"bold": True,
				"full_width": False,
			}
		)
	if block_type == "divider":
		block["styles"].update({"padding": {"top": 16, "right": 0, "bottom": 16, "left": 0}})
	if block_type == "social":
		block["styles"].update({"padding": {"top": 12, "right": 0, "bottom": 12, "left": 0}})
	if block_type == "image":
		block["styles"].update({"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}})
	if block_type == "spacer":
		block["styles"].update({"padding": {"top": 0, "right": 0, "bottom": 0, "left": 0}})

	content_overrides = overrides.pop("content", None)
	style_overrides = overrides.pop("styles", None)
	block.update(overrides)
	if content_overrides:
		block["content"].update(content_overrides)
	if style_overrides:
		block["styles"].update(style_overrides)
	return block


def new_row(n_columns: int = 1, **overrides: Any) -> dict:
	n_columns = max(1, min(MAX_COLUMNS, int(n_columns)))
	widths = _equal_widths(n_columns)
	row = {
		"id": r_id if (r_id := overrides.pop("id", None)) else new_id("row"),
		"styles": copy.deepcopy(DEFAULT_ROW_STYLES),
		"condition": {"enabled": False, "field": "", "operator": "equals", "value": "", "expression": ""},
		"columns": [{"id": new_id("col"), "width": width, "blocks": []} for width in widths],
	}
	style_overrides = overrides.pop("styles", None)
	row.update(overrides)
	if style_overrides:
		row["styles"].update(style_overrides)
	return row


def _equal_widths(count: int) -> list[float]:
	if count < 1:
		return [100]
	base = round(100 / count, 2)
	widths = [base] * count
	widths[-1] = round(100 - sum(widths[:-1]), 2)
	return widths


# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------


def normalize_settings(raw: Any) -> dict:
	raw = _as_dict(raw)
	out = copy.deepcopy(DEFAULT_DESIGN_SETTINGS)
	for key, value in raw.items():
		if key not in out:
			continue
		out[key] = value
	out["width"] = _int(out.get("width"), 600, 320, 720)
	out["align"] = out.get("align") if out.get("align") in {"left", "center", "right"} else "center"
	out["background_color"] = _color(out.get("background_color"), DEFAULT_DESIGN_SETTINGS["background_color"])
	out["content_background"] = _color(
		out.get("content_background"), DEFAULT_DESIGN_SETTINGS["content_background"]
	)
	out["text_color"] = _color(out.get("text_color"), DEFAULT_DESIGN_SETTINGS["text_color"])
	out["link_color"] = _color(out.get("link_color"), "")
	out["button_color"] = _color(out.get("button_color"), "")
	out["button_text_color"] = _color(out.get("button_text_color"), "")
	out["font_family"] = out.get("font_family") if out.get("font_family") in FONT_CHOICES else ""
	out["font_size"] = _int(out.get("font_size"), 16, 8, 72)
	out["preheader"] = _str(out.get("preheader"), "", 500)
	out["email_title"] = _str(out.get("email_title"), "", 300)
	out["subject_template"] = _str(out.get("subject_template"), "", 500)
	out["border_radius"] = _int(out.get("border_radius"), 0, 0, 40)
	return out


def normalize_row(raw: Any, index: int = 0) -> dict:
	raw = _as_dict(raw)
	row = {
		"id": _str(raw.get("id"), "", 64).strip() or new_id("row"),
		"styles": _normalize_row_styles(raw.get("styles")),
		"condition": _normalize_condition(raw.get("condition")),
		"columns": [],
	}
	columns = _as_list(raw.get("columns"))
	if not columns:
		columns = [{"width": 100, "blocks": []}]

	for col_index, raw_col in enumerate(columns[:MAX_COLUMNS]):
		col = _as_dict(raw_col)
		blocks = []
		for raw_block in _as_list(col.get("blocks")):
			block = normalize_block(raw_block)
			if block:
				blocks.append(block)
		row["columns"].append(
			{
				"id": _str(col.get("id"), "", 64).strip() or new_id("col"),
				"width": _num(col.get("width"), 100 / len(columns), 5, 100),
				"blocks": blocks,
			}
		)

	# Make widths add up to 100 while preserving the user's intent.
	total = sum(col["width"] for col in row["columns"])
	if total <= 0:
		widths = _equal_widths(len(row["columns"]))
		for col, width in zip(row["columns"], widths):
			col["width"] = width
	elif abs(total - 100) > 0.5:
		scale = 100 / total
		for col in row["columns"]:
			col["width"] = round(col["width"] * scale, 2)
		row["columns"][-1]["width"] = round(
			100 - sum(col["width"] for col in row["columns"][:-1]), 2
		)
	return row


def _normalize_row_styles(raw: Any) -> dict:
	raw = _as_dict(raw)
	padding_default = DEFAULT_ROW_STYLES["padding"]
	return {
		"background_color": _color(raw.get("background_color"), ""),
		"background_image": _str(raw.get("background_image"), "", 2000),
		"padding": _spacing(raw.get("padding"), padding_default),
		"columns_gap": _int(raw.get("columns_gap"), 20, 0, 80),
		"vertical_align": raw.get("vertical_align")
		if raw.get("vertical_align") in {"top", "middle", "bottom"}
		else "top",
		"border_radius": _int(raw.get("border_radius"), 0, 0, 40),
		"hide_mobile": _bool(raw.get("hide_mobile")),
		"hide_desktop": _bool(raw.get("hide_desktop")),
		"reverse_stack": _bool(raw.get("reverse_stack")),
		"no_stack": _bool(raw.get("no_stack")),
		"locked": _bool(raw.get("locked")),
	}


def _normalize_condition(raw: Any) -> dict:
	raw = _as_dict(raw)
	operator = raw.get("operator") if raw.get("operator") in _CONDITION_OPERATORS else "equals"
	return {
		"enabled": _bool(raw.get("enabled")),
		"field": _str(raw.get("field"), "", 200),
		"operator": operator,
		"value": _str(raw.get("value"), "", 500),
		"expression": _str(raw.get("expression"), "", 1000),
	}


_CONDITION_OPERATORS = {
	"equals",
	"not_equals",
	"contains",
	"not_contains",
	"is_set",
	"is_not_set",
	"greater_than",
	"less_than",
}


def normalize_block(raw: Any) -> dict | None:
	raw = _as_dict(raw)
	block_type = _str(raw.get("type"), "", 40).strip().lower()
	if block_type not in BLOCK_TYPES:
		if not raw:
			return None
		raise DesignError(f"Unknown block type: {block_type or '(missing)'}")

	default = new_block(block_type)
	block = {
		"id": _str(raw.get("id"), "", 64).strip() or default["id"],
		"type": block_type,
		"styles": _normalize_block_styles(block_type, raw.get("styles"), default["styles"]),
		"content": _normalize_content(block_type, raw.get("content"), default["content"]),
	}
	if _bool(raw.get("locked")):
		block["styles"]["locked"] = True
	return block


def _normalize_block_styles(block_type: str, raw: Any, default: dict) -> dict:
	raw = _as_dict(raw)
	styles = _common_styles(raw)
	styles.update(
		{
			"font_family": raw.get("font_family")
			if raw.get("font_family") in FONT_CHOICES
			else default.get("font_family", ""),
			"font_size": _int(raw.get("font_size"), default.get("font_size", 16), 8, 96),
			"line_height": _num(raw.get("line_height"), default.get("line_height", 1.6), 0.8, 4),
			"letter_spacing": _num(raw.get("letter_spacing"), default.get("letter_spacing", 0), -2, 12),
			"color": _color(raw.get("color"), default.get("color", "")),
			"align": raw.get("align")
			if raw.get("align") in {"left", "center", "right", "justify"}
			else default.get("align", "left"),
		}
	)
	if block_type == "paragraph":
		styles["paragraph_spacing"] = _int(
			raw.get("paragraph_spacing"), default.get("paragraph_spacing", 12), 0, 80
		)
		styles["direction"] = raw.get("direction") if raw.get("direction") == "rtl" else "ltr"
	if block_type == "title":
		styles["level"] = None  # level lives in content
	if block_type == "button":
		styles.update(
			{
				"background_color": _color(raw.get("background_color"), default.get("background_color", "")),
				"text_color": _color(raw.get("text_color"), default.get("text_color", "")),
				"border_radius": _int(
					raw.get("border_radius"), default.get("border_radius", 6), 0, 40
				),
				"bold": _bool(raw.get("bold"), default.get("bold", True)),
				"full_width": _bool(raw.get("full_width"), False),
			}
		)
	return {k: v for k, v in styles.items() if k != "level"}


def _normalize_content(block_type: str, raw: Any, default: dict) -> dict:
	raw = _as_dict(raw)
	if block_type == "title":
		level = _int(raw.get("level"), default.get("level", 2), 1, 3)
		return {"text": _str(raw.get("text"), default["text"], 1000), "level": level}
	if block_type in {"paragraph", "text", "list"}:
		content = {"html": _str(raw.get("html"), default.get("html", ""), 150_000)}
		if block_type == "list":
			content["list_style"] = (
				raw.get("list_style")
				if raw.get("list_style")
				in {"disc", "decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman", "square", "none"}
				else "disc"
			)
			content["list_start"] = _int(raw.get("list_start"), 1, 1, 999)
		return content
	if block_type == "image":
		return {
			"src": _str(raw.get("src"), "", 2000).strip(),
			"alt": _str(raw.get("alt"), "", 300),
			"link": _str(raw.get("link"), "", 2000).strip(),
			"width": _int(raw.get("width"), 100, 5, 100),
			"align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "center",
			"border_radius": _int(raw.get("border_radius"), 0, 0, 80),
		}
	if block_type == "button":
		return {
			"text": _str(raw.get("text"), default.get("text", "Donate now"), 300) or "Donate now",
			"link": _str(raw.get("link"), default.get("link", ""), 2000).strip(),
			"align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "center",
			"full_width": _bool(raw.get("full_width"), False),
		}
	if block_type == "divider":
		return {
			"width": _int(raw.get("width"), 100, 1, 100),
			"thickness": _int(raw.get("thickness"), 1, 1, 12),
			"color": _color(raw.get("color"), "#DDE5E3"),
			"align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "center",
		}
	if block_type == "spacer":
		return {"height": _int(raw.get("height"), 24, 1, 300)}
	if block_type == "social":
		known = {net["key"]: net for net in SOCIAL_NETWORKS}
		networks = []
		seen = set()
		for raw_net in _as_list(raw.get("networks"))[:12]:
			raw_net = _as_dict(raw_net)
			key = _str(raw_net.get("key"), "", 40).lower()
			if key not in known or key in seen:
				continue
			seen.add(key)
			networks.append({"key": key, "url": _str(raw_net.get("url"), "", 2000).strip()})
		if not networks:
			networks = [{"key": net["key"], "url": ""} for net in SOCIAL_NETWORKS[:4]]
		return {
			"networks": networks,
			"icon_size": _int(raw.get("icon_size"), 24, 12, 48),
			"spacing": _int(raw.get("spacing"), 12, 0, 60),
			"align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "center",
		}
	if block_type == "html":
		return {"html": _str(raw.get("html"), default.get("html", ""), 150_000)}
	if block_type == "video":
		return {
			"url": _str(raw.get("url"), "", 2000).strip(),
			"thumbnail": _str(raw.get("thumbnail"), "", 2000).strip(),
			"align": raw.get("align") if raw.get("align") in {"left", "center", "right"} else "center",
			"width": _int(raw.get("width"), 100, 20, 100),
		}
	return {}


# ---------------------------------------------------------------------------
# Document level
# ---------------------------------------------------------------------------


def normalize_design(raw: Any) -> dict:
	raw = _as_dict(raw)
	design = {
		"version": BUILDER_VERSION,
		"settings": normalize_settings(raw.get("settings")),
		"rows": [],
	}
	rows = _as_list(raw.get("rows"))
	if len(rows) > MAX_ROWS:
		raise DesignError(f"A message cannot have more than {MAX_ROWS} rows.")
	for index, raw_row in enumerate(rows):
		design["rows"].append(normalize_row(raw_row, index))
	validate_design(design)
	return design


def validate_design(design: dict) -> None:
	if not isinstance(design, dict):
		raise DesignError("The design must be an object.")
	rows = design.get("rows")
	if not isinstance(rows, list):
		raise DesignError("The design must have a list of rows.")
	if len(rows) > MAX_ROWS:
		raise DesignError(f"A message cannot have more than {MAX_ROWS} rows.")

	total_blocks = 0
	ids: set[str] = set()

	def check_id(value):
		if not value:
			return
		if value in ids:
			raise DesignError("The design contains duplicate element ids.")
		ids.add(value)

	for row_index, row in enumerate(rows):
		if not isinstance(row, dict) or not isinstance(row.get("columns"), list):
			raise DesignError(f"Row {row_index + 1} is invalid.")
		if not row["columns"]:
			raise DesignError(f"Row {row_index + 1} must have at least one column.")
		if len(row["columns"]) > MAX_COLUMNS:
			raise DesignError(f"Row {row_index + 1} has too many columns.")
		check_id(row.get("id"))
		for column in row["columns"]:
			if not isinstance(column, dict) or not isinstance(column.get("blocks"), list):
				raise DesignError(f"A column in row {row_index + 1} is invalid.")
			check_id(column.get("id"))
			for block in column["blocks"]:
				if not isinstance(block, dict) or block.get("type") not in BLOCK_TYPES:
					raise DesignError(f"Row {row_index + 1} contains an unknown block.")
				total_blocks += 1
				check_id(block.get("id"))
	if total_blocks > MAX_BLOCKS:
		raise DesignError(f"A message cannot have more than {MAX_BLOCKS} blocks.")


def count_blocks(design: dict) -> int:
	return sum(
		len(column.get("blocks", []))
		for row in _as_list(design.get("rows"))
		for column in _as_list(row.get("columns"))
	)


def iter_blocks(design: dict):
	"""Yield (row, column, block) for every block in document order."""
	for row in _as_list(design.get("rows")):
		for column in _as_list(row.get("columns")):
			for block in _as_list(column.get("blocks")):
				yield row, column, block


def new_design(settings: dict | None = None) -> dict:
	return normalize_design(
		{
			"version": BUILDER_VERSION,
			"settings": settings or {},
			"rows": [],
		}
	)


def blank_design(settings: dict | None = None, with_scaffold: bool = False) -> dict:
	"""A new message. With scaffold, add a logo header and footer."""
	design = new_design(settings)
	if with_scaffold:
		design["rows"] = [
			new_row(
				1,
				styles={
					"padding": {"top": 18, "right": 20, "bottom": 18, "left": 20},
					"background_color": "#001F27",
				},
				columns=[
					{
						"width": 100,
						"blocks": [
							new_block(
								"image",
								content={
									"src": "/assets/glia_email_builder/images/glia-logo-white.png",
									"alt": "Glia",
									"width": 96,
									"align": "center",
									"link": "{{ WebsiteURL }}",
								},
							)
						],
					}
				],
			),
			new_row(
				1,
				styles={
					"padding": {"top": 24, "right": 24, "bottom": 24, "left": 24},
				},
				columns=[
					{
						"width": 100,
						"blocks": [
							new_block(
								"paragraph",
								content={"html": "<p>Start writing your message here.</p>"},
							)
						],
					}
				],
			),
			new_row(
				1,
				styles={
					"padding": {"top": 20, "right": 24, "bottom": 20, "left": 24},
					"background_color": "#F3F6F5",
				},
				columns=[
					{
						"width": 100,
						"blocks": [
							new_block(
								"paragraph",
								styles={"font_size": 12, "line_height": 1.6, "align": "center"},
								content={
									"html": (
										"<p>{{ OrganizationAddress }}</p>"
										"<p>{{ UnsubscribeLink }}</p>"
									)
								},
							)
						],
					}
				],
			),
		]
	return normalize_design(design)


def coerce_design_json(value: Any) -> dict:
	"""Accept a dict or a JSON string and return a normalised design."""
	import json

	if isinstance(value, str):
		try:
			value = json.loads(value)
		except json.JSONDecodeError as exc:
			raise DesignError(f"The design is not valid JSON: {exc.msg}") from exc
	return normalize_design(value)


def validate_ids(design: dict) -> None:
	"""Safety helper used by tests; duplicate ids break selection."""
	seen = set()
	for row in design.get("rows", []):
		for item in [row.get("id")] + [c.get("id") for c in row.get("columns", [])]:
			if item and item in seen:
				raise DesignError("Duplicate id")
			if item:
				seen.add(item)
		for column in row.get("columns", []):
			for block in column.get("blocks", []):
				if block.get("id") and block["id"] in seen:
					raise DesignError("Duplicate block id")
				if block.get("id"):
					seen.add(block["id"])
