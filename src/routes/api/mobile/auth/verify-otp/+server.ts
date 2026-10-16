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

		let userRecord: typeof users.$inferSelect;
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);

		if (!existingUser) {
			const metadata = result.metadata || {};
			const displayName = metadata.name || email.split('@')[0];
			const passwordHash = metadata.passwordHash || null;

			const [newUser] = await db.insert(users).values({
				email: email,
				password: passwordHash,
				name: displayName,
				planTier: 'free',
				emailVerified: new Date(),
			}).returning();

			userRecord = newUser;
		} else {
			userRecord = existingUser;
			await db.update(users)
				.set({ emailVerified: new Date() })
				.where(eq(users.id, userRecord.id));
		}

		SecurityLogger.emailVerificationSuccess(userRecord.id, email);

		const secret = env.AUTH_SECRET || 'ezboai-auth-secret';
		const token = jwt.sign(
			{
				sub: userRecord.id,
				id: userRecord.id,
				email: userRecord.email,
				name: userRecord.name,
				isAdmin: userRecord.isAdmin,
				planTier: userRecord.planTier || 'free'
			},
			secret,
			{ expiresIn: '30d' }
		);

		let credits = { text: 0, image: 0, video: 0, audio: 0 };
		try {
			credits = await CreditService.getUserCredits(userRecord.id);
		} catch (creditErr) {
			console.warn('[Mobile OTP] Failed to fetch credits:', creditErr);
		}

		return json({
			success: true,
			token,
			user: {
				id: userRecord.id,
				name: userRecord.name,
				email: userRecord.email,
				image: userRecord.image,
				planTier: userRecord.planTier || 'free',
				isAdmin: userRecord.isAdmin,
				profession: userRecord.profession,
				personalInstructions: userRecord.personalInstructions,
				subscriptionStatus: userRecord.subscriptionStatus
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
