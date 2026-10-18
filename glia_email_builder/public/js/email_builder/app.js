/**
 * Glia Email Builder - application controller.
 */
(function () {
	"use strict";

	window.GEB = window.GEB || {};
	const GEB = window.GEB;
	const core = GEB.core;
	const esc = core.esc;

	const MAX_HISTORY = 50;

	GEB.state = {
		design: null,
		template: null,
		subject: "",
		referenceDoctype: "",
		referenceDoctypes: [],
		mergeFieldGroups: [],
		sampleDoc: {},
		settings: {},
		designMeta: {},
		categories: [],
		selection: null,
		device: "desktop",
		showHidden: false,
		activeTab: "content",
		dirty: false,
		revision: 0,
		saving: null,
		lastSaved: null,
		canWrite: true,
		canCreate: false,
		imported: false,
		emailSize: 0,
		warnClipped: false,
		user: "",
		previewSource: "",
		readOnly: false,
		startContext: null,
	};

	// ---------------------------------------------------------------------
	// History / timeline
	// ---------------------------------------------------------------------
	GEB.history = {
		stack: [],
		index: -1,
		timer: null,

		reset(label) {
			clearTimeout(this.timer);
			this.timer = null;
			this.stack = [];
			this.index = -1;
			this.snapshot(label || "Template opened", { force: true });
		},

		snapshot(label, options) {
			const opts = options || {};
			if (!GEB.state.design) return;
			clearTimeout(this.timer);
			this.timer = null;
			const json = JSON.stringify(GEB.state.design);
			if (!opts.force && this.stack[this.index] && this.stack[this.index].json === json) return;
			this.stack = this.stack.slice(0, this.index + 1);
			this.stack.push({ label: label || "Change", at: new Date(), json });
			if (this.stack.length > MAX_HISTORY) {
				this.stack.shift();
			}
			this.index = this.stack.length - 1;
			GEB.app && GEB.app.refreshTimeline && GEB.app.refreshTimeline();
		},

		snapshotDebounced(label) {
			clearTimeout(this.timer);
			this.timer = setTimeout(() => this.snapshot(label || "Text edited"), 800);
		},

		canUndo() {
			return this.index > 0;
		},

		canRedo() {
			return this.index >= 0 && this.index < this.stack.length - 1;
		},

		undo() {
			if (!this.canUndo()) return;
			this.apply(this.index - 1);
		},

		redo() {
			if (!this.canRedo()) return;
			this.apply(this.index + 1);
		},

		apply(index) {
			const entry = this.stack[index];
			if (!entry) return;
			clearTimeout(this.timer);
			this.timer = null;
			this.index = index;
			GEB.state.design = GEB.model.normalize(JSON.parse(entry.json));
			if (GEB.state.selection) {
				const found =
					GEB.state.selection.type === "block"
						? GEB.model.findBlock(GEB.state.selection.id)
						: GEB.model.findRow(GEB.state.selection.id);
				if (!found) GEB.state.selection = null;
			}
			GEB.markDirty();
			GEB.canvas.render();
			GEB.inspector.render();
			GEB.app && GEB.app.refreshTimeline && GEB.app.refreshTimeline();
		},

		entries(limit) {
			const out = [];
			const start = Math.max(0, this.index - (limit || 15) + 1);
			for (let i = this.index; i >= start; i--) {
				out.push({ index: i, ...this.stack[i] });
			}
			return out;
		},
	};

	GEB.markDirty = function () {
		GEB.state.dirty = true;
		GEB.state.revision += 1;
		GEB.app && GEB.app.updateSaveStatus && GEB.app.updateSaveStatus();
	};

	// ---------------------------------------------------------------------
	// App
	// ---------------------------------------------------------------------
	GEB.app = {
		wrapper: null,
		root: null,
		autosaveTimer: null,
		docClickBound: false,

		// -----------------------------------------------------------------
		// Boot / routing
		// -----------------------------------------------------------------

		boot(wrapper) {
			this.wrapper = wrapper;
			this.root = document.createElement("div");
			this.root.className = "geb-app";
			wrapper.innerHTML = "";
			wrapper.appendChild(this.root);
			this.position();
			window.addEventListener("resize", () => this.position());
			this.observeSidebar();
			document.addEventListener("keydown", (event) => this.onKeyDown(event));
			window.addEventListener("beforeunload", (event) => this.onBeforeUnload(event));
			document.addEventListener("visibilitychange", () => {
				if (document.hidden && GEB.state.dirty && GEB.state.canWrite && GEB.state.template) {
					this.save({ silent: true, toast: false });
				}
			});

			const name = this.templateFromUrl();
			if (name) this.loadTemplate(name);
			else this.loadStart();
		},

		position() {
			if (!this.root) return;
			const navbar = document.querySelector(".navbar, .desk-navbar, .app-navbar, .navbar-container");
			let top = 0;
			if (navbar) {
				const rect = navbar.getBoundingClientRect();
				if (rect.bottom > 0 && rect.bottom < 160) top = rect.bottom;
			}
			// Keep the Desk app rail visible and place the builder in the
			// remaining content area. The rail can collapse or resize, so use
			// its measured right edge rather than a hard-coded width.
			const sidebar = document.querySelector(".body-sidebar-container, .layout-side-section");
			let left = 0;
			if (sidebar) {
				const style = window.getComputedStyle(sidebar);
				const rect = sidebar.getBoundingClientRect();
				if (style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.right > 0) {
					left = Math.max(0, Math.min(rect.right, window.innerWidth));
				}
			}
			this.root.style.top = Math.max(0, top) + "px";
			this.root.style.left = left + "px";
			this.root.style.height = Math.max(320, window.innerHeight - top) + "px";
		},

		observeSidebar() {
			const sidebar = document.querySelector(".body-sidebar-container, .layout-side-section");
			if (!sidebar) {
				if (!this._sidebarRetry) {
					this._sidebarRetry = setTimeout(() => {
						this._sidebarRetry = null;
						this.position();
						this.observeSidebar();
					}, 300);
				}
				return;
			}
			if (!window.ResizeObserver) return;
			if (this._sidebarObserver) this._sidebarObserver.disconnect();
			this._sidebarObserver = new ResizeObserver(() => this.position());
			this._sidebarObserver.observe(sidebar);
		},

		templateFromUrl() {
			try {
				return new URLSearchParams(window.location.search).get("template") || "";
			} catch (error) {
				return "";
			}
		},

		setUrlTemplate(name) {
			try {
				const url = new URL(window.location.href);
				if (name) url.searchParams.set("template", name);
				else url.searchParams.delete("template");
				window.history.replaceState({}, "", url.pathname + (url.search || "") + (url.hash || ""));
			} catch (error) {
				/* ignore */
			}
		},

		onShow() {
			this.position();
			this.observeSidebar();
			const name = this.templateFromUrl();
			if (name && (!GEB.state.template || GEB.state.template.name !== name)) {
				this.loadTemplate(name);
			}
		},

		// -----------------------------------------------------------------
		// Start screen
		// -----------------------------------------------------------------

		loadStart() {
			clearInterval(this.autosaveTimer);
			GEB.api
				.getContext()
				.then((context) => {
					const state = GEB.state;
					state.settings = context.settings || {};
					state.user = context.user || "";
					state.canCreate = !!context.can_create;
					state.referenceDoctypes = context.reference_doctypes || [];
					state.referenceDoctype = state.settings.default_reference_doctype || "Contact";
					state.categories = context.categories || [];
					state.startContext = context;
					state.template = null;
					state.dirty = false;
					this.root.className = "geb-app geb-app-start";
					GEB.library.renderStart(this.root, context);
				})
				.catch((error) => this.showFatal(error.message));
		},

		openTemplate(name) {
			this.setUrlTemplate(name);
			this.loadTemplate(name);
		},

		loadTemplate(name) {
			this.setLoading("Opening " + name + "…");
			GEB.api
				.getContext(name)
				.then((context) => this.startEditor(context))
				.catch((error) => this.showFatal(error.message));
		},

		// -----------------------------------------------------------------
		// Editor shell
		// -----------------------------------------------------------------

		startEditor(context) {
			const state = GEB.state;
			state.settings = context.settings || {};
			state.template = context.template || null;
			state.subject = context.subject || context.template?.subject || "";
			state.referenceDoctype =
				context.reference_doctype ||
				context.template?.reference_doctype ||
				state.settings.default_reference_doctype ||
				"";
			state.referenceDoctypes = context.reference_doctypes || [];
			state.mergeFieldGroups = context.merge_field_groups || [];
			state.sampleDoc = context.sample_doc || {};
			state.design = GEB.model.normalize(context.design || GEB.model.newDesign());
			state.designMeta = context.design_meta || { category: "Custom", description: "" };
			state.categories = context.categories || [];
			state.canWrite = !!context.can_write;
			state.canCreate = !!context.can_create;
			state.imported = !!context.imported;
			state.emailSize = Number(context.design_meta?.email_size) || 0;
			state.warnClipped = state.emailSize > (state.settings.gmail_clip_bytes || 102000);
			state.lastSaved = null;
			state.dirty = false;
			state.revision = 0;
			state.selection = null;
			state.device = "desktop";
			state.showHidden = false;
			state.saving = null;
			state.user = context.user || state.user;
			state.previewSource = "";
			state.readOnly = !state.canWrite;
			state.design.settings.email_title =
				state.design.settings.email_title || state.template?.name || "";

			this.root.className = "geb-app" + (state.canWrite ? "" : " is-readonly");
			this.root.innerHTML =
				'<header class="geb-topbar">' +
				'<button type="button" class="geb-topbar-back" data-app-action="back" title="Back to Email Templates">' +
				GEB.icons.chevronLeft +
				"</button>" +
				'<div class="geb-brand">' +
				'<span class="geb-brand-mark">' +
				GEB.icons.mail +
				"</span>" +
				'<span class="geb-brand-title">Email Builder</span>' +
				"</div>" +
				'<span class="geb-topbar-divider"></span>' +
				'<button type="button" class="geb-template-name" data-app-action="classic" title="Open the classic Email Template form">' +
				esc(state.template?.name || "") +
				"</button>" +
				'<nav class="geb-topbar-nav">' +
				'<button type="button" data-app-action="preview">' +
				GEB.icons.preview +
				" Preview</button>" +
				'<button type="button" data-app-action="templates">' +
				GEB.icons.blocks +
				" Templates</button>" +
				'<button type="button" data-app-action="sample">' +
				GEB.icons.send +
				" Send a sample</button>" +
				"</nav>" +
				'<div class="geb-topbar-right">' +
				(state.canWrite
					? '<span class="geb-save-status" data-save-status>Not saved yet</span>' +
					  '<button type="button" class="btn btn-sm btn-default geb-save-btn" data-app-action="save">Save</button>' +
					  '<button type="button" class="btn btn-sm btn-primary geb-save-close" data-app-action="save-close">Save &amp; Close</button>'
					: '<span class="geb-readonly-badge">' + GEB.icons.lock + " Read only</span>") +
				'<div class="geb-more-wrap">' +
				'<button type="button" class="geb-more-btn" data-app-action="more" title="More actions">⋯</button>' +
				'<div class="geb-menu" data-menu hidden>' +
				'<button type="button" data-app-action="html">View HTML</button>' +
				(state.canCreate
					? '<button type="button" data-app-action="duplicate">Duplicate this email</button>'
					: "") +
				'<button type="button" data-app-action="classic">Open the classic form</button>' +
				"<hr />" +
				'<button type="button" data-app-action="help">Help</button>' +
				"</div></div></div>" +
				"</header>" +
				'<div class="geb-subject-bar">' +
				'<span class="geb-subject-label">Subject</span>' +
				'<button type="button" class="geb-subject-value" data-app-action="edit-subject">' +
				(state.subject ? esc(state.subject) : '<span class="geb-muted">Add a subject line</span>') +
				"</button>" +
				'<span class="geb-subject-meta">' +
				esc(state.designMeta.category || "Custom") +
				"</span>" +
				(state.warnClipped
					? '<span class="geb-subject-warn" title="Gmail may clip this message">' + GEB.icons.alert + "</span>"
					: "") +
				"</div>" +
				'<div class="geb-banner" data-banner hidden></div>' +
				'<div class="geb-workspace">' +
				'<div class="geb-canvas-scroll" id="geb-canvas-scroll">' +
				'<div class="geb-canvas-toolbar">' +
				'<div class="geb-device-toggle">' +
				'<button type="button" class="geb-device-btn is-active" data-device="desktop" title="Desktop preview">' + GEB.icons.desktop + "</button>" +
				'<button type="button" class="geb-device-btn" data-device="mobile" title="Mobile preview">' + GEB.icons.mobile + "</button>" +
				"</div>" +
				'<button type="button" class="geb-eye-btn" data-app-action="toggle-hidden" title="Show hidden elements">' + GEB.icons.eye + "</button>" +
				"</div>" +
				'<div class="geb-canvas-stage" id="geb-canvas-stage"></div>' +
				"</div>" +
				'<aside class="geb-inspector" id="geb-inspector"></aside>' +
				"</div>" +
				(state.canWrite
					? '<div class="geb-history-pill">' +
					  '<button type="button" class="geb-history-btn" data-history="undo" title="Undo (Ctrl+Z)">' + GEB.icons.undo + "</button>" +
					  '<button type="button" class="geb-history-btn" data-history="redo" title="Redo (Ctrl+Shift+Z)">' + GEB.icons.redo + "</button>" +
					  '<span class="geb-history-sep"></span>' +
					  '<button type="button" class="geb-history-btn geb-history-timeline" data-history="timeline" title="Timeline">' + GEB.icons.clock + "</button>" +
					  "</div>"
					: "") +
				'<div class="geb-timeline" data-timeline hidden></div>';

			if (!this.root.__gebShellBound) {
				this.root.__gebShellBound = true;
				this.bindShell();
			}
			const stage = this.root.querySelector("#geb-canvas-stage");
			const inspectorRoot = this.root.querySelector("#geb-inspector");
			GEB.canvas.init(stage);
			GEB.inspector.init(inspectorRoot);
			GEB.history.reset("Template opened");
			GEB.canvas.render();
			GEB.inspector.render();
			this.refreshTimeline();
			this.updateSaveStatus();
			this.updateSubjectLabel();
			this.applyReadOnly();

			if (state.imported) {
				this.setBanner(
					"This template's existing content was imported as an HTML block. Save it to convert it into an editable block design.",
					"info"
				);
			}
			if (!state.canWrite) {
				this.setBanner("You have read-only access to this template. Duplicate it to make changes.", "warning");
			}
			this.startAutosave();
		},

		bindShell() {
			this.root.addEventListener("click", (event) => {
				const menu = this.root.querySelector("[data-menu]");
				if (menu && !event.target.closest(".geb-more-wrap")) menu.hidden = true;

				const appAction = event.target.closest("[data-app-action]");
				if (appAction) {
					event.preventDefault();
					this.handleAppAction(appAction.dataset.appAction);
					return;
				}
				const device = event.target.closest("[data-device]");
				if (device) {
					event.preventDefault();
					this.setDevice(device.dataset.device);
					return;
				}
				const history = event.target.closest("[data-history]");
				if (history) {
					event.preventDefault();
					if (history.dataset.history === "undo") GEB.history.undo();
					else if (history.dataset.history === "redo") GEB.history.redo();
					else if (history.dataset.history === "timeline") this.toggleTimeline();
					return;
				}
				const bannerClose = event.target.closest("[data-banner-close]");
				if (bannerClose) {
					event.preventDefault();
					this.clearBanner();
					return;
				}
				const timelineEntry = event.target.closest("[data-timeline-index]");
				if (timelineEntry) {
					event.preventDefault();
					GEB.history.apply(Number(timelineEntry.dataset.timelineIndex));
					this.toggleTimeline(false);
				}
			});
		},

		handleAppAction(action) {
			const menu = this.root.querySelector("[data-menu]");
			if (action === "more") {
				if (menu) menu.hidden = !menu.hidden;
				return;
			}
			if (menu) menu.hidden = true;
			if (action === "back") return this.leave();
			if (action === "preview") return GEB.modals.preview();
			if (action === "templates") {
				return GEB.library.openPicker((item) => GEB.library.applyTemplate(item));
			}
			if (action === "sample") return GEB.modals.sendSample();
			if (action === "save") return this.save();
			if (action === "save-close") return this.save({ close: true });
			if (action === "html") return this.viewHtml();
			if (action === "duplicate") return this.duplicate();
			if (action === "classic") return this.openClassic();
			if (action === "help") return GEB.modals.help();
			if (action === "edit-subject") return this.editSubject();
			if (action === "toggle-hidden") return this.toggleHidden();
		},

		setDevice(device) {
			if (!["desktop", "mobile"].includes(device)) return;
			GEB.state.device = device;
			GEB.state.selection = null;
			this.root.querySelectorAll("[data-device]").forEach((button) => {
				button.classList.toggle("is-active", button.dataset.device === device);
			});
			GEB.canvas.render();
			GEB.inspector.render();
		},

		toggleHidden() {
			GEB.state.showHidden = !GEB.state.showHidden;
			this.root.querySelector(".geb-eye-btn")?.classList.toggle("is-active", GEB.state.showHidden);
			GEB.canvas.render();
			GEB.inspector.render();
			if (GEB.state.showHidden) {
				GEB.ui.toast("Hidden blocks are now visible and greyed out.", "info");
			}
		},

		editSubject() {
			GEB.inspector.setTab("settings");
			setTimeout(() => {
				const input = this.root.querySelector('[data-setting="subject"]');
				if (input) {
					input.focus();
					input.select && input.select();
				}
			}, 60);
		},

		updateSubjectLabel() {
			if (!this.root) return;
			const button = this.root.querySelector(".geb-subject-value");
			if (!button) return;
			button.innerHTML = GEB.state.subject
				? esc(GEB.state.subject)
				: '<span class="geb-muted">Add a subject line</span>';
		},

		updateSaveStatus() {
			if (!this.root) return;
			const el = this.root.querySelector("[data-save-status]");
			if (el) {
				if (GEB.state.saving) {
					el.textContent = "Saving…";
					el.className = "geb-save-status is-saving";
				} else if (GEB.state.dirty) {
					el.textContent = "Unsaved changes";
					el.className = "geb-save-status is-dirty";
				} else if (GEB.state.lastSaved) {
					el.textContent = "Saved at " + core.formatTime(GEB.state.lastSaved);
					el.className = "geb-save-status is-saved";
				} else {
					el.textContent = "No unsaved changes";
					el.className = "geb-save-status";
				}
			}
			this.refreshUndoButtons();
		},

		refreshUndoButtons() {
			if (!this.root) return;
			const undo = this.root.querySelector('[data-history="undo"]');
			const redo = this.root.querySelector('[data-history="redo"]');
			if (undo) undo.disabled = !GEB.history.canUndo();
			if (redo) redo.disabled = !GEB.history.canRedo();
		},

		refreshTimeline() {
			this.refreshUndoButtons();
			const host = this.root && this.root.querySelector("[data-timeline]");
			if (!host) return;
			const entries = GEB.history.entries(15);
			host.innerHTML =
				'<div class="geb-timeline-head"><span>Timeline</span><span class="geb-dim">Last ' +
				entries.length +
				" edits</span></div>" +
				'<div class="geb-timeline-list">' +
				entries
					.map(
						(entry) =>
							'<button type="button" class="geb-timeline-entry ' +
							(entry.index === GEB.history.index ? "is-current" : "") +
							'" data-timeline-index="' +
							entry.index +
							'"><span class="geb-timeline-dot"></span><span class="geb-timeline-text">' +
							esc(entry.label) +
							'<span class="geb-timeline-time">' +
							core.formatDateTime(entry.at) +
							"</span></span></button>"
					)
					.join("") +
				"</div>";
		},

		toggleTimeline(force) {
			const host = this.root.querySelector("[data-timeline]");
			if (!host) return;
			const show = force == null ? host.hidden : !!force;
			host.hidden = !show;
			if (show) this.refreshTimeline();
		},

		// -----------------------------------------------------------------
		// Banners / read-only
		// -----------------------------------------------------------------

		setBanner(message, type) {
			const banner = this.root.querySelector("[data-banner]");
			if (!banner) return;
			banner.hidden = false;
			banner.className = "geb-banner geb-banner-" + (type || "info");
			banner.innerHTML =
				'<span class="geb-banner-icon">' +
				(type === "warning" ? GEB.icons.alert : GEB.icons.help) +
				"</span><span class=\"geb-banner-text\">" +
				esc(message) +
				'</span><button type="button" class="geb-banner-close" data-banner-close title="Dismiss">' +
				GEB.icons.close +
				"</button>";
		},

		clearBanner() {
			const banner = this.root.querySelector("[data-banner]");
			if (banner) banner.hidden = true;
		},

		applyReadOnly() {
			if (GEB.state.canWrite) return;
			this.root.querySelectorAll("[contenteditable]").forEach((el) => {
				el.setAttribute("contenteditable", "false");
			});
			this.root.querySelectorAll(".geb-inspector input, .geb-inspector select, .geb-inspector textarea").forEach((el) => {
				el.disabled = true;
			});
			const keep = new Set(["back-to-blocks", "back-to-rows", "open-classic", "manage-merge-fields"]);
			this.root.querySelectorAll(".geb-inspector [data-action]").forEach((el) => {
				if (!keep.has(el.dataset.action)) el.disabled = true;
			});
			this.root.querySelectorAll(".geb-inspector .geb-palette-item, .geb-inspector .geb-row-preset").forEach((el) => {
				el.disabled = true;
			});
			GEB.dnd && GEB.dnd.destroy && GEB.dnd.destroy();
		},

		// -----------------------------------------------------------------
		// Save
		// -----------------------------------------------------------------

		save(options) {
			const opts = options || {};
			const state = GEB.state;
			if (!state.template) return Promise.resolve(null);
			if (!state.canWrite) {
				GEB.ui.error("You do not have permission to edit this template.");
				return Promise.resolve(null);
			}
			if (!String(state.subject || "").trim()) {
				if (!opts.silent) {
					GEB.ui.error("Add a subject line before saving.");
					GEB.inspector.setTab("settings");
					setTimeout(() => {
						const input = this.root.querySelector('[data-setting="subject"]');
						if (input) input.focus();
					}, 80);
				}
				return Promise.resolve(null);
			}
			if (state.saving) return state.saving;
			const revision = state.revision;
			state.saving = true;
			this.updateSaveStatus();
			const payload = {
				template: state.template.name,
				design: state.design,
				subject: state.subject,
				reference_doctype: state.referenceDoctype,
				category: state.designMeta.category,
				description: state.designMeta.description,
				base_modified: opts.overwrite ? null : state.template.modified,
			};
			const promise = GEB.api
				.save(payload, { silent: !!opts.silent })
				.then((result) => {
					state.saving = false;
					if (result && result.conflict) {
						state.dirty = true;
						this.updateSaveStatus();
						this.showConflict(result);
						return result;
					}
					state.template.modified = result.modified || state.template.modified;
					state.designMeta = Object.assign({}, state.designMeta, {
						name: state.template.name,
					});
					state.lastSaved = new Date();
					state.emailSize = Number(result.size) || 0;
					GEB.library.items = null;
					state.warnClipped = !!result.warn_clipped;
					state.dirty = state.revision !== revision;
					this.updateSaveStatus();
					this.updateSubjectLabel();
					if (opts.toast !== false && !opts.silent) GEB.ui.success("Email saved.");
					if (state.warnClipped) {
						GEB.ui.toast(
							"This message is larger than Gmail's ~102 KB clipping limit. Some clients may cut the end off.",
							"error"
						);
					}
					if (state.dirty && !opts.close) {
						// Edits happened while the save was in flight.
						setTimeout(() => this.save({ silent: true, toast: false }), 1200);
					}
					if (opts.close) {
						this.closeEditor();
					}
					return result;
				})
				.catch((error) => {
					state.saving = false;
					this.updateSaveStatus();
					if (!opts.silent) GEB.ui.error(error.message || "Could not save the email.");
					return null;
				});
			state.saving = promise;
			promise.finally(() => {
				state.saving = null;
				this.updateSaveStatus();
			});
			return promise;
		},

		showConflict(result) {
			if (this._conflictOpen) return;
			this._conflictOpen = true;
			GEB.ui.modal({
				title: "This template changed elsewhere",
				body:
					'<p class="geb-confirm-text">Another window or user saved this template while you were editing. Reload the latest version, or overwrite it with your changes.</p>',
				actions: [
					{
						label: "Cancel",
						onClick: () => {
							this._conflictOpen = false;
						},
					},
					{
						label: "Reload latest",
						onClick: () => {
							this._conflictOpen = false;
							this.loadTemplate(GEB.state.template.name);
						},
					},
					{
						label: "Overwrite",
						primary: true,
						onClick: () => {
							this._conflictOpen = false;
							this.save({ overwrite: true });
						},
					},
				],
				onClose: () => {
					this._conflictOpen = false;
				},
			});
		},

		startAutosave() {
			clearInterval(this.autosaveTimer);
			this.autosaveTimer = setInterval(() => {
				if (GEB.state.dirty && !GEB.state.saving && GEB.state.canWrite && GEB.state.template) {
					this.save({ silent: true, toast: false });
				}
			}, 15000);
		},

		// -----------------------------------------------------------------
		// Navigation / other actions
		// -----------------------------------------------------------------

		leave() {
			if (GEB.state.dirty) {
				GEB.ui
					.confirm("You have unsaved changes. Leave without saving?", {
						confirmLabel: "Discard changes",
						danger: true,
					})
					.then((confirmed) => {
						if (confirmed) {
							GEB.state.dirty = false;
							this.goToTemplates();
						}
					});
				return;
			}
			this.goToTemplates();
		},

		goToTemplates() {
			clearInterval(this.autosaveTimer);
			if (frappe.set_route) frappe.set_route("List", "Email Template");
			else window.location.href = "/desk/email-template";
		},

		closeEditor() {
			clearInterval(this.autosaveTimer);
			const name = GEB.state.template && GEB.state.template.name;
			if (frappe.set_route) frappe.set_route("Form", "Email Template", name);
			else window.location.href = "/desk/email-template/" + encodeURIComponent(name || "");
		},

		openClassic() {
			const go = () => {
				clearInterval(this.autosaveTimer);
				if (frappe.set_route) {
					frappe.set_route("Form", "Email Template", GEB.state.template.name);
				} else {
					window.location.href =
						"/desk/email-template/" + encodeURIComponent(GEB.state.template.name);
				}
			};
			if (GEB.state.dirty && GEB.state.canWrite) {
				GEB.ui
					.confirm("Save your changes before opening the classic form?", {
						confirmLabel: "Save and open",
					})
					.then((confirmed) => {
						if (confirmed) {
							this.save({ close: false }).then((result) => {
								if (result && !result.conflict) go();
							});
						} else {
							GEB.state.dirty = false;
							go();
						}
					});
				return;
			}
			go();
		},

		viewHtml() {
			if (!GEB.state.template) return;
			GEB.api
				.preview({
					template: GEB.state.template.name,
					design: GEB.state.design,
					subject: GEB.state.subject,
					reference_doctype: GEB.state.referenceDoctype,
					include_source: 1,
				})
				.then((result) => {
					GEB.state.previewSource = result.source || "";
					GEB.modals.htmlSource(result.source || "");
				})
				.catch(() => {});
		},

		duplicate() {
			const doDuplicate = () => {
				const value = GEB.state.template.name + " copy";
				GEB.ui
					.prompt("Duplicate this email", {
						label: "New email name",
						value,
						confirmLabel: "Duplicate",
					})
					.then((title) => {
						if (!title) return;
						GEB.api
							.create({
								title,
								seed: GEB.state.template.name,
								reference_doctype: GEB.state.referenceDoctype,
								category: GEB.state.designMeta.category,
							})
							.then((result) => {
								GEB.library.items = null;
								GEB.ui.success("Email duplicated.");
								this.openTemplate(result.name);
							})
							.catch(() => {});
					});
			};
			if (GEB.state.canWrite) {
				this.save({ silent: false }).then((result) => {
					if (result && !result.conflict) doDuplicate();
				});
			} else if (GEB.state.canCreate) {
				doDuplicate();
			}
		},

		// -----------------------------------------------------------------
		// Loading and fatal errors
		// -----------------------------------------------------------------

		setLoading(message) {
			this.root.className = "geb-app";
			this.root.innerHTML =
				'<div class="geb-boot"><div class="geb-boot-inner"><div class="geb-boot-spinner"></div>' +
				'<div class="geb-boot-title">' +
				esc(message || "Loading…") +
				'</div><div class="geb-boot-sub">This should only take a moment.</div></div></div>';
			this.position();
		},

		showFatal(message) {
			clearInterval(this.autosaveTimer);
			this.root.className = "geb-app";
			this.root.innerHTML =
				'<div class="geb-fatal"><h3>Could not open the Email Builder</h3><p>' +
				esc(message || "Something went wrong.") +
				'</p><button type="button" class="btn btn-sm btn-primary" data-fatal-back>Back to Email Templates</button></div>';
			this.root.querySelector("[data-fatal-back]").addEventListener("click", () => this.goToTemplates());
			this.position();
		},

		// -----------------------------------------------------------------
		// Keyboard
		// -----------------------------------------------------------------

		isEditableTarget(target) {
			if (!target) return false;
			const tag = target.tagName;
			if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return true;
			if (target.isContentEditable) return true;
			return !!target.closest("[contenteditable=true]");
		},

		onKeyDown(event) {
			const mod = event.metaKey || event.ctrlKey;
			const key = event.key.toLowerCase();
			if (mod && key === "s") {
				if (!GEB.state.template) return;
				event.preventDefault();
				this.save();
				return;
			}
			if (!GEB.state.template) return;
			if (mod && key === "z" && event.shiftKey) {
				if (this.isEditableTarget(event.target)) return;
				event.preventDefault();
				GEB.history.redo();
				return;
			}
			if (mod && key === "z") {
				if (this.isEditableTarget(event.target)) return;
				event.preventDefault();
				GEB.history.undo();
				return;
			}
			if (mod && key === "y") {
				if (this.isEditableTarget(event.target)) return;
				event.preventDefault();
				GEB.history.redo();
				return;
			}
			if (event.key === "Escape") {
				if (document.querySelector(".geb-modal-backdrop")) return;
				const timeline = this.root.querySelector("[data-timeline]");
				if (timeline && !timeline.hidden) {
					this.toggleTimeline(false);
					return;
				}
				GEB.canvas.clearSelection();
				return;
			}
			if ((event.key === "Delete" || event.key === "Backspace") && !this.isEditableTarget(event.target)) {
				const selection = GEB.state.selection;
				if (!selection || !GEB.state.canWrite) return;
				event.preventDefault();
				if (selection.type === "block") {
					GEB.model.removeBlock(selection.id);
					GEB.history.snapshot("Block deleted");
				} else if (selection.type === "row") {
					GEB.model.removeRow(selection.id);
					GEB.history.snapshot("Row deleted");
				}
				GEB.state.selection = null;
				GEB.markDirty();
				GEB.canvas.render();
				GEB.inspector.render();
			}
		},

		onBeforeUnload(event) {
			if (GEB.state.template && GEB.state.dirty && !GEB.state.saving) {
				event.preventDefault();
				event.returnValue = "";
				return "";
			}
			return undefined;
		},
	};

	GEB.boot = function (wrapper) {
		GEB.app.boot(wrapper);
	};

	GEB.onShow = function (wrapper) {
		GEB.app.onShow(wrapper);
	};
})();
