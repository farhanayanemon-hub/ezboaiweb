import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async () => {
  throw redirect(302, '/downloads/ezboai.apk');
};
