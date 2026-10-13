import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { authSanitizers, validatePasswordSafety } from '$lib/utils/sanitization.js';
import { isOtpVerificationEnabled } from '$lib/server/settings-store.js';
import { CreditService } from '$lib/server/credit-service.js';
import { SecurityLogger } from '$lib/server/security-monitoring.js';
import { getClientIP } from '$lib/server/rate-limiting.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { email: rawEmail, password: rawPassword } = body;

		const clientIP = getClientIP(request);

		if (!rawEmail || !rawPassword) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		const sanitizedEmail = authSanitizers.email(rawEmail);
		const passwordSafety = validatePasswordSafety(rawPassword);

		if (!sanitizedEmail || !passwordSafety.isValid) {
			SecurityLogger.loginFailure(rawEmail, 'Invalid email or password format', clientIP);
			return json({ error: 'Invalid email or password' }, { status: 400 });
		}

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, sanitizedEmail))
			.limit(1);

		if (!user || !user.password) {
			SecurityLogger.loginFailure(sanitizedEmail, 'User not found or no password', clientIP);
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		const isValidPassword = await bcrypt.compare(passwordSafety.sanitized, user.password);
		if (!isValidPassword) {
			SecurityLogger.loginFailure(sanitizedEmail, 'Invalid password', clientIP);
			return json({ error: 'Invalid email or password' }, { status: 401 });
		}

		const otpEnabled = await isOtpVerificationEnabled();
		if (otpEnabled && !user.emailVerified) {
			SecurityLogger.loginFailure(sanitizedEmail, 'Email not verified', clientIP);
			return json({
				error: 'Email verification required',
				requiresOtp: true,
				email: user.email
			}, { status: 403 });
		}

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

		SecurityLogger.loginSuccess(user.id, user.email || '', clientIP);

		let credits = { text: 0, image: 0, video: 0, audio: 0 };
		try {
			credits = await CreditService.getUserCredits(user.id);
		} catch (creditErr) {
			console.warn('[Mobile Auth] Failed to fetch user credits:', creditErr);
		}

		return json({
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
		console.error('[Mobile Login] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal login error' },
			{ status: 500 }
		);
	}
};
