/**
 * Glia Email Builder - Desk page entry point.
 *
 * Loads the builder modules as cache-busted assets and hands control to
 * GEB.boot(). All UI code lives in /assets/glia_email_builder/js/email_builder/.
 */
frappe.pages["email-builder"].on_page_load = function (wrapper) {
	wrapper.classList.add("geb-page");

	if (wrapper.__gebBooted) {
		window.GEB && window.GEB.onShow && window.GEB.onShow(wrapper);
		return;
	}

	wrapper.innerHTML =
		'<div class="geb-boot"><div class="geb-boot-inner">' +
		'<div class="geb-boot-spinner"></div>' +
		"<div class=\"geb-boot-title\">Loading Email Builder</div>" +
		'<div class="geb-boot-sub">Preparing blocks, templates and merge fields…</div>' +
		"</div></div>";

	const assets = [
		"/assets/glia_email_builder/js/email_builder/vendor/Sortable.min.js",
		"/assets/glia_email_builder/js/email_builder/core.js",
		"/assets/glia_email_builder/js/email_builder/api.js",
		"/assets/glia_email_builder/js/email_builder/model.js",
		"/assets/glia_email_builder/js/email_builder/styles.js",
		"/assets/glia_email_builder/js/email_builder/blocks.js",
		"/assets/glia_email_builder/js/email_builder/canvas.js",
		"/assets/glia_email_builder/js/email_builder/inspector.js",
		"/assets/glia_email_builder/js/email_builder/toolbar.js",
		"/assets/glia_email_builder/js/email_builder/dnd.js",
		"/assets/glia_email_builder/js/email_builder/modals.js",
		"/assets/glia_email_builder/js/email_builder/library.js",
		"/assets/glia_email_builder/js/email_builder/app.js",
	];

	frappe.require(assets).then(() => {
		if (!window.GEB) {
			wrapper.innerHTML =
				'<div class="geb-fatal"><h3>Could not load the Email Builder</h3>' +
				"<p>Please hard-refresh the page. If the problem persists, run <code>bench build</code> and <code>bench clear-cache</code>.</p></div>";
			return;
		}
		try {
			window.GEB.boot(wrapper);
			wrapper.__gebBooted = true;
		} catch (error) {
			console.error(error);
			wrapper.innerHTML =
				'<div class="geb-fatal"><h3>Email Builder failed to start</h3><pre>' +
				frappe.utils.escape_html(error.message || String(error)) +
				"</pre></div>";
		}
	});
};

frappe.pages["email-builder"].on_page_show = function (wrapper) {
	if (window.GEB && window.GEB.onShow) {
		window.GEB.onShow(wrapper);
	}
};
