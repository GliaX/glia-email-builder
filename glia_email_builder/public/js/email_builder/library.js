/**
 * Glia Email Builder - start screen and template library.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	function todayLabel() {
		try {
			return new Date().toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
		} catch (error) {
			return "";
		}
	}

	GEB.library = {
		items: null,
		loading: false,
		selected: null,
		category: "All",
		search: "",

		load(force) {
			if (this.loading) return Promise.resolve(this.items || []);
			if (this.items && !force) return Promise.resolve(this.items);
			this.loading = true;
			return GEB.api
				.getLibrary()
				.then((items) => {
					this.items = items || [];
					return this.items;
				})
				.catch(() => {
					this.items = [];
					return [];
				})
				.finally(() => {
					this.loading = false;
				});
		},

		categories() {
			const set = new Set(["All"]);
			(this.items || []).forEach((item) => set.add(item.category || "Custom"));
			return Array.from(set);
		},

		filtered() {
			const term = (this.search || "").toLowerCase();
			return (this.items || []).filter((item) => {
				if (this.category !== "All" && (item.category || "Custom") !== this.category) return false;
				if (!term) return true;
				return (
					(item.title || "").toLowerCase().includes(term) ||
					(item.description || "").toLowerCase().includes(term) ||
					(item.category || "").toLowerCase().includes(term) ||
					(item.subject || "").toLowerCase().includes(term)
				);
			});
		},

		// -----------------------------------------------------------------
		// Shared card rendering
		// -----------------------------------------------------------------

		card(item, options) {
			const opts = options || {};
			const card = document.createElement("div");
			card.className = "geb-library-card";
			card.dataset.template = item.title;
			card.dataset.category = item.category || "Custom";
			card.tabIndex = 0;
			card.setAttribute("role", "button");
			card.innerHTML =
				'<div class="geb-library-thumb"><div class="geb-thumb-iframe-wrap"></div>' +
				'<span class="geb-library-selected">' +
				GEB.icons.check +
				"</span>" +
				'<span class="geb-library-badge">' +
				esc(item.category || "Custom") +
				"</span>" +
				(item.seeded ? '<span class="geb-library-starter">Starter</span>' : "") +
				"</div>" +
				'<div class="geb-library-card-body">' +
				'<div class="geb-library-card-title">' +
				esc(item.title || "") +
				"</div>" +
				'<div class="geb-library-card-description">' +
				esc(item.description || item.subject || "") +
				"</div>" +
				'<div class="geb-library-card-meta"><span>' +
				esc(item.subject_preview || item.subject || "No subject") +
				"</span></div>" +
				(opts.showUse
					? '<button type="button" class="geb-library-use">Use this template</button>'
					: "") +
				"</div>";

			const wrap = card.querySelector(".geb-thumb-iframe-wrap");
			if (item.preview_html) {
				const iframe = document.createElement("iframe");
				iframe.setAttribute("sandbox", "");
				iframe.setAttribute("title", item.title + " preview");
				iframe.srcdoc = item.preview_html;
				iframe.className = "geb-thumb-iframe";
				wrap.appendChild(iframe);
			} else {
				wrap.innerHTML =
					'<div class="geb-thumb-placeholder">' + GEB.icons.mail + "<span>No preview yet</span></div>";
			}

			card.addEventListener("click", (event) => {
				if (event.target.closest(".geb-library-use")) return;
				opts.onSelect && opts.onSelect(item, card);
			});
			card.addEventListener("dblclick", () => {
				opts.onActivate && opts.onActivate(item);
			});
			card.addEventListener("keydown", (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					opts.onActivate ? opts.onActivate(item) : opts.onSelect && opts.onSelect(item, card);
				}
			});
			const use = card.querySelector(".geb-library-use");
			if (use) {
				use.addEventListener("click", (event) => {
					event.stopPropagation();
					opts.onActivate && opts.onActivate(item);
				});
			}
			return card;
		},

		// -----------------------------------------------------------------
		// Start screen
		// -----------------------------------------------------------------

		renderStart(wrapper, context) {
			const state = GEB.state;
			const canCreate = !!context.can_create;
			wrapper.innerHTML = "";
			const root = document.createElement("div");
			root.className = "geb-start";
			root.innerHTML =
				'<header class="geb-start-header">' +
				'<div class="geb-brand"><span class="geb-brand-mark">' +
				GEB.icons.mail +
				'</span><div><div class="geb-brand-title">Email Builder</div><div class="geb-brand-sub">Donor communications</div></div></div>' +
				'<div class="geb-start-header-actions">' +
				'<button type="button" class="geb-text-btn" data-start-action="templates">Email Templates</button>' +
				'<button type="button" class="geb-text-btn" data-start-action="help">Help</button>' +
				"</div></header>" +
				'<main class="geb-start-main">' +
				'<div class="geb-start-heading"><h1>Create an email</h1><p>Start from one of our donor templates, or build a message from scratch.</p></div>' +
				'<div class="geb-start-grid">' +
				'<section class="geb-start-compose">' +
				'<div class="geb-start-compose-inner">' +
				'<div class="geb-field"><span class="geb-label">Email name <span class="geb-required">*</span></span>' +
				'<input class="form-control geb-input" data-start-name type="text" maxlength="140" placeholder="e.g. Autumn impact newsletter" /></div>' +
				'<div class="geb-field"><span class="geb-label">Merge fields reference</span>' +
				'<select class="form-control geb-input" data-start-doctype>' +
				(context.reference_doctypes || ["Contact"])
					.map(
						(doctype) =>
							'<option value="' +
							esc(doctype) +
							'"' +
							(doctype === context.settings?.default_reference_doctype ? " selected" : "") +
							">" +
							esc(doctype) +
							"</option>"
					)
					.join("") +
				"</select>" +
				'<span class="geb-help">Campaigns pass this document to templates as <code>doc.*</code>.</span></div>' +
				'<div class="geb-start-selection" data-start-selection>' +
				'<div class="geb-start-selection-icon">' +
				GEB.icons.blocks +
				"</div>" +
				'<div><div class="geb-start-selection-title">Start from scratch</div>' +
				'<div class="geb-start-selection-sub">A blank email with the Glia header and footer.</div></div>' +
				"</div>" +
				'<button type="button" class="geb-create-btn" data-start-create' +
				(canCreate ? "" : " disabled") +
				">Create email</button>" +
				(canCreate
					? '<p class="geb-start-footnote">You can also open an existing template from the Email Template list.</p>'
					: '<p class="geb-start-footnote geb-warning-text">You do not have permission to create Email Templates.</p>') +
				"</div></section>" +
				'<section class="geb-start-library">' +
				'<div class="geb-start-library-head"><div><h2>Starters</h2><p>Pre-loaded donor templates. Your message is a copy — edit anything.</p></div>' +
				'<button type="button" class="geb-text-btn" data-start-action="templates">Browse all</button></div>' +
				'<div class="geb-library-toolbar">' +
				'<input class="form-control geb-input" type="search" data-library-search placeholder="Search templates" />' +
				'<div class="geb-library-chips" data-library-chips></div>' +
				"</div>" +
				'<div class="geb-library-grid" data-start-grid><div class="geb-library-loading">' +
				'<div class="geb-skeleton-card"></div><div class="geb-skeleton-card"></div><div class="geb-skeleton-card"></div>' +
				"</div></div>" +
				"</section></div></main>";
			wrapper.appendChild(root);

			const nameInput = root.querySelector("[data-start-name]");
			const doctypeSelect = root.querySelector("[data-start-doctype]");
			const selection = root.querySelector("[data-start-selection]");
			const grid = root.querySelector("[data-start-grid]");
			const chips = root.querySelector("[data-library-chips]");
			const search = root.querySelector("[data-library-search]");
			const createBtn = root.querySelector("[data-start-create]");
			this.startState = { selected: null, nameInput, doctypeSelect };
			state.startContext = context;
			nameInput.focus();

			const setSelection = (item) => {
				this.startState.selected = item;
				grid.querySelectorAll(".geb-library-card").forEach((card) => card.classList.remove("is-selected"));
				if (item) {
					const card = Array.from(grid.querySelectorAll(".geb-library-card")).find(
						(node) => node.dataset.template === item.title
					);
					if (card) card.classList.add("is-selected");
					selection.innerHTML =
						'<div class="geb-start-selection-icon">' +
						GEB.icons.check +
						"</div><div><div class=\"geb-start-selection-title\">" +
						esc(item.title) +
						'</div><div class="geb-start-selection-sub">' +
						esc(item.category || "Template") +
						" · a copy will be created</div></div>" +
						'<button type="button" class="geb-text-btn geb-start-clear" data-start-action="scratch">Change</button>';
					if (!nameInput.value) nameInput.placeholder = item.title + " copy";
				} else {
					selection.innerHTML =
						'<div class="geb-start-selection-icon">' +
						GEB.icons.blocks +
						"</div><div><div class=\"geb-start-selection-title\">Start from scratch</div>" +
						'<div class="geb-start-selection-sub">A blank email with the Glia header and footer.</div></div>' +
						'<button type="button" class="geb-text-btn geb-start-clear" data-start-action="scratch">Change</button>';
					if (!nameInput.value) nameInput.placeholder = "e.g. Autumn impact newsletter";
				}
			};

			const renderGrid = () => {
				grid.innerHTML = "";
				const items = this.filtered();
				if (!items.length) {
					grid.innerHTML =
						'<div class="geb-library-empty">No templates match. You can still start from scratch.</div>';
					return;
				}
				items.forEach((item) => {
					grid.appendChild(
						this.card(item, {
							onSelect: (selected) => setSelection(selected),
							onActivate: (selected) => {
								setSelection(selected);
								this.createFromStart(selected);
							},
						})
					);
				});
				if (this.startState.selected) {
					const card = Array.from(grid.querySelectorAll(".geb-library-card")).find(
						(node) => node.dataset.template === this.startState.selected.title
					);
					if (card) card.classList.add("is-selected");
				}
			};

			const renderChips = () => {
				chips.innerHTML = this.categories()
					.map(
						(category) =>
							'<button type="button" class="geb-chip ' +
							(category === this.category ? "is-active" : "") +
							'" data-library-category="' +
							esc(category) +
							'">' +
							esc(category) +
							"</button>"
					)
					.join("");
				chips.querySelectorAll("[data-library-category]").forEach((button) => {
					button.addEventListener("click", () => {
						this.category = button.dataset.libraryCategory;
						renderChips();
						renderGrid();
					});
				});
			};

			root.addEventListener("click", (event) => {
				const action = event.target.closest("[data-start-action]");
				if (action) {
					if (action.dataset.startAction === "scratch") {
						setSelection(null);
						return;
					}
					if (action.dataset.startAction === "help") {
						GEB.modals.help();
						return;
					}
					if (action.dataset.startAction === "templates") {
						frappe.set_route("List", "Email Template");
						return;
					}
				}
				if (event.target.closest("[data-start-create]")) this.createFromStart(this.startState.selected);
			});
			search.addEventListener(
				"input",
				core.debounce(() => {
					this.search = search.value;
					renderGrid();
				}, 180)
			);

			this.load().then(() => {
				renderChips();
				renderGrid();
			});
		},

		createFromStart(item) {
			const start = this.startState || {};
			const context = GEB.state.startContext || {};
			const nameInput = start.nameInput;
			const title = (nameInput?.value || "").trim();
			if (!title) {
				GEB.ui.error("Give your email a name first.");
				nameInput?.focus();
				return;
			}
			const button = document.querySelector("[data-start-create]");
			if (button) {
				button.disabled = true;
				button.textContent = "Creating…";
			}
			GEB.api
				.create({
					title,
					seed: item ? item.name : null,
					reference_doctype: start.doctypeSelect?.value || context.settings?.default_reference_doctype,
					category: item ? item.category : null,
				})
				.then((result) => {
					this.items = null;
					GEB.ui.success("Email created.");
					GEB.app.openTemplate(result.name);
				})
				.catch(() => {
					if (button) {
						button.disabled = false;
						button.textContent = "Create email";
					}
				});
		},

		// -----------------------------------------------------------------
		// Switch-template picker inside the editor
		// -----------------------------------------------------------------

		openPicker(onSelect) {
			const body = document.createElement("div");
			body.className = "geb-picker-panel";
			body.innerHTML =
				'<div class="geb-library-toolbar">' +
				'<input class="form-control geb-input" type="search" data-picker-search placeholder="Search templates" />' +
				'<div class="geb-library-chips" data-picker-chips></div></div>' +
				'<div class="geb-library-grid geb-picker-grid" data-picker-grid><div class="geb-library-loading"><div class="geb-skeleton-card"></div><div class="geb-skeleton-card"></div></div></div>';
			const modal = GEB.ui.modal({
				title: "Template library",
				subtitle: "Choosing a template replaces the current email content.",
				body,
				size: "xlarge",
				actions: [{ label: "Close" }],
			});
			const grid = body.querySelector("[data-picker-grid]");
			const chips = body.querySelector("[data-picker-chips]");
			const search = body.querySelector("[data-picker-search]");
			let category = "All";
			const render = () => {
				const filtered = (this.items || []).filter((item) => {
					if (category !== "All" && (item.category || "Custom") !== category) return false;
					const term = (search.value || "").toLowerCase();
					if (!term) return true;
					return (
						(item.title || "").toLowerCase().includes(term) ||
						(item.description || "").toLowerCase().includes(term)
					);
				});
				grid.innerHTML = "";
				if (!filtered.length) {
					grid.innerHTML = '<div class="geb-library-empty">No templates match.</div>';
					return;
				}
				filtered.forEach((item) => {
					grid.appendChild(
						this.card(item, {
							showUse: true,
							onActivate: () => {
								GEB.ui
									.confirm(
										"Replace the content of this email with “" + item.title + "”? Your current content will be overwritten.",
										{ confirmLabel: "Use template" }
									)
									.then((confirmed) => {
										if (!confirmed) return;
										modal.close();
										onSelect && onSelect(item);
									});
							},
						})
					);
				});
			};
			const renderChips = () => {
				chips.innerHTML = this.categories()
					.map(
						(cat) =>
							'<button type="button" class="geb-chip ' +
							(cat === category ? "is-active" : "") +
							'" data-picker-category="' +
							esc(cat) +
							'">' +
							esc(cat) +
							"</button>"
					)
					.join("");
				chips.querySelectorAll("[data-picker-category]").forEach((button) => {
					button.addEventListener("click", () => {
						category = button.dataset.pickerCategory;
						renderChips();
						render();
					});
				});
			};
			search.addEventListener("input", core.debounce(render, 180));
			this.load().then(() => {
				renderChips();
				render();
			});
			return modal;
		},

		applyTemplate(item) {
			if (!item || !item.name) return;
			if (GEB.state && !GEB.state.canWrite) {
				GEB.ui.error("You have read-only access to this template.");
				return;
			}
			GEB.api
				.getContext(item.title)
				.then((context) => {
					if (!context.design) return;
					GEB.state.design = context.design;
					GEB.state.designMeta = context.design_meta || GEB.state.designMeta;
					GEB.state.design.settings.email_title = GEB.state.template?.name || context.template?.name || "";
					GEB.state.selection = null;
					GEB.markDirty();
					GEB.history?.snapshot("Template applied");
					GEB.canvas.render();
					GEB.inspector?.render();
					GEB.ui.success("Template applied. Review the content and save.");
				})
				.catch(() => {});
		},

		// -----------------------------------------------------------------
		// Standalone preview of a library item
		// -----------------------------------------------------------------
		previewItem(item) {
			const body = document.createElement("div");
			body.className = "geb-library-preview";
			body.innerHTML =
				'<div class="geb-preview-toolbar"><div class="geb-preview-device">' +
				'<button type="button" class="geb-preview-tab is-active" data-lib-device="desktop">Desktop</button>' +
				'<button type="button" class="geb-preview-tab" data-lib-device="mobile">Mobile</button>' +
				"</div></div>" +
				'<div class="geb-library-preview-frame"><iframe sandbox="" title="Template preview"></iframe></div>';
			const frame = body.querySelector("iframe");
			frame.srcdoc = item.preview_html || "<p>No preview available.</p>";
			body.querySelectorAll("[data-lib-device]").forEach((button) => {
				button.addEventListener("click", () => {
					const mobile = button.dataset.libDevice === "mobile";
					body.querySelector(".geb-library-preview-frame").classList.toggle("is-mobile", mobile);
					body.querySelectorAll("[data-lib-device]").forEach((node) => {
						node.classList.toggle("is-active", node === button);
					});
				});
			});
			return GEB.ui.modal({
				title: item.title,
				subtitle: item.description || item.category || "",
				body,
				size: "xlarge",
				actions: [{ label: "Close" }],
			});
		},
	};
})();
