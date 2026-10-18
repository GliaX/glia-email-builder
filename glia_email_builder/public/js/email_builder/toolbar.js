/**
 * Glia Email Builder - floating rich-text toolbar.
 *
 * Uses document.execCommand for the small formatting surface needed in email
 * (bold, italic, links, lists, colours, alignment). The served HTML is
 * sanitised server-side, and the toolbar keeps the selection alive while its
 * controls (including merge-field modals) are used.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;

	const FONT_CHOICES = [
		["Arial", "Arial"],
		["Helvetica", "Helvetica"],
		["Verdana", "Verdana"],
		["Tahoma", "Tahoma"],
		["Trebuchet MS", "Trebuchet MS"],
		["Georgia", "Georgia"],
		["Times New Roman", "Times New Roman"],
		["Courier New", "Courier New"],
	];

	const SIZE_CHOICES = [
		["1", "10 px"],
		["2", "12 px"],
		["3", "14 px"],
		["4", "16 px"],
		["5", "18 px"],
		["6", "24 px"],
		["7", "32 px"],
	];

	GEB.toolbar = {
		el: null,
		activeEl: null,
		range: null,
		textOnly: false,

		ensure() {
			if (this.el) return this.el;
			const el = document.createElement("div");
			el.className = "geb-toolbar";
			el.innerHTML =
				'<div class="geb-toolbar-row">' +
				'<select class="geb-tb-select" data-cmd="fontName" title="Font">' +
				FONT_CHOICES.map(([value, label]) => '<option value="' + value + '">' + label + "</option>").join("") +
				"</select>" +
				'<select class="geb-tb-select geb-tb-size" data-cmd="fontSize" title="Size">' +
				SIZE_CHOICES.map(([value, label]) => '<option value="' + value + '">' + label + "</option>").join("") +
				"</select>" +
				'<span class="geb-tb-sep"></span>' +
				'<button type="button" class="geb-tb-btn" data-cmd="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="italic" title="Italic (Ctrl+I)"><em>I</em></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="superscript" title="Superscript">x²</button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="subscript" title="Subscript">x₂</button>' +
				'<span class="geb-tb-sep"></span>' +
				'<button type="button" class="geb-tb-btn" data-cmd="justifyLeft" title="Align left">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h10M4 18h13"/></svg></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="justifyCenter" title="Align center">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M7 12h10M5 18h14"/></svg></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="justifyRight" title="Align right">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M10 12h10M7 18h13"/></svg></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="insertUnorderedList" title="Bulleted list">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg></button>' +
				'<button type="button" class="geb-tb-btn" data-cmd="insertOrderedList" title="Numbered list">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h1v4M4 9h2M4 14h2l-2 3h2" stroke-width="1.3"/></svg></button>' +
				'<span class="geb-tb-sep"></span>' +
				'<span class="geb-tb-color-wrap" title="Text color">' +
				'<button type="button" class="geb-tb-btn geb-tb-color-btn" data-cmd="foreColor" data-color-trigger="1">A<span class="geb-tb-color-bar"></span></button>' +
				'<input type="color" class="geb-tb-color-input" data-color-input="1" value="#005AB9" />' +
				"</span>" +
				'<button type="button" class="geb-tb-btn" data-cmd="removeFormat" title="Clear formatting">' +
				'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h12M9 6l-2 13M7 19h6"/><path d="M15 14l5 5M20 14l-5 5"/></svg></button>' +
				'<span class="geb-tb-sep"></span>' +
				'<button type="button" class="geb-tb-btn" data-action="link" title="Insert link">' +
				GEB.icons.link +
				"</button>" +
				'<button type="button" class="geb-tb-btn" data-cmd="unlink" title="Remove link">' +
				GEB.icons.unlink +
				"</button>" +
				'<button type="button" class="geb-tb-btn geb-tb-wide" data-action="merge" title="Insert merge field">Merge Fields</button>' +
				'<button type="button" class="geb-tb-btn geb-tb-wide" data-action="condition" title="Insert conditional content">Conditional</button>' +
				"</div>";
			document.body.appendChild(el);
			this.el = el;
			this.bind();
			return el;
		},

		bind() {
			const el = this.el;
			el.addEventListener("mousedown", (event) => {
				// Keep the contenteditable selection when using the toolbar.
				if (event.target.closest("select, input[type=color]")) {
					this.saveSelection();
					return;
				}
				event.preventDefault();
				this.saveSelection();
			});
			el.addEventListener("click", (event) => {
				const button = event.target.closest("[data-cmd], [data-action]");
				if (!button) return;
				event.preventDefault();
				event.stopPropagation();
				if (button.dataset.action === "link") return this.openLink();
				if (button.dataset.action === "merge") return this.openMergeFields();
				if (button.dataset.action === "condition") return this.openCondition();
				const command = button.dataset.cmd;
				if (command === "foreColor") {
					const input = el.querySelector("[data-color-input]");
					if (input.showPicker) {
						try {
							input.showPicker();
							return;
						} catch (error) {
							/* fall through */
						}
					}
					input.click();
					return;
				}
				this.exec(command);
			});
			el.querySelector("[data-color-input]").addEventListener("input", (event) => {
				this.restoreSelection();
				this.exec("foreColor", event.target.value);
				GEB.colors.remember(event.target.value);
			});
			el.querySelector('[data-cmd="fontName"]').addEventListener("change", (event) => {
				this.exec("fontName", event.target.value);
			});
			el.querySelector('[data-cmd="fontSize"]').addEventListener("change", (event) => {
				this.exec("fontSize", event.target.value);
			});
			window.addEventListener("resize", () => this.reposition());
		},

		showFor(element) {
			if (!element || !element.isContentEditable) return;
			this.activeEl = element;
			this.textOnly = element.dataset.edit === "text";
			const el = this.ensure();
			el.classList.toggle("is-text-only", this.textOnly);
			el.classList.add("is-visible");
			setTimeout(() => this.positionFor(element), 0);
			this.syncState();
		},

		hide() {
			if (!this.el) return;
			this.el.classList.remove("is-visible");
			this.el.style.display = "none";
			this.activeEl = null;
		},

		positionFor(element) {
			const el = this.el;
			if (!el || !element || !element.isConnected) return;
			const rect = element.getBoundingClientRect();
			let top = rect.top;
			let left = rect.left + Math.max(0, rect.width / 2);
			const selection = window.getSelection();
			if (selection && selection.rangeCount) {
				const range = selection.getRangeAt(0);
				if (!range.collapsed) {
					const rangeRect = range.getBoundingClientRect();
					if (rangeRect && rangeRect.width) {
						top = rangeRect.top;
						left = rangeRect.left + rangeRect.width / 2;
					}
				}
			}
			el.style.visibility = "hidden";
			el.style.display = "block";
			const size = el.getBoundingClientRect();
			const toolbarHeight = size.height || 44;
			const toolbarWidth = size.width || 500;
			let y = top - toolbarHeight - 10;
			if (y < 52) y = top + rect.height + 10;
			let x = left - toolbarWidth / 2;
			const minX = 12;
			const maxX = window.innerWidth - toolbarWidth - 12;
			x = Math.max(minX, Math.min(maxX, x));
			el.style.top = Math.max(52, Math.min(window.innerHeight - toolbarHeight - 12, y)) + "px";
			el.style.left = x + "px";
			el.style.visibility = "";
		},

		reposition() {
			if (!this.el || !this.el.classList.contains("is-visible") || !this.activeEl) return;
			this.positionFor(this.activeEl);
		},

		saveSelection() {
			const selection = window.getSelection();
			if (selection && selection.rangeCount) {
				const range = selection.getRangeAt(0);
				if (this.activeEl && this.activeEl.contains(range.commonAncestorContainer)) {
					this.range = range.cloneRange();
				}
			}
		},

		restoreSelection() {
			if (!this.range) return;
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(this.range);
			if (this.activeEl) this.activeEl.focus();
		},

		exec(command, value) {
			if (!this.activeEl) return;
			this.restoreSelection();
			try {
				document.execCommand("styleWithCSS", false, true);
				document.execCommand(command, false, value == null ? null : String(value));
			} catch (error) {
				GEB.ui.error("This formatting command is not available in your browser.");
			}
			this.saveSelection();
			GEB.canvas.syncEditable(this.activeEl);
			this.syncState();
		},

		syncState() {
			if (!this.el || !this.activeEl) return;
			this.el.querySelectorAll("[data-cmd]").forEach((button) => {
				const command = button.dataset.cmd;
				if (["fontName", "fontSize", "foreColor"].includes(command)) return;
				let active = false;
				try {
					active = document.queryCommandState(command);
				} catch (error) {
					active = false;
				}
				button.classList.toggle("is-active", !!active);
			});
		},

		openLink() {
			this.saveSelection();
			const selectedText = window.getSelection() ? window.getSelection().toString() : "";
			GEB.modals.link(({ url, text }) => {
				this.restoreSelection();
				if (!url) {
					document.execCommand("unlink");
				} else if (selectedText) {
					document.execCommand("createLink", false, url);
				} else {
					const label = text || url;
					document.execCommand(
						"insertHTML",
						false,
						'<a href="' + core.escAttr(url) + '">' + core.esc(label) + "</a>"
					);
				}
				GEB.canvas.syncEditable(this.activeEl);
				this.saveSelection();
			}, { text: selectedText });
		},

		openMergeFields() {
			this.saveSelection();
			GEB.modals.mergeFields((field) => {
				this.restoreSelection();
				document.execCommand("insertText", false, field);
				GEB.canvas.syncEditable(this.activeEl);
				this.saveSelection();
			});
		},

		openCondition() {
			this.saveSelection();
			GEB.modals.conditional((snippet) => {
				this.restoreSelection();
				document.execCommand("insertText", false, snippet);
				GEB.canvas.syncEditable(this.activeEl);
				this.saveSelection();
			});
		},
	};
})();
