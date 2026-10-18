/**
 * Glia Email Builder - shared utilities.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};

	const GEB = window.GEB;

	GEB.core = {
		esc(value) {
			return String(value == null ? "" : value)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		},
		escAttr(value) {
			return GEB.core.esc(value);
		},
		dir(value) {
			return /[\/\\]/.test(value) ? "ltr" : "auto";
		},
		clone(value) {
			return JSON.parse(JSON.stringify(value));
		},
		uid(prefix) {
			const random = Math.random().toString(36).slice(2, 10);
			return (prefix || "id") + "_" + Date.now().toString(36).slice(-5) + random;
		},
		debounce(fn, wait) {
			let timer = null;
			return function (...args) {
				clearTimeout(timer);
				timer = setTimeout(() => fn.apply(this, args), wait || 300);
			};
		},
		throttle(fn, wait) {
			let last = 0;
			return function (...args) {
				const now = Date.now();
				if (now - last >= wait) {
					last = now;
					fn.apply(this, args);
				}
			};
		},
		getPath(object, path) {
			return String(path || "")
				.split(".")
				.reduce((obj, key) => (obj == null ? undefined : obj[key]), object);
		},
		setPath(object, path, value) {
			const keys = String(path || "").split(".");
			let target = object;
			for (let i = 0; i < keys.length - 1; i++) {
				if (target[keys[i]] == null || typeof target[keys[i]] !== "object") {
					target[keys[i]] = {};
				}
				target = target[keys[i]];
			}
			target[keys[keys.length - 1]] = value;
			return object;
		},
		deepEqual(a, b) {
			return JSON.stringify(a) === JSON.stringify(b);
		},
		clamp(value, min, max) {
			return Math.min(max, Math.max(min, value));
		},
		hexToRgba(hex, alpha) {
			const parsed = GEB.core.parseHex(hex);
			if (!parsed) return "rgba(0,0,0," + alpha + ")";
			return "rgba(" + parsed.r + "," + parsed.g + "," + parsed.b + "," + alpha + ")";
		},
		parseHex(hex) {
			if (!hex) return null;
			const value = String(hex).trim().replace("#", "");
			if (!/^[0-9a-fA-F]{3,8}$/.test(value)) return null;
			const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.slice(0, 6);
			return {
				r: parseInt(full.slice(0, 2), 16),
				g: parseInt(full.slice(2, 4), 16),
				b: parseInt(full.slice(4, 6), 16),
			};
		},
		readableTextColor(background) {
			const rgb = GEB.core.parseHex(background);
			if (!rgb) return "#FFFFFF";
			const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
			return luminance > 0.62 ? "#001F27" : "#FFFFFF";
		},
		formatTime(value) {
			const date = value instanceof Date ? value : new Date(value);
			if (isNaN(date.getTime())) return "";
			try {
				return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
			} catch (error) {
				return date.toTimeString().slice(0, 5);
			}
		},
		formatDateTime(value) {
			const date = value instanceof Date ? value : new Date(value);
			if (isNaN(date.getTime())) return "";
			try {
				return date.toLocaleString([], {
					month: "short",
					day: "numeric",
					hour: "numeric",
					minute: "2-digit",
				});
			} catch (error) {
				return date.toString().slice(0, 16);
			}
		},
		formatBytes(bytes) {
			const value = Number(bytes) || 0;
			if (value < 1024) return value + " B";
			if (value < 1024 * 1024) return Math.round(value / 1024) + " KB";
			return (value / (1024 * 1024)).toFixed(1) + " MB";
		},
		stripHtml(html) {
			const div = document.createElement("div");
			div.innerHTML = html || "";
			return div.textContent || "";
		},
		normalizeUrl(url) {
			const value = String(url || "").trim();
			if (!value) return "";
			if (/^(https?:|mailto:|tel:|#|\/|\{\{|<!--)/i.test(value)) return value;
			if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(value)) return "https://" + value;
			return value;
		},
		sanitizePastedHtml(html) {
			const div = document.createElement("div");
			div.innerHTML = html || "";
			const allowed = new Set([
				"P",
				"BR",
				"B",
				"STRONG",
				"I",
				"EM",
				"U",
				"UL",
				"OL",
				"LI",
				"A",
				"SPAN",
				"DIV",
				"BLOCKQUOTE",
				"H1",
				"H2",
				"H3",
			]);
			const walk = (node) => {
				for (const child of Array.from(node.childNodes)) {
					if (child.nodeType === Node.ELEMENT_NODE) {
						if (!allowed.has(child.tagName)) {
							const text = document.createTextNode(child.textContent || "");
							child.replaceWith(text);
							continue;
						}
						for (const attr of Array.from(child.attributes)) {
							if (attr.name !== "href" && attr.name !== "style" && attr.name !== "target") {
								child.removeAttribute(attr.name);
							}
							if (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) {
								child.removeAttribute("href");
							}
						}
						if (child.tagName === "A" && child.getAttribute("href")) {
							child.setAttribute("target", "_blank");
						}
						walk(child);
					}
				}
			};
			walk(div);
			return div.innerHTML;
		},
		download(filename, content, type) {
			const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			setTimeout(() => {
				URL.revokeObjectURL(link.href);
				link.remove();
			}, 500);
		},
		async copy(text) {
			try {
				await navigator.clipboard.writeText(text);
				return true;
			} catch (error) {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand("copy");
				textarea.remove();
				return true;
			}
		},
	};

	// ---------------------------------------------------------------------
	// Icons (inline SVG, no external icon font)
	// ---------------------------------------------------------------------
	const svg = (path, extra) =>
		'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
		'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
		(extra || "") +
		">" +
		path +
		"</svg>";

	GEB.icons = {
		title: svg('<path d="M4 6h16M4 12h10M4 18h7"/>'),
		paragraph: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
		text: svg('<path d="M5 6h14M12 6v12M9 18h6"/>'),
		list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
		image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'),
		button: svg('<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h8"/>'),
		divider: svg('<path d="M3 12h18"/><path d="M6 7h12M6 17h12" opacity=".35"/>'),
		social: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>'),
		html: svg('<path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/>'),
		video: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
		spacer: svg('<path d="M4 5h16M4 19h16"/><path d="M12 8v8M9 11l3-3 3 3M9 13l3 3 3-3"/>'),
		plus: svg('<path d="M12 5v14M5 12h14"/>'),
		trash: svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>'),
		duplicate: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
		drag: svg('<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>'),
		chevron: svg('<path d="M6 9l6 6 6-6"/>'),
		chevronLeft: svg('<path d="M15 18l-6-6 6-6"/>'),
		close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
		desktop: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
		mobile: svg('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
		eye: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
		undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
		redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
		clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
		preview: svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
		mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
		send: svg('<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>'),
		lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
		unlock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7-2.5"/>'),
		condition: svg('<path d="M4 6h4l4 6-4 6H4"/><path d="M12 12h8M16 8l4 4-4 4"/>'),
		link: svg('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'),
		unlink: svg('<path d="M15 9l2-2a4 4 0 0 0-6-6l-2 2"/><path d="M9 15l-2 2a4 4 0 0 0 6 6l2-2"/><path d="M4 4l16 16"/>'),
		color: svg('<path d="M12 3l7 7-7 7-7-7z"/><path d="M12 21a9 9 0 0 0 9-9"/>'),
		merge: svg('<path d="M8 4v6a4 4 0 0 0 4 4h4"/><path d="M16 4v6a4 4 0 0 1-4 4H8"/><path d="M12 14v6"/>'),
		settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L6 10.5a7 7 0 0 0 0 2L4 14l2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>'),
		blocks: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
		help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>'),
		imagePlus: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 9v6M9 12h6"/>'),
		alert: svg('<path d="M12 3l10 18H2z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>'),
		check: svg('<path d="M4 12l5 5L20 6"/>'),
		minus: svg('<path d="M5 12h14"/>'),
		arrowUp: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
		arrowDown: svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
		row1: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="58" height="22" rx="2"/></svg>',
		row2: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="27" height="22" rx="2"/><rect x="32" y="1" width="27" height="22" rx="2"/></svg>',
		row2lr: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="17" height="22" rx="2"/><rect x="22" y="1" width="37" height="22" rx="2"/></svg>',
		row2rl: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="37" height="22" rx="2"/><rect x="42" y="1" width="17" height="22" rx="2"/></svg>',
		row3: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="17" height="22" rx="2"/><rect x="22" y="1" width="17" height="22" rx="2"/><rect x="43" y="1" width="16" height="22" rx="2"/></svg>',
		row4: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="12" height="22" rx="2"/><rect x="16.3" y="1" width="12" height="22" rx="2"/><rect x="31.6" y="1" width="12" height="22" rx="2"/><rect x="47" y="1" width="12" height="22" rx="2"/></svg>',
		row5: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="9" height="22" rx="2"/><rect x="13" y="1" width="9" height="22" rx="2"/><rect x="25" y="1" width="9" height="22" rx="2"/><rect x="37" y="1" width="9" height="22" rx="2"/><rect x="49" y="1" width="10" height="22" rx="2"/></svg>',
		row6: '<svg viewBox="0 0 60 24"><rect x="1" y="1" width="7.5" height="22" rx="2"/><rect x="11" y="1" width="7.5" height="22" rx="2"/><rect x="21" y="1" width="7.5" height="22" rx="2"/><rect x="31" y="1" width="7.5" height="22" rx="2"/><rect x="41" y="1" width="7.5" height="22" rx="2"/><rect x="51" y="1" width="7.5" height="22" rx="2"/></svg>',
	};

	// ---------------------------------------------------------------------
	// UI primitives
	// ---------------------------------------------------------------------
	GEB.ui = {
		toast(message, type) {
			let host = document.getElementById("geb-toasts");
			if (!host) {
				host = document.createElement("div");
				host.id = "geb-toasts";
				host.className = "geb-toasts";
				document.body.appendChild(host);
			}
			const toast = document.createElement("div");
			toast.className = "geb-toast geb-toast-" + (type || "info");
			toast.innerHTML =
				'<span class="geb-toast-icon">' +
				(type === "error" ? GEB.icons.alert : type === "success" ? GEB.icons.check : GEB.icons.help) +
				"</span><span class=\"geb-toast-text\">" +
				GEB.core.esc(message) +
				"</span>";
			host.appendChild(toast);
			requestAnimationFrame(() => toast.classList.add("is-visible"));
			setTimeout(() => {
				toast.classList.remove("is-visible");
				setTimeout(() => toast.remove(), 250);
			}, 4200);
		},
		error(message) {
			GEB.ui.toast(message, "error");
		},
		success(message) {
			GEB.ui.toast(message, "success");
		},
		modal(options) {
			const opts = options || {};
			const backdrop = document.createElement("div");
			backdrop.className = "geb-modal-backdrop";
			const size = opts.size || "medium";
			backdrop.innerHTML =
				'<div class="geb-modal geb-modal-' +
				size +
				'" role="dialog" aria-modal="true">' +
				'<div class="geb-modal-head">' +
				'<div class="geb-modal-heading"><div class="geb-modal-title">' +
				GEB.core.esc(opts.title || "") +
				"</div>" +
				(opts.subtitle ? '<div class="geb-modal-subtitle">' + GEB.core.esc(opts.subtitle) + "</div>" : "") +
				"</div>" +
				'<button type="button" class="geb-icon-btn geb-modal-close" aria-label="Close">' +
				GEB.icons.close +
				"</button>" +
				"</div>" +
				'<div class="geb-modal-body"></div>' +
				'<div class="geb-modal-actions"></div>' +
				"</div>";
			document.body.appendChild(backdrop);
			document.body.classList.add("geb-modal-open");

			const body = backdrop.querySelector(".geb-modal-body");
			const actionHost = backdrop.querySelector(".geb-modal-actions");
			const close = () => {
				backdrop.classList.remove("is-visible");
				document.body.classList.remove("geb-modal-open");
				setTimeout(() => backdrop.remove(), 160);
				document.removeEventListener("keydown", onKey);
				opts.onClose && opts.onClose();
			};
			const onKey = (event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					close();
				}
			};
			document.addEventListener("keydown", onKey);
			backdrop.querySelector(".geb-modal-close").addEventListener("click", close);
			backdrop.addEventListener("mousedown", (event) => {
				if (event.target === backdrop) close();
			});
			if (typeof opts.body === "string") body.innerHTML = opts.body;
			else if (opts.body instanceof Node) body.appendChild(opts.body);

			(opts.actions || []).forEach((action) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className =
					"btn btn-sm " + (action.primary ? "btn-primary" : "btn-default") + (action.danger ? " geb-danger" : "");
				button.textContent = action.label;
				button.addEventListener("click", () => {
					const result = action.onClick ? action.onClick({ close, body, backdrop }) : undefined;
					if (result !== false) close();
				});
				actionHost.appendChild(button);
			});
			if (!(opts.actions || []).length) actionHost.remove();
			requestAnimationFrame(() => backdrop.classList.add("is-visible"));
			const focusable = backdrop.querySelector("input, textarea, select, button.btn-primary");
			if (focusable) setTimeout(() => focusable.focus(), 80);
			return { backdrop, body, close, actionHost };
		},
		confirm(message, options) {
			const opts = options || {};
			return new Promise((resolve) => {
				let settled = false;
				const modal = GEB.ui.modal({
					title: opts.title || "Please confirm",
					body: '<div class="geb-confirm-text">' + GEB.core.esc(message) + "</div>",
					actions: [
						{
							label: opts.cancelLabel || "Cancel",
							onClick: () => {
								settled = true;
								resolve(false);
							},
						},
						{
							label: opts.confirmLabel || "Continue",
							primary: true,
							danger: opts.danger,
							onClick: () => {
								settled = true;
								resolve(true);
							},
						},
					],
					onClose: () => {
						if (!settled) resolve(false);
					},
				});
				modal.backdrop.querySelector(".btn-primary").classList.toggle("btn-danger", !!opts.danger);
			});
		},
		prompt(title, options) {
			const opts = options || {};
			return new Promise((resolve) => {
				let settled = false;
				const modal = GEB.ui.modal({
					title,
					body:
						'<label class="geb-field"><span class="geb-label">' +
						GEB.core.esc(opts.label || "Value") +
						'</span><input class="form-control geb-input" type="text" value="' +
						GEB.core.escAttr(opts.value || "") +
						'" placeholder="' +
						GEB.core.escAttr(opts.placeholder || "") +
						'" /></label>' +
						(opts.help ? '<p class="geb-help">' + GEB.core.esc(opts.help) + "</p>" : ""),
					actions: [
						{
							label: "Cancel",
							onClick: () => {
								settled = true;
								resolve(null);
							},
						},
						{
							label: opts.confirmLabel || "OK",
							primary: true,
							onClick: ({ body }) => {
								const input = body.querySelector("input");
								settled = true;
								resolve(input.value.trim());
							},
						},
					],
					onClose: () => {
						if (!settled) resolve(null);
					},
				});
				const input = modal.body.querySelector("input");
				input.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						settled = true;
						resolve(input.value.trim());
						modal.close();
					}
				});
			});
		},
		blockPicker(onPick) {
			const order = [
				"title",
				"paragraph",
				"text",
				"list",
				"image",
				"button",
				"divider",
				"spacer",
				"social",
				"video",
				"html",
			];
			const body = document.createElement("div");
			body.className = "geb-picker-grid";
			order.forEach((type) => {
				const meta = GEB.blocks[type];
				if (!meta) return;
				const button = document.createElement("button");
				button.type = "button";
				button.className = "geb-picker-item";
				button.innerHTML =
					'<span class="geb-picker-icon">' + GEB.icons[type] + "</span><span>" + GEB.core.esc(meta.label) + "</span>";
				button.addEventListener("click", () => {
					modal.close();
					onPick(type);
				});
				body.appendChild(button);
			});
			const modal = GEB.ui.modal({ title: "Add a content block", body, size: "small" });
			return modal;
		},
	};

	// ---------------------------------------------------------------------
	// Recent colours (EveryAction remembers recently used colours)
	// ---------------------------------------------------------------------
	const RECENT_KEY = "geb_recent_colors";

	GEB.colors = {
		list() {
			try {
				return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 10);
			} catch (error) {
				return [];
			}
		},
		remember(color) {
			if (!color || !/^#[0-9a-fA-F]{3,8}$/.test(color)) return;
			const recent = GEB.colors.list().filter((value) => value.toLowerCase() !== color.toLowerCase());
			recent.unshift(color);
			localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
		},
	};
})();
