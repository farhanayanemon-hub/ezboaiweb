import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { authSanitizers } from '$lib/utils/sanitization.js';
import { OtpService } from '$lib/server/otp-service.js';
import { CreditService } from '$lib/server/credit-service.js';
import { SecurityLogger } from '$lib/server/security-monitoring.js';
import { getClientIP } from '$lib/server/rate-limiting.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email: rawEmail, code: rawCode } = body;

		const clientIP = getClientIP(request);

		if (!rawEmail || !rawCode) {
			return json({ error: 'Email and verification code are required' }, { status: 400 });
		}

		const email = authSanitizers.email(rawEmail);
		const code = rawCode.trim();

		if (!email) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		const result = await OtpService.verifyOtp(email, code, 'registration');
		if (!result.success) {
			SecurityLogger.registrationFailure(email, 'Invalid OTP code', clientIP);
			return json({ error: result.error || 'Invalid or expired verification code' }, { status: 400 });
		}

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		// Update user emailVerified
		await db.update(users)
			.set({ emailVerified: new Date() })
			.where(eq(users.id, user.id));

		SecurityLogger.emailVerificationSuccess(user.id, email);

		const secret = env.AUTH_SECRET || 'ezboai-auth-secret';
		const token = jwt.sign(
			{
				sub: user.id,
				id: user.id,
				email: user.email,
				name: user.name,
				isAdmin: user.isAdmin,
				planTier: user.planTier || 'free'
			},
			secret,
			{ expiresIn: '30d' }
		);

		let credits = { text: 0, image: 0, video: 0, audio: 0 };
		try {
			credits = await CreditService.getUserCredits(user.id);
		} catch (creditErr) {
			console.warn('[Mobile OTP] Failed to fetch credits:', creditErr);
		}

		return json({
			success: true,
			token,
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				image: user.image,
				planTier: user.planTier || 'free',
				isAdmin: user.isAdmin,
				profession: user.profession,
				personalInstructions: user.personalInstructions,
				subscriptionStatus: user.subscriptionStatus
			},
			credits
		});

	} catch (error) {
		console.error('[Mobile OTP Verify] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal verification error' },
			{ status: 500 }
		);
	}
};
