/**
 * Glia Email Builder - right-hand inspector (Content / Rows / Settings).
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	const CATEGORY_OPTIONS = [
		"Newsletter",
		"Appeal",
		"Thank You",
		"Invitation",
		"Announcement",
		"Letter",
		"Recurring Giving",
		"Blank",
		"Custom",
	];

	function h(value) {
		return esc(value == null ? "" : value);
	}

	function num(value, fallback) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	GEB.inspector = {
		root: null,
		activeTab: "content",
		spacingLinked: {},

		init(root) {
			this.root = root;
			this.bind();
			this.render();
		},

		bind() {
			const root = this.root;
			if (!root || root.__gebBound) return;
			root.__gebBound = true;
			root.addEventListener("click", (event) => this.onClick(event));
			root.addEventListener("change", (event) => this.onFieldChange(event, false));
			root.addEventListener("input", (event) => this.onFieldChange(event, true));
		},

		setTab(tab) {
			if (!["content", "rows", "settings"].includes(tab)) return;
			this.activeTab = tab;
			this.render();
		},

		render() {
			if (!this.root) return;
			const state = GEB.state;
			if (!state.design) {
				this.root.innerHTML = "";
				return;
			}
			const tabs = [
				{ key: "content", label: "Content" },
				{ key: "rows", label: "Rows" },
				{ key: "settings", label: "Settings" },
			];
			const body =
				this.activeTab === "settings"
					? this.renderSettings()
					: this.activeTab === "rows"
						? this.renderRowsPanel()
						: this.renderContentPanel();
			this.root.innerHTML =
				'<div class="geb-tabs">' +
				tabs
					.map(
						(tab) =>
							'<button type="button" class="geb-tab ' +
							(this.activeTab === tab.key ? "is-active" : "") +
							'" data-tab="' +
							tab.key +
							'">' +
							tab.label +
							"</button>"
					)
					.join("") +
				"</div>" +
				'<div class="geb-inspector-body">' +
				body +
				"</div>";
			if (this.activeTab === "content" && !this.selectedBlock()) {
				if (GEB.dnd && GEB.dnd.initPalette) GEB.dnd.initPalette();
			}
			if (GEB.state && !GEB.state.canWrite && GEB.app && GEB.app.applyReadOnly) {
				GEB.app.applyReadOnly();
			}
		},

		// -----------------------------------------------------------------
		// Selection helpers
		// -----------------------------------------------------------------

		selectedBlock() {
			const selection = GEB.state.selection;
			if (!selection || selection.type !== "block") return null;
			return GEB.model.findBlock(selection.id);
		},

		selectedRow() {
			const selection = GEB.state.selection;
			if (!selection || selection.type !== "row") return null;
			return GEB.model.findRow(selection.id);
		},

		// -----------------------------------------------------------------
		// Content tab
		// -----------------------------------------------------------------

		renderContentPanel() {
			const found = this.selectedBlock();
			if (!found) return this.renderPalette();
			return this.renderBlockProperties(found);
		},

		renderPalette() {
			const items = GEB.blocks.ORDER.map((type) => {
				const meta = GEB.blocks[type];
				return (
					'<button type="button" class="geb-palette-item" data-block-type="' +
					type +
					'" draggable="true" title="' +
					h(meta.label) +
					'">' +
					'<span class="geb-palette-icon">' +
					(GEB.icons[type] || GEB.icons.block || "") +
					"</span>" +
					'<span class="geb-palette-label">' +
					h(meta.label) +
					"</span>" +
					"</button>"
				);
			}).join("");
			return (
				'<div class="geb-panel-heading"><div><div class="geb-panel-title">Content</div>' +
				'<div class="geb-panel-sub">Drag onto the email or click to add</div></div></div>' +
				'<div class="geb-palette">' +
				items +
				"</div>" +
				'<div class="geb-panel-note">' +
				GEB.icons.help +
				"<span>Blocks are edited inline. Select a block to see its properties here.</span></div>"
			);
		},

		renderBlockProperties(found) {
			const block = found.block;
			const meta = GEB.blocks[block.type] || GEB.blocks.paragraph;
			const locked = !!block.styles?.locked;
			const groups = meta.props || [];
			const groupHtml = groups
				.map((group) => {
					const fields = (group.fields || [])
						.filter(Boolean)
						.map((field) => this.renderField(field, block, { locked }))
						.join("");
					if (!fields) return "";
					return (
						'<div class="geb-prop-group"><div class="geb-prop-group-title">' +
						h(group.label) +
						"</div>" +
						fields +
						"</div>"
					);
				})
				.join("");
			return (
				'<div class="geb-panel-heading">' +
				'<button type="button" class="geb-back-btn" data-action="back-to-blocks">' +
				GEB.icons.chevronLeft +
				" Blocks</button>" +
				'<div class="geb-heading-actions">' +
				(locked ? '<span class="geb-lock-badge">' + GEB.icons.lock + " Locked</span>" : "") +
				'<button type="button" class="geb-icon-btn" data-action="duplicate-block" title="Duplicate block">' +
				GEB.icons.duplicate +
				"</button>" +
				'<button type="button" class="geb-icon-btn geb-danger" data-action="delete-block" title="Delete block">' +
				GEB.icons.trash +
				"</button>" +
				"</div>" +
				"</div>" +
				'<div class="geb-prop-title">' +
				h(meta.label) +
				'<span class="geb-prop-sub">' +
				(locked ? "Locked" : "Content block") +
				"</span></div>" +
				(locked
					? '<div class="geb-notice">' +
					  GEB.icons.lock +
					  "<span>This block is locked. Unlock it under Block Options to edit its content.</span></div>"
					: "") +
				groupHtml +
				"<div class=\"geb-prop-footer\">" +
				'<button type="button" class="geb-text-btn" data-action="select-parent-row">' +
				GEB.icons.row1 +
				" Row</button>" +
				'<button type="button" class="geb-text-btn" data-action="move-block-up">' +
				GEB.icons.arrowUp +
				" Move up</button>" +
				'<button type="button" class="geb-text-btn" data-action="move-block-down">' +
				GEB.icons.arrowDown +
				" Move down</button>" +
				"</div>"
			);
		},

		renderField(field, block, options) {
			const opts = options || {};
			const locked = opts.locked;
			const value = core.getPath(block, field.key);
			const disabled = locked && field.key !== "styles.locked";
			const attr = disabled ? " disabled" : "";
			const label = '<div class="geb-label">' + h(field.label || "") + "</div>";

			if (field.type === "row") {
				return (
					'<div class="geb-field-row">' +
					(field.fields || [])
						.map((child) => this.renderField(child, block, options))
						.join("") +
					"</div>"
				);
			}
			if (field.type === "help") {
				return '<p class="geb-help">' + h(field.text || "") + "</p>";
			}
			if (field.type === "text") {
				return (
					'<label class="geb-field">' +
					label +
					'<input class="form-control geb-input" type="text" data-field-key="' +
					h(field.key) +
					'" data-field-type="text" value="' +
					h(value || "") +
					'" placeholder="' +
					h(field.placeholder || "") +
					'"' +
					attr +
					" /></label>"
				);
			}
			if (field.type === "textarea") {
				return (
					'<label class="geb-field">' +
					label +
					'<textarea class="form-control geb-input" rows="' +
					num(field.rows, 3) +
					'" data-field-key="' +
					h(field.key) +
					'" data-field-type="text"' +
					attr +
					">" +
					h(value || "") +
					"</textarea></label>"
				);
			}
			if (field.type === "number") {
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="number">' +
					label +
					'<div class="geb-stepper">' +
					'<button type="button" class="geb-step-btn" data-step="-1"' +
					attr +
					">−</button>" +
					'<input class="geb-step-input" type="number" data-number-input value="' +
					h(value == null ? "" : value) +
					'" min="' +
					num(field.min, 0) +
					'" max="' +
					num(field.max, 999) +
					'" step="' +
					num(field.step, 1) +
					'" placeholder="' +
					h(field.placeholder || "") +
					'"' +
					attr +
					" />" +
					'<button type="button" class="geb-step-btn" data-step="1"' +
					attr +
					">+</button>" +
					(field.suffix ? '<span class="geb-step-suffix">' + h(field.suffix) + "</span>" : "") +
					"</div></div>"
				);
			}
			if (field.type === "select") {
				const choices = field.options || [];
				return (
					'<label class="geb-field">' +
					label +
					'<select class="form-control geb-input" data-field-key="' +
					h(field.key) +
					'" data-field-type="select"' +
					attr +
					">" +
					choices
						.map((choice) => {
							const choiceValue = typeof choice === "object" ? choice.value : choice;
							const choiceLabel = typeof choice === "object" ? choice.label : choice;
							return (
								'<option value="' +
								h(choiceValue) +
								'"' +
								(String(value) === String(choiceValue) ? " selected" : "") +
								">" +
								h(choiceLabel) +
								"</option>"
							);
						})
						.join("") +
					"</select></label>"
				);
			}
			if (field.type === "segmented") {
				const choices = field.options || [];
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="segmented">' +
					label +
					'<div class="geb-segmented">' +
					choices
						.map((choice) => {
							const choiceValue = typeof choice === "object" ? choice.value : choice;
							const choiceLabel = typeof choice === "object" ? choice.label : choice;
							return (
								'<button type="button" class="geb-seg-btn ' +
								(String(value) === String(choiceValue) ? "is-active" : "") +
								'" data-seg-value="' +
								h(choiceValue) +
								'"' +
								attr +
								">" +
								h(choiceLabel) +
								"</button>"
							);
						})
						.join("") +
					"</div></div>"
				);
			}
			if (field.type === "align") {
				const align = value || "left";
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="align">' +
					label +
					'<div class="geb-segmented geb-align-buttons">' +
					(field.options || [])
						.map(
							(option) =>
								'<button type="button" class="geb-seg-btn ' +
								(align === option.value ? "is-active" : "") +
								'" data-seg-value="' +
								h(option.value) +
								'" title="' +
								h(option.label) +
								'"' +
								attr +
								"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\"><path d=\"" +
								option.icon +
								'"/></svg></button>'
						)
						.join("") +
					"</div></div>"
				);
			}
			if (field.type === "toggle") {
				return (
					'<div class="geb-toggle-row">' +
					'<span class="geb-label">' +
					h(field.label) +
					"</span>" +
					'<label class="geb-switch"><input type="checkbox" data-field-key="' +
					h(field.key) +
					'" data-field-type="toggle"' +
					(value ? " checked" : "") +
					(field.key === "styles.locked" ? "" : attr) +
					' /><span class="geb-switch-track"></span></label></div>'
				);
			}
			if (field.type === "color") {
				const fallback =
					typeof field.fallback === "function" ? field.fallback() : field.fallback || "";
				const swatch = value || fallback || "#ffffff";
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="color">' +
					label +
					'<div class="geb-color-row">' +
					'<span class="geb-color-swatch" style="background:' +
					h(swatch) +
					'">' +
					'<input type="color" data-color-input value="' +
					h(swatch) +
					'"' +
					attr +
					" /></span>" +
					'<input class="geb-color-text" type="text" data-color-text value="' +
					h(value || "") +
					'" placeholder="' +
					(value ? "" : "Default") +
					'" maxlength="9"' +
					attr +
					" />" +
					(value
						? '<button type="button" class="geb-color-clear" data-color-clear title="Use default"' +
						  attr +
						  ">" +
						  GEB.icons.close +
						  "</button>"
						: "") +
					"</div>" +
					'<div class="geb-recent-colors">' +
					GEB.colors
						.list()
						.slice(0, 7)
						.map(
							(color) =>
								'<button type="button" class="geb-recent-color" data-recent-color="' +
								h(color) +
								'" style="background:' +
								h(color) +
								'" title="' +
								h(color) +
								'"></button>'
						)
						.join("") +
					"</div></div>"
				);
			}
			if (field.type === "spacing") {
				const padding = value || {};
				const linked = this.spacingLinked[field.key] !== false;
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="spacing" data-linked="' +
					(linked ? "1" : "0") +
					'">' +
					label +
					'<div class="geb-spacing-head"><span class="geb-dim">All sides</span>' +
					'<button type="button" class="geb-link-sides ' +
					(linked ? "is-active" : "") +
					'" data-spacing-link title="Link all sides">' +
					GEB.icons.link +
					"</button></div>" +
					'<div class="geb-spacing-grid">' +
					["top", "right", "bottom", "left"]
						.map(
							(side) =>
								'<label class="geb-spacing-cell"><span>' +
								side.charAt(0).toUpperCase() +
								side.slice(1) +
								'</span><input type="number" min="0" max="400" step="1" data-spacing-side="' +
								side +
								'" value="' +
								h(padding[side] == null ? 0 : padding[side]) +
								'"' +
								attr +
								" /></label>"
						)
						.join("") +
					"</div></div>"
				);
			}
			if (field.type === "range") {
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="range">' +
					label +
					'<div class="geb-range-row">' +
					'<input type="range" min="' +
					num(field.min, 0) +
					'" max="' +
					num(field.max, 100) +
					'" step="' +
					num(field.step, 1) +
					'" data-range-input data-live="1" value="' +
					h(value == null ? (field.min || 0) : value) +
					'"' +
					attr +
					" />" +
					'<input type="number" class="geb-range-number" data-number-input min="' +
					num(field.min, 0) +
					'" max="' +
					num(field.max, 100) +
					'" value="' +
					h(value == null ? (field.min || 0) : value) +
					'"' +
					attr +
					" />" +
					'<span class="geb-range-suffix">' +
					h(field.suffix || "") +
					"</span>" +
					"</div></div>"
				);
			}
			if (field.type === "image") {
				const src = value || "";
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="image">' +
					label +
					'<div class="geb-image-field">' +
					'<div class="geb-image-thumb">' +
					(src
						? '<img src="' + h(src) + '" alt="" />'
						: '<span class="geb-image-empty">' + GEB.icons.imagePlus + "</span>") +
					"</div>" +
					'<div class="geb-image-field-actions">' +
					'<button type="button" class="geb-mini-btn" data-image-browse' +
					attr +
					">Browse</button>" +
					'<input class="form-control geb-input" type="text" data-field-key="' +
					h(field.key) +
					'" data-field-type="text" value="' +
					h(src) +
					'" placeholder="/files/… or https://…"' +
					attr +
					" />" +
					"</div></div></div>"
				);
			}
			if (field.type === "url") {
				const presets = field.presets || [];
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="url">' +
					label +
					'<input class="form-control geb-input" type="text" data-field-key="' +
					h(field.key) +
					'" data-field-type="text" value="' +
					h(value || "") +
					'" placeholder="https://… or {{ DonateURL }}"' +
					attr +
					" />" +
					(presets.length
						? '<div class="geb-preset-row">' +
						  presets
								.map(
									(preset) =>
										'<button type="button" class="geb-preset-btn" data-url-preset="' +
										h(preset.value) +
										'"' +
										attr +
										">" +
										h(preset.label) +
										"</button>"
								)
								.join("") +
						  "</div>"
						: "") +
					"</div>"
				);
			}
			if (field.type === "code") {
				return (
					'<label class="geb-field">' +
					label +
					'<textarea class="form-control geb-code" rows="' +
					num(field.rows, 8) +
					'" data-field-key="' +
					h(field.key) +
					'" data-field-type="text" data-live="1" spellcheck="false"' +
					attr +
					">" +
					h(value || "") +
					"</textarea></label>"
				);
			}
			if (field.type === "networks") {
				const networks = value || [];
				const rows = GEB.blocks.socialNetworks
					.map((network) => {
						const existing = networks.find((item) => item.key === network.key);
						const enabled = !!existing;
						return (
							'<div class="geb-network-row" data-network-key="' +
							h(network.key) +
							'">' +
							'<label class="geb-switch"><input type="checkbox" data-network-enabled ' +
							(enabled ? "checked" : "") +
							' /><span class="geb-switch-track"></span></label>' +
							'<span class="geb-network-name">' +
							h(network.label) +
							"</span>" +
							'<input class="form-control geb-input" type="text" data-network-url value="' +
							h(existing ? existing.url : "") +
							'" placeholder="Default from settings"' +
							(enabled ? "" : " disabled") +
							" />" +
							"</div>"
						);
					})
					.join("");
				return (
					'<div class="geb-field" data-field-key="' +
					h(field.key) +
					'" data-field-type="networks">' +
					'<div class="geb-label">Networks</div>' +
					'<div class="geb-networks">' +
					rows +
					"</div></div>"
				);
			}
			return "";
		},

		// -----------------------------------------------------------------
		// Rows tab
		// -----------------------------------------------------------------

		renderRowsPanel() {
			const found = this.selectedRow();
			if (!found) {
				const presets = GEB.blocks.ROW_PRESETS.map(
					(preset, index) =>
						'<button type="button" class="geb-row-preset" data-row-preset="' +
						index +
						'" title="' +
						h(preset.label) +
						'"><span class="geb-row-preset-icon">' +
						GEB.icons[preset.icon] +
						"</span><span>" +
						h(preset.label) +
						"</span></button>"
				).join("");
				return (
					'<div class="geb-panel-heading"><div><div class="geb-panel-title">Rows</div>' +
					'<div class="geb-panel-sub">Add a layout to organise content blocks</div></div></div>' +
					'<div class="geb-row-presets">' +
					presets +
					"</div>" +
					'<div class="geb-panel-note">' +
					GEB.icons.help +
					"<span>Rows can hold up to six columns. Click a row on the canvas to edit its background, spacing and mobile behaviour.</span></div>"
				);
			}
			const row = found.row;
			const locked = !!row.styles?.locked;
			const condition = row.condition || {};
			const conditionSummary = condition.enabled
				? GEB.model.conditionSummary(condition)
				: "No display condition applied to this row";
			const columnSummary = row.columns
				.map((column) => Math.round(Number(column.width) || 0) + "%")
				.join(" / ");
			return (
				'<div class="geb-panel-heading">' +
				'<button type="button" class="geb-back-btn" data-action="back-to-rows">' +
				GEB.icons.chevronLeft +
				" Rows</button>" +
				'<div class="geb-panel-title">Row</div>' +
				'<div class="geb-heading-actions">' +
				(locked ? '<span class="geb-lock-badge">' + GEB.icons.lock + " Locked</span>" : "") +
				'<button type="button" class="geb-icon-btn" data-action="duplicate-row" title="Duplicate row">' +
				GEB.icons.duplicate +
				"</button>" +
				'<button type="button" class="geb-icon-btn geb-danger" data-action="delete-row" title="Delete row">' +
				GEB.icons.trash +
				"</button>" +
				"</div></div>" +
				'<div class="geb-prop-title">Row properties<span class="geb-prop-sub">' +
				h(columnSummary) +
				"</span></div>" +
				(locked
					? '<div class="geb-notice">' +
					  GEB.icons.lock +
					  "<span>This row is locked. Unlock it below to change its content or layout.</span></div>"
					: "") +
				this.renderField(
					{
						type: "number",
						key: "styles.columns_gap",
						label: "Column spacing",
						min: 0,
						max: 80,
						suffix: "px",
					},
					row,
					{ locked }
				) +
				this.renderField(
					{
						type: "select",
						key: "styles.vertical_align",
						label: "Vertical alignment",
						options: [
							{ value: "top", label: "Top" },
							{ value: "middle", label: "Middle" },
							{ value: "bottom", label: "Bottom" },
						],
					},
					row,
					{ locked }
				) +
				this.renderField({ type: "color", key: "styles.background_color", label: "Background color" }, row, {
					locked,
				}) +
				this.renderField(
					{ type: "text", key: "styles.background_image", label: "Background image URL" },
					row,
					{ locked }
				) +
				this.renderField({ type: "spacing", key: "styles.padding", label: "Padding" }, row, { locked }) +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Mobile</div>' +
				this.renderField(
					{ type: "toggle", key: "styles.hide_mobile", label: "Hide on mobile" },
					row,
					{ locked }
				) +
				this.renderField(
					{ type: "toggle", key: "styles.hide_desktop", label: "Hide on desktop" },
					row,
					{ locked }
				) +
				this.renderField(
					{ type: "toggle", key: "styles.reverse_stack", label: "Reverse stack order on mobile" },
					row,
					{ locked }
				) +
				this.renderField(
					{ type: "toggle", key: "styles.no_stack", label: "Do not stack on mobile" },
					row,
					{ locked }
				) +
				"</div>" +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Display condition</div>' +
				'<div class="geb-condition-box"><div class="geb-condition-summary">' +
				GEB.icons.condition +
				"<span>" +
				h(conditionSummary) +
				"</span></div>" +
				'<button type="button" class="geb-btn-secondary" data-action="edit-condition">' +
				(condition.enabled ? "Edit condition" : "Add condition") +
				"</button>" +
				(condition.enabled
					? '<button type="button" class="geb-text-btn" data-action="remove-condition">Remove</button>'
					: "") +
				"</div></div>" +
				this.renderField({ type: "toggle", key: "styles.locked", label: "Lock this row" }, row, { locked })
			);
		},

		// -----------------------------------------------------------------
		// Settings tab
		// -----------------------------------------------------------------

		renderSettings() {
			const state = GEB.state;
			const settings = state.design.settings;
			const settingsProxy = { settings };
			const resolved = GEB.style.resolved();
			const meta = state.designMeta || {};
			const referenceChoices = (state.referenceDoctypes || []).map((doctype) => ({
				value: doctype,
				label: doctype,
			}));
			if (state.referenceDoctype && !referenceChoices.some((item) => item.value === state.referenceDoctype)) {
				referenceChoices.unshift({ value: state.referenceDoctype, label: state.referenceDoctype });
			}
			const size = Number(state.emailSize) || 0;
			const warn = state.warnClipped || size > (state.settings?.gmail_clip_bytes || 102000);
			return (
				'<div class="geb-panel-heading"><div><div class="geb-panel-title">Email settings</div>' +
				'<div class="geb-panel-sub">Subject, branding and global layout</div></div></div>' +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Email details</div>' +
				'<label class="geb-field"><span class="geb-label">Subject line</span>' +
				'<input class="form-control geb-input" type="text" data-setting="subject" value="' +
				h(state.subject || "") +
				'" placeholder="Your subject line" /></label>' +
				'<label class="geb-field"><span class="geb-label">Preview text</span>' +
				'<input class="form-control geb-input" type="text" data-setting="preheader" value="' +
				h(settings.preheader || "") +
				'" placeholder="Text shown next to the subject in the inbox" /></label>' +
				'<label class="geb-field"><span class="geb-label">Email title (browser tab)</span>' +
				'<input class="form-control geb-input" type="text" data-setting="email_title" value="' +
				h(settings.email_title || "") +
				'" placeholder="Defaults to the subject" /></label>' +
				'<label class="geb-field"><span class="geb-label">Reference DocType</span>' +
				'<select class="form-control geb-input" data-setting="reference_doctype">' +
				referenceChoices
					.map(
						(option) =>
							'<option value="' +
							h(option.value) +
							'"' +
							(option.value === state.referenceDoctype ? " selected" : "") +
							">" +
							h(option.label) +
							"</option>"
					)
					.join("") +
				"</select>" +
				'<span class="geb-help">Merge fields resolve against this document when a campaign is sent.</span></label>' +
				'<label class="geb-field"><span class="geb-label">Category</span>' +
				'<select class="form-control geb-input" data-setting="category">' +
				CATEGORY_OPTIONS.map(
					(category) =>
						'<option value="' +
						h(category) +
						'"' +
						(category === (meta.category || "Custom") ? " selected" : "") +
						">" +
						h(category) +
						"</option>"
				).join("") +
				"</select></label>" +
				'<label class="geb-field"><span class="geb-label">Description</span>' +
				'<textarea class="form-control geb-input" rows="2" data-setting="description" placeholder="Internal note for your team">' +
				h(meta.description || "") +
				"</textarea></label>" +
				"</div>" +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Global styling</div>' +
				this.renderField(
					{ type: "range", key: "settings.width", label: "Email width", min: 320, max: 720, step: 10, suffix: "px" },
					settingsProxy,
					{}
				) +
				this.renderField(
					{
						type: "align",
						key: "settings.align",
						label: "Email alignment",
						options: [
							{ value: "left", label: "Left", icon: "M4 6h16M4 12h10M4 18h13" },
							{ value: "center", label: "Center", icon: "M4 6h16M7 12h10M5 18h14" },
							{ value: "right", label: "Right", icon: "M4 6h16M10 12h10M7 18h13" },
						],
					},
					settingsProxy,
					{}
				) +
				this.renderField({ type: "color", key: "settings.background_color", label: "Page background" }, settingsProxy, {}) +
				this.renderField(
					{ type: "color", key: "settings.content_background", label: "Email background" },
					settingsProxy,
					{}
				) +
				this.renderField(
					{
						type: "select",
						key: "settings.font_family",
						label: "Default font",
						options: [
							{ value: "", label: "Brand default" },
							{ value: "Arial", label: "Arial" },
							{ value: "Helvetica", label: "Helvetica" },
							{ value: "Verdana", label: "Verdana" },
							{ value: "Tahoma", label: "Tahoma" },
							{ value: "Trebuchet MS", label: "Trebuchet MS" },
							{ value: "Georgia", label: "Georgia" },
							{ value: "Times New Roman", label: "Times New Roman" },
							{ value: "Courier New", label: "Courier New" },
						],
					},
					settingsProxy,
					{}
				) +
				this.renderField(
					{ type: "number", key: "settings.font_size", label: "Base font size", min: 8, max: 72, suffix: "px" },
					settingsProxy,
					{}
				) +
				this.renderField({ type: "color", key: "settings.text_color", label: "Body text color" }, settingsProxy, {}) +
				this.renderField(
					{ type: "color", key: "settings.link_color", label: "Link color", fallback: resolved.linkColor },
					settingsProxy,
					{}
				) +
				this.renderField(
					{
						type: "color",
						key: "settings.button_color",
						label: "Button color",
						fallback: resolved.buttonColor,
					},
					settingsProxy,
					{}
				) +
				this.renderField(
					{
						type: "color",
						key: "settings.button_text_color",
						label: "Button text color",
						fallback: resolved.buttonTextColor,
					},
					settingsProxy,
					{}
				) +
				this.renderField(
					{
						type: "number",
						key: "settings.border_radius",
						label: "Email corner radius",
						min: 0,
						max: 40,
						suffix: "px",
					},
					settingsProxy,
					{}
				) +
				"</div>" +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Message health</div>' +
				'<div class="geb-health-grid">' +
				'<div><span class="geb-health-label">Blocks</span><strong>' +
				GEB.model.blockCount(state.design) +
				"</strong></div>" +
				'<div><span class="geb-health-label">HTML size</span><strong>' +
				(size ? core.formatBytes(size) : "Not saved yet") +
				"</strong></div>" +
				'<div><span class="geb-health-label">Last saved</span><strong>' +
				(state.lastSaved ? core.formatTime(state.lastSaved) : "—") +
				"</strong></div>" +
				"</div>" +
				(warn
					? '<div class="geb-warning">' +
					  GEB.icons.alert +
					  "<span>Gmail clips messages larger than ~102 KB. Consider removing large HTML or images.</span></div>"
					: "") +
				'<button type="button" class="geb-btn-secondary" data-action="open-classic">Open the classic Email Template form</button>' +
				"</div>" +
				'<div class="geb-prop-group"><div class="geb-prop-group-title">Merge fields</div>' +
				'<p class="geb-help">Merge fields are managed globally for your organisation.</p>' +
				'<button type="button" class="geb-btn-secondary" data-action="manage-merge-fields">Manage merge fields</button>' +
				"</div>"
			);
		},

		// -----------------------------------------------------------------
		// Events
		// -----------------------------------------------------------------

		onClick(event) {
			const target = event.target;
			const tab = target.closest("[data-tab]");
			if (tab) {
				event.preventDefault();
				this.setTab(tab.dataset.tab);
				return;
			}

			const paletteItem = target.closest("[data-block-type]");
			if (paletteItem) {
				event.preventDefault();
				this.addBlock(paletteItem.dataset.blockType);
				return;
			}

			const rowPreset = target.closest("[data-row-preset]");
			if (rowPreset) {
				event.preventDefault();
				const preset = GEB.blocks.ROW_PRESETS[Number(rowPreset.dataset.rowPreset)];
				if (preset) {
					const row = GEB.model.addRow(preset.widths);
					GEB.history?.snapshot("Row added");
					GEB.markDirty();
					GEB.canvas.render();
					GEB.canvas.selectRow(row.id);
					GEB.inspector.render();
				}
				return;
			}

			const action = target.closest("[data-action]");
			if (action) {
				event.preventDefault();
				this.handleAction(action.dataset.action, action);
				return;
			}

			const seg = target.closest("[data-seg-value]");
			if (seg) {
				event.preventDefault();
				const holder = seg.closest("[data-field-key]");
				if (!holder) return;
				let value = seg.dataset.segValue;
				const type = holder.dataset.fieldType;
				if (type === "segmented" && /^-?\d+$/.test(value)) value = Number(value);
				this.applyFieldValue(holder.dataset.fieldKey, value, { source: "click" });
				this.render();
				return;
			}

			const step = target.closest("[data-step]");
			if (step) {
				event.preventDefault();
				const holder = step.closest("[data-field-key]");
				const input = holder?.querySelector("[data-number-input]");
				if (!holder || !input) return;
				const current = Number(input.value) || 0;
				const next = current + Number(step.dataset.step) * (Number(input.step) || 1);
				input.value = next;
				this.applyFieldValue(holder.dataset.fieldKey, next, { source: "step" });
				return;
			}

			const spacingLink = target.closest("[data-spacing-link]");
			if (spacingLink) {
				event.preventDefault();
				const holder = spacingLink.closest("[data-field-key]");
				if (!holder) return;
				const linked = holder.dataset.linked === "1";
				holder.dataset.linked = linked ? "0" : "1";
				spacingLink.classList.toggle("is-active", !linked);
				return;
			}

			const recent = target.closest("[data-recent-color]");
			if (recent) {
				event.preventDefault();
				const holder = recent.closest("[data-field-key]");
				if (holder) this.applyFieldValue(holder.dataset.fieldKey, recent.dataset.recentColor, {});
				this.render();
				return;
			}

			const clearColor = target.closest("[data-color-clear]");
			if (clearColor) {
				event.preventDefault();
				const holder = clearColor.closest("[data-field-key]");
				if (holder) this.applyFieldValue(holder.dataset.fieldKey, "", {});
				this.render();
				return;
			}

			const preset = target.closest("[data-url-preset]");
			if (preset) {
				event.preventDefault();
				const holder = preset.closest("[data-field-key]");
				const input = holder?.querySelector("input[data-field-type=text]");
				if (holder && input) {
					input.value = preset.dataset.urlPreset;
					this.applyFieldValue(holder.dataset.fieldKey, input.value, {});
				}
				return;
			}

			const browse = target.closest("[data-image-browse]");
			if (browse) {
				event.preventDefault();
				const holder = browse.closest("[data-field-key]");
				if (!holder) return;
				GEB.modals.openImages((file) => {
					const input = holder.querySelector("input[data-field-type=text]");
					if (input) input.value = file.file_url;
					this.applyFieldValue(holder.dataset.fieldKey, file.file_url, {});
					this.render();
				});
				return;
			}
		},

		handleAction(action, element) {
			const blockFound = this.selectedBlock();
			const rowFound = this.selectedRow();
			if (action === "back-to-blocks") {
				GEB.state.selection = null;
				GEB.canvas.clearSelection();
				return;
			}
			if (action === "back-to-rows") {
				GEB.state.selection = null;
				GEB.canvas.clearSelection();
				this.setTab("rows");
				return;
			}
			if (action === "select-parent-row" && blockFound) {
				GEB.canvas.selectRow(blockFound.row.id);
				return;
			}
			if (action === "duplicate-block" && blockFound) {
				const copy = GEB.model.duplicateBlock(blockFound.block.id);
				GEB.history?.snapshot("Block duplicated");
				GEB.markDirty();
				GEB.canvas.render();
				if (copy) GEB.canvas.selectBlock(copy.id);
				return;
			}
			if (action === "delete-block" && blockFound) {
				GEB.model.removeBlock(blockFound.block.id);
				GEB.history?.snapshot("Block deleted");
				GEB.markDirty();
				GEB.state.selection = null;
				GEB.canvas.render();
				this.render();
				return;
			}
			if (action === "move-block-up" && blockFound) {
				if (GEB.model.moveBlockByOffset(blockFound.block.id, -1)) {
					GEB.history?.snapshot("Block moved");
					GEB.markDirty();
					GEB.canvas.render();
					GEB.canvas.selectBlock(blockFound.block.id);
				}
				return;
			}
			if (action === "move-block-down" && blockFound) {
				if (GEB.model.moveBlockByOffset(blockFound.block.id, 1)) {
					GEB.history?.snapshot("Block moved");
					GEB.markDirty();
					GEB.canvas.render();
					GEB.canvas.selectBlock(blockFound.block.id);
				}
				return;
			}
			if (action === "duplicate-row" && rowFound) {
				const copy = GEB.model.duplicateRow(rowFound.row.id);
				GEB.history?.snapshot("Row duplicated");
				GEB.markDirty();
				GEB.canvas.render();
				if (copy) GEB.canvas.selectRow(copy.id);
				return;
			}
			if (action === "delete-row" && rowFound) {
				GEB.model.removeRow(rowFound.row.id);
				GEB.history?.snapshot("Row deleted");
				GEB.markDirty();
				GEB.state.selection = null;
				GEB.canvas.render();
				this.render();
				return;
			}
			if (action === "edit-condition" && rowFound) {
				GEB.modals.rowCondition(rowFound.row, () => {
					GEB.history?.snapshot("Row condition updated");
					GEB.markDirty();
					GEB.canvas.render();
					GEB.canvas.selectRow(rowFound.row.id);
					this.render();
				});
				return;
			}
			if (action === "remove-condition" && rowFound) {
				rowFound.row.condition = {
					enabled: false,
					field: "",
					operator: "equals",
					value: "",
					expression: "",
				};
				GEB.history?.snapshot("Row condition removed");
				GEB.markDirty();
				GEB.canvas.render();
				GEB.canvas.selectRow(rowFound.row.id);
				this.render();
				return;
			}
			if (action === "open-classic") {
				if (GEB.app && GEB.app.openClassic) GEB.app.openClassic();
				return;
			}
			if (action === "manage-merge-fields") {
				window.open("/desk/email-builder-settings", "_blank", "noopener");
				return;
			}
		},

		addBlock(type) {
			let block = null;
			if (GEB.state.selection?.type === "block") {
				const found = this.selectedBlock();
				if (found) {
					block = GEB.model.newBlock(type);
					found.column.blocks.splice(found.blockIndex + 1, 0, block);
				}
			} else if (GEB.state.selection?.type === "row") {
				const found = this.selectedRow();
				if (found) {
					block = GEB.model.newBlock(type);
					found.row.columns[0].blocks.push(block);
				}
			} else {
				block = GEB.model.insertIntoBestTarget(type);
			}
			if (!block) {
				const row = GEB.model.addRow([100]);
				block = GEB.model.insertBlock(row.id, 0, type);
			}
			GEB.history?.snapshot("Block added");
			GEB.markDirty();
			GEB.canvas.render();
			GEB.canvas.selectBlock(block.id, { focusText: !!GEB.blocks[type]?.rich });
			this.render();
		},

		onFieldChange(event, isInput) {
			const target = event.target;
			const colorText = target.closest("[data-color-text]");
			if (colorText) {
				if (isInput) return;
				const holder = colorText.closest("[data-field-key]");
				if (!holder) return;
				let value = colorText.value.trim();
				if (value && !/^#[0-9a-fA-F]{3,8}$/.test(value)) {
					GEB.ui.error("Enter a hex colour such as #005AB9, or leave it blank for the default.");
					return;
				}
				this.applyFieldValue(holder.dataset.fieldKey, value, {});
				this.render();
				return;
			}
			const colorInput = target.closest("[data-color-input]");
			if (colorInput) {
				if (!isInput) return;
				const holder = colorInput.closest("[data-field-key]");
				if (!holder) return;
				const value = colorInput.value;
				const text = holder.querySelector("[data-color-text]");
				if (text) text.value = value;
				GEB.colors.remember(value);
				this.applyFieldValue(holder.dataset.fieldKey, value, { live: true });
				return;
			}
			const range = target.closest("[data-range-input]");
			if (range) {
				if (!isInput) return;
				const holder = range.closest("[data-field-key]");
				if (!holder) return;
				const number = holder.querySelector("[data-number-input]");
				if (number) number.value = range.value;
				this.applyFieldValue(holder.dataset.fieldKey, Number(range.value), { live: true });
				return;
			}
			const numberInput = target.closest("[data-number-input]");
			if (numberInput) {
				if (isInput) return;
				const holder = numberInput.closest("[data-field-key]");
				if (!holder) return;
				const value = numberInput.value === "" ? null : Number(numberInput.value);
				this.applyFieldValue(holder.dataset.fieldKey, value, {});
				const rangeInput = holder.querySelector("[data-range-input]");
				if (rangeInput && value != null) rangeInput.value = value;
				return;
			}
			const spacingSide = target.closest("[data-spacing-side]");
			if (spacingSide) {
				if (isInput) return;
				const holder = spacingSide.closest("[data-field-key]");
				if (!holder) return;
				const side = spacingSide.dataset.spacingSide;
				const value = Number(spacingSide.value) || 0;
				const padding = Object.assign({}, this.readPadding(holder));
				if (holder.dataset.linked === "1") {
					padding.top = value;
					padding.right = value;
					padding.bottom = value;
					padding.left = value;
					holder.querySelectorAll("[data-spacing-side]").forEach((input) => {
						input.value = value;
					});
				} else {
					padding[side] = value;
				}
				this.applyFieldValue(holder.dataset.fieldKey, padding, {});
				return;
			}
			const networkEnabled = target.closest("[data-network-enabled]");
			if (networkEnabled) {
				const row = networkEnabled.closest("[data-network-key]");
				const holder = networkEnabled.closest("[data-field-key]");
				if (!row || !holder) return;
				const key = row.dataset.networkKey;
				const networks = this.readNetworks(holder);
				const existing = networks.find((network) => network.key === key);
				if (networkEnabled.checked && !existing) networks.push({ key, url: "" });
				if (!networkEnabled.checked && existing) networks.splice(networks.indexOf(existing), 1);
				const urlInput = row.querySelector("[data-network-url]");
				if (urlInput) urlInput.disabled = !networkEnabled.checked;
				this.applyFieldValue(holder.dataset.fieldKey, networks, {});
				return;
			}
			const networkUrl = target.closest("[data-network-url]");
			if (networkUrl) {
				if (isInput) return;
				const row = networkUrl.closest("[data-network-key]");
				const holder = networkUrl.closest("[data-field-key]");
				if (!row || !holder) return;
				const networks = this.readNetworks(holder);
				const network = networks.find((item) => item.key === row.dataset.networkKey);
				if (network) network.url = networkUrl.value.trim();
				this.applyFieldValue(holder.dataset.fieldKey, networks, {});
				return;
			}

			const setting = target.closest("[data-setting]");
			if (setting) {
				if (isInput && setting.dataset.setting === "reference_doctype") return;
				this.applySetting(setting.dataset.setting, setting.value, { live: isInput });
				return;
			}

			const field = target.closest("[data-field-key]");
			if (field && (target.matches("input, select, textarea"))) {
				const live = target.dataset.live === "1" || field.dataset.fieldType === "range";
				if (isInput && !live) return;
				if (!isInput && live && field.dataset.fieldType !== "url") return;
				const type = field.dataset.fieldType;
				let value = target.value;
				if (type === "number" || type === "range") value = value === "" ? null : Number(value);
				if (type === "toggle") value = target.checked;
				this.applyFieldValue(field.dataset.fieldKey, value, { live });
			}
		},

		readPadding(holder) {
			const padding = { top: 0, right: 0, bottom: 0, left: 0 };
			holder.querySelectorAll("[data-spacing-side]").forEach((input) => {
				padding[input.dataset.spacingSide] = Number(input.value) || 0;
			});
			return padding;
		},

		readNetworks(holder) {
			const networks = [];
			holder.querySelectorAll("[data-network-key]").forEach((row) => {
				const enabled = row.querySelector("[data-network-enabled]")?.checked;
				if (!enabled) return;
				const url = row.querySelector("[data-network-url]")?.value || "";
				networks.push({ key: row.dataset.networkKey, url });
			});
			return networks;
		},

		applyFieldValue(key, value, options) {
			if (!key) return;
			const opts = options || {};
			const blockFound = this.selectedBlock();
			const rowFound = this.selectedRow();
			const inSettings = key.startsWith("settings.");
			let target = null;
			let kind = "block";
			let actualKey = key;
			if (inSettings) {
				target = GEB.state.design.settings;
				actualKey = key.slice("settings.".length);
				kind = "settings";
			} else if (blockFound) {
				target = blockFound.block;
			} else if (rowFound) {
				target = rowFound.row;
				kind = "row";
			}
			if (!target) return;

			core.setPath(target, actualKey, value);
			GEB.markDirty();
			const label =
				kind === "settings"
					? "Email settings edited"
					: kind === "row"
						? "Row edited"
						: (GEB.blocks[(blockFound && blockFound.block.type) || "paragraph"]?.short || "Block") +
							" edited";
			if (opts.live && GEB.history?.snapshotDebounced) GEB.history.snapshotDebounced(label);
			else GEB.history?.snapshot(label);

			if (kind === "settings") {
				GEB.canvas.render();
			} else if (kind === "row") {
				GEB.canvas.refreshRow(rowFound.row.id);
			} else {
				GEB.canvas.refreshBlock(blockFound.block.id);
			}

			// Toggling a lock changes which controls are editable, and level
			// changes the rendered tag, so refresh this panel for those fields.
			if (key === "styles.locked" || key === "content.level") this.render();
			if (key === "settings.width" && GEB.app?.updateScale) GEB.app.updateScale();
		},

		applySetting(setting, value, options) {
			const opts = options || {};
			if (setting === "subject") {
				GEB.state.subject = value;
				GEB.app?.updateSubjectLabel?.();
			} else if (setting === "preheader") {
				GEB.state.design.settings.preheader = value;
				const strip = document.querySelector(".geb-preheader-text");
				if (strip) {
					strip.innerHTML = value
						? GEB.core.esc(value)
						: '<span class="geb-muted">Add preview text</span>';
				}
			} else if (setting === "email_title") {
				GEB.state.design.settings.email_title = value;
			} else if (setting === "reference_doctype") {
				GEB.state.referenceDoctype = value;
				GEB.api
					.getReferenceContext(value)
					.then((context) => {
						GEB.state.mergeFieldGroups = context.merge_field_groups || [];
						GEB.state.sampleDoc = context.sample_doc || {};
						GEB.ui.success("Merge fields updated for " + value + ".");
					})
					.catch(() => {});
			} else if (setting === "category") {
				GEB.state.designMeta.category = value;
			} else if (setting === "description") {
				GEB.state.designMeta.description = value;
			}
			GEB.markDirty();
			if (opts.live && GEB.history?.snapshotDebounced) {
				GEB.history.snapshotDebounced("Email details edited");
			} else {
				GEB.history?.snapshot("Email details edited");
			}
		},
	};
})();
