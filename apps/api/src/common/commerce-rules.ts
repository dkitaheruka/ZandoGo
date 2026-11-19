export type SupportedAiLanguage = 'fr' | 'sw' | 'ln' | 'en';
export type AiMessageTone = 'WARM' | 'FORMAL' | 'CONCISE';

export interface ChargeCalculationResult {
  baseTotal: number;
  transactionFeePercent: number;
  transactionFeeAmount: number;
  chargedTotal: number;
}

export function computePaymentTotals(
  baseTotalRaw: number,
  feePercentRaw: number,
  isCashOnDelivery: boolean,
): ChargeCalculationResult {
  const baseTotal = Math.max(0, Number(baseTotalRaw || 0));
  if (isCashOnDelivery) {
    return {
      baseTotal,
      transactionFeePercent: 0,
      transactionFeeAmount: 0,
      chargedTotal: Number(baseTotal.toFixed(2)),
    };
  }
  const transactionFeePercent = Math.max(0, Number(feePercentRaw ?? 3.5));
  const transactionFeeAmount = Number((baseTotal * (transactionFeePercent / 100)).toFixed(2));
  const chargedTotal = Number((baseTotal + transactionFeeAmount).toFixed(2));
  return {
    baseTotal,
    transactionFeePercent,
    transactionFeeAmount,
    chargedTotal,
  };
}

export function resolveVendorSettlementEligibility(params: {
  storePayoutBlocked: boolean;
  hasOpenDispute: boolean;
  globalImmediateWithdrawal: boolean;
  storeImmediateWithdrawal: boolean;
}): {
  canReleaseImmediately: boolean;
  initialTxStatus: 'AVAILABLE' | 'LOCKED' | 'HELD_FOR_DISPUTE';
} {
  if (params.hasOpenDispute) {
    return { canReleaseImmediately: false, initialTxStatus: 'HELD_FOR_DISPUTE' };
  }
  if (params.storePayoutBlocked) {
    return { canReleaseImmediately: false, initialTxStatus: 'LOCKED' };
  }
  if (params.globalImmediateWithdrawal || params.storeImmediateWithdrawal) {
    return { canReleaseImmediately: true, initialTxStatus: 'AVAILABLE' };
  }
  return { canReleaseImmediately: false, initialTxStatus: 'LOCKED' };
}

export function isValidContextualMessage(
  candidate: string,
  channel: 'inapp' | 'sms',
  requiredTokens: string[],
): boolean {
  const maxChars = channel === 'sms' ? 155 : 260;
  const normalized = candidate.trim();
  if (!normalized || normalized.length > maxChars) return false;
  return requiredTokens
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .every((tok) => normalized.includes(tok));
}

export function buildLanguageInstruction(language?: string): string {
  switch (language) {
    case 'sw':
      return 'Réponds en Kiswahili ya Kongo (Swahili de Goma/Est-RDC) naturel, clair, poli et commerçant.';
    case 'ln':
      return 'Réponds en Lingala ya RDC (Kinshasa/commerce) naturel, clair, respectueux et facile à comprendre.';
    case 'en':
      return 'Respond in clear, polite, concise English suitable for East/Central Africa marketplace commerce.';
    default:
      return 'Réponds toujours en français clair, concret, poli et concis.';
  }
}

export function buildToneInstruction(tone?: AiMessageTone): string {
  if (tone === 'FORMAL') {
    return 'Adopte un ton professionnel, institutionnel, courtois et sobre.';
  }
  if (tone === 'CONCISE') {
    return 'Adopte un ton direct, ultra-concis, factuel et amical.';
  }
  return 'Adopte un ton chaleureux, humain, proche et rassurant (ex: "Bonjour", "Merci pour votre confiance").';
}

export const AI_LANGUAGE_LABELS: Record<SupportedAiLanguage, string> = {
  fr: 'Français',
  ln: 'Lingala',
  sw: 'Kiswahili',
  en: 'English',
};

export function normalizeAiLanguage(lang?: string | null): SupportedAiLanguage {
  const v = String(lang || '').trim().toLowerCase();
  if (v === 'ln' || v === 'sw' || v === 'en' || v === 'fr') {
    return v;
  }
  return 'fr';
}

export function extractProtectedTokens(text: string): string[] {
  const matches = text.match(/(https?:\/\/[^\s]+|#[A-Z0-9-]+|\$\s?\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s?(?:USD|CDF|km)\b)/gi);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.trim()))).slice(0, 8);
}

export function isValidTranslationOutput(translated: string, original: string): boolean {
  const clean = translated.trim();
  if (!clean || clean.length > 4000) return false;
  const protectedTokens = extractProtectedTokens(original);
  return protectedTokens.every((tok) => {
    const compact = tok.replace(/\s+/g, '');
    return clean.includes(tok) || clean.replace(/\s+/g, '').includes(compact);
  });
}

