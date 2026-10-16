import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import { authSanitizers } from '$lib/utils/sanitization.js';
import { OtpService } from '$lib/server/otp-service.js';
import { sendOtpEmail } from '$lib/server/email.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email: rawEmail } = body;

		if (!rawEmail) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		const email = authSanitizers.email(rawEmail);
		if (!email) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		// Look for pending OTP registration first
		const pendingOtp = await OtpService.getPendingOtp(email, 'registration');
		let recipientName = email.split('@')[0];

		if (pendingOtp?.metadata?.name) {
			recipientName = pendingOtp.metadata.name;
		} else {
			const [existingUser] = await db
				.select({ id: users.id, name: users.name })
				.from(users)
				.where(eq(users.email, email))
				.limit(1);

			if (existingUser?.name) {
				recipientName = existingUser.name;
			} else if (!pendingOtp) {
				return json({ error: 'No pending registration found for this email' }, { status: 404 });
			}
		}

		const resendResult = await OtpService.resendOtp(email, 'registration');
		const otpCode = resendResult?.code || (await OtpService.createOtp(email, 'registration', pendingOtp?.metadata));

		await sendOtpEmail({
			email,
			name: recipientName,
			otpCode,
			expiryMinutes: OtpService.getExpiryMinutes(),
		});

		console.log(`[Mobile OTP Resend] New OTP sent to ${email}`);

		return json({
			success: true,
			message: 'A new verification code has been sent to your email.'
		});

	} catch (error) {
		console.error('[Mobile OTP Resend] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to resend verification code' },
			{ status: 500 }
		);
	}
};
