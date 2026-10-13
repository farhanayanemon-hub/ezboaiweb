import { adminSettingsService } from './admin-settings.js';

export type GatewayId = 'paypal' | 'wise' | 'skrill' | 'binance' | 'bybit' | 'bkash' | 'nagad' | 'rocket';

export interface ManualGateway {
  id: GatewayId;
  name: string;
  icon: string; // emoji or simple svg-name
  enabled: boolean;
  accountInfo: string;     // email / wallet / username
  displayName: string;     // e.g. "Pay with PayPal"
  instructions: string;    // English instructions shown to user
  iconUrl: string;         // Optional uploaded logo URL (overrides emoji icon)
}

export const GATEWAY_DEFAULTS: Record<GatewayId, Omit<ManualGateway, 'id'>> = {
  bkash:   { name: 'bKash',   icon: '📱', enabled: true, accountInfo: '01886882299 (Personal)', displayName: 'bKash (Send Money)',
             instructions: 'Send the exact amount in BDT via Send Money to the bKash personal number above. Use your username or email as reference. After sending, copy the TrxID and paste it below. Order will be verified and activated within 15–60 minutes.', iconUrl: '' },
  nagad:   { name: 'Nagad',   icon: '📲', enabled: true, accountInfo: '01886882299 (Personal)', displayName: 'Nagad (Send Money)',
             instructions: 'Send the exact amount in BDT via Send Money to the Nagad personal number above. After sending, copy the TrxID and paste it below with your sender phone number. Order activated within 15–60 minutes.', iconUrl: '' },
  rocket:  { name: 'Rocket',  icon: '🚀', enabled: true, accountInfo: '01886882299-8 (Personal)', displayName: 'Rocket (Send Money)',
             instructions: 'Send the exact amount in BDT via Send Money to the Rocket personal number above. After sending, copy the TrxID and submit it below with your sender phone number.', iconUrl: '' },
  binance: { name: 'Binance', icon: '🪙', enabled: true, accountInfo: 'ezboai@binance (Pay ID: 382910291)', displayName: 'Binance Pay (USDT)',
             instructions: 'Send the equivalent USDT (TRC20 or BEP20) to the Binance Pay ID / address above. After sending, copy the Binance transaction ID (TxID/UID) and paste it below with the network used. Activation within 30 minutes – 6 hours.', iconUrl: '' },
  bybit:   { name: 'Bybit',   icon: '🟡', enabled: true, accountInfo: 'ezboai@bybit (UID: 49201928)', displayName: 'Bybit (USDT)',
             instructions: 'Send the equivalent USDT (TRC20/BEP20) to our Bybit UID / wallet above. After sending, copy the Bybit TxID/Order ID and submit below. We activate within 30 minutes – 6 hours after on-chain confirmation.', iconUrl: '' },
  wise:    { name: 'Wise',    icon: '🌐', enabled: true, accountInfo: 'billing@ezboai.com', displayName: 'Wise (TransferWise)',
             instructions: 'Send the exact amount in USD/EUR to the Wise email/account above. After payment, copy the Wise transaction reference and paste it below with sender name. We verify and activate within 1–24 hours.', iconUrl: '' },
  paypal:  { name: 'PayPal',  icon: '💳', enabled: true, accountInfo: 'billing@ezboai.com', displayName: 'PayPal',
             instructions: 'Send the exact amount in USD to our PayPal email above as "Friends & Family" (no fees). After sending, copy the PayPal Transaction ID and paste it in the field below. Order will be activated within 1–6 hours after verification.', iconUrl: '' },
  skrill:  { name: 'Skrill',  icon: '💸', enabled: true, accountInfo: 'billing@ezboai.com', displayName: 'Skrill',
             instructions: 'Send the exact USD amount to our Skrill email above. After sending, copy the Skrill transaction ID and submit it below. We will verify and activate your subscription within 1–6 hours.', iconUrl: '' },
};

const KEYS = ['enabled', 'accountInfo', 'displayName', 'instructions', 'iconUrl'] as const;
const k = (id: GatewayId, field: string) => `manual_gateway_${id}_${field}`;

export async function loadAllGateways(): Promise<ManualGateway[]> {
  const out: ManualGateway[] = [];
  for (const id of Object.keys(GATEWAY_DEFAULTS) as GatewayId[]) {
    const d = GATEWAY_DEFAULTS[id];
    const g: ManualGateway = { id, ...d };
    for (const f of KEYS) {
      const v = await adminSettingsService.getSetting(k(id, f));
      if (v !== null) {
        if (f === 'enabled') g.enabled = v === 'true';
        else (g as any)[f] = v;
      }
    }
    out.push(g);
  }
  return out;
}

export async function saveGateway(id: GatewayId, fields: Partial<ManualGateway>): Promise<void> {
  for (const f of KEYS) {
    if (fields[f as keyof ManualGateway] === undefined) continue;
    const val = String(fields[f as keyof ManualGateway]);
    await adminSettingsService.setSetting(k(id, f), val, 'manual_gateways');
  }
}

export async function getEnabledGateways(): Promise<ManualGateway[]> {
  return (await loadAllGateways()).filter(g => g.enabled);
}
