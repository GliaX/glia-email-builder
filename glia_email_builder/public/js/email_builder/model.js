/**
 * Glia Email Builder - design model and mutation helpers.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;

	const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
	const ROW_PADDING = { top: 10, right: 20, bottom: 10, left: 20 };

	function baseStyles(type) {
		const styles = {
			padding: Object.assign({}, ZERO),
			background_color: "",
			hide_mobile: false,
			hide_desktop: false,
			locked: false,
			font_family: "",
			font_size: 16,
			line_height: 1.6,
			letter_spacing: 0,
			color: "",
			align: "left",
		};
		if (type === "title") {
			styles.font_size = 32;
			styles.line_height = 1.25;
		}
		if (type === "paragraph") {
			styles.paragraph_spacing = 12;
			styles.direction = "ltr";
		}
		if (type === "text") {
			styles.line_height = 1.5;
		}
		if (type === "list") {
			styles.line_height = 1.7;
			styles.paragraph_spacing = 0;
		}
		if (type === "image") {
			styles.padding = Object.assign({}, ZERO);
		}
		if (type === "button") {
			styles.background_color = "";
			styles.text_color = "";
			styles.border_radius = 6;
			styles.bold = true;
			styles.full_width = false;
			styles.font_size = 16;
			styles.padding = { top: 6, right: 0, bottom: 6, left: 0 };
		}
		if (type === "divider") {
			styles.padding = { top: 16, right: 0, bottom: 16, left: 0 };
		}
		if (type === "spacer") {
			styles.padding = Object.assign({}, ZERO);
		}
		if (type === "social") {
			styles.padding = { top: 12, right: 0, bottom: 12, left: 0 };
		}
		return styles;
	}

	const DEFAULT_CONTENT = {
		title: { text: "I'm a new title block", level: 2 },
		paragraph: { html: "<p>I'm a new paragraph block.</p>" },
		text: { html: "I'm a new Text block ready for your content." },
		list: {
			html: "<ul><li>List item one</li><li>List item two</li></ul>",
			list_style: "disc",
			list_start: 1,
		},
		image: { src: "", alt: "", link: "", width: 100, align: "center", border_radius: 0 },
		button: { text: "Donate now", link: "{{ DonateURL }}", align: "center", full_width: false },
		divider: { width: 100, thickness: 1, color: "#DDE5E3", align: "center" },
		spacer: { height: 24 },
		social: {
			networks: [
				{ key: "facebook", url: "" },
				{ key: "instagram", url: "" },
				{ key: "twitter", url: "" },
				{ key: "linkedin", url: "" },
				{ key: "youtube", url: "" },
			],
			icon_size: 24,
			spacing: 12,
			align: "center",
		},
		html: { html: "<p>Add your HTML here.</p>" },
		video: { url: "", thumbnail: "", align: "center", width: 100 },
	};

	GEB.model = {
		ZERO,
		ROW_PADDING,
		baseStyles,

		newBlock(type) {
			if (!type) type = "paragraph";
			return {
				id: core.uid("block"),
				type,
				styles: baseStyles(type),
				content: core.clone(DEFAULT_CONTENT[type] || {}),
			};
		},

		newRow(widths, options) {
			const opts = options || {};
			const columnWidths = widths && widths.length ? widths : [100];
			let total = columnWidths.reduce((sum, width) => sum + Number(width), 0);
			if (!total) total = 100;
			return {
				id: core.uid("row"),
				styles: {
					background_color: opts.background || "",
					background_image: "",
					padding: Object.assign({}, opts.padding || ROW_PADDING),
					columns_gap: opts.gap == null ? 20 : opts.gap,
					vertical_align: "top",
					border_radius: 0,
					hide_mobile: false,
					hide_desktop: false,
					reverse_stack: !!opts.reverse,
					no_stack: false,
					locked: false,
				},
				condition: {
					enabled: false,
					field: "",
					operator: "equals",
					value: "",
					expression: "",
				},
				columns: columnWidths.map((width) => ({
					id: core.uid("col"),
					width: Math.round((Number(width) / total) * 10000) / 100,
					blocks: [],
				})),
			};
		},

		newDesign(settings) {
			return {
				version: 1,
				settings: Object.assign(
					{
						width: 600,
						align: "center",
						background_color: "#F3F6F5",
						content_background: "#FFFFFF",
						font_family: "",
						font_size: 16,
						text_color: "#1D2B2F",
						link_color: "",
						button_color: "",
						button_text_color: "",
						preheader: "",
						email_title: "",
						subject_template: "",
						border_radius: 0,
					},
					settings || {}
				),
				rows: [],
			};
		},

		normalize(design) {
			const normalized = design && typeof design === "object" ? core.clone(design) : GEB.model.newDesign();
			normalized.settings = Object.assign(GEB.model.newDesign().settings, normalized.settings || {});
			normalized.rows = Array.isArray(normalized.rows) ? normalized.rows : [];
			const seen = new Set();
			normalized.rows.forEach((row) => {
				row.id = row.id || core.uid("row");
				if (seen.has(row.id)) row.id = core.uid("row");
				seen.add(row.id);
				row.styles = Object.assign(
					{
						background_color: "",
						background_image: "",
						padding: Object.assign({}, ROW_PADDING),
						columns_gap: 20,
						vertical_align: "top",
						border_radius: 0,
						hide_mobile: false,
						hide_desktop: false,
						reverse_stack: false,
						no_stack: false,
						locked: false,
					},
					row.styles || {}
				);
				row.condition = Object.assign(
					{ enabled: false, field: "", operator: "equals", value: "", expression: "" },
					row.condition || {}
				);
				row.columns = Array.isArray(row.columns) && row.columns.length ? row.columns : [{ width: 100, blocks: [] }];
				row.columns.forEach((column) => {
					column.id = column.id || core.uid("col");
					if (seen.has(column.id)) column.id = core.uid("col");
					seen.add(column.id);
					column.width = Number(column.width) || 100 / row.columns.length;
					column.blocks = Array.isArray(column.blocks) ? column.blocks : [];
					column.blocks.forEach((block) => {
						block.id = block.id || core.uid("block");
						if (seen.has(block.id)) block.id = core.uid("block");
						seen.add(block.id);
						block.styles = Object.assign(baseStyles(block.type), block.styles || {});
						block.content = Object.assign({}, DEFAULT_CONTENT[block.type] || {}, block.content || {});
					});
				});
			});
			return normalized;
		},

		rows() {
			return (GEB.state.design && GEB.state.design.rows) || [];
		},

		findRow(rowId) {
			const rows = GEB.model.rows();
			for (let index = 0; index < rows.length; index++) {
				if (rows[index].id === rowId) return { row: rows[index], index };
			}
			return null;
		},

		findBlock(blockId) {
			const rows = GEB.model.rows();
			for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
				const row = rows[rowIndex];
				for (let colIndex = 0; colIndex < row.columns.length; colIndex++) {
					const column = row.columns[colIndex];
					for (let blockIndex = 0; blockIndex < column.blocks.length; blockIndex++) {
						if (column.blocks[blockIndex].id === blockId) {
							return {
								row,
								rowIndex,
								column,
								colIndex,
								block: column.blocks[blockIndex],
								blockIndex,
							};
						}
					}
				}
			}
			return null;
		},

		blockCount(design) {
			const value = design || GEB.state.design;
			return (value.rows || []).reduce(
				(total, row) => total + row.columns.reduce((sum, column) => sum + column.blocks.length, 0),
				0
			);
		},

		addRow(widths, options) {
			const row = GEB.model.newRow(widths, options);
			const selectedRow = GEB.state.selection?.type === "row" ? GEB.model.findRow(GEB.state.selection.id) : null;
			if (selectedRow) {
				GEB.state.design.rows.splice(selectedRow.index + 1, 0, row);
			} else {
				GEB.state.design.rows.push(row);
			}
			return row;
		},

		removeRow(rowId) {
			const found = GEB.model.findRow(rowId);
			if (!found) return;
			GEB.state.design.rows.splice(found.index, 1);
		},

		moveRow(rowId, direction) {
			const found = GEB.model.findRow(rowId);
			if (!found) return;
			const next = found.index + direction;
			if (next < 0 || next >= GEB.state.design.rows.length) return;
			const rows = GEB.state.design.rows;
			const [row] = rows.splice(found.index, 1);
			rows.splice(next, 0, row);
		},

		duplicateRow(rowId) {
			const found = GEB.model.findRow(rowId);
			if (!found) return null;
			const copy = core.clone(found.row);
			copy.id = core.uid("row");
			copy.columns.forEach((column) => {
				column.id = core.uid("col");
				column.blocks.forEach((block) => {
					block.id = core.uid("block");
				});
			});
			GEB.state.design.rows.splice(found.index + 1, 0, copy);
			return copy;
		},

		removeBlock(blockId) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return;
			found.column.blocks.splice(found.blockIndex, 1);
		},

		duplicateBlock(blockId) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return null;
			const copy = core.clone(found.block);
			copy.id = core.uid("block");
			found.column.blocks.splice(found.blockIndex + 1, 0, copy);
			return copy;
		},

		insertBlock(rowId, colIndex, type, index) {
			const row = GEB.model.findRow(rowId)?.row;
			if (!row || !row.columns[colIndex]) return null;
			const block = GEB.model.newBlock(type);
			const targetIndex = index == null ? row.columns[colIndex].blocks.length : index;
			row.columns[colIndex].blocks.splice(targetIndex, 0, block);
			return block;
		},

		moveBlock(blockId, targetRowId, targetColIndex, targetIndex) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return false;
			const target = GEB.model.findRow(targetRowId)?.row;
			if (!target || !target.columns[targetColIndex]) return false;
			found.column.blocks.splice(found.blockIndex, 1);
			const insertAt = Math.max(
				0,
				Math.min(target.columns[targetColIndex].blocks.length, targetIndex == null ? 9999 : targetIndex)
			);
			target.columns[targetColIndex].blocks.splice(insertAt, 0, found.block);
			return true;
		},

		moveBlockByOffset(blockId, offset) {
			const found = GEB.model.findBlock(blockId);
			if (!found) return false;
			const list = found.column.blocks;
			const next = found.blockIndex + offset;
			if (next < 0 || next >= list.length) return false;
			const [block] = list.splice(found.blockIndex, 1);
			list.splice(next, 0, block);
			return true;
		},

		firstColumn() {
			const rows = GEB.model.rows();
			for (const row of rows) {
				for (let index = 0; index < row.columns.length; index++) {
					if (row.columns[index].blocks.length === 0) return { row, colIndex: index };
				}
			}
			if (rows.length) {
				const row = rows[rows.length - 1];
				return { row, colIndex: row.columns.length - 1 };
			}
			return null;
		},

		insertIntoBestTarget(type) {
			const selection = GEB.state.selection;
			if (selection && selection.type === "block") {
				const found = GEB.model.findBlock(selection.id);
				if (found) {
					const block = GEB.model.newBlock(type);
					found.column.blocks.splice(found.blockIndex + 1, 0, block);
					return block;
				}
			}
			if (selection && selection.type === "row") {
				const found = GEB.model.findRow(selection.id);
				if (found) {
					const column = found.row.columns[0];
					const block = GEB.model.newBlock(type);
					column.blocks.push(block);
					return block;
				}
			}
			const target = GEB.model.firstColumn();
			if (target) {
				const block = GEB.model.newBlock(type);
				target.row.columns[target.colIndex].blocks.push(block);
				return block;
			}
			return null;
		},

		allBlocks() {
			const blocks = [];
			GEB.model.rows().forEach((row) => {
				row.columns.forEach((column) => {
					column.blocks.forEach((block) => blocks.push(block));
				});
			});
			return blocks;
		},

		blockLabel(type) {
			return (GEB.blocks[type] && GEB.blocks[type].label) || type;
		},

		typeOfBlock(blockId) {
			const found = GEB.model.findBlock(blockId);
			return found ? found.block.type : "";
		},

		conditionSummary(condition) {
			if (!condition || !condition.enabled) return "";
			if (condition.expression) return condition.expression;
			const labels = {
				equals: "equals",
				not_equals: "does not equal",
				contains: "contains",
				not_contains: "does not contain",
				is_set: "is set",
				is_not_set: "is not set",
				greater_than: "is greater than",
				less_than: "is less than",
			};
			const field = condition.field || "(field)";
			if (condition.operator === "is_set" || condition.operator === "is_not_set") {
				return field + " " + (labels[condition.operator] || "");
			}
			return field + " " + (labels[condition.operator] || condition.operator) + " “" + (condition.value || "") + "”";
		},
	};
})();
