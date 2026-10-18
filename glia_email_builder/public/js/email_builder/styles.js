/**
 * Glia Email Builder - canvas styling helpers.
 *
 * These mirror the Python renderer closely enough that the editing canvas is a
 * faithful preview. The final email HTML is still generated server-side.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;

	const FONT_STACKS = {
		Arial: "'Helvetica Neue', Helvetica, Arial, sans-serif",
		Helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
		Verdana: "Verdana, Geneva, sans-serif",
		Tahoma: "Tahoma, Verdana, Segoe, sans-serif",
		"Trebuchet MS": "'Trebuchet MS', 'Lucida Grande', sans-serif",
		Georgia: "Georgia, 'Times New Roman', serif",
		"Times New Roman": "'Times New Roman', Times, serif",
		"Courier New": "'Courier New', Courier, monospace",
	};

	const px = (value, fallback) => {
		const number = Number(value);
		return (Number.isFinite(number) ? number : fallback || 0) + "px";
	};

	GEB.style = {
		FONT_STACKS,

		settings() {
			return (GEB.state && GEB.state.design && GEB.state.design.settings) || {};
		},

		app() {
			return (GEB.state && GEB.state.settings) || {};
		},

		resolved() {
			const design = GEB.style.settings();
			const app = GEB.style.app();
			return {
				width: Number(design.width) || 600,
				align: design.align || "center",
				background: design.background_color || "#F3F6F5",
				contentBackground: design.content_background || "#FFFFFF",
				textColor: design.text_color || "#1D2B2F",
				linkColor: design.link_color || app.default_link_color || "#005AB9",
				buttonColor: design.button_color || app.default_button_color || "#00A89E",
				buttonTextColor: design.button_text_color || app.default_button_text_color || "#FFFFFF",
				fontFamily: GEB.style.fontFamily(design.font_family || app.default_font || "Arial"),
				fontSize: Number(design.font_size) || 16,
				borderRadius: Number(design.border_radius) || 0,
			};
		},

		fontFamily(name) {
			return FONT_STACKS[name] || FONT_STACKS.Arial;
		},

		padding(styles) {
			const padding = (styles && styles.padding) || {};
			return (
				px(padding.top, 0) +
				" " +
				px(padding.right, 0) +
				" " +
				px(padding.bottom, 0) +
				" " +
				px(padding.left, 0)
			);
		},

		blockWrapper(block) {
			const styles = block.styles || {};
			const resolved = GEB.style.resolved();
			const parts = ["padding:" + GEB.style.padding(styles)];
			if (block.type !== "button" && styles.background_color) {
				parts.push("background-color:" + styles.background_color);
			}
			parts.push("text-align:" + (styles.align || "left"));
			if (block.type === "paragraph") {
				parts.push("--geb-para:" + (Number(styles.paragraph_spacing) || 0) + "px");
			}
			if (block.type === "text" || block.type === "title" || block.type === "list") {
				parts.push("--geb-para:0px");
			}
			if (block.type === "image" && styles.background_color) {
				parts.push("background-color:" + styles.background_color);
			}
			if (block.type === "button") {
				parts.push("background-color:transparent");
			}
			if (styles.locked) parts.push("--geb-locked:1");
			if (styles.hide_mobile) parts.push("--geb-hide-mobile:1");
			if (styles.hide_desktop) parts.push("--geb-hide-desktop:1");
			return parts.join(";") + ";";
		},

		textStyle(block) {
			const styles = block.styles || {};
			const resolved = GEB.style.resolved();
			const lineHeight = Number(styles.line_height) || 1.6;
			return (
				"font-family:" +
				GEB.style.fontFamily(styles.font_family || "") +
				";font-size:" +
				px(styles.font_size, resolved.fontSize) +
				";line-height:" +
				lineHeight +
				";letter-spacing:" +
				px(styles.letter_spacing, 0) +
				";color:" +
				(styles.color || resolved.textColor) +
				";text-align:" +
				(styles.align || "left") +
				";mso-line-height-rule:exactly;"
			);
		},

		titleStyle(block) {
			const styles = block.styles || {};
			const level = Number((block.content || {}).level) || 2;
			const defaults = { 1: 32, 2: 24, 3: 19 };
			return (
				"margin:" +
				(level < 3 ? "0 0 12px" : "0 0 8px") +
				";font-family:" +
				GEB.style.fontFamily(styles.font_family || "") +
				";font-size:" +
				px(styles.font_size, defaults[level] || 24) +
				";line-height:" +
				(Number(styles.line_height) || 1.25) +
				";letter-spacing:" +
				px(styles.letter_spacing, 0) +
				";color:" +
				(styles.color || "#001F27") +
				";text-align:" +
				(styles.align || "left") +
				";font-weight:700;"
			);
		},

		button(block) {
			const styles = block.styles || {};
			const content = block.content || {};
			const resolved = GEB.style.resolved();
			const background = styles.background_color || resolved.buttonColor;
			const color = styles.text_color || resolved.buttonTextColor;
			const radius = Number(styles.border_radius);
			return {
				background,
				color,
				radius: Number.isFinite(radius) ? radius : 6,
				fontFamily: GEB.style.fontFamily(styles.font_family || ""),
				fontSize: px(styles.font_size, 16),
				fontWeight: styles.bold === false ? 400 : 700,
				align: content.align || "center",
				fullWidth: !!content.full_width,
				padding: "12px 24px",
			};
		},

		row(row) {
			const styles = row.styles || {};
			const parts = [
				"padding:" + GEB.style.padding(styles),
				"background-color:" + (styles.background_color || "transparent"),
				"border-radius:" + (Number(styles.border_radius) || 0) + "px",
			];
			if (styles.background_image) {
				parts.push("background-image:url('" + styles.background_image + "')");
				parts.push("background-size:cover");
				parts.push("background-position:center");
			}
			return parts.join(";") + ";";
		},

		rowTable(row) {
			const styles = row.styles || {};
			const gap = Number(styles.columns_gap) || 0;
			return "width:100%;border-collapse:separate;border-spacing:" + gap + "px 0;table-layout:fixed;";
		},

		column(column) {
			const width = Number(column.width) || 100;
			return "width:" + width + "%;vertical-align:" + ((GEB.state.design.rows || []).length ? "top" : "top") + ";";
		},

		deviceClass() {
			return GEB.state && GEB.state.device === "mobile" ? "is-mobile" : "is-desktop";
		},
	};
})();
