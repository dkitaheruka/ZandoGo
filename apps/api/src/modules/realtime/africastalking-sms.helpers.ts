import { timingSafeEqual } from 'crypto';

export const AFRICASTALKING_SUCCESS_CODES = new Set<number>([100, 101, 102]);

export const AFRICASTALKING_STATUS_DESCRIPTIONS: Record<number, string> = {
  100: 'Processed',
  101: 'Sent',
  102: 'Queued',
  401: 'RiskHold',
  402: 'InvalidSenderId',
  403: 'InvalidPhoneNumber',
  404: 'UnsupportedNumberType',
  405: 'InsufficientBalance',
  406: 'UserInBlacklist',
  407: 'CouldNotRoute',
  409: 'DoNotDisturbRejection',
  500: 'InternalServerError',
  501: 'GatewayError',
  502: 'RejectedByGateway',
};

export const AFRICASTALKING_NETWORK_NAMES: Record<string, string> = {
  '62120': 'Airtel Nigeria',
  '62130': 'MTN Nigeria',
  '62150': 'Glo Nigeria',
  '62160': 'Etisalat Nigeria',
  '63001': 'Vodacom RDC',
  '63002': 'Airtel RDC',
  '63086': 'Orange RDC',
  '63089': 'Africell RDC',
  '63510': 'MTN Rwanda',
  '63513': 'Tigo Rwanda',
  '63514': 'Airtel Rwanda',
  '63902': 'Safaricom Kenya',
  '63903': 'Airtel Kenya',
  '63907': 'Orange Kenya',
  '63999': 'Equitel Kenya',
  '64002': 'Tigo Tanzania',
  '64003': 'Zantel Tanzania',
  '64004': 'Vodacom Tanzania',
  '64005': 'Airtel Tanzania',
  '64007': 'TTCL Tanzania',
  '64009': 'Halotel Tanzania',
  '64101': 'Airtel Uganda',
  '64110': 'MTN Uganda',
  '64111': 'UTL Uganda',
  '64114': 'Africell Uganda',
  '65001': 'TNM Malawi',
  '65010': 'Airtel Malawi',
  '99999': 'Athena (Sandbox)',
};

export interface ParsedSmsRecipientResult {
  number: string;
  statusCode: number;
  status: string;
  cost?: string;
  messageId?: string;
  accepted: boolean;
}

export function normalizeSmsRecipient(phone: string): string {
  const cleaned = String(phone || '').replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('243') || digits.startsWith('250') || digits.startsWith('254') || digits.startsWith('256')) {
    return `+${digits}`;
  }
  return `+243${digits.replace(/^0+/, '')}`;
}

export function isSuccessSmsStatusCode(statusCode?: number): boolean {
  return typeof statusCode === 'number' && AFRICASTALKING_SUCCESS_CODES.has(statusCode);
}

export function describeSmsStatusCode(statusCode?: number): string {
  if (typeof statusCode !== 'number') return 'Unknown';
  return AFRICASTALKING_STATUS_DESCRIPTIONS[statusCode] || `Code_${statusCode}`;
}

export function resolveNetworkName(networkCode?: string): string {
  const code = String(networkCode || '').trim();
  if (!code) return 'Unknown';
  return AFRICASTALKING_NETWORK_NAMES[code] || `Telco_${code}`;
}

export function buildMessagingEndpoint(params: {
  isSandbox: boolean;
  mode: 'standard' | 'bulk_json';
}): string {
  // Documentation Africa's Talking :
  // - /version1/messaging existe en Live et Sandbox
  // - /version1/messaging/bulk (JSON) est Live (Sandbox indiqué "coming soon")
  if (params.isSandbox) {
    return 'https://api.sandbox.africastalking.com/version1/messaging';
  }
  if (params.mode === 'bulk_json') {
    return 'https://api.africastalking.com/version1/messaging/bulk';
  }
  return 'https://api.africastalking.com/version1/messaging';
}

export function parseAfricasTalkingResponse(
  payload: unknown,
  fallbackRecipient?: string,
): {
  summaryMessage: string;
  recipients: ParsedSmsRecipientResult[];
  anyAccepted: boolean;
} {
  const data = (payload && typeof payload === 'object' ? payload : {}) as {
    SMSMessageData?: {
      Message?: string;
      Recipients?: Array<{
        statusCode?: number | string;
        number?: string;
        cost?: string;
        status?: string;
        messageId?: string;
      }>;
    };
  };

  const summaryMessage = String(data.SMSMessageData?.Message || '');
  const rawRecipients = Array.isArray(data.SMSMessageData?.Recipients)
    ? data.SMSMessageData!.Recipients
    : [];

  const recipients: ParsedSmsRecipientResult[] = rawRecipients.map((r) => {
    const code = Number(r.statusCode ?? 500);
    const accepted = isSuccessSmsStatusCode(code);
    return {
      number: String(r.number || fallbackRecipient || ''),
      statusCode: Number.isFinite(code) ? code : 500,
      status: String(r.status || describeSmsStatusCode(code)),
      cost: r.cost ? String(r.cost) : undefined,
      messageId: r.messageId && r.messageId !== 'None' ? String(r.messageId) : undefined,
      accepted,
    };
  });

  return {
    summaryMessage,
    recipients,
    anyAccepted: recipients.some((r) => r.accepted),
  };
}

export function filterOptedOutRecipients(
  recipients: string[],
  optedOutNumbers: Iterable<string>,
): { allowed: string[]; excluded: string[] } {
  const blacklist = new Set<string>();
  for (const num of optedOutNumbers) {
    const normalized = normalizeSmsRecipient(num);
    if (normalized) blacklist.add(normalized);
  }

  const allowed: string[] = [];
  const excluded: string[] = [];
  const seen = new Set<string>();

  for (const raw of recipients) {
    const normalized = normalizeSmsRecipient(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    if (blacklist.has(normalized)) {
      excluded.push(normalized);
    } else {
      allowed.push(normalized);
    }
  }

  return { allowed, excluded };
}

export function verifyAfricasTalkingCallbackToken(params: {
  expectedSecret?: string;
  providedToken?: string;
  isProduction: boolean;
}): boolean {
  const expected = (params.expectedSecret || '').trim();
  const provided = (params.providedToken || '').trim();

  if (!expected) {
    // En production, fail-closed : un jeton AFRICASTALKING_WEBHOOK_TOKEN doit protéger les URLs de callback.
    return !params.isProduction;
  }

  if (!provided) return false;
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(provided, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
