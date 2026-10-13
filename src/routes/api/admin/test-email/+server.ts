import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { emailService } from '$lib/server/email.js';
import { getMailingSettings } from '$lib/server/admin-settings.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		throw error(401, 'Unauthorized');
	}

	let toEmail: string;
	try {
		const body = await request.json();
		toEmail = (body.toEmail || '').trim();
	} catch {
		throw error(400, 'Invalid request body');
	}

	if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
		return json({ success: false, message: 'Please enter a valid email address.' }, { status: 400 });
	}

	const settings = await getMailingSettings();
	if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
		return json({ success: false, message: 'SMTP is not configured. Please save your SMTP settings first.' }, { status: 400 });
	}

	// Ensure the email service is using the latest saved settings
	await emailService.reconfigure();

	// Verify the SMTP connection before sending
	const connected = await emailService.testConnection();
	if (!connected) {
		return json({ success: false, message: 'Could not connect to SMTP server. Please check your host, port, and credentials.' }, { status: 400 });
	}

	const now = new Date().toUTCString();
	const sent = await emailService.sendEmail({
		to: toEmail,
		subject: 'Test Email — SMTP Configuration',
		html: `
			<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">
				<h2 style="margin:0 0 8px;font-size:20px;color:#111827;">SMTP Test Successful ✓</h2>
				<p style="margin:0 0 16px;color:#374151;font-size:14px;">
					Your SMTP settings are configured correctly. This test email confirms that outgoing email delivery is working.
				</p>
				<table style="font-size:13px;color:#6b7280;border-collapse:collapse;width:100%;">
					<tr><td style="padding:4px 0;font-weight:600;color:#111827;width:120px;">SMTP Host</td><td>${settings.smtp_host}</td></tr>
					<tr><td style="padding:4px 0;font-weight:600;color:#111827;">Port</td><td>${settings.smtp_port || '587'}</td></tr>
					<tr><td style="padding:4px 0;font-weight:600;color:#111827;">Secure</td><td>${settings.smtp_secure === 'true' ? 'SSL/TLS' : 'STARTTLS'}</td></tr>
					<tr><td style="padding:4px 0;font-weight:600;color:#111827;">Sent at</td><td>${now}</td></tr>
				</table>
				<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
				<p style="margin:0;color:#9ca3af;font-size:11px;">Sent from Ezbo AI Admin</p>
			</div>
		`,
		text: `SMTP Test Successful. Your SMTP settings are configured correctly.\n\nHost: ${settings.smtp_host}\nPort: ${settings.smtp_port || '587'}\nSent at: ${now}`,
	});

	if (!sent) {
		return json({ success: false, message: 'Connected to SMTP but failed to send the email. Check server logs for details.' }, { status: 500 });
	}

	return json({ success: true, message: `Test email sent successfully to ${toEmail}` });
};
