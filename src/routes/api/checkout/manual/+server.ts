import type { RequestHandler } from './$types';
import { json, error as svelteError } from '@sveltejs/kit';
import { db, pricingPlans, manualOrders, users, creditPlans } from '$lib/server/db/index.js';
import { eq } from 'drizzle-orm';
import { getEnabledGateways, type GatewayId } from '$lib/server/manual-gateways.js';
import { sendAdminOrderNotification } from '$lib/server/email.js';
import { z } from 'zod/v4';

const Body = z.object({
  // Either planId (subscription) OR creditPlanId (credit pack) must be provided
  planId: z.string().min(1).optional(),
  creditPlanId: z.string().min(1).optional(),
  gateway: z.enum(['paypal', 'wise', 'skrill', 'binance', 'bybit', 'bkash', 'nagad', 'rocket', 'manual']),
  txnReference: z.string().min(2).max(200),
  senderInfo: z.string().max(200).nullable().optional(),
  userNotes: z.string().max(1000).nullable().optional(),
}).refine((d) => !!(d.planId || d.creditPlanId), {
  message: 'Either planId or creditPlanId is required',
});

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = await locals.auth();
  if (!session?.user?.id) throw svelteError(401, 'Not authenticated');

  let body;
  try { body = Body.parse(await request.json()); }
  catch (e: any) { throw svelteError(400, 'Invalid request: ' + (e?.message || 'bad body')); }

  // Verify gateway is enabled
  const enabled = await getEnabledGateways();
  if (!enabled.find((g) => g.id === body.gateway)) {
    throw svelteError(400, 'This payment method is not currently available');
  }

  // Get user info
  const [u] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  // Branch on order type: subscription (pricingPlans) or credit (creditPlans)
  let orderType: 'subscription' | 'credit';
  let orderInsert: any = {
    userId: session.user.id,
    userEmail: u?.email || session.user.email || null,
    gateway: body.gateway as GatewayId,
    status: 'new',
    txnReference: body.txnReference,
    senderInfo: body.senderInfo || null,
    userNotes: body.userNotes || null,
  };
  let notifyPlanName: string;
  let notifyAmount: number;
  let notifyCurrency: string;

  if (body.creditPlanId) {
    orderType = 'credit';
    const [plan] = await db.select().from(creditPlans).where(eq(creditPlans.id, body.creditPlanId)).limit(1);
    if (!plan || !plan.isActive) throw svelteError(404, 'Credit plan not found');
    orderInsert = {
      ...orderInsert,
      orderType: 'credit',
      creditPlanId: plan.id,
      planId: null,
      planName: plan.name,
      planTier: null,
      amount: plan.priceAmount,
      currency: plan.currency,
    };
    notifyPlanName = plan.name;
    notifyAmount = plan.priceAmount / 100;
    notifyCurrency = plan.currency;
  } else {
    orderType = 'subscription';
    const [plan] = await db.select().from(pricingPlans).where(eq(pricingPlans.id, body.planId!)).limit(1);
    if (!plan || !plan.isActive) throw svelteError(404, 'Plan not found');
    orderInsert = {
      ...orderInsert,
      orderType: 'subscription',
      planId: plan.id,
      planName: plan.name,
      planTier: plan.tier as any,
      amount: plan.priceAmount,
      currency: plan.currency,
    };
    notifyPlanName = plan.name;
    notifyAmount = plan.priceAmount / 100;
    notifyCurrency = plan.currency;
  }

  const [order] = await db.insert(manualOrders).values(orderInsert).returning();

  // Notify admin (non-blocking)
  void sendAdminOrderNotification({
    source: 'manual',
    orderType,
    userId: session.user.id,
    userEmail: u?.email || session.user.email || null,
    userName: u?.name || null,
    planName: notifyPlanName,
    amount: notifyAmount,
    currency: notifyCurrency,
    gateway: body.gateway,
    txnReference: body.txnReference,
    senderInfo: body.senderInfo || null,
    userNotes: body.userNotes || null,
    orderId: order.id,
    status: 'pending-verification',
  });

  return json({ ok: true, orderId: order.id });
};
