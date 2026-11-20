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
import {
  buildOfficialInvoicePayload,
  computeInvoiceProofCode,
  formatInvoiceOperatorLabel,
} from '../src/modules/orders/invoice.helpers';
import { generateOfficialInvoicePdfBytes } from '../../web/src/lib/invoice-pdf';

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

describe('official downloadable invoice & PDF proof', () => {
  it('formats operators and computes deterministic SHA-256 proof code', () => {
    expect(formatInvoiceOperatorLabel('MOBILE_MONEY_MPESA')).toBe('Vodacom M-Pesa RDC');
    expect(formatInvoiceOperatorLabel('CASH_ON_DELIVERY')).toBe('Paiement Cash à la Livraison');

    const params = {
      orderId: 'ord-999',
      orderNumber: 'ZG-2026-9999',
      buyerId: 'usr-123',
      chargedTotalUsd: 108.68,
      providerReference: 'MPESA-TX-888',
      issuedAt: '2026-11-19T12:00:00.000Z',
    };
    const code1 = computeInvoiceProofCode(params);
    const code2 = computeInvoiceProofCode(params);
    expect(code1).toMatch(/^ZG-PROOF-[A-F0-9]{16}$/);
    expect(code1).toBe(code2);
  });

  it('builds complete invoice payload with exact USD/CDF totals and generates a valid A4 PDF 1.4', () => {
    const invoice = buildOfficialInvoicePayload({
      orderId: 'ord-abc-1',
      orderNumber: 'ZG-2026-4401',
      orderStatus: 'PAID',
      currency: 'USD',
      createdAt: '2026-11-19T10:00:00.000Z',
      paidAt: '2026-11-19T10:02:00.000Z',
      subtotalUsd: 100,
      deliveryFeeUsd: 5,
      exchangeRateUsdToCdf: 2850,
      isPaid: true,
      paymentMethodCode: 'MOBILE_MONEY_AIRTEL',
      providerReference: 'AIRTEL-991234',
      buyer: {
        id: 'buyer-1',
        fullName: 'Amani Kasongo',
        phone: '+243998112233',
        email: 'amani@zandogo.cd',
      },
      deliveryAddress: {
        commune: 'Goma',
        quartier: 'Himbi',
        ville: 'Goma',
        referencePoint: 'Pres du Rond-Point Birere',
      },
      stores: [{ storeId: 'st-1', storeName: 'Kivu Tech Store', subtotalUsd: 100 }],
      items: [
        {
          title: 'Smartphone 5G Zando',
          storeName: 'Kivu Tech Store',
          variantLabel: 'Noir 128Go',
          productType: 'PHYSICAL',
          quantity: 1,
          unitPriceUsd: 100,
          totalPriceUsd: 100,
        },
      ],
    });

    expect(invoice.invoiceNumber).toBe('FAC-ZG-2026-4401');
    expect(invoice.totals.transactionFeePercent).toBe(3.5);
    expect(invoice.totals.transactionFeeAmountUsd).toBe(3.68);
    expect(invoice.totals.chargedTotalUsd).toBe(108.68);
    expect(invoice.totals.chargedTotalCdf).toBe(Math.round(108.68 * 2850));
    expect(invoice.payment.operatorLabel).toBe('Airtel Money RDC');
    expect(invoice.verification.verifiedPurchase).toBe(true);
    expect(invoice.verification.proofCode).toMatch(/^ZG-PROOF-[A-F0-9]{16}$/);

    const pdfBytes = generateOfficialInvoicePdfBytes(invoice);
    const pdfText = Buffer.from(pdfBytes).toString('latin1');
    expect(pdfText.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdfText.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdfText).toContain('FAC-ZG-2026-4401');
    expect(pdfText).toContain('Amani Kasongo');
    expect(pdfText).toContain(invoice.verification.proofCode);
    expect(pdfText).toContain('AIRTEL-991234');
  });

  it('waives transaction fees on cash on delivery invoices', () => {
    const invoice = buildOfficialInvoicePayload({
      orderId: 'ord-cod-1',
      orderNumber: 'ZG-2026-5501',
      orderStatus: 'CONFIRMED',
      currency: 'USD',
      createdAt: '2026-11-19T11:00:00.000Z',
      subtotalUsd: 50,
      deliveryFeeUsd: 4,
      exchangeRateUsdToCdf: 2850,
      isPaid: false,
      paymentMethodCode: 'CASH_ON_DELIVERY',
      buyer: { id: 'buyer-2', fullName: 'Mireille Neema' },
      stores: [{ storeId: 'st-1', storeName: 'Goma Mode', subtotalUsd: 50 }],
      items: [
        {
          title: 'Robe Wax Royale',
          storeName: 'Goma Mode',
          quantity: 1,
          unitPriceUsd: 50,
          totalPriceUsd: 50,
        },
      ],
    });

    expect(invoice.totals.transactionFeePercent).toBe(0);
    expect(invoice.totals.transactionFeeAmountUsd).toBe(0);
    expect(invoice.totals.chargedTotalUsd).toBe(54);
  });
});

