import { describe, expect, it } from 'bun:test';
import {
  buildLanguageInstruction,
  buildToneInstruction,
  computePaymentTotals,
  extractProtectedTokens,
  isValidContextualMessage,
  isValidTranslationOutput,
  normalizeAiLanguage,
  resolveVendorSettlementEligibility,
} from '../src/common/commerce-rules';

describe('computePaymentTotals', () => {
  it('applies default 3.5% fee for electronic payment', () => {
    const res = computePaymentTotals(100, 3.5, false);
    expect(res.baseTotal).toBe(100);
    expect(res.transactionFeePercent).toBe(3.5);
    expect(res.transactionFeeAmount).toBe(3.5);
    expect(res.chargedTotal).toBe(103.5);
  });

  it('applies custom fee percentage accurately with rounding', () => {
    const res = computePaymentTotals(249.99, 2.5, false);
    expect(res.transactionFeeAmount).toBe(6.25);
    expect(res.chargedTotal).toBe(256.24);
  });

  it('waives transaction fees on cash on delivery', () => {
    const res = computePaymentTotals(150, 3.5, true);
    expect(res.transactionFeePercent).toBe(0);
    expect(res.transactionFeeAmount).toBe(0);
    expect(res.chargedTotal).toBe(150);
  });
});

describe('resolveVendorSettlementEligibility', () => {
  it('locks funds for 48h by default when immediate withdrawal is disabled', () => {
    const res = resolveVendorSettlementEligibility({
      storePayoutBlocked: false,
      hasOpenDispute: false,
      globalImmediateWithdrawal: false,
      storeImmediateWithdrawal: false,
    });
    expect(res.canReleaseImmediately).toBe(false);
    expect(res.initialTxStatus).toBe('LOCKED');
  });

  it('credits vendor wallet as AVAILABLE immediately when 48h escrow is disabled globally', () => {
    const res = resolveVendorSettlementEligibility({
      storePayoutBlocked: false,
      hasOpenDispute: false,
      globalImmediateWithdrawal: true,
      storeImmediateWithdrawal: false,
    });
    expect(res.canReleaseImmediately).toBe(true);
    expect(res.initialTxStatus).toBe('AVAILABLE');
  });

  it('credits vendor wallet as AVAILABLE immediately when store immediate withdrawal is enabled', () => {
    const res = resolveVendorSettlementEligibility({
      storePayoutBlocked: false,
      hasOpenDispute: false,
      globalImmediateWithdrawal: false,
      storeImmediateWithdrawal: true,
    });
    expect(res.canReleaseImmediately).toBe(true);
    expect(res.initialTxStatus).toBe('AVAILABLE');
  });

  it('holds funds under dispute even if 48h escrow is disabled', () => {
    const res = resolveVendorSettlementEligibility({
      storePayoutBlocked: false,
      hasOpenDispute: true,
      globalImmediateWithdrawal: true,
      storeImmediateWithdrawal: true,
    });
    expect(res.canReleaseImmediately).toBe(false);
    expect(res.initialTxStatus).toBe('HELD_FOR_DISPUTE');
  });

  it('keeps funds locked for blocked store even if 48h escrow is disabled', () => {
    const res = resolveVendorSettlementEligibility({
      storePayoutBlocked: true,
      hasOpenDispute: false,
      globalImmediateWithdrawal: true,
      storeImmediateWithdrawal: true,
    });
    expect(res.canReleaseImmediately).toBe(false);
    expect(res.initialTxStatus).toBe('LOCKED');
  });
});

describe('isValidContextualMessage', () => {
  it('accepts valid SMS under 155 chars containing required tokens', () => {
    const msg = 'Bonjour ! Commande #ZG-1042 payee (120 USD). Livraison en preparation sur ZandoGo.';
    expect(isValidContextualMessage(msg, 'sms', ['ZG-1042', '120 USD'])).toBe(true);
  });

  it('rejects SMS exceeding 155 chars', () => {
    const tooLong = 'Bonjour ! Commande #ZG-1042 (120 USD) ' + 'a'.repeat(130);
    expect(isValidContextualMessage(tooLong, 'sms', ['ZG-1042', '120 USD'])).toBe(false);
  });

  it('rejects message missing a required critical token', () => {
    const msg = 'Bonjour ! Votre commande a bien ete payee sur ZandoGo.';
    expect(isValidContextualMessage(msg, 'inapp', ['ZG-1042', '120 USD'])).toBe(false);
  });

  it('accepts longer in-app message up to 260 chars', () => {
    const msg =
      'Bonjour ! Votre commande #ZG-1042 de 120 USD est confirmee et transmise au vendeur. Merci pour votre confiance sur ZandoGo.';
    expect(isValidContextualMessage(msg, 'inapp', ['ZG-1042', '120 USD'])).toBe(true);
  });
});

describe('multilingual and tone directives', () => {
  it('returns distinct instructions for FR, SW, LN, EN', () => {
    expect(buildLanguageInstruction('fr')).toContain('français');
    expect(buildLanguageInstruction('sw')).toContain('Kiswahili');
    expect(buildLanguageInstruction('ln')).toContain('Lingala');
    expect(buildLanguageInstruction('en')).toContain('English');
  });

  it('returns distinct instructions for WARM, FORMAL, CONCISE tones', () => {
    expect(buildToneInstruction('WARM')).toContain('chaleureux');
    expect(buildToneInstruction('FORMAL')).toContain('professionnel');
    expect(buildToneInstruction('CONCISE')).toContain('ultra-concis');
  });
});

describe('chat translation guardrails', () => {
  it('normalizes supported chat languages and defaults to fr', () => {
    expect(normalizeAiLanguage('LN')).toBe('ln');
    expect(normalizeAiLanguage('sw')).toBe('sw');
    expect(normalizeAiLanguage('en')).toBe('en');
    expect(normalizeAiLanguage('unknown')).toBe('fr');
  });

  it('extracts and enforces preservation of prices, distances, and order refs in translations', () => {
    const lingala = 'Mbote ndeko, nakoki kozwa appareil oyo na $180 mpe livraison 4.5 km ? #ZG-204';
    const tokens = extractProtectedTokens(lingala);
    expect(tokens).toContain('$180');
    expect(tokens).toContain('4.5 km');
    expect(tokens).toContain('#ZG-204');

    const validFrench = 'Bonjour frère, puis-je avoir cet appareil à $180 avec livraison sur 4.5 km ? #ZG-204';
    const corruptedPrice = 'Bonjour frère, puis-je avoir cet appareil à $120 avec livraison sur 4.5 km ? #ZG-204';

    expect(isValidTranslationOutput(validFrench, lingala)).toBe(true);
    expect(isValidTranslationOutput(corruptedPrice, lingala)).toBe(false);
  });
});

