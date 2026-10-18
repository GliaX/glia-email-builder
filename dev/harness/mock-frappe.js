/**
 * Minimal Frappe shim for the standalone Email Builder dev harness.
 * Not shipped with the app.
 */
(function () {
	"use strict";

	const data = window.__GEB_HARNESS__ || {};
	const clone = (value) => JSON.parse(JSON.stringify(value));

	function templateContext(name) {
		const base = clone(data.startContext);
		if (!name) return base;
		const item = (data.library || []).find((row) => row.title === name || row.name === name);
		base.template = {
			name,
			subject: item ? item.subject : data.blankSubject || "Your email subject",
			reference_doctype: "Contact",
			modified: "2026-10-01 10:00:00",
			use_html: 1,
		};
		base.has_design = true;
		base.design = clone(
			(data.designs && data.designs[name]) || data.blankDesign || base.design
		);
		base.design_meta = {
			name,
			category: item ? item.category : "Custom",
			description: item ? item.description : "",
			seeded: item ? item.seeded : 0,
			compiled_on: item ? item.compiled_on : "",
			email_size: item ? item.email_size : 0,
		};
		return base;
	}

	window.frappe = {
		csrf_token: "harness",
		boot: { developer_mode: true, csrf_token: "harness" },
		session: { user: "you@glia.org" },

		call(options) {
			const opts = typeof options === "string" ? { method: options } : options || {};
			const method = String(opts.method || "").split(".").pop();
			const args = opts.args || {};
			let result = null;

			if (method === "get_context") {
				result = args.template ? templateContext(args.template) : clone(data.startContext);
			} else if (method === "get_library") {
				result = clone(data.library);
			} else if (method === "get_reference_context") {
				result = {
					reference_doctype: args.reference_doctype || "Contact",
					merge_field_groups: clone(data.context.merge_field_groups),
					sample_doc: clone(data.context.sample_doc),
				};
			} else if (method === "get_template_status") {
				result = { has_design: true, can_write: true, category: "Newsletter", email_size: 24000 };
			} else if (method === "save_design") {
				if (window.__GEB_FORCE_CONFLICT__) {
					window.__GEB_FORCE_CONFLICT__ = false;
					result = { ok: false, conflict: true, modified: "2026-10-02 10:00:00" };
				} else {
					const htmlSize = JSON.stringify(args.design || {}).length * 2;
					result = {
						ok: true,
						conflict: false,
						modified: new Date().toISOString(),
						size: htmlSize,
						warn_clipped: htmlSize > 102000,
						block_count: 20,
						subject: args.subject || "",
						compiled_on: new Date().toISOString(),
					};
					if (data.context.template) data.context.template.modified = result.modified;
				}
			} else if (method === "preview") {
				const name = args.template;
				const item = name && data.library.find((row) => row.title === name || row.name === name);
				const html = name
					? ((data.previews && data.previews[name]) ||
						(data.library[0] && data.library[0].preview_html) ||
						"")
					: data.blankPreview || "";
				result = {
					html,
					source: html,
					subject: args.subject || (item && item.subject_preview) || data.blankSubject || "Preview",
					size: html.length,
					warn_clipped: false,
					block_count: 20,
				};
			} else if (method === "send_sample") {
				result = { ok: true, recipients: String(args.recipients || "").split(",") };
			} else if (method === "list_images") {
				result = clone(data.images);
			} else if (method === "list_contacts") {
				result = clone(data.contacts);
			} else if (method === "create_template") {
				result = { name: args.title, modified: new Date().toISOString(), has_design: true };
				const sourceDesign = args.seed
					? data.designs && data.designs[args.seed]
					: data.blankDesign;
				if (sourceDesign) data.designs[args.title] = clone(sourceDesign);
				const sourceTemplate = args.seed
					? data.library.find((row) => row.title === args.seed)
					: {
							subject: data.blankSubject || "Your email subject",
							subject_preview: data.blankSubject || "Your email subject",
							preview_html: data.blankPreview || "",
						};
				data.library.unshift({
					name: args.title,
					title: args.title,
					description: args.description || "",
					category: args.category || "Custom",
					subject: sourceTemplate ? sourceTemplate.subject : "Your email subject",
					subject_preview: sourceTemplate ? sourceTemplate.subject_preview : "",
					preview_html: sourceTemplate ? sourceTemplate.preview_html : "",
					seeded: 0,
					modified: "2026-10-02 10:00:00",
					email_size: 20000,
				});
			} else if (method === "recompile_all") {
				result = { ok: true, count: data.library.length, errors: [] };
			} else {
				result = { ok: true };
			}

			return Promise.resolve({ message: result });
		},

		set_route(...args) {
			if (window.console) console.info("[harness] frappe.set_route", args);
			if (window.GEB && GEB.ui) GEB.ui.toast("Harness: would navigate to " + args.join(" / "), "info");
		},

		show_alert(options) {
			if (window.GEB && GEB.ui) GEB.ui.toast(options.message || options, options.indicator || "info");
		},

		msgprint(message) {
			const text = typeof message === "string" ? message : message.message || "";
			if (window.GEB && GEB.ui) GEB.ui.toast(String(text).replace(/<[^>]+>/g, " "), "info");
			else console.info("[harness] msgprint", text);
		},

		utils: {
			escape_html(value) {
				return String(value == null ? "" : value)
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;");
			},
			get_query_params() {
				return {};
			},
		},

		db: {
			get_value() {
				return Promise.resolve(null);
			},
		},
	};
})();
