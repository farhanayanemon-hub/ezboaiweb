import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users, accounts } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';
import { CreditService } from '$lib/server/credit-service.js';
import { SecurityLogger } from '$lib/server/security-monitoring.js';
import { getClientIP } from '$lib/server/rate-limiting.js';
import { randomUUID } from 'crypto';

interface GoogleTokenInfo {
	email?: string;
	email_verified?: string | boolean;
	name?: string;
	picture?: string;
	sub?: string;
	error_description?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { idToken, email: directEmail, name: directName, picture: directPicture, googleId: directGoogleId } = body;
		const clientIP = getClientIP(request);

		let userEmail = directEmail?.trim().toLowerCase();
		let userName = directName?.trim();
		let userPicture = directPicture;
		let googleId = directGoogleId;

		// If an idToken is provided, verify it directly with Google's API
		if (idToken) {
			try {
				const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
				if (verifyRes.ok) {
					const data = (await verifyRes.json()) as GoogleTokenInfo;
					if (data.email) {
						userEmail = data.email.toLowerCase();
						userName = data.name || userName;
						userPicture = data.picture || userPicture;
						googleId = data.sub || googleId;
					}
				} else {
					console.warn('[Mobile Google Auth] Token verification failed from Google API, falling back to body data if valid');
				}
			} catch (vErr) {
				console.warn('[Mobile Google Auth] Error calling Google tokeninfo:', vErr);
			}
		}

		if (!userEmail) {
			return json({ error: 'Valid Google email is required' }, { status: 400 });
		}

		// Check if user exists in database
		let [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, userEmail))
			.limit(1);

		if (!user) {
			// Register new user via Google
			const newUserId = randomUUID();
			const now = new Date();

			await db.insert(users).values({
				id: newUserId,
				name: userName || userEmail.split('@')[0],
				email: userEmail,
				image: userPicture || null,
				emailVerified: now,
				planTier: 'free',
				subscriptionStatus: 'active',
				createdAt: now,
				updatedAt: now,
			});

			if (googleId) {
				try {
					await db.insert(accounts).values({
						id: randomUUID(),
						userId: newUserId,
						type: 'oauth',
						provider: 'google',
						providerAccountId: googleId,
					});
				} catch (accErr) {
					console.warn('[Mobile Google Auth] Could not insert account link:', accErr);
				}
			}

			try {
				await CreditService.initializeUserCredits(newUserId);
			} catch (creditErr) {
				console.warn('[Mobile Google Auth] Failed to initialize credits:', creditErr);
			}

			[user] = await db
				.select()
				.from(users)
				.where(eq(users.id, newUserId))
				.limit(1);
		} else {
			// If existing user doesn't have verified email or picture, update it
			if (!user.emailVerified || (!user.image && userPicture)) {
				await db
					.update(users)
					.set({
						emailVerified: user.emailVerified || new Date(),
						image: user.image || userPicture || null,
						updatedAt: new Date(),
					})
					.where(eq(users.id, user.id));
			}
		}

		const secret = env.AUTH_SECRET || 'ezboai-auth-secret';
		const token = jwt.sign(
			{
				sub: user.id,
				id: user.id,
				email: user.email,
				name: user.name,
				isAdmin: user.isAdmin,
				planTier: user.planTier || 'free',
			},
			secret,
			{ expiresIn: '30d' }
		);

		SecurityLogger.loginSuccess(user.id, user.email || '', clientIP);

		let credits = { text: 0, image: 0, video: 0, audio: 0 };
		try {
			credits = await CreditService.getUserCredits(user.id);
		} catch (creditErr) {
			console.warn('[Mobile Google Auth] Failed to fetch credits:', creditErr);
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
				subscriptionStatus: user.subscriptionStatus,
			},
			credits,
		});
	} catch (error) {
		console.error('[Mobile Google Auth] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Google authentication failed' },
			{ status: 500 }
		);
	}
};
