/**
 * Glia Email Builder - block definitions.
 *
 * Each block declares its canvas representation and the property groups shown
 * in the right-hand inspector. Content is edited inline on the canvas, like
 * EveryAction's drag-and-drop editor.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	const FONT_CHOICES = [
		{ value: "", label: "Default font" },
		{ value: "Arial", label: "Arial" },
		{ value: "Helvetica", label: "Helvetica" },
		{ value: "Verdana", label: "Verdana" },
		{ value: "Tahoma", label: "Tahoma" },
		{ value: "Trebuchet MS", label: "Trebuchet MS" },
		{ value: "Georgia", label: "Georgia" },
		{ value: "Times New Roman", label: "Times New Roman" },
		{ value: "Courier New", label: "Courier New" },
	];

	const LINK_PRESETS = [
		{ label: "Donation page", value: "{{ DonateURL }}" },
		{ label: "Website", value: "{{ WebsiteURL }}" },
		{ label: "Unsubscribe", value: "{{ UnsubscribeURL }}" },
	];

	const ALIGN_OPTIONS = [
		{ value: "left", label: "Left", icon: "M4 6h16M4 12h10M4 18h13" },
		{ value: "center", label: "Center", icon: "M4 6h16M7 12h10M5 18h14" },
		{ value: "right", label: "Right", icon: "M4 6h16M10 12h10M7 18h13" },
		{ value: "justify", label: "Justify", icon: "M4 6h16M4 12h16M4 18h16" },
	];

	const F = {
		text: (key, label, options) => Object.assign({ type: "text", key, label }, options || {}),
		number: (key, label, options) =>
			Object.assign({ type: "number", key, label, min: 0, max: 999, step: 1 }, options || {}),
		select: (key, label, choices, options) =>
			Object.assign({ type: "select", key, label, options: choices }, options || {}),
		color: (key, label, options) => Object.assign({ type: "color", key, label }, options || {}),
		align: (key, label) => ({ type: "align", key, label, options: ALIGN_OPTIONS }),
		toggle: (key, label, options) => Object.assign({ type: "toggle", key, label }, options || {}),
		spacing: (key, label) => ({ type: "spacing", key, label }),
		range: (key, label, options) =>
			Object.assign({ type: "range", key, label, min: 0, max: 100, step: 1, suffix: "%" }, options || {}),
		image: (key, label, options) => Object.assign({ type: "image", key, label }, options || {}),
		url: (key, label, options) =>
			Object.assign({ type: "url", key, label, presets: LINK_PRESETS }, options || {}),
		code: (key, label, options) => Object.assign({ type: "code", key, label, rows: 8 }, options || {}),
		segmented: (key, label, options) => Object.assign({ type: "segmented", key, label }, options || {}),
	};

	function typography(block) {
		const fields = [
			{
				type: "row",
				fields: [
					F.select("styles.font_family", "Font", FONT_CHOICES),
					F.number("styles.font_size", "Size", { min: 8, max: 96, suffix: "px", step: 1 }),
				],
			},
			{
				type: "row",
				fields: [
					F.color("styles.color", "Text color", { allowEmpty: true }),
					F.align("styles.align", "Alignment"),
				],
			},
			{
				type: "row",
				fields: [
					F.number("styles.line_height", "Line height", { min: 0.8, max: 4, step: 0.05 }),
					F.number("styles.letter_spacing", "Letter spacing", {
						min: -2,
						max: 12,
						step: 0.5,
						suffix: "px",
					}),
				],
			},
		];
		return fields;
	}

	function commonOptions(options) {
		const opts = options || {};
		const fields = [F.spacing("styles.padding", "Padding")];
		if (!opts.omitBackground) {
			fields.push(F.color("styles.background_color", "Background", { allowEmpty: true }));
		}
		fields.push(
			{
				type: "row",
				fields: [
					F.toggle("styles.hide_mobile", "Hide on mobile"),
					F.toggle("styles.hide_desktop", "Hide on desktop"),
				],
			},
			F.toggle("styles.locked", "Lock this block")
		);
		return fields;
	}

	function props(contentFields, options) {
		return [
			{ label: "Content Properties", fields: contentFields.filter(Boolean) },
			{ label: "Block Options", fields: commonOptions(options) },
		];
	}

	// ---------------------------------------------------------------------
	// Preview-safe HTML (keeps the desk page safe while editing raw HTML)
	// ---------------------------------------------------------------------
	const REMOVE_TAGS = new Set([
		"SCRIPT",
		"STYLE",
		"IFRAME",
		"OBJECT",
		"EMBED",
		"FORM",
		"INPUT",
		"BUTTON",
		"TEXTAREA",
		"SELECT",
		"OPTION",
		"LINK",
		"META",
		"BASE",
		"TITLE",
	]);
	const UNWRAP_TAGS = new Set(["HTML", "HEAD", "BODY"]);

	GEB.blocks = {
		safeHtml(html) {
			if (!html) return "";
			const template = document.createElement("template");
			template.innerHTML = html;
			const walk = (node) => {
				for (const child of Array.from(node.childNodes)) {
					if (child.nodeType === Node.ELEMENT_NODE) {
						const tag = child.tagName;
						if (REMOVE_TAGS.has(tag)) {
							child.remove();
							continue;
						}
						if (UNWRAP_TAGS.has(tag)) {
							const frag = document.createDocumentFragment();
							while (child.firstChild) frag.appendChild(child.firstChild);
							child.replaceWith(frag);
							continue;
						}
						for (const attr of Array.from(child.attributes)) {
							const name = attr.name.toLowerCase();
							if (name.startsWith("on")) child.removeAttribute(attr.name);
							if (
								(name === "href" || name === "src") &&
								/^\s*(?:javascript|vbscript|data:text\/html)/i.test(attr.value)
							) {
								child.removeAttribute(attr.name);
							}
							if (name === "style" && /expression\s*\(|javascript\s*:/i.test(attr.value)) {
								child.removeAttribute("style");
							}
						}
						walk(child);
					}
				}
			};
			walk(template.content);
			return template.innerHTML;
		},

		displayText(value) {
			return String(value == null ? "" : value);
		},

		resolveToken(value) {
			const app = GEB.state.settings || {};
			const replacements = {
				DonateURL: app.donation_url,
				WebsiteURL: app.website_url,
				OrganizationName: app.organization_name,
				OrganizationAddress: app.organization_address,
				Disclaimer: app.disclaimer,
				FacebookURL: app.social_facebook,
				InstagramURL: app.social_instagram,
				TwitterURL: app.social_twitter,
				LinkedInURL: app.social_linkedin,
				YouTubeURL: app.social_youtube,
				UnsubscribeURL: "#unsubscribe",
				UnsubscribeLink: "Unsubscribe",
			};
			return String(value || "").replace(/\{\{\s*([A-Za-z][A-Za-z0-9_ ]*?)\s*\}\}/g, (match, name) => {
				const key = name.replace(/\s+/g, "");
				return replacements[key] != null && replacements[key] !== "" ? replacements[key] : match;
			});
		},

		asset(path) {
			const base = (GEB.state.settings && GEB.state.settings.asset_base) || "/assets/glia_email_builder";
			return base + "/images/social/" + path;
		},

		networkUrl(network) {
			const app = GEB.state.settings || {};
			return network.url || app["social_" + network.key] || "";
		},

		// -----------------------------------------------------------------
		// Defaults
		// -----------------------------------------------------------------

		defaults(type) {
			return GEB.model.newBlock(type);
		},

		// -----------------------------------------------------------------
		// Block definitions
		// -----------------------------------------------------------------

		title: {
			label: "Title",
			short: "Title",
			icon: "title",
			rich: "text",
			canvas(block) {
				const content = block.content || {};
				const level = Math.min(3, Math.max(1, Number(content.level) || 2));
				return (
					'<h' +
					level +
					' class="geb-rich geb-title" data-edit="text" contenteditable="true" spellcheck="true" ' +
					'style="' +
					GEB.style.titleStyle(block) +
					'">' +
					esc(content.text || "") +
					"</h" +
					level +
					">"
				);
			},
			props: props([
				F.segmented("content.level", "Heading", {
					options: [
						{ value: 1, label: "H1" },
						{ value: 2, label: "H2" },
						{ value: 3, label: "H3" },
					],
				}),
				...typography(),
			]),
			summary(block) {
				return core.stripHtml((block.content || {}).text || "").slice(0, 80);
			},
		},

		paragraph: {
			label: "Paragraph",
			short: "Paragraph",
			icon: "paragraph",
			rich: "html",
			canvas(block) {
				const html = GEB.blocks.safeHtml((block.content || {}).html || "");
				return (
					'<div class="geb-rich geb-paragraph-rich" data-edit="html" contenteditable="true" ' +
					'spellcheck="true" style="' +
					GEB.style.textStyle(block) +
					'" data-placeholder="Write a paragraph…">' +
					(html || "") +
					"</div>"
				);
			},
			props: props([
				...typography(),
				F.number("styles.paragraph_spacing", "Paragraph spacing", {
					min: 0,
					max: 80,
					suffix: "px",
				}),
				F.segmented("styles.direction", "Text direction", {
					options: [
						{ value: "ltr", label: "LTR" },
						{ value: "rtl", label: "RTL" },
					],
				}),
			]),
			summary(block) {
				return core.stripHtml((block.content || {}).html || "").slice(0, 80);
			},
		},

		text: {
			label: "Text",
			short: "Text",
			icon: "text",
			rich: "html",
			canvas(block) {
				const html = GEB.blocks.safeHtml((block.content || {}).html || "");
				return (
					'<div class="geb-rich geb-text-rich" data-edit="html" contenteditable="true" ' +
					'spellcheck="true" style="' +
					GEB.style.textStyle(block) +
					'" data-placeholder="Add text…">' +
					(html || "") +
					"</div>"
				);
			},
			props: props([...typography()]),
			summary(block) {
				return core.stripHtml((block.content || {}).html || "").slice(0, 80);
			},
		},

		list: {
			label: "List",
			short: "List",
			icon: "list",
			rich: "html",
			canvas(block) {
				const content = block.content || {};
				const html = GEB.blocks.safeHtml(content.html || "");
				const listStyle = content.list_style || "disc";
				const style =
					GEB.style.textStyle(block) +
					"--geb-list-style:" +
					listStyle +
					";" +
					(content.list_start > 1 ? "--geb-list-start:" + content.list_start + ";" : "");
				return (
					'<div class="geb-rich geb-list-rich geb-list-' +
					esc(listStyle) +
					'" data-edit="html" contenteditable="true" spellcheck="true" style="' +
					style +
					'" data-placeholder="Add list items…">' +
					(html || "") +
					"</div>"
				);
			},
			props: props([
				...typography(),
				F.select(
					"content.list_style",
					"List style",
					[
						{ value: "disc", label: "Bulleted" },
						{ value: "decimal", label: "Numbered" },
						{ value: "lower-alpha", label: "Letters (a, b)" },
						{ value: "upper-alpha", label: "Letters (A, B)" },
						{ value: "lower-roman", label: "Roman (i, ii)" },
						{ value: "upper-roman", label: "Roman (I, II)" },
						{ value: "square", label: "Square" },
						{ value: "none", label: "No marker" },
					]
				),
				F.number("content.list_start", "Start from", { min: 1, max: 999 }),
			]),
			summary(block) {
				return core.stripHtml((block.content || {}).html || "").slice(0, 80);
			},
		},

		image: {
			label: "Image",
			short: "Image",
			icon: "image",
			canvas(block) {
				const content = block.content || {};
				const width = Number(content.width) || 100;
				const align = content.align || "center";
				const radius = Number(content.border_radius) || 0;
				const src = content.src ? GEB.blocks.resolveToken(content.src) : "";
				const link = content.link ? GEB.blocks.resolveToken(content.link) : "";
				const frameStyle =
					"width:" +
					width +
					"%;" +
					(align === "center" ? "margin-left:auto;margin-right:auto;" : "") +
					(align === "right" ? "margin-left:auto;" : "");
				if (!src) {
					return (
						'<div class="geb-image-placeholder" style="' +
						frameStyle +
						'">' +
						'<div class="geb-image-placeholder-icon">' +
						GEB.icons.image +
						"</div>" +
						"<div>Drop an image here</div>" +
						'<button type="button" class="geb-mini-btn" data-action="browse-image">Browse images</button>' +
						"</div>"
					);
				}
				const img =
					'<img src="' +
					esc(src) +
					'" alt="' +
					esc(content.alt || "") +
					'" draggable="false" style="display:block;width:100%;height:auto;border:0;' +
					(radius ? "border-radius:" + radius + "px;" : "") +
					'" />';
				return (
					'<div class="geb-image-frame" style="' +
					frameStyle +
					'">' +
					img +
					(link ? '<div class="geb-image-link-badge">' + GEB.icons.link + " Linked</div>" : "") +
					"</div>"
				);
			},
			props: props([
				F.image("content.src", "Image"),
				F.text("content.alt", "Alt text", { placeholder: "Describe the image" }),
				F.url("content.link", "Link"),
				F.range("content.width", "Width", { min: 5, max: 100 }),
				F.align("content.align", "Alignment"),
				F.number("content.border_radius", "Corner radius", { min: 0, max: 80, suffix: "px" }),
			]),
			summary(block) {
				return (block.content || {}).alt || "Image";
			},
		},

		button: {
			label: "Button",
			short: "Button",
			icon: "button",
			rich: "text",
			canvas(block) {
				const content = block.content || {};
				const style = GEB.style.button(block);
				const styleCss =
					"display:inline-block;padding:" +
					style.padding +
					";font-family:" +
					style.fontFamily +
					";font-size:" +
					style.fontSize +
					";font-weight:" +
					style.fontWeight +
					";line-height:1.3;color:" +
					style.color +
					";background-color:" +
					style.background +
					";border-radius:" +
					style.radius +
					"px;text-align:center;text-decoration:none;" +
					(style.fullWidth ? "display:block;width:100%;" : "");
				return (
					'<div class="geb-button-wrap" style="text-align:' +
					esc(style.align) +
					';">' +
					'<span class="geb-button" contenteditable="true" data-edit="text" spellcheck="false" style="' +
					styleCss +
					'">' +
					esc(content.text || "Button") +
					"</span>" +
					"</div>"
				);
			},
			props: props(
				[
					F.url("content.link", "Button link", { presets: LINK_PRESETS }),
					F.align("content.align", "Alignment"),
					F.toggle("content.full_width", "Full width"),
					F.color("styles.background_color", "Button color", {
						fallback: () => GEB.style.resolved().buttonColor,
					}),
					F.color("styles.text_color", "Text color", {
						fallback: () => GEB.style.resolved().buttonTextColor,
					}),
					F.number("styles.border_radius", "Corner radius", { min: 0, max: 40, suffix: "px" }),
					F.number("styles.font_size", "Font size", { min: 8, max: 32, suffix: "px" }),
					F.toggle("styles.bold", "Bold text"),
				],
				{ omitBackground: true }
			),
			summary(block) {
				return (block.content || {}).text || "Button";
			},
		},

		divider: {
			label: "Divider",
			short: "Divider",
			icon: "divider",
			canvas(block) {
				const content = block.content || {};
				const width = Number(content.width) || 100;
				const thickness = Number(content.thickness) || 1;
				const align = content.align || "center";
				const margin = align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto";
				return (
					'<div class="geb-divider-line" style="width:' +
					width +
					"%;margin:" +
					margin +
					";border-top:" +
					thickness +
					"px solid " +
					esc(content.color || "#DDE5E3") +
					';"></div>'
				);
			},
			props: props([
				F.color("content.color", "Line color"),
				F.number("content.thickness", "Thickness", { min: 1, max: 12, suffix: "px" }),
				F.range("content.width", "Width", { min: 1, max: 100 }),
				F.align("content.align", "Alignment"),
			]),
			summary() {
				return "Divider";
			},
		},

		spacer: {
			label: "Spacer",
			short: "Spacer",
			icon: "spacer",
			canvas(block) {
				const height = Number((block.content || {}).height) || 24;
				return (
					'<div class="geb-spacer" style="height:' +
					height +
					'px;"><span class="geb-spacer-label">' +
					height +
					" px</span></div>"
				);
			},
			props: props([F.number("content.height", "Height", { min: 1, max: 300, suffix: "px" })]),
			summary(block) {
				return ((block.content || {}).height || 24) + " px";
			},
		},

		social: {
			label: "Social",
			short: "Social",
			icon: "social",
			canvas(block) {
				const content = block.content || {};
				const networks = content.networks || [];
				const size = Number(content.icon_size) || 24;
				const spacing = Number(content.spacing) || 12;
				const justify =
					content.align === "left" ? "flex-start" : content.align === "right" ? "flex-end" : "center";
				const icons = networks
					.map((network) => {
						const meta = GEB.blocks.socialNetworks.find((item) => item.key === network.key);
						if (!meta) return "";
						return (
							'<a href="' +
							esc(GEB.blocks.networkUrl(network) || "#") +
							'" class="geb-social-icon" target="_blank" rel="noopener" title="' +
							esc(meta.label) +
							'" style="width:' +
							size +
							"px;height:" +
							size +
							'px;margin:0 ' +
							spacing / 2 +
							'px;" data-action="social-link" data-network="' +
							esc(network.key) +
							'"><img src="' +
							esc(GEB.blocks.asset(meta.icon)) +
							'" alt="' +
							esc(meta.label) +
							'" style="width:100%;height:100%;display:block;" draggable="false" /></a>'
						);
					})
					.join("");
				return (
					'<div class="geb-social-row" style="justify-content:' +
					justify +
					';"><div class="geb-social-inner" style="display:flex;align-items:center;">' +
					(icons || '<span class="geb-muted">Choose social networks in the properties panel.</span>') +
					"</div></div>"
				);
			},
			props: props([
				{ type: "networks", key: "content.networks", label: "Networks" },
				F.number("content.icon_size", "Icon size", { min: 12, max: 48, suffix: "px" }),
				F.number("content.spacing", "Icon spacing", { min: 0, max: 60, suffix: "px" }),
				F.align("content.align", "Alignment"),
			]),
			summary() {
				return "Social icons";
			},
		},

		html: {
			label: "HTML",
			short: "HTML",
			icon: "html",
			canvas(block) {
				const html = GEB.blocks.safeHtml((block.content || {}).html || "");
				if (!html.trim()) {
					return '<div class="geb-html-empty">Add HTML in the properties panel.</div>';
				}
				return '<div class="geb-html-block"><span class="geb-html-badge">HTML</span>' + html + "</div>";
			},
			props: props([
				F.code("content.html", "HTML source", { rows: 12 }),
				{
					type: "help",
					text: "Inline styles only. External stylesheets and scripts are removed for safety.",
				},
			]),
			summary(block) {
				return core.stripHtml((block.content || {}).html || "").slice(0, 80);
			},
		},

		video: {
			label: "Video",
			short: "Video",
			icon: "video",
			canvas(block) {
				const content = block.content || {};
				const url = content.url ? GEB.blocks.resolveToken(content.url) : "";
				const width = Number(content.width) || 100;
				const align = content.align || "center";
				const margin = align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto";
				const thumb =
					content.thumbnail ||
					(() => {
						const match = String(url).match(
							/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
						);
						return match ? "https://img.youtube.com/vi/" + match[1] + "/hqdefault.jpg" : "";
					})();
				if (!url) {
					return (
						'<div class="geb-video-placeholder" style="width:' +
						width +
						"%;margin:" +
						margin +
						';"><div class="geb-video-play">' +
						GEB.icons.video +
						"</div><div>Add a video URL</div></div>"
					);
				}
				return (
					'<div class="geb-video" style="width:' +
					width +
					"%;margin:" +
					margin +
					";" +
					(thumb ? "background-image:url('" + esc(thumb) + "');" : "") +
					'"><div class="geb-video-overlay"><div class="geb-video-play">▶</div><div class="geb-video-url">' +
					esc(GEB.blocks.resolveToken(url)) +
					"</div></div></div>"
				);
			},
			props: props([
				F.url("content.url", "Video URL", {
					presets: [
						{ label: "YouTube", value: "https://www.youtube.com/watch?v=" },
						{ label: "Vimeo", value: "https://vimeo.com/" },
					],
				}),
				F.image("content.thumbnail", "Thumbnail (optional)"),
				F.range("content.width", "Width", { min: 20, max: 100 }),
				F.align("content.align", "Alignment"),
			]),
			summary(block) {
				return (block.content || {}).url || "Video";
			},
		},
	};

	GEB.blocks.socialNetworks = [
		{ key: "facebook", label: "Facebook", icon: "facebook.png" },
		{ key: "instagram", label: "Instagram", icon: "instagram.png" },
		{ key: "twitter", label: "X / Twitter", icon: "x.png" },
		{ key: "linkedin", label: "LinkedIn", icon: "linkedin.png" },
		{ key: "youtube", label: "YouTube", icon: "youtube.png" },
	];

	GEB.blocks.ORDER = [
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

	GEB.blocks.ROW_PRESETS = [
		{ widths: [100], label: "One column", icon: "row1" },
		{ widths: [50, 50], label: "Two equal columns", icon: "row2" },
		{ widths: [33.33, 66.67], label: "One third / two thirds", icon: "row2lr" },
		{ widths: [66.67, 33.33], label: "Two thirds / one third", icon: "row2rl" },
		{ widths: [33.33, 33.34, 33.33], label: "Three columns", icon: "row3" },
		{ widths: [25, 25, 25, 25], label: "Four columns", icon: "row4" },
		{ widths: [20, 20, 20, 20, 20], label: "Five columns", icon: "row5" },
		{ widths: [16.67, 16.67, 16.67, 16.67, 16.67, 16.65], label: "Six columns", icon: "row6" },
	];
})();
