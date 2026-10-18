/**
 * Email Builder Settings form integration.
 */
frappe.ui.form.on("Email Builder Settings", {
	refresh(frm) {
		if (!frm.__gebSettingsButtonsAdded) {
			frm.__gebSettingsButtonsAdded = true;

			frm.add_custom_button(__("Open Email Builder"), () => {
				window.location.href = "/desk/email-builder";
			});

			frm.add_custom_button(__("Recompile Block Templates"), () => {
				frappe.confirm(
					__(
						"Recompile every block design with the current brand colours, fonts and organization details? This updates the Email Template HTML."
					),
					() => {
						frappe
							.call({
								method: "glia_email_builder.api.recompile_all",
								freeze: true,
								freeze_message: __("Recompiling templates…"),
							})
							.then((response) => {
								const result = response.message || {};
								const message =
									__("{0} template(s) recompiled.", [result.count || 0]) +
									(result.errors && result.errors.length
										? "<br><br><strong>" +
										  __("Some templates could not be compiled:") +
										  "</strong><br>" +
										  result.errors.map(frappe.utils.escape_html).join("<br>")
										: "");
								frappe.msgprint({
									title: __("Recompile complete"),
									message,
									indicator: "green",
								});
							});
					}
				);
			});
		}

		frm.dashboard.set_headline(
			__(
				"These merge fields and brand defaults are shared by every block-based Email Template. Use the Email Builder to edit a message."
			)
		);
	},
});
