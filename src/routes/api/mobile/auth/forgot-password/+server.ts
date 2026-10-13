import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { authSanitizers } from '$lib/utils/sanitization.js';
import { createPasswordResetToken, getUserForReset, generateResetUrl } from '$lib/server/password-reset.js';
import { sendPasswordResetEmail } from '$lib/server/email.js';
import { SecurityLogger } from '$lib/server/security-monitoring.js';
import { getClientIP } from '$lib/server/rate-limiting.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email: rawEmail } = body;

		const clientIP = getClientIP(request);

		if (!rawEmail || typeof rawEmail !== 'string') {
			return json({ error: 'Email address is required' }, { status: 400 });
		}

		const email = authSanitizers.email(rawEmail);
		if (!email) {
			return json({ error: 'Invalid email address format' }, { status: 400 });
		}

		try {
			const userData = await getUserForReset(email);

			if (userData) {
				const { token } = await createPasswordResetToken(email);
				const resetUrl = await generateResetUrl(token);

				await sendPasswordResetEmail({
					name: userData.name,
					email: userData.email,
					resetUrl,
				});
			}
		} catch (resetErr: any) {
			if (resetErr instanceof Error && resetErr.message.includes('Too many password reset requests')) {
				return json({ error: 'Too many reset requests. Please wait a while before trying again.' }, { status: 429 });
			}
			console.warn('[Mobile Forgot Password] Warning during reset process:', resetErr?.message || resetErr);
		}

		// Always return success message to avoid email enumeration
		return json({
			success: true,
			message: 'If an account exists for this email, password reset instructions have been sent.'
		});
	} catch (error) {
		console.error('[Mobile Forgot Password] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
