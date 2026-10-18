/**
 * Email Template list view integration.
 *
 * Makes the block builder the obvious way to create a new donor email while
 * keeping the standard "New" button for classic HTML templates.
 */
frappe.listview_settings["Email Template"] = frappe.listview_settings["Email Template"] || {};

frappe.listview_settings["Email Template"].onload = function (listview) {
	listview.page.add_inner_button(__("New Email (Block Builder)"), () => {
		window.location.href = "/desk/email-builder";
	});
};
