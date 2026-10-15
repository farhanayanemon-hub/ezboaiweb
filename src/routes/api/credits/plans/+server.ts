import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db, creditPlans } from '$lib/server/db/index.js';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		const plans = await db
			.select()
			.from(creditPlans)
			.where(eq(creditPlans.isActive, true))
			.orderBy(desc(creditPlans.isPopular), desc(creditPlans.createdAt));

		return json({ creditPlans: plans });
	} catch (error) {
		console.error('Error fetching public credit plans:', error);
		return json({ creditPlans: [] });
	}
};
