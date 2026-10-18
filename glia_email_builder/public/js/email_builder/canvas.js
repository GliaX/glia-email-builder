/**
 * Glia Email Builder - canvas rendering and inline editing.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	function snapshot(label) {
		if (GEB.history && GEB.history.snapshot) GEB.history.snapshot(label);
		if (GEB.markDirty) GEB.markDirty();
	}

	function refreshInspector() {
		if (GEB.inspector && GEB.inspector.render) GEB.inspector.render();
	}

	function selectedBlockId() {
		return GEB.state.selection && GEB.state.selection.type === "block"
			? GEB.state.selection.id
			: null;
	}

	GEB.canvas = {
		root: null,

		init(root) {
			this.root = root;
			this.bind();
		},

		bind() {
			const root = this.root;
			if (!root || root.__gebBound) return;
			root.__gebBound = true;

			root.addEventListener("click", (event) => this.onClick(event));
			root.addEventListener("input", (event) => this.onInput(event));
			root.addEventListener("paste", (event) => this.onPaste(event));
			root.addEventListener("keydown", (event) => this.onKeyDown(event));
			root.addEventListener("focusin", (event) => this.onFocusIn(event));
			root.addEventListener("focusout", (event) => this.onFocusOut(event));
			root.addEventListener("dblclick", (event) => this.onDoubleClick(event));
			root.addEventListener("dragstart", (event) => {
				if (event.target.tagName === "IMG") event.preventDefault();
			});
			root.addEventListener(
				"scroll",
				() => {
					if (GEB.toolbar) GEB.toolbar.reposition();
				},
				true
			);
		},

		// -----------------------------------------------------------------
		// Rendering
		// -----------------------------------------------------------------

		render() {
			if (!this.root) return;
			const state = GEB.state;
			const design = state.design;
			const settings = design.settings;
			const resolved = GEB.style.resolved();
			const device = state.device || "desktop";
			const showHidden = !!state.showHidden;

			const preheader = settings.preheader || "";
			const preheaderHtml =
				'<button type="button" class="geb-preheader" data-action="edit-preheader" title="Edit preview text">' +
				'<span class="geb-preheader-label">Preview text</span>' +
				'<span class="geb-preheader-text">' +
				(preheader ? esc(preheader) : '<span class="geb-muted">Add preview text</span>') +
				"</span></button>";

			const rows = design.rows || [];
			const stageClasses =
				"geb-canvas-stage " +
				(device === "mobile" ? "is-mobile" : "is-desktop") +
				(showHidden ? " show-hidden" : "");
			const emailStyle =
				"width:" +
				(device === "mobile" ? 390 : resolved.width) +
				"px;background:" +
				resolved.contentBackground +
				";border-radius:" +
				resolved.borderRadius +
				"px;";

			const emptyState = rows.length
				? ""
				: '<div class="geb-empty-state">' +
				  '<div class="geb-empty-title">Start building your email</div>' +
				  '<div class="geb-empty-copy">Choose a layout below, or drag a content block from the right-hand panel.</div>' +
				  '<div class="geb-empty-actions">' +
				  GEB.blocks.ROW_PRESETS.slice(0, 4)
						.map(
							(preset) =>
								'<button type="button" class="geb-layout-btn" data-add-row-widths="' +
								esc(preset.widths.join(",")) +
								'" title="' +
								esc(preset.label) +
								'">' +
								'<span class="geb-layout-icon">' +
								GEB.icons[preset.icon] +
								"</span>" +
								esc(preset.label) +
								"</button>"
						)
						.join("") +
				  "</div>" +
				  '<button type="button" class="geb-empty-block-btn" data-action="add-block-empty">' +
				  GEB.icons.plus +
				  " Add a content block</button>" +
				  "</div>";

			const addRow =
				'<div class="geb-add-row">' +
				'<button type="button" class="geb-add-row-btn" data-action="add-row">' +
				GEB.icons.plus +
				" Add a row</button>" +
				'<span class="geb-add-row-hint">or pick a layout in the Rows panel</span>' +
				"</div>";

			this.root.innerHTML =
				'<div class="' +
				stageClasses +
				'" style="--geb-link:' +
				resolved.linkColor +
				";--geb-text:" +
				resolved.textColor +
				";--geb-content-width:" +
				resolved.width +
				'px;">' +
				preheaderHtml +
				'<div class="geb-email" style="' +
				emailStyle +
				'">' +
				'<div class="geb-rows" id="geb-rows">' +
				rows.map((row) => this.renderRow(row)).join("") +
				"</div>" +
				emptyState +
				addRow +
				"</div>" +
				'<div class="geb-canvas-footnote">' +
				'<span class="geb-dim">' +
				resolved.width +
				" px · " +
				GEB.model.blockCount(design) +
				" blocks</span>" +
				'<button type="button" class="geb-link-btn" data-action="edit-settings">Email settings</button>' +
				"</div>" +
				"</div>";

			this.markSelection();
			if (GEB.dnd) GEB.dnd.init();
			if (GEB.state && !GEB.state.canWrite && GEB.app && GEB.app.applyReadOnly) {
				GEB.app.applyReadOnly();
			}
		},

		renderRow(row) {
			const state = GEB.state;
			const styles = row.styles || {};
			const selected = state.selection && state.selection.type === "row" && state.selection.id === row.id;
			const parentSelected =
				state.selection && state.selection.type === "block" && this.rowOfBlock(state.selection.id)?.id === row.id;
			const hiddenMobile = !!styles.hide_mobile;
			const hiddenDesktop = !!styles.hide_desktop;
			const deviceHidden =
				(state.device === "mobile" && hiddenMobile) || (state.device === "desktop" && hiddenDesktop);
			const locked = !!styles.locked;
			const condition = row.condition && row.condition.enabled;
			const classes = [
				"geb-row",
				selected ? "is-selected" : "",
				parentSelected ? "is-parent-selected" : "",
				deviceHidden ? "is-device-hidden" : "",
				locked ? "is-locked" : "",
				condition ? "has-condition" : "",
				styles.no_stack ? "row-no-stack" : "",
			]
				.filter(Boolean)
				.join(" ");

			const conditionChip = condition
				? '<button type="button" class="geb-condition-chip" data-row-action="condition" title="Edit display condition">' +
				  GEB.icons.condition +
				  "<span>" +
				  esc(GEB.model.conditionSummary(row.condition)) +
				  "</span></button>"
				: "";

			const hiddenBadge = deviceHidden
				? '<span class="geb-hidden-badge">' +
				  GEB.icons.eye +
				  (hiddenMobile ? " Hidden on mobile" : " Hidden on desktop") +
				  "</span>"
				: "";

			const tools = locked
				? '<div class="geb-row-tools"><span class="geb-lock-badge" title="Row locked">' + GEB.icons.lock + "</span></div>"
				: '<div class="geb-row-tools">' +
				  '<span class="geb-drag geb-row-drag" data-row-action="drag" title="Drag row">' + GEB.icons.drag + "</span>" +
				  conditionChip +
				  '<div class="geb-tool-spacer"></div>' +
				  '<button type="button" class="geb-icon-btn" data-row-action="up" title="Move row up">' + GEB.icons.arrowUp + "</button>" +
				  '<button type="button" class="geb-icon-btn" data-row-action="down" title="Move row down">' + GEB.icons.arrowDown + "</button>" +
				  '<button type="button" class="geb-icon-btn" data-row-action="duplicate" title="Duplicate row">' + GEB.icons.duplicate + "</button>" +
				  '<button type="button" class="geb-icon-btn geb-danger" data-row-action="delete" title="Delete row">' + GEB.icons.trash + "</button>" +
				  "</div>";

			const visualColumns =
				state.device === "mobile" && styles.reverse_stack ? row.columns.slice().reverse() : row.columns;
			const columnsHtml = visualColumns
				.map((column) => {
					const originalIndex = row.columns.indexOf(column);
					return this.renderColumn(row, column, originalIndex);
				})
				.join("");

			const tableClass =
				"geb-row-table" +
				(styles.reverse_stack ? " geb-reverse" : "") +
				(styles.no_stack ? " geb-no-stack-row" : "");

			return (
				'<div class="' +
				classes +
				'" data-row-id="' +
				esc(row.id) +
				'">' +
				tools +
				hiddenBadge +
				'<div class="geb-row-body" style="' +
				GEB.style.row(row) +
				'">' +
				'<table role="presentation" class="' +
				tableClass +
				'" style="' +
				GEB.style.rowTable(row) +
				'"><tbody><tr>' +
				columnsHtml +
				"</tr></tbody></table>" +
				"</div>" +
				"</div>"
			);
		},

		renderColumn(row, column, colIndex) {
			const rowStyles = row.styles || {};
			const width = Number(column.width) || 100 / row.columns.length;
			const stackClass = rowStyles.no_stack ? "geb-col-no-stack" : "geb-col-stack";
			const blocks = column.blocks || [];
			const dropzone =
				'<div class="geb-col-dropzone" data-drop-col="' +
				colIndex +
				'" data-drop-row="' +
				esc(row.id) +
				'">' +
				(blocks.length
					? '<span class="geb-dim">Drop content blocks here</span>'
					: '<button type="button" class="geb-drop-add" data-add-block="' +
					  esc(row.id) +
					  '" data-col-index="' +
					  colIndex +
					  '">' +
					  GEB.icons.plus +
					  "</button><span>Drop content blocks here</span>") +
				"</div>";
			return (
				'<td class="geb-col ' +
				stackClass +
				'" style="width:' +
				width +
				'%;vertical-align:top;" data-col-index="' +
				colIndex +
				'">' +
				'<div class="geb-col-blocks" data-row-id="' +
				esc(row.id) +
				'" data-col-index="' +
				colIndex +
				'">' +
				blocks.map((block) => this.renderBlock(block, row, colIndex)).join("") +
				"</div>" +
				dropzone +
				"</td>"
			);
		},

		renderBlock(block, row, colIndex) {
			const meta = GEB.blocks[block.type] || GEB.blocks.paragraph;
			const styles = block.styles || {};
			const selected = selectedBlockId() === block.id;
			const hiddenMobile = !!styles.hide_mobile;
			const hiddenDesktop = !!styles.hide_desktop;
			const deviceHidden =
				(GEB.state.device === "mobile" && hiddenMobile) ||
				(GEB.state.device === "desktop" && hiddenDesktop);
			const locked = !!styles.locked;
			const classes = [
				"geb-block",
				"geb-block-" + block.type,
				selected ? "is-selected" : "",
				deviceHidden ? "is-device-hidden" : "",
				locked ? "is-locked" : "",
			]
				.filter(Boolean)
				.join(" ");
			const hiddenBadge = deviceHidden
				? '<span class="geb-hidden-badge">' +
				  GEB.icons.eye +
				  (hiddenMobile ? " Hidden on mobile" : " Hidden on desktop") +
				  "</span>"
				: "";
			const tools = locked
				? '<div class="geb-block-tools"><span class="geb-lock-badge" title="Block locked">' + GEB.icons.lock + "</span></div>"
				: '<div class="geb-block-tools">' +
				  '<span class="geb-drag geb-block-drag" data-block-action="drag" title="Drag block">' + GEB.icons.drag + "</span>" +
				  '<div class="geb-tool-spacer"></div>' +
				  '<button type="button" class="geb-icon-btn" data-block-action="add" title="Add a block after">' + GEB.icons.plus + "</button>" +
				  '<button type="button" class="geb-icon-btn" data-block-action="duplicate" title="Duplicate block">' + GEB.icons.duplicate + "</button>" +
				  '<button type="button" class="geb-icon-btn geb-danger" data-block-action="delete" title="Delete block">' + GEB.icons.trash + "</button>" +
				  "</div>";

			return (
				'<div class="' +
				classes +
				'" data-block-id="' +
				esc(block.id) +
				'" data-block-type="' +
				esc(block.type) +
				'" style="' +
				GEB.style.blockWrapper(block) +
				'">' +
				tools +
				hiddenBadge +
				'<div class="geb-block-content">' +
				meta.canvas(block) +
				"</div>" +
				"</div>"
			);
		},

		// -----------------------------------------------------------------
		// Selection
		// -----------------------------------------------------------------

		rowOfBlock(blockId) {
			const found = GEB.model.findBlock(blockId);
			return found ? found.row : null;
		},

		selectBlock(blockId, options) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return;
			GEB.state.selection = { type: "block", id: blockId };
			this.markSelection();
			if (GEB.inspector && GEB.inspector.setTab) GEB.inspector.setTab("content");
			refreshInspector();
			if (!options || !options.keepToolbar) {
				const el = this.root.querySelector('[data-block-id="' + blockId + '"] [contenteditable]');
				if (el && document.activeElement !== el && options && options.focusText) {
					el.focus();
				}
			}
		},

		selectRow(rowId) {
			if (!GEB.model.findRow(rowId)) return;
			GEB.state.selection = { type: "row", id: rowId };
			this.markSelection();
			if (GEB.inspector && GEB.inspector.setTab) GEB.inspector.setTab("rows");
			refreshInspector();
		},

		clearSelection() {
			GEB.state.selection = null;
			this.markSelection();
			if (GEB.inspector && GEB.inspector.setTab) GEB.inspector.setTab("content");
			refreshInspector();
			if (GEB.toolbar) GEB.toolbar.hide();
		},

		markSelection() {
			if (!this.root) return;
			const selection = GEB.state.selection;
			this.root.querySelectorAll(".geb-block.is-selected, .geb-row.is-selected").forEach((el) => {
				el.classList.remove("is-selected");
			});
			this.root.querySelectorAll(".geb-row.is-parent-selected").forEach((el) => {
				el.classList.remove("is-parent-selected");
			});
			if (selection && selection.type === "block") {
				const block = this.root.querySelector('.geb-block[data-block-id="' + selection.id + '"]');
				if (block) {
					block.classList.add("is-selected");
					const row = block.closest(".geb-row");
					if (row) row.classList.add("is-parent-selected");
				}
			} else if (selection && selection.type === "row") {
				const row = this.root.querySelector('.geb-row[data-row-id="' + selection.id + '"]');
				if (row) row.classList.add("is-selected");
			}
			const hidden = GEB.state.showHidden;
			this.root.querySelector(".geb-canvas-stage")?.classList.toggle("show-hidden", hidden);
		},

		refreshBlock(blockId) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return;
			const el = this.root.querySelector('.geb-block[data-block-id="' + blockId + '"]');
			if (!el) return;
			const wrapper = document.createElement("div");
			wrapper.innerHTML = this.renderBlock(found.block, found.row, found.colIndex);
			el.replaceWith(wrapper.firstElementChild);
			this.markSelection();
		},

		refreshRow(rowId) {
			const found = GEB.model.findRow(rowId);
			if (!found) return;
			const el = this.root.querySelector('.geb-row[data-row-id="' + rowId + '"]');
			if (!el) return;
			const wrapper = document.createElement("div");
			wrapper.innerHTML = this.renderRow(found.row);
			el.replaceWith(wrapper.firstElementChild);
			this.markSelection();
		},

		applyDevice() {
			this.render();
		},

		// -----------------------------------------------------------------
		// Inline editing
		// -----------------------------------------------------------------

		blockFromElement(el) {
			const holder = el.closest("[data-block-id]");
			if (!holder) return null;
			return GEB.model.findBlock(holder.dataset.blockId);
		},

		syncEditable(el) {
			const found = this.blockFromElement(el);
			if (!found) return;
			if (el.dataset.edit === "text") {
				found.block.content.text = el.innerText.replace(/\u00a0/g, " ").replace(/\n+$/, "");
			} else {
				found.block.content.html = el.innerHTML;
			}
			if (GEB.markDirty) GEB.markDirty();
			if (GEB.history && GEB.history.snapshotDebounced) {
				GEB.history.snapshotDebounced((el.dataset.edit === "text" ? "Text" : "Text") + " edited");
			}
		},

		onInput(event) {
			const el = event.target;
			if (!el.isContentEditable) return;
			this.syncEditable(el);
			if (GEB.toolbar) GEB.toolbar.syncState();
		},

		onPaste(event) {
			const el = event.target;
			if (!el.isContentEditable) return;
			event.preventDefault();
			const html = (event.clipboardData || window.clipboardData).getData("text/html");
			const text = (event.clipboardData || window.clipboardData).getData("text/plain");
			if (html) {
				document.execCommand("insertHTML", false, core.sanitizePastedHtml(html));
			} else {
				document.execCommand("insertText", false, text);
			}
			this.syncEditable(el);
		},

		onKeyDown(event) {
			const el = event.target;
			if (!el.isContentEditable) return;
			const isSingleLine = el.dataset.edit === "text";
			if (event.key === "Enter" && isSingleLine) {
				event.preventDefault();
				el.blur();
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				el.blur();
				this.clearSelection();
				return;
			}
			if ((event.metaKey || event.ctrlKey) && (event.key === "z" || event.key === "y")) {
				// Let the browser handle undo inside the editable field.
				event.stopPropagation();
			}
		},

		onFocusIn(event) {
			const el = event.target;
			if (!el.isContentEditable) return;
			const found = this.blockFromElement(el);
			if (!found) return;
			if (!GEB.state.selection || GEB.state.selection.id !== found.block.id) {
				GEB.state.selection = { type: "block", id: found.block.id };
				this.markSelection();
				refreshInspector();
			}
			if (GEB.toolbar) GEB.toolbar.showFor(el);
		},

		onFocusOut(event) {
			if (!event.target.isContentEditable) return;
			setTimeout(() => {
				const active = document.activeElement;
				if (active && (active.closest(".geb-toolbar") || active.isContentEditable)) return;
				if (GEB.toolbar) GEB.toolbar.hide();
			}, 120);
		},

		onDoubleClick(event) {
			const blockEl = event.target.closest("[data-block-id]");
			if (!blockEl) return;
			const found = GEB.model.findBlock(blockEl.dataset.blockId);
			if (!found) return;
			if (found.block.type === "image") {
				this.openImagePicker(found.block);
			}
		},

		// -----------------------------------------------------------------
		// Click actions
		// -----------------------------------------------------------------

		onClick(event) {
			const target = event.target;
			const actionEl = target.closest("[data-action]");
			if (actionEl) {
				const action = actionEl.dataset.action;
				if (action === "edit-preheader" || action === "edit-settings") {
					event.preventDefault();
					if (GEB.inspector) GEB.inspector.setTab("settings");
					if (action === "edit-preheader") {
						setTimeout(() => {
							const input = document.querySelector('[data-setting="preheader"]');
							if (input) {
								input.focus();
								input.select && input.select();
							}
						}, 60);
					}
					return;
				}
				if (action === "browse-image") {
					event.preventDefault();
					event.stopPropagation();
					const found = this.blockFromElement(actionEl);
					if (found) this.openImagePicker(found.block);
					return;
				}
				if (action === "social-link") {
					event.preventDefault();
					event.stopPropagation();
					const found = this.blockFromElement(actionEl);
					if (found) this.selectBlock(found.block.id);
					return;
				}
				if (action === "add-row") {
					event.preventDefault();
					if (!GEB.state.canWrite) return;
					this.addRow([100]);
					return;
				}
				if (action === "add-block-empty") {
					event.preventDefault();
					if (!GEB.state.canWrite) return;
					GEB.ui.blockPicker((type) => {
						if (!GEB.model.rows().length) {
							const row = GEB.model.addRow([100]);
							const block = GEB.model.insertBlock(row.id, 0, type);
							snapshot("Row added");
							this.render();
							if (block) this.selectBlock(block.id, { focusText: true });
						} else {
							const block = GEB.model.insertIntoBestTarget(type);
							snapshot("Block added");
							this.render();
							if (block) this.selectBlock(block.id, { focusText: true });
						}
						refreshInspector();
					});
					return;
				}
			}

			const layoutBtn = target.closest("[data-add-row-widths]");
			if (layoutBtn) {
				event.preventDefault();
				if (!GEB.state.canWrite) return;
				const widths = layoutBtn.dataset.addRowWidths.split(",").map(Number);
				this.addRow(widths);
				return;
			}

			const addBlockBtn = target.closest("[data-add-block]");
			if (addBlockBtn) {
				event.preventDefault();
				if (!GEB.state.canWrite) return;
				const rowId = addBlockBtn.dataset.addBlock;
				const colIndex = Number(addBlockBtn.dataset.colIndex);
				GEB.ui.blockPicker((type) => {
					const block = GEB.model.insertBlock(rowId, colIndex, type);
					snapshot("Block added");
					this.render();
					if (block) this.selectBlock(block.id, { focusText: true });
					refreshInspector();
				});
				return;
			}

			const blockAction = target.closest("[data-block-action]");
			if (blockAction) {
				event.preventDefault();
				event.stopPropagation();
				const blockEl = blockAction.closest("[data-block-id]");
				if (!blockEl) return;
				this.handleBlockAction(blockAction.dataset.blockAction, blockEl.dataset.blockId);
				return;
			}

			const rowAction = target.closest("[data-row-action]");
			if (rowAction) {
				event.preventDefault();
				event.stopPropagation();
				const rowEl = rowAction.closest("[data-row-id]");
				if (!rowEl) return;
				this.handleRowAction(rowAction.dataset.rowAction, rowEl.dataset.rowId);
				return;
			}

			// Links inside editable content should never navigate the desk page.
			const anchor = target.closest("a");
			if (anchor && anchor.closest(".geb-rich, .geb-html-block, .geb-email")) {
				event.preventDefault();
			}

			const blockEl = target.closest(".geb-block");
			if (blockEl && !target.closest(".geb-block-tools")) {
				this.selectBlock(blockEl.dataset.blockId);
				return;
			}

			const rowEl = target.closest(".geb-row");
			if (rowEl) {
				if (!target.closest(".geb-row-tools")) this.selectRow(rowEl.dataset.rowId);
				return;
			}

			if (target.closest(".geb-canvas-stage, .geb-email, .geb-rows, .geb-add-row, .geb-canvas-footnote")) {
				this.clearSelection();
			}
		},

		handleBlockAction(action, blockId) {
			if (!GEB.state.canWrite) return;
			const found = GEB.model.findBlock(blockId);
			if (!found) return;
			if (found.block.styles?.locked && action !== "drag") {
				GEB.ui.toast("This block is locked. Unlock it in the properties panel to edit it.", "info");
				return;
			}
			if (action === "drag") {
				this.selectBlock(blockId);
				return;
			}
			if (action === "add") {
				GEB.ui.blockPicker((type) => {
					const block = GEB.model.newBlock(type);
					found.column.blocks.splice(found.blockIndex + 1, 0, block);
					snapshot("Block added");
					this.render();
					this.selectBlock(block.id, { focusText: true });
					refreshInspector();
				});
				return;
			}
			if (action === "duplicate") {
				const copy = GEB.model.duplicateBlock(blockId);
				snapshot("Block duplicated");
				this.render();
				if (copy) this.selectBlock(copy.id);
				return;
			}
			if (action === "delete") {
				GEB.model.removeBlock(blockId);
				snapshot("Block deleted");
				GEB.state.selection = null;
				this.render();
				refreshInspector();
			}
		},

		handleRowAction(action, rowId) {
			if (!GEB.state.canWrite) return;
			const found = GEB.model.findRow(rowId);
			if (!found) return;
			if (found.row.styles?.locked && action !== "drag" && action !== "condition") {
				GEB.ui.toast("This row is locked. Unlock it in the properties panel to edit it.", "info");
				return;
			}
			if (action === "drag") {
				this.selectRow(rowId);
				return;
			}
			if (action === "condition") {
				if (GEB.modals && GEB.modals.rowCondition) {
					GEB.modals.rowCondition(found.row, () => {
						snapshot("Row condition updated");
						this.render();
						this.selectRow(rowId);
						refreshInspector();
					});
				}
				return;
			}
			if (action === "up" || action === "down") {
				GEB.model.moveRow(rowId, action === "up" ? -1 : 1);
				snapshot("Row moved");
				this.render();
				this.selectRow(rowId);
				return;
			}
			if (action === "duplicate") {
				const copy = GEB.model.duplicateRow(rowId);
				snapshot("Row duplicated");
				this.render();
				if (copy) this.selectRow(copy.id);
				return;
			}
			if (action === "delete") {
				GEB.model.removeRow(rowId);
				snapshot("Row deleted");
				GEB.state.selection = null;
				this.render();
				refreshInspector();
			}
		},

		addRow(widths) {
			if (!GEB.state.canWrite) return;
			const row = GEB.model.addRow(widths);
			snapshot("Row added");
			this.render();
			this.selectRow(row.id);
			refreshInspector();
			GEB.ui.toast("Row added. Drag content blocks into it.", "success");
		},

		openImagePicker(block) {
			if (!GEB.state.canWrite) return;
			if (GEB.modals && GEB.modals.openImages) {
				GEB.modals.openImages((file) => {
					block.content.src = file.file_url;
					if (!block.content.alt) block.content.alt = file.file_name || "";
					snapshot("Image changed");
					this.refreshBlock(block.id);
					refreshInspector();
				});
			}
		},

		focusBlockText(blockId) {
			const el = this.root.querySelector(
				'[data-block-id="' + blockId + '"] [contenteditable="true"]'
			);
			if (!el) return;
			el.focus();
			const range = document.createRange();
			range.selectNodeContents(el);
			range.collapse(false);
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		},
	};
})();
