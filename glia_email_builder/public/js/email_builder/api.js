/**
 * Glia Email Builder - server API wrappers.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;

	const METHOD_PREFIX = "glia_email_builder.api.";

	GEB.api = {
		errorMessage(error) {
			if (!error) return "Something went wrong.";
			let serverMessages = error._server_messages;
			if (typeof serverMessages === "string") {
				try {
					serverMessages = JSON.parse(serverMessages);
				} catch (parseError) {
					serverMessages = null;
				}
			}
			if (Array.isArray(serverMessages) && serverMessages.length) {
				const first = serverMessages[0];
				let text = first;
				try {
					const parsed = JSON.parse(first);
					text = parsed.message || parsed;
				} catch (parseError) {
					/* plain string */
				}
				text = GEB.core.stripHtml(text).trim();
				if (text) return text;
			}
			if (error.message && error.message !== "There was an error.") {
				return GEB.core.stripHtml(error.message).trim();
			}
			if (error.exc_type) return error.exc_type.replace(/_/g, " ");
			return "Something went wrong. Please try again.";
		},

		call(method, args, options) {
			const opts = options || {};
			return frappe
				.call({
					method: METHOD_PREFIX + method,
					args: args || {},
					type: "POST",
					freeze: !!opts.freeze,
				})
				.then((response) => response.message)
				.catch((error) => {
					const message = GEB.api.errorMessage(error);
					if (!opts.silent) GEB.ui.error(message);
					const wrapped = new Error(message);
					wrapped.original = error;
					throw wrapped;
				});
		},

		getContext(template) {
			return GEB.api.call("get_context", template ? { template } : {});
		},

		getLibrary(search) {
			return GEB.api.call("get_library", search ? { search } : {});
		},

		getReferenceContext(referenceDoctype) {
			return GEB.api.call("get_reference_context", { reference_doctype: referenceDoctype || "" });
		},

		getTemplateStatus(template) {
			return GEB.api.call("get_template_status", { template });
		},

		save(payload, options) {
			return GEB.api.call("save_design", payload, Object.assign({ freeze: false }, options || {}));
		},

		create(payload, options) {
			return GEB.api.call("create_template", payload, Object.assign({ freeze: true }, options || {}));
		},

		preview(payload) {
			return GEB.api.call("preview", payload, { freeze: false });
		},

		sendSample(payload) {
			return GEB.api.call("send_sample", payload, { freeze: true });
		},

		listImages(search) {
			return GEB.api.call("list_images", search ? { search } : {});
		},

		listContacts(search, referenceDoctype) {
			const args = {};
			if (search) args.search = search;
			if (referenceDoctype) args.reference_doctype = referenceDoctype;
			return GEB.api.call("list_contacts", args);
		},

		recompileAll() {
			return GEB.api.call("recompile_all", {}, { freeze: true });
		},

		uploadImage(file, onProgress) {
			return new Promise((resolve, reject) => {
				const form = new FormData();
				form.append("file", file, file.name);
				form.append("is_private", "0");
				form.append("folder", "Home");
				const xhr = new XMLHttpRequest();
				xhr.open("POST", "/api/method/upload_file");
				xhr.setRequestHeader("X-Frappe-CSRF-Token", frappe.csrf_token || frappe.boot?.csrf_token || "");
				xhr.setRequestHeader("Accept", "application/json");
				if (onProgress && xhr.upload) {
					xhr.upload.addEventListener("progress", (event) => {
						if (event.lengthComputable) onProgress(event.loaded / event.total);
					});
				}
				xhr.onload = () => {
					let payload = null;
					try {
						payload = JSON.parse(xhr.responseText);
					} catch (error) {
						/* ignore */
					}
					if (xhr.status >= 200 && xhr.status < 300 && payload?.message?.file_url) {
						resolve(payload.message);
					} else {
						const message =
							payload?._server_messages || payload?.message || "Could not upload the image.";
						reject(new Error(GEB.api.errorMessage({ _server_messages: message })));
					}
				};
				xhr.onerror = () => reject(new Error("Could not upload the image."));
				xhr.send(form);
			});
		},
	};
})();
