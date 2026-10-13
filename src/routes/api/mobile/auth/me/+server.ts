import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, users } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import { CreditService } from '$lib/server/credit-service.js';
import { isDemoModeEnabled, DEMO_MODE_MESSAGES } from '$lib/constants/demo-mode.js';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const [user] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				planTier: users.planTier,
				isAdmin: users.isAdmin,
				profession: users.profession,
				personalInstructions: users.personalInstructions,
				subscriptionStatus: users.subscriptionStatus,
				createdAt: users.createdAt,
			})
			.from(users)
			.where(eq(users.id, session.user.id))
			.limit(1);

		if (!user) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		let credits = { text: 0, image: 0, video: 0, audio: 0 };
		try {
			credits = await CreditService.getUserCredits(user.id);
		} catch (creditErr) {
			console.warn('[Mobile Me] Failed to fetch credits:', creditErr);
		}

		return json({
			user,
			credits
		});

	} catch (error) {
		console.error('[Mobile Me] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	try {
		if (isDemoModeEnabled()) {
			return json({ error: DEMO_MODE_MESSAGES.ADMIN_SAVE_DISABLED }, { status: 403 });
		}

		const session = await locals.auth();
		if (!session?.user?.id) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { name, profession, personalInstructions, image } = body;

		const updateData: Partial<typeof users.$inferInsert> = {};

		if (name !== undefined) {
			const trimmedName = name?.trim();
			if (!trimmedName) {
				return json({ error: 'Name cannot be empty' }, { status: 400 });
			}
			updateData.name = trimmedName;
		}

		if (profession !== undefined) {
			updateData.profession = profession?.trim() || null;
		}

		if (personalInstructions !== undefined) {
			if (personalInstructions && personalInstructions.length > 2000) {
				return json({ error: 'Custom instructions must be 2000 characters or less' }, { status: 400 });
			}
			updateData.personalInstructions = personalInstructions?.trim() || null;
		}

		if (image !== undefined) {
			updateData.image = image?.trim() || null;
		}

		if (Object.keys(updateData).length > 0) {
			await db.update(users)
				.set(updateData)
				.where(eq(users.id, session.user.id));
		}

		const [updatedUser] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				planTier: users.planTier,
				isAdmin: users.isAdmin,
				profession: users.profession,
				personalInstructions: users.personalInstructions,
				subscriptionStatus: users.subscriptionStatus,
			})
			.from(users)
			.where(eq(users.id, session.user.id))
			.limit(1);

		return json({
			success: true,
			user: updatedUser
		});

	} catch (error) {
		console.error('[Mobile Profile Update] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal update error' },
			{ status: 500 }
		);
	}
};
