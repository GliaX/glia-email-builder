/**
 * Glia Email Builder - modals: links, merge fields, conditional content,
 * image library, row conditions, previews and sample sends.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	function mailBody(html) {
		const wrapper = document.createElement("div");
		wrapper.className = "geb-modal-content";
		wrapper.innerHTML = html;
		return wrapper;
	}

	function quoteJs(value) {
		return String(value == null ? "" : value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
	}

	function mergeFieldGroups() {
		return (GEB.state && GEB.state.mergeFieldGroups) || [];
	}

	function allMergeFields() {
		const fields = [];
		mergeFieldGroups().forEach((group, groupIndex) => {
			(group.fields || []).forEach((field, fieldIndex) => {
				fields.push({ group: group.group, groupIndex, field, fieldIndex });
			});
		});
		return fields;
	}

	function buildMergeExpression(field, fallback) {
		const expression = String(field.expression || "").trim();
		if (!expression) return "";
		if (expression.startsWith("{{") || expression.startsWith("{%")) return expression;
		let body = expression;
		const usesDefault = /\|\s*default\s*\(/.test(body);
		if (fallback && !usesDefault) {
			body += "|default('" + quoteJs(fallback) + "', true)";
		}
		return "{{ " + body + " }}";
	}

	GEB.modals = {
		// -----------------------------------------------------------------
		// Links
		// -----------------------------------------------------------------
		link(callback, options) {
			const opts = options || {};
			const body = mailBody(
				'<div class="geb-form-stack">' +
					'<label class="geb-field"><span class="geb-label">Link URL</span>' +
					'<input class="form-control geb-input" type="text" data-link-url value="' +
					esc(opts.url || "") +
					'" placeholder="https://… or {{ DonateURL }}" /></label>' +
					'<div class="geb-preset-row">' +
					'<button type="button" class="geb-preset-btn" data-link-preset="{{ DonateURL }}" data-link-label="Donate today">Donation page</button>' +
					'<button type="button" class="geb-preset-btn" data-link-preset="{{ WebsiteURL }}" data-link-label="Visit our website">Website</button>' +
					'<button type="button" class="geb-preset-btn" data-link-preset="{{ UnsubscribeURL }}" data-link-label="Unsubscribe">Unsubscribe</button>' +
					"</div>" +
					'<label class="geb-field"><span class="geb-label">Link text <span class="geb-dim">(used when nothing is selected)</span></span>' +
					'<input class="form-control geb-input" type="text" data-link-text value="' +
					esc(opts.text || "") +
					'" placeholder="Donate today" /></label>' +
					'<p class="geb-help">You can use merge fields in the URL, for example <code>{{ DonateURL }}</code>.</p>' +
					"</div>"
			);
			const modal = GEB.ui.modal({
				title: "Insert link",
				body,
				actions: [
					{ label: "Cancel" },
					{
						label: "Apply",
						primary: true,
						onClick: () => {
							const url = body.querySelector("[data-link-url]").value.trim();
							const text = body.querySelector("[data-link-text]").value.trim();
							if (url && /^\s*javascript:/i.test(url)) {
								GEB.ui.error("JavaScript links are not allowed.");
								return false;
							}
							callback({ url, text });
						},
					},
				],
			});
			body.querySelectorAll("[data-link-preset]").forEach((button) => {
				button.addEventListener("click", () => {
					body.querySelector("[data-link-url]").value = button.dataset.linkPreset;
					const text = body.querySelector("[data-link-text]");
					if (!text.value) text.value = button.dataset.linkLabel || "";
				});
			});
			return modal;
		},

		// -----------------------------------------------------------------
		// Merge fields
		// -----------------------------------------------------------------
		mergeFields(callback) {
			const groups = mergeFieldGroups();
			if (!groups.length) {
				GEB.ui.error("No merge fields are configured. Add some in Email Builder Settings.");
				return;
			}
			const body = mailBody(
				'<div class="geb-form-stack">' +
					'<div class="geb-merge-search"><input class="form-control geb-input" type="search" data-merge-search placeholder="Search merge fields" autocomplete="off" /></div>' +
					'<label class="geb-field"><span class="geb-label">If the field is empty, show</span>' +
					'<input class="form-control geb-input" type="text" data-merge-fallback placeholder="e.g. Friend" /></label>' +
					'<div class="geb-merge-list" data-merge-list></div>' +
					"</div>"
			);
			const list = body.querySelector("[data-merge-list]");
			const fallbackInput = body.querySelector("[data-merge-fallback]");
			const searchInput = body.querySelector("[data-merge-search]");

			const renderList = (query) => {
				const term = (query || "").toLowerCase();
				const html = groups
					.map((group, groupIndex) => {
						const fields = (group.fields || []).filter((field) => {
							if (!term) return true;
							return (
								(field.label || "").toLowerCase().includes(term) ||
								(field.expression || "").toLowerCase().includes(term) ||
								(field.aliases || "").toLowerCase().includes(term)
							);
						});
						if (!fields.length) return "";
						return (
							'<details class="geb-merge-group" ' +
							(groupIndex < 2 || term ? "open" : "") +
							"><summary>" +
							esc(group.group || "Merge fields") +
							"</summary><div class=\"geb-merge-items\">" +
							fields
								.map((field) => {
									const index = (group.fields || []).indexOf(field);
									return (
										'<button type="button" class="geb-merge-item" data-merge-group="' +
										groupIndex +
										'" data-merge-index="' +
										index +
										'"><span class="geb-merge-label">' +
										esc(field.label || field.expression) +
										'</span><span class="geb-merge-expression">' +
										esc(field.expression || "") +
										"</span>" +
										(field.sample_value
											? '<span class="geb-merge-sample">' + esc(field.sample_value) + "</span>"
											: "") +
										"</button>"
									);
								})
								.join("") +
							"</div></details>"
						);
					})
					.join("");
				list.innerHTML = html || '<div class="geb-empty-list">No merge fields match that search.</div>';
				list.querySelectorAll(".geb-merge-item").forEach((item) => {
					item.addEventListener("click", () => {
						const group = groups[Number(item.dataset.mergeGroup)];
						const field = group?.fields?.[Number(item.dataset.mergeIndex)];
						if (!field) return;
						const fallback = fallbackInput.value.trim() || field.fallback || "";
						callback(buildMergeExpression(field, fallback));
						modal.close();
					});
				});
			};
			renderList("");
			searchInput.addEventListener("input", () => renderList(searchInput.value));
			const modal = GEB.ui.modal({ title: "Insert merge field", body, size: "medium" });
			return modal;
		},

		// -----------------------------------------------------------------
		// Conditional content
		// -----------------------------------------------------------------
		conditional(callback) {
			const fields = allMergeFields();
			const body = mailBody(
				'<div class="geb-form-stack">' +
					'<div class="geb-field"><span class="geb-label">Condition</span>' +
					'<div class="geb-condition-builder">' +
					'<select class="form-control geb-input" data-cond-field>' +
					'<option value="">Choose a merge field…</option>' +
					fields
						.filter((item) => String(item.field.expression || "").startsWith("doc."))
						.map(
							(item) =>
								'<option value="' +
								esc(item.field.expression) +
								'">' +
								esc(item.group + " · " + (item.field.label || item.field.expression)) +
								"</option>"
						)
						.join("") +
					'<option value="__custom">Custom expression…</option>' +
					"</select>" +
					'<select class="form-control geb-input" data-cond-operator>' +
					'<option value="equals">equals</option><option value="not_equals">does not equal</option>' +
					'<option value="contains">contains</option><option value="not_contains">does not contain</option>' +
					'<option value="greater_than">is greater than</option><option value="less_than">is less than</option>' +
					'<option value="is_set">is set</option><option value="is_not_set">is not set</option>' +
					"</select>" +
					'<input class="form-control geb-input" type="text" data-cond-value placeholder="Value" />' +
					"</div>" +
					'<input class="form-control geb-input" type="text" data-cond-custom placeholder="Custom Jinja expression, e.g. doc.state == \'CA\'" style="display:none;margin-top:6px;" />' +
					"</div>" +
					'<label class="geb-field"><span class="geb-label">Content if true</span>' +
					'<textarea class="form-control geb-input" rows="3" data-cond-true></textarea></label>' +
					'<label class="geb-field"><span class="geb-label">Content if false <span class="geb-dim">(optional)</span></span>' +
					'<textarea class="form-control geb-input" rows="2" data-cond-false></textarea></label>' +
					'<p class="geb-help">Conditional tags are invisible in the message. The editor shows them as text so you can edit them later.</p>' +
					"</div>"
			);
			const fieldSelect = body.querySelector("[data-cond-field]");
			const operator = body.querySelector("[data-cond-operator]");
			const valueInput = body.querySelector("[data-cond-value]");
			const custom = body.querySelector("[data-cond-custom]");
			const update = () => {
				const isCustom = fieldSelect.value === "__custom";
				custom.style.display = isCustom ? "block" : "none";
				const noValue = ["is_set", "is_not_set"].includes(operator.value);
				valueInput.style.display = noValue ? "none" : "block";
			};
			fieldSelect.addEventListener("change", update);
			operator.addEventListener("change", update);
			update();

			const modal = GEB.ui.modal({
				title: "Insert conditional content",
				body,
				size: "medium",
				actions: [
					{ label: "Cancel" },
					{
						label: "Insert",
						primary: true,
						onClick: () => {
							const trueText = body.querySelector("[data-cond-true]").value;
							const falseText = body.querySelector("[data-cond-false]").value;
							if (!trueText.trim()) {
								GEB.ui.error("Add the content to show when the condition is true.");
								return false;
							}
							let expression;
							if (fieldSelect.value === "__custom") {
								expression = custom.value.trim();
							} else if (fieldSelect.value) {
								const field = fieldSelect.value;
								const op = operator.value;
								const value = quoteJs(valueInput.value.trim());
								if (op === "equals") expression = "equals(" + field + ", '" + value + "')";
								else if (op === "not_equals") expression = "not_equals(" + field + ", '" + value + "')";
								else if (op === "contains") expression = "contains(" + field + ", '" + value + "')";
								else if (op === "not_contains") expression = "not_contains(" + field + ", '" + value + "')";
								else if (op === "greater_than") expression = "greater_than(" + field + ", '" + value + "')";
								else if (op === "less_than") expression = "less_than(" + field + ", '" + value + "')";
								else if (op === "is_set") expression = field;
								else if (op === "is_not_set") expression = "not " + field;
								else expression = field;
							} else {
								expression = "doc.first_name";
							}
							let snippet = "{{ if " + expression + " }}" + trueText;
							if (falseText.trim()) snippet += "{{ else }}" + falseText;
							snippet += "{{ end }}";
							callback(snippet);
						},
					},
				],
			});
			return modal;
		},

		// -----------------------------------------------------------------
		// Row display condition
		// -----------------------------------------------------------------
		rowCondition(row, onSave) {
			const condition = row.condition || {};
			const fields = allMergeFields().filter((item) =>
				String(item.field.expression || "").startsWith("doc.")
			);
			const body = mailBody(
				'<div class="geb-form-stack">' +
					'<p class="geb-help">Only show this row to recipients whose data matches the condition. Leave it empty to always show the row.</p>' +
					'<div class="geb-field"><span class="geb-label">Condition</span>' +
					'<div class="geb-condition-builder">' +
					'<select class="form-control geb-input" data-cond-field>' +
					'<option value="">Choose a merge field…</option>' +
					fields
						.map(
							(item) =>
								'<option value="' +
								esc(item.field.expression) +
								'"' +
								(condition.field === item.field.expression ? " selected" : "") +
								">" +
								esc(item.group + " · " + (item.field.label || item.field.expression)) +
								"</option>"
						)
						.join("") +
					(condition.expression
						? '<option value="__custom" selected>Custom expression…</option>'
						: (condition.field &&
							!fields.some((item) => item.field.expression === condition.field)
								? '<option value="' +
									esc(condition.field) +
									'" selected>' +
									esc(condition.field) +
									"</option>"
								: "") + '<option value="__custom">Custom expression…</option>') +
					"</select>" +
					'<select class="form-control geb-input" data-cond-operator>' +
					'<option value="equals">equals</option><option value="not_equals">does not equal</option>' +
					'<option value="contains">contains</option><option value="not_contains">does not contain</option>' +
					'<option value="greater_than">is greater than</option><option value="less_than">is less than</option>' +
					'<option value="is_set">is set</option><option value="is_not_set">is not set</option>' +
					"</select>" +
					'<input class="form-control geb-input" type="text" data-cond-value placeholder="Value" value="' +
					esc(condition.value || "") +
					'" />' +
					"</div>" +
					'<input class="form-control geb-input" type="text" data-cond-custom placeholder="e.g. doc.state == \'CA\'" value="' +
					esc(condition.expression || "") +
					'" style="display:none;margin-top:6px;" />' +
					"</div>" +
					'<div class="geb-field"><span class="geb-label">Preview</span><div class="geb-condition-preview" data-cond-preview></div></div>' +
					"</div>"
			);
			const fieldSelect = body.querySelector("[data-cond-field]");
			const operator = body.querySelector("[data-cond-operator]");
			const valueInput = body.querySelector("[data-cond-value]");
			const custom = body.querySelector("[data-cond-custom]");
			const preview = body.querySelector("[data-cond-preview]");
			if (condition.operator) operator.value = condition.operator;
			if (condition.expression) {
				fieldSelect.value = "__custom";
				custom.value = condition.expression;
			}
			const updateVisibility = () => {
				custom.style.display = fieldSelect.value === "__custom" ? "block" : "none";
				valueInput.style.display = ["is_set", "is_not_set"].includes(operator.value) ? "none" : "block";
			};
			const updatePreview = () => {
				let text;
				if (fieldSelect.value === "__custom") {
					text = custom.value || "(no expression yet)";
				} else if (!fieldSelect.value) {
					text = "No condition — the row is always shown.";
				} else {
					const value = valueInput.value.trim();
					text =
						fieldSelect.value +
						" " +
						operator.options[operator.selectedIndex].text +
						(["is_set", "is_not_set"].includes(operator.value) ? "" : " “" + value + "”");
				}
				preview.textContent = text;
			};
			[fieldSelect, operator, valueInput, custom].forEach((input) => {
				input.addEventListener("input", () => {
					updateVisibility();
					updatePreview();
				});
				input.addEventListener("change", () => {
					updateVisibility();
					updatePreview();
				});
			});
			updateVisibility();
			updatePreview();

			const actions = [{ label: "Cancel" }];
			if (condition.enabled) {
				actions.push({
					label: "Remove condition",
					onClick: () => {
						row.condition = {
							enabled: false,
							field: "",
							operator: "equals",
							value: "",
							expression: "",
						};
						onSave && onSave();
					},
				});
			}
			actions.push({
				label: "Save condition",
				primary: true,
				onClick: () => {
					const expression = fieldSelect.value === "__custom" ? custom.value.trim() : "";
					const field = fieldSelect.value === "__custom" ? "" : fieldSelect.value;
					if (!expression && !field) {
						GEB.ui.error("Choose a field or write a custom expression.");
						return false;
					}
					row.condition = {
						enabled: true,
						field,
						operator: operator.value,
						value: valueInput.value.trim(),
						expression,
					};
					onSave && onSave();
				},
			});
			return GEB.ui.modal({ title: "Row display condition", body, size: "medium", actions });
		},

		// -----------------------------------------------------------------
		// Image library
		// -----------------------------------------------------------------
		openImages(callback) {
			const body = mailBody(
				'<div class="geb-image-manager">' +
					'<div class="geb-image-toolbar">' +
					'<input class="form-control geb-input" type="search" data-image-search placeholder="Search images" />' +
					'<button type="button" class="btn btn-sm btn-default" data-image-upload>Upload</button>' +
					'<input type="file" data-image-file accept="image/png,image/jpeg,image/gif,image/webp" hidden />' +
					"</div>" +
					'<div class="geb-image-note">' +
					GEB.icons.alert +
					"<span>Images must be public so recipients can see them. Uploaded files are stored in the public Files area.</span>" +
					"</div>" +
					'<div class="geb-image-section" data-image-stock></div>' +
					'<div class="geb-image-section" data-image-files></div>' +
					'<div class="geb-image-url-row"><label class="geb-label">Or use an image URL</label>' +
					'<input class="form-control geb-input" type="text" data-image-url placeholder="https://… or /files/…" /></div>' +
					"</div>"
			);
			let selected = null;
			let uploadProgress = null;
			const stockHost = body.querySelector("[data-image-stock]");
			const filesHost = body.querySelector("[data-image-files]");
			const search = body.querySelector("[data-image-search]");
			const urlInput = body.querySelector("[data-image-url]");
			const fileInput = body.querySelector("[data-image-file]");

			const select = (item) => {
				selected = item;
				body.querySelectorAll(".geb-image-card").forEach((card) => card.classList.remove("is-selected"));
				const card = Array.from(body.querySelectorAll(".geb-image-card")).find(
					(node) => node.dataset.imageUrl === item.file_url
				);
				if (card) card.classList.add("is-selected");
				urlInput.value = item.file_url || "";
			};

			const renderCards = (host, items, emptyMessage) => {
				if (!items.length) {
					host.innerHTML =
						'<div class="geb-image-section-title">' +
						(host === stockHost ? "Brand assets" : "Uploaded images") +
						'</div><div class="geb-empty-list">' +
						esc(emptyMessage) +
						"</div>";
					return;
				}
				host.innerHTML =
					'<div class="geb-image-section-title">' +
					(host === stockHost ? "Brand assets" : "Uploaded images") +
					"</div>" +
					'<div class="geb-image-grid">' +
					items
						.map(
							(item) =>
								'<button type="button" class="geb-image-card" data-image-url="' +
								esc(item.file_url) +
								'" data-image-name="' +
								esc(item.file_name || "") +
								'" title="' +
								esc(item.file_name || "") +
								'"><span class="geb-image-thumb"><img loading="lazy" src="' +
								esc(item.file_url) +
								'" alt="' +
								esc(item.file_name || "") +
								'" /></span><span class="geb-image-name">' +
								esc(item.file_name || "") +
								"</span></button>"
						)
						.join("") +
					"</div>";
				host.querySelectorAll(".geb-image-card").forEach((card) => {
					card.addEventListener("click", () => {
						select({ file_url: card.dataset.imageUrl, file_name: card.dataset.imageName });
					});
					card.addEventListener("dblclick", () => {
						select({ file_url: card.dataset.imageUrl, file_name: card.dataset.imageName });
						modal.close();
						callback(selected);
					});
				});
			};

			let stockItems = [];
			let fileItems = [];
			const load = (term) => {
				filesHost.innerHTML = '<div class="geb-loading-inline">Loading images…</div>';
				GEB.api
					.listImages(term)
					.then((data) => {
						stockItems = data.stock || [];
						fileItems = data.files || [];
						renderCards(stockHost, stockItems, "No brand assets found.");
						renderCards(filesHost, fileItems, "No public images yet. Upload one to get started.");
					})
					.catch(() => {
						filesHost.innerHTML = '<div class="geb-empty-list">Could not load images.</div>';
					});
			};
			load("");
			search.addEventListener("input", core.debounce(() => load(search.value), 300));
			urlInput.addEventListener("input", () => {
				const value = urlInput.value.trim();
				selected = value ? { file_url: value, file_name: value.split("/").pop() || "image" } : null;
			});
			body.querySelector("[data-image-upload]").addEventListener("click", () => fileInput.click());
			fileInput.addEventListener("change", () => {
				const file = fileInput.files && fileInput.files[0];
				if (!file) return;
				const button = body.querySelector("[data-image-upload]");
				button.disabled = true;
				button.textContent = "Uploading…";
				GEB.api
					.uploadImage(file, (progress) => {
						button.textContent = "Uploading " + Math.round(progress * 100) + "%";
					})
					.then((result) => {
						GEB.ui.success("Image uploaded.");
						selected = { file_url: result.file_url, file_name: file.name };
						load(search.value);
					})
					.catch((error) => GEB.ui.error(error.message || "Upload failed."))
					.finally(() => {
						button.disabled = false;
						button.textContent = "Upload";
						fileInput.value = "";
					});
			});

			const modal = GEB.ui.modal({
				title: "Choose an image",
				body,
				size: "large",
				actions: [
					{ label: "Cancel" },
					{
						label: "Insert image",
						primary: true,
						onClick: () => {
							if (!selected) {
								GEB.ui.error("Choose an image first.");
								return false;
							}
							callback(selected);
						},
					},
				],
			});
			return modal;
		},

		// -----------------------------------------------------------------
		// Preview
		// -----------------------------------------------------------------
		preview() {
			const body = mailBody(
				'<div class="geb-preview">' +
					'<div class="geb-preview-toolbar">' +
					'<div class="geb-preview-device">' +
					'<button type="button" class="geb-preview-tab is-active" data-preview-device="desktop">Desktop</button>' +
					'<button type="button" class="geb-preview-tab" data-preview-device="mobile">Mobile</button>' +
					"</div>" +
					'<div class="geb-preview-contact"><input class="form-control geb-input" type="search" data-preview-contact placeholder="Preview with a real record…" autocomplete="off" /><div class=\"geb-contact-results\" data-contact-results></div></div>' +
					'<div class="geb-preview-actions">' +
					'<button type="button" class="geb-btn-secondary" data-preview-html>View HTML</button>' +
					'<button type="button" class="btn btn-sm btn-primary" data-preview-send>Send a sample</button>' +
					"</div>" +
					"</div>" +
					'<div class="geb-preview-subject" data-preview-subject></div>' +
					'<div class="geb-preview-warning" data-preview-warning hidden></div>' +
					'<div class="geb-preview-frame-wrap"><iframe class="geb-preview-frame" data-preview-frame sandbox="" title="Email preview"></iframe></div>' +
					'<div class="geb-preview-loading" data-preview-loading><div class="geb-boot-spinner"></div><span>Rendering preview…</span></div>' +
					"</div>"
			);
			const frame = body.querySelector("[data-preview-frame]");
			const loading = body.querySelector("[data-preview-loading]");
			const subjectHost = body.querySelector("[data-preview-subject]");
			const warning = body.querySelector("[data-preview-warning]");
			let source = "";
			let contact = "";
			let device = "desktop";
			let contactTimer = null;

			const applyDevice = () => {
				const wrap = body.querySelector(".geb-preview-frame-wrap");
				wrap.classList.toggle("is-mobile", device === "mobile");
				body.querySelectorAll("[data-preview-device]").forEach((button) => {
					button.classList.toggle("is-active", button.dataset.previewDevice === device);
				});
			};

			const load = () => {
				loading.hidden = false;
				frame.classList.remove("is-ready");
				GEB.api
					.preview({
						template: GEB.state.template?.name,
						design: GEB.state.design,
						subject: GEB.state.subject,
						reference_doctype: GEB.state.referenceDoctype,
						contact: contact || undefined,
						include_source: 1,
					})
					.then((data) => {
						source = data.source || "";
						frame.srcdoc = data.html || "";
						subjectHost.innerHTML =
							'<span class="geb-dim">Subject</span> ' + esc(data.subject || GEB.state.subject || "");
						warning.hidden = !data.warn_clipped;
						warning.innerHTML = data.warn_clipped
							? GEB.icons.alert +
							  "<span>This message is larger than Gmail's ~102 KB clipping limit. Some clients may cut the end off.</span>"
							: "";
						GEB.state.previewSource = source;
						loading.hidden = true;
						frame.classList.add("is-ready");
					})
					.catch(() => {
						loading.hidden = true;
					});
			};

			const results = body.querySelector("[data-contact-results]");
			body.querySelector("[data-preview-contact]").addEventListener("input", (event) => {
				clearTimeout(contactTimer);
				const term = event.target.value.trim();
				if (!term) {
					results.innerHTML = "";
					return;
				}
				contactTimer = setTimeout(() => {
					GEB.api.listContacts(term, GEB.state.referenceDoctype).then((contacts) => {
						results.innerHTML = (contacts || [])
							.map(
								(item) =>
									'<button type="button" class="geb-contact-result" data-contact="' +
									esc(item.name) +
									'">' +
									esc(item.full_name || item.email_id || item.name) +
									'<span class="geb-dim">' +
									esc(item.email_id || "") +
									"</span></button>"
							)
							.join("");
						results.querySelectorAll("[data-contact]").forEach((button) => {
							button.addEventListener("click", () => {
								contact = button.dataset.contact;
								body.querySelector("[data-preview-contact]").value =
									button.textContent.split("\n")[0];
								results.innerHTML = "";
								load();
							});
						});
					});
				}, 250);
			});

			body.querySelectorAll("[data-preview-device]").forEach((button) => {
				button.addEventListener("click", () => {
					device = button.dataset.previewDevice;
					applyDevice();
				});
			});
			body.querySelector("[data-preview-send]").addEventListener("click", () => {
				GEB.modals.sendSample({ contact });
			});
			body.querySelector("[data-preview-html]").addEventListener("click", () => {
				GEB.modals.htmlSource(source);
			});

			const modal = GEB.ui.modal({
				title: "Preview email",
				subtitle: "Merge fields are rendered with sample donor data unless you choose a contact.",
				body,
				size: "xlarge",
				actions: [{ label: "Close" }],
			});
			applyDevice();
			load();
			return modal;
		},

		// -----------------------------------------------------------------
		// Send a sample
		// -----------------------------------------------------------------
		sendSample(options) {
			const opts = options || {};
			const defaultRecipient = /@/.test(GEB.state.user || "") ? GEB.state.user : "";
			const body = mailBody(
				'<div class="geb-form-stack">' +
					'<label class="geb-field"><span class="geb-label">Recipients</span>' +
					'<input class="form-control geb-input" type="text" data-sample-recipients value="' +
					esc(defaultRecipient) +
					'" placeholder="you@example.org, colleague@example.org" /></label>' +
					'<p class="geb-help">Separate multiple addresses with commas. Up to 10 at a time.</p>' +
					'<div class="geb-sample-subject"><span class="geb-dim">Subject</span> ' +
					esc(GEB.state.subject || "(no subject)") +
					"</div>" +
					'<div class="geb-sample-note">' +
					GEB.icons.alert +
					"<span>This sends the current, unsaved message. Merge fields use sample data" +
					(opts.contact ? " and the selected contact." : ".") +
					"</span></div>" +
					"</div>"
			);
			const modal = GEB.ui.modal({
				title: "Send a sample email",
				body,
				actions: [
					{ label: "Cancel" },
					{
						label: "Send sample",
						primary: true,
						onClick: ({ close, backdrop }) => {
							const recipients = body.querySelector("[data-sample-recipients]").value.trim();
							if (!recipients) {
								GEB.ui.error("Enter at least one email address.");
								return false;
							}
							const button = backdrop.querySelector(".btn-primary");
							button.disabled = true;
							button.textContent = "Sending…";
							GEB.api
								.sendSample({
									template: GEB.state.template?.name,
									design: GEB.state.design,
									subject: GEB.state.subject,
									reference_doctype: GEB.state.referenceDoctype,
									recipients,
									contact: opts.contact || undefined,
								})
								.then(() => {
									GEB.ui.success("Sample email queued.");
									close();
								})
								.catch(() => {
									button.disabled = false;
									button.textContent = "Send sample";
								});
							return false;
						},
					},
				],
			});
			return modal;
		},

		// -----------------------------------------------------------------
		// HTML source
		// -----------------------------------------------------------------
		htmlSource(source) {
			const content =
				source ||
				GEB.state.previewSource ||
				"<p>Open the preview first to compile the source.</p>";
			const escaped = esc(content);
			const body = mailBody(
				'<div class="geb-source-wrap"><pre class="geb-source">' + escaped + "</pre></div>"
			);
			const modal = GEB.ui.modal({
				title: "HTML source",
				subtitle: "This is the compiled, email-safe HTML that will be stored on the Email Template.",
				body,
				size: "xlarge",
				actions: [
					{
						label: "Copy",
						onClick: () => {
							core.copy(content).then(() => GEB.ui.success("HTML copied."));
							return false;
						},
					},
					{
						label: "Download .html",
						onClick: () => {
							core.download(
								(GEB.state.template?.name || "email") + ".html",
								content,
								"text/html;charset=utf-8"
							);
							return false;
						},
					},
					{ label: "Close", primary: true },
				],
			});
			return modal;
		},

		// -----------------------------------------------------------------
		// Help
		// -----------------------------------------------------------------
		help() {
			const body = mailBody(
				'<div class="geb-help-panel">' +
					"<h4>Building an email</h4>" +
					"<p>Drag a content block from the <strong>Content</strong> tab onto the canvas, or click it to add it after the selected block. Use the <strong>Rows</strong> tab to add layouts with up to six columns.</p>" +
					"<h4>Editing content</h4>" +
					"<p>Click any text on the canvas to edit it in place. Select text to use the floating toolbar for links, lists, colours and merge fields. Image, button and video settings live in the right-hand panel.</p>" +
					"<h4>Personalisation</h4>" +
					"<p>Merge fields insert <code>{{ doc.field }}</code> expressions. Conditional content uses the EveryAction syntax (<code>{{ if … }}…{{ end }}</code>). Rows can have display conditions in their properties.</p>" +
					"<h4>Keyboard shortcuts</h4>" +
					'<div class="geb-kbd-grid">' +
					"<span><kbd>Ctrl</kbd> + <kbd>S</kbd></span><span>Save</span>" +
					"<span><kbd>Ctrl</kbd> + <kbd>Z</kbd></span><span>Undo</span>" +
					"<span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></span><span>Redo</span>" +
					"<span><kbd>Esc</kbd></span><span>Deselect / close</span>" +
					"</div>" +
					"<h4>Email clients</h4>" +
					"<p>The final HTML is table-based with inline styles and tuned for Outlook, Gmail and Apple Mail. Gmail clips messages larger than about 102 KB, so keep an eye on the message size in Settings.</p>" +
					"</div>"
			);
			return GEB.ui.modal({ title: "Email Builder help", body, size: "medium", actions: [{ label: "Close" }] });
		},
	};
})();
