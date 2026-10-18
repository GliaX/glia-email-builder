/**
 * Glia Email Builder - drag and drop with SortableJS.
 *
 * The design model is rebuilt from the DOM after each drop, which keeps
 * dragging simple and handles reordering blocks across columns.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;

	GEB.dnd = {
		instances: [],
		paletteInstance: null,

		destroy() {
			this.instances.forEach((instance) => {
				try {
					instance.destroy();
				} catch (error) {
					/* already gone */
				}
			});
			this.instances = [];
		},

		init() {
			if (!window.Sortable || !GEB.state.canWrite) return;
			this.destroy();
			const state = GEB.state;
			const mobile = state.device === "mobile";

			const rows = document.getElementById("geb-rows");
			if (rows && !mobile) {
				this.instances.push(
					Sortable.create(rows, {
						animation: 150,
						handle: ".geb-row-drag",
						draggable: ".geb-row:not(.is-locked)",
						ghostClass: "geb-drag-ghost",
						chosenClass: "geb-drag-chosen",
						onEnd: () => this.afterRowDrop(),
					})
				);
			}

			document.querySelectorAll(".geb-col-blocks").forEach((column) => {
				if (column.closest(".geb-row.is-locked")) return;
				this.instances.push(
					Sortable.create(column, {
						group: { name: "geb-blocks", pull: !mobile, put: !mobile },
						animation: 140,
						handle: ".geb-block-drag",
						draggable: ".geb-block:not(.is-locked)",
						ghostClass: "geb-drag-ghost",
						chosenClass: "geb-drag-chosen",
						disabled: mobile,
						onEnd: (evt) => {
							if (evt.to && evt.to.closest && evt.to.closest(".geb-col-blocks")) {
								this.afterBlockDrop();
							}
						},
					})
				);
			});

			this.initPalette();
		},

		initPalette() {
			const palette = document.querySelector(".geb-palette");
			if (!palette || !window.Sortable) return;
			if (this.paletteInstance) {
				try {
					this.paletteInstance.destroy();
				} catch (error) {
					/* ignore */
				}
			}
			this.paletteInstance = Sortable.create(palette, {
				group: { name: "geb-blocks", pull: "clone", put: false },
				sort: false,
				animation: 140,
				draggable: ".geb-palette-item",
				ghostClass: "geb-palette-ghost",
				onEnd: (evt) => this.afterPaletteDrop(evt),
			});
		},

		afterPaletteDrop(evt) {
			const item = evt.item;
			const target = evt.to;
			const type = item?.dataset?.blockType;
			if (!type || !target || !target.classList.contains("geb-col-blocks")) {
				item?.remove();
				GEB.canvas.render();
				return;
			}
			const rowId = target.dataset.rowId;
			const colIndex = Number(target.dataset.colIndex);
			const index = Math.max(0, Math.min(Number(evt.newIndex) || 0, target.querySelectorAll(".geb-block").length));
			item.remove();
			const block = GEB.model.insertBlock(rowId, colIndex, type, index);
			if (!block) {
				GEB.canvas.render();
				return;
			}
			GEB.history?.snapshot("Block dropped");
			GEB.markDirty();
			GEB.canvas.render();
			GEB.canvas.selectBlock(block.id, { focusText: !!GEB.blocks[type]?.rich });
			GEB.inspector?.render();
		},

		afterBlockDrop() {
			const blockMap = {};
			GEB.model.allBlocks().forEach((block) => {
				blockMap[block.id] = block;
			});
			const rowsById = {};
			GEB.model.rows().forEach((row) => {
				rowsById[row.id] = row;
			});
			const orderedRows = [];
			document.querySelectorAll("#geb-rows .geb-row[data-row-id]").forEach((rowEl) => {
				const row = rowsById[rowEl.dataset.rowId];
				if (!row) return;
				orderedRows.push(row);
				rowEl.querySelectorAll(".geb-col").forEach((colEl) => {
					const colIndex = Number(colEl.dataset.colIndex);
					const column = row.columns[colIndex];
					if (!column) return;
					const nextBlocks = [];
					colEl.querySelectorAll(".geb-block[data-block-id]").forEach((blockEl) => {
						const block = blockMap[blockEl.dataset.blockId];
						if (block) nextBlocks.push(block);
					});
					column.blocks = nextBlocks;
				});
			});
			if (orderedRows.length) {
				GEB.state.design.rows = orderedRows;
			}
			GEB.history?.snapshot("Layout changed");
			GEB.markDirty();
			GEB.canvas.render();
			GEB.inspector?.render();
		},

		afterRowDrop() {
			const rowsById = {};
			GEB.model.rows().forEach((row) => {
				rowsById[row.id] = row;
			});
			const ordered = [];
			document.querySelectorAll("#geb-rows .geb-row[data-row-id]").forEach((rowEl) => {
				const row = rowsById[rowEl.dataset.rowId];
				if (row) ordered.push(row);
			});
			if (ordered.length) {
				GEB.state.design.rows = ordered;
				GEB.history?.snapshot("Row moved");
				GEB.markDirty();
				GEB.canvas.render();
				GEB.inspector?.render();
			}
		},
	};
})();
