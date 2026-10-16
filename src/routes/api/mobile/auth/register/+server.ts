import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { authSanitizers, validatePasswordSafety } from '$lib/utils/sanitization.js';
import { validatePassword, BALANCED_PASSWORD_POLICY } from '$lib/utils/password-validation.js';
import { validateEmailForAuth } from '$lib/utils/email-validation.js';
import { isOtpVerificationEnabled } from '$lib/server/settings-store.js';
import { sendOtpEmail } from '$lib/server/email.js';
import { OtpService } from '$lib/server/otp-service.js';
import { SecurityLogger } from '$lib/server/security-monitoring.js';
import { getClientIP } from '$lib/server/rate-limiting.js';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { name: rawName, email: rawEmail, password: rawPassword } = body;

		const clientIP = getClientIP(request);

		if (!rawEmail || !rawPassword) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		const email = authSanitizers.email(rawEmail);
		const passwordSafety = validatePasswordSafety(rawPassword);

		if (!email || !passwordSafety.isValid) {
			SecurityLogger.registrationFailure(rawEmail || 'unknown', 'Invalid input data', clientIP);
			return json({ error: 'Invalid email or password format' }, { status: 400 });
		}

		const passwordValidation = validatePassword(rawPassword, BALANCED_PASSWORD_POLICY, { email });
		if (!passwordValidation.isValid) {
			SecurityLogger.registrationFailure(email, 'Password does not meet strength requirements', clientIP);
			return json({ error: passwordValidation.errors?.[0] || 'Password must be at least 8 characters long' }, { status: 400 });
		}

		const emailValidation = validateEmailForAuth(rawEmail);
		if (!emailValidation.isValid) {
			SecurityLogger.registrationFailure(rawEmail, 'Email validation failed', clientIP);
			return json({ error: 'Invalid email address format' }, { status: 400 });
		}

		const validatedEmail = emailValidation.normalizedEmail;
		const displayName = rawName?.trim() || validatedEmail.split('@')[0];

		// Check if user already exists and is verified
		const existingUser = await db.select().from(users).where(eq(users.email, validatedEmail)).limit(1);

		if (existingUser.length > 0) {
			const existing = existingUser[0];
			if (existing.emailVerified) {
				SecurityLogger.registrationFailure(validatedEmail, 'Email already exists', clientIP);
				return json({ error: 'An account with this email address already exists' }, { status: 400 });
			}
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(rawPassword, 12);

		// Store registration details in OTP metadata - deferred user creation
		const otpCode = await OtpService.createOtp(validatedEmail, 'registration', {
			name: displayName,
			passwordHash: hashedPassword,
		});

		try {
			await sendOtpEmail({
				email: validatedEmail,
				name: displayName,
				otpCode,
				expiryMinutes: OtpService.getExpiryMinutes(),
			});
			SecurityLogger.emailVerificationSent(validatedEmail, 'pending_mobile_otp');
			console.log(`[Mobile Register] OTP verification email sent to ${validatedEmail}`);
		} catch (emailErr) {
			console.error('[Mobile Register] Failed to send OTP email:', emailErr);
		}

		return json({
			requiresOtp: true,
			email: validatedEmail,
			message: 'Verification code sent to your email.'
		});

	} catch (error) {
		console.error('[Mobile Register] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal registration error' },
			{ status: 500 }
		);
	}
};
