"""EveryAction-style template syntax -> portable Jinja.

EveryAction lets users write merge fields and conditional content with a
handlebars-like syntax::

    {{ if equals(StateOrProvince,'NH') }}New Hampshire{{ else }}National{{ end }}
    {{each GenderArray}}{{loop_var}},{{end}}

ERPNext stores Email Templates as Jinja and renders them with
``frappe.render_template``. This module translates the EveryAction control
syntax, convenience macros and merge-field aliases into plain Jinja so the
compiled HTML can be sent by ERPNext's core Email Campaign job without any
custom runtime.

The translator is deliberately conservative: anything that is already valid
Jinja (``{% if %}``, ``{{ doc.first_name }}``) is passed through untouched.
"""

from __future__ import annotations

import re
from typing import Iterable

CONTROL_WORDS = {
	"if",
	"elseif",
	"elif",
	"else",
	"end",
	"each",
	"endif",
	"endfor",
	"for",
}

JINJA_KEYWORDS = {
	"and",
	"or",
	"not",
	"in",
	"is",
	"if",
	"else",
	"elif",
	"for",
	"endfor",
	"endif",
	"true",
	"false",
	"none",
	"null",
	"doc",
	"loop_var",
}

COMPARISON_MACROS = {
	"equals": "==",
	"not_equals": "!=",
	"less_than": "<",
	"greater_than": ">",
	"less_than_or_equal_to": "<=",
	"greater_than_or_equal_to": ">=",
}

CONTAINMENT_MACROS = {
	"contains": "in",
	"not_contains": "not in",
}

ALL_MACROS = set(COMPARISON_MACROS) | set(CONTAINMENT_MACROS)

_TOKEN_RE = re.compile(r"\{\{\s*(.*?)\s*\}\}", re.DOTALL)
_IDENTIFIER_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_GLOBAL_TOKEN_RE = re.compile(r"\{\{\s*([A-Za-z][A-Za-z0-9_ ]*?)\s*\}\}")


class MacroError(ValueError):
	"""Raised for malformed EveryAction-style content."""


def normalize_name(value: str) -> str:
	"""Case/space/underscore insensitive key used for alias lookup."""
	return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def build_alias_map(merge_fields: Iterable[dict]) -> dict[str, dict]:
	"""Map every label and alias of a merge field to its expression."""
	aliases: dict[str, dict] = {}
	for field in merge_fields or []:
		expression = (field.get("expression") or "").strip()
		if not expression:
			continue
		entry = {
			"expression": expression,
			"fallback": field.get("fallback") or "",
		}
		names = [field.get("label") or ""]
		names += [part.strip() for part in (field.get("aliases") or "").split(",")]
		for name in names:
			key = normalize_name(name)
			if key and key not in aliases:
				aliases[key] = entry
	return aliases


def replace_globals(content: str, values: dict[str, str]) -> str:
	"""Replace ``{{ OrganizationAddress }}`` style tokens with literal values.

	Values are literal HTML snippets (already escaped by the caller); they are
	never evaluated as Jinja.
	"""
	if not values:
		return content

	normalized = {normalize_name(key): value for key, value in values.items()}

	def repl(match: re.Match) -> str:
		value = normalized.get(normalize_name(match.group(1)))
		return value if value is not None else match.group(0)

	return _GLOBAL_TOKEN_RE.sub(repl, content)


def translate_template(content: str, aliases: dict[str, dict] | None = None) -> str:
	"""Translate a full template (subject, preheader or block HTML)."""
	if not content:
		return content
	aliases = aliases or {}
	out: list[str] = []
	stack: list[str] = []
	position = 0

	for match in _TOKEN_RE.finditer(content):
		out.append(content[position : match.start()])
		inner = match.group(1)
		first = re.match(r"\s*([A-Za-z_]+)", inner)
		word = first.group(1).lower() if first else ""

		if word in CONTROL_WORDS:
			rest = inner[first.end() :].strip() if first else ""
			if word == "if":
				out.append("{% if " + _translate_expression(rest, aliases, fallback=False) + " %}")
				stack.append("if")
			elif word in {"elseif", "elif"}:
				_require_stack(stack, "if", inner)
				out.append("{% elif " + _translate_expression(rest, aliases, fallback=False) + " %}")
			elif word == "else":
				if not stack or stack[-1] not in {"if", "for"}:
					raise MacroError("Found {{ else }} without an open {{ if }} or {{ each }} block.")
				out.append("{% else %}")
			elif word == "each":
				out.append(
					"{% for loop_var in " + _translate_expression(rest, aliases, fallback=False) + " %}"
				)
				stack.append("for")
			elif word == "for":
				out.append("{% " + rest + " %}")
				stack.append("for")
			elif word == "end":
				if not stack:
					raise MacroError("Found {{ end }} without a matching {{ if }} or {{ each }}.")
				kind = stack.pop()
				out.append("{% endfor %}" if kind == "for" else "{% endif %}")
			elif word in {"endif", "endfor"}:
				expected = "if" if word == "endif" else "for"
				_require_stack(stack, expected, inner)
				stack.pop()
				out.append("{% " + word + " %}")
		else:
			expression = _translate_expression(inner, aliases, fallback=True)
			out.append("{{ " + expression + " }}")
		position = match.end()

	if stack:
		kind = stack[-1]
		raise MacroError(
			"Your message has an unclosed conditional block. "
			f"Add {{{{ end }}}} (or {{{{ endif }}}}) to close the last {kind}."
		)

	out.append(content[position:])
	return _translate_jinja_blocks("".join(out), aliases)


def _translate_jinja_blocks(content: str, aliases: dict[str, dict]) -> str:
	"""Also resolve merge-field aliases inside hand-written ``{% %}`` blocks."""

	def repl(match: re.Match) -> str:
		inner = match.group(1)
		word_match = re.match(r"\s*([A-Za-z_]+)", inner)
		word = word_match.group(1) if word_match else ""
		if word.lower() in {"comment", "raw", "endraw", "include", "extends", "block", "endblock"}:
			return match.group(0)
		return "{% " + _translate_expression(inner, aliases, fallback=False) + " %}"

	# Only translate expressions in tags that look like control statements.
	return re.sub(
		r"\{%\s*((?:if|elif|elseif|for)\b.*?)\s*%\}",
		repl,
		content,
		flags=re.DOTALL,
	)


def _require_stack(stack: list[str], expected: str | None, token: str) -> None:
	if not stack:
		raise MacroError(f"Found {{{{ {token} }}}} without an open conditional block.")
	if expected and stack[-1] != expected:
		raise MacroError(
			f"Found {{{{ {token} }}}} but the open block is "
			f"{'a loop' if stack[-1] == 'for' else 'an if'}."
		)


def _translate_expression(expression: str, aliases: dict[str, dict], fallback: bool) -> str:
	expression = expression.strip()
	if not expression:
		return expression
	expression = _translate_macros(expression)
	expression = _replace_aliases(expression, aliases, fallback=fallback)
	return expression


def _translate_macros(expression: str) -> str:
	"""Rewrite ``equals(a, b)`` (and friends) into Jinja comparisons."""
	out: list[str] = []
	i = 0
	length = len(expression)
	while i < length:
		ch = expression[i]
		if ch in {"'", '"'}:
			end = _skip_string(expression, i)
			out.append(expression[i:end])
			i = end
			continue
		if ch.isalpha() or ch == "_":
			match = _IDENTIFIER_RE.match(expression, i)
			name = match.group(0) if match else ""
			end_name = match.end() if match else i
			if name in ALL_MACROS:
				j = end_name
				while j < length and expression[j].isspace():
					j += 1
				if j < length and expression[j] == "(":
					close = _find_matching_paren(expression, j)
					if close == -1:
						raise MacroError(f"Unclosed parenthesis after {name}().")
					inner = expression[j + 1 : close]
					args = _split_top_level(inner)
					if len(args) != 2:
						raise MacroError(f"{name}() expects two values, got {len(args)}.")
					left = _translate_macros(args[0].strip())
					right = _translate_macros(args[1].strip())
					operator = COMPARISON_MACROS.get(name) or CONTAINMENT_MACROS[name]
					if name in {"contains", "not_contains"}:
						out.append(f"({right} {operator} {left})")
					else:
						out.append(f"({left} {operator} {right})")
					i = close + 1
					continue
			out.append(expression[i:end_name])
			i = end_name
			continue
		out.append(ch)
		i += 1
	return "".join(out)


def _skip_string(text: str, start: int) -> int:
	quote = text[start]
	i = start + 1
	while i < len(text):
		if text[i] == "\\":
			i += 2
			continue
		if text[i] == quote:
			return i + 1
		i += 1
	return len(text)


def _find_matching_paren(text: str, start: int) -> int:
	depth = 0
	i = start
	while i < len(text):
		ch = text[i]
		if ch in {"'", '"'}:
			i = _skip_string(text, i)
			continue
		if ch == "(":
			depth += 1
		elif ch == ")":
			depth -= 1
			if depth == 0:
				return i
		i += 1
	return -1


def _split_top_level(text: str) -> list[str]:
	parts: list[str] = []
	depth = 0
	start = 0
	i = 0
	while i < len(text):
		ch = text[i]
		if ch in {"'", '"'}:
			i = _skip_string(text, i)
			continue
		if ch in "([{":
			depth += 1
		elif ch in ")]}":
			depth -= 1
		elif ch == "," and depth == 0:
			parts.append(text[start:i])
			start = i + 1
		i += 1
	parts.append(text[start:])
	return parts


def _replace_aliases(expression: str, aliases: dict[str, dict], fallback: bool) -> str:
	if not aliases:
		return expression
	out: list[str] = []
	i = 0
	length = len(expression)
	while i < length:
		ch = expression[i]
		if ch in {"'", '"'}:
			end = _skip_string(expression, i)
			out.append(expression[i:end])
			i = end
			continue
		if ch.isalpha() or ch == "_":
			match = _IDENTIFIER_RE.match(expression, i)
			name = match.group(0) if match else ""
			end = match.end() if match else i
			previous = expression[i - 1] if i > 0 else ""
			next_char = expression[end] if end < length else ""
			key = normalize_name(name)
			is_attribute = previous == "."
			is_call = next_char == "("
			if (
				key in aliases
				and not is_attribute
				and not is_call
				and name.lower() not in JINJA_KEYWORDS
			):
				alias = aliases[key]
				replacement = alias["expression"]
				# A bare merge-field token gets a fallback; comparisons do not
				# (a default would change the meaning of the condition).
				standalone = expression.strip() == name
				if fallback and standalone and alias.get("fallback"):
					replacement = _with_fallback(replacement, alias["fallback"])
				out.append(replacement)
			else:
				out.append(name)
			i = end
			continue
		out.append(ch)
		i += 1
	return "".join(out)


def _with_fallback(expression: str, fallback: str) -> str:
	expression = expression.strip()
	if not fallback:
		return expression
	escaped = fallback.replace("\\", "\\\\").replace("'", "\\'")
	return f"{expression}|default('{escaped}', true)"


def build_condition_expression(condition: dict, aliases: dict[str, dict]) -> str:
	"""Turn a row's simple display-condition into a Jinja expression."""
	condition = condition or {}
	raw_expression = (condition.get("expression") or "").strip()
	if raw_expression:
		return _translate_expression(raw_expression, aliases, fallback=False)

	field = (condition.get("field") or "").strip()
	if not field:
		return ""
	expression = _translate_expression(field, aliases, fallback=False)
	if expression == field and not field.startswith("doc."):
		# Allow field names such as "state" or "donor_since".
		if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]*", field):
			expression = "doc." + field

	operator = condition.get("operator") or "equals"
	value = (condition.get("value") or "").strip()

	if operator == "is_set":
		return f"{expression}"
	if operator == "is_not_set":
		return f"not {expression}"

	escaped = value.replace("\\", "\\\\").replace("'", "\\'")
	if operator == "contains":
		return f"'{escaped}' in ({expression} or '')"
	if operator == "not_contains":
		return f"'{escaped}' not in ({expression} or '')"

	operators = {
		"equals": "==",
		"not_equals": "!=",
		"greater_than": ">",
		"less_than": "<",
	}
	op = operators.get(operator, "==")
	return f"({expression} or '') {op} '{escaped}'"


def is_balanced(content: str) -> bool:
	"""Cheap pre-check used by editor previews."""
	try:
		translate_template(content)
	except MacroError:
		return False
	return True
