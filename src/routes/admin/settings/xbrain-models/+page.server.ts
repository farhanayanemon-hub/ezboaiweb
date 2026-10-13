import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { loadXBrainConfig, saveXBrainConfig, DEFAULTS, DEFAULT_ROUTER_MODEL, type Tier, type XBrainModelConfig } from '$lib/server/xbrain-config';

const TIERS: Tier[] = ['free', 'pro', 'thinking'];
const CATS = ['code','math','creative','factual','conversation','analysis','vision'] as const;

export const load: PageServerLoad = async () => {
  const { configs, routerModel } = await loadXBrainConfig(true);
  return { configs, routerModel, defaults: DEFAULTS, defaultRouterModel: DEFAULT_ROUTER_MODEL };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const data = await request.formData();
    try {
      const configs: Record<Tier, XBrainModelConfig> = JSON.parse(JSON.stringify(DEFAULTS));
      for (const tier of TIERS) {
        const c = configs[tier];
        c.enabled = data.get(`${tier}_enabled`) === 'on';
        c.displayName = (data.get(`${tier}_displayName`) as string || c.displayName).trim();
        c.description = (data.get(`${tier}_description`) as string || '').trim();
        c.systemPrompt = (data.get(`${tier}_systemPrompt`) as string || c.systemPrompt).trim();
        const mt = parseInt((data.get(`${tier}_maxTokens`) as string) || '0', 10);
        if (mt >= 256 && mt <= 200000) c.maxTokens = mt;
        const tp = parseFloat((data.get(`${tier}_temperature`) as string) || '');
        if (!isNaN(tp) && tp >= 0 && tp <= 2) c.temperature = tp;
        c.defaultModel = (data.get(`${tier}_defaultModel`) as string || c.defaultModel).trim();
        for (const cat of CATS) {
          const v = (data.get(`${tier}_route_${cat}`) as string || '').trim();
          if (v) c.routes[cat] = v;
        }
      }
      const routerModel = ((data.get('routerModel') as string) || DEFAULT_ROUTER_MODEL).trim();
      await saveXBrainConfig(configs, routerModel);
      return { success: true, message: 'Ezbo model settings saved successfully.' };
    } catch (e: any) {
      return fail(500, { error: e?.message || 'Failed to save settings' });
    }
  },
  reset: async () => {
    try {
      await saveXBrainConfig(DEFAULTS, DEFAULT_ROUTER_MODEL);
      return { success: true, message: 'Reset to defaults.' };
    } catch (e: any) {
      return fail(500, { error: e?.message || 'Reset failed' });
    }
  },
};
