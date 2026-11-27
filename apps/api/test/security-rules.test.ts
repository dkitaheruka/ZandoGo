import { describe, expect, it } from 'bun:test';
import {
  LoginAttemptTracker,
  hasValidFileMagicBytes,
  isSafeChatAttachmentUrl,
  isSafeMediaReference,
  isSafePaymentRedirectUrl,
  getPrimaryAppUrl,
  parseAllowedCorsOrigins,
  shouldConfirmGatewayPayment,
  validateJwtSecretsConfig,
} from '../src/common/security-rules';

describe('validateJwtSecretsConfig', () => {
  it('rejects missing or identical JWT secrets', () => {
    expect(() =>
      validateJwtSecretsConfig({ accessSecret: '', refreshSecret: 'abc', isProduction: false }),
    ).toThrow();
    expect(() =>
      validateJwtSecretsConfig({
        accessSecret: 'same-secret-value-1234567890123456',
        refreshSecret: 'same-secret-value-1234567890123456',
        isProduction: true,
      }),
    ).toThrow();
  });

  it('rejects short or placeholder secrets in production', () => {
    expect(() =>
      validateJwtSecretsConfig({
        accessSecret: 'short-access',
        refreshSecret: 'short-refresh',
        isProduction: true,
      }),
    ).toThrow();

    expect(() =>
      validateJwtSecretsConfig({
        accessSecret: 'changeme-access-secret-value-1234567890',
        refreshSecret: 'distinct-strong-refresh-secret-9876543210',
        isProduction: true,
      }),
    ).toThrow();
  });

  it('accepts distinct >= 32 char secrets in production', () => {
    expect(() =>
      validateJwtSecretsConfig({
        accessSecret: 'ZG_Prod_Access_9f4b2a1e8c7d6e5f4a3b2c1d0e9f8a7b',
        refreshSecret: 'ZG_Prod_Refresh_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
        isProduction: true,
      }),
    ).not.toThrow();
  });
});

describe('getPrimaryAppUrl', () => {
  it('uses the first configured origin as the external callback base URL', () => {
    expect(getPrimaryAppUrl('https://public.example, http://localhost:3000/')).toBe(
      'https://public.example',
    );
    expect(getPrimaryAppUrl('')).toBe('');
  });
});

describe('shouldConfirmGatewayPayment (fail-closed)', () => {
  it('never confirms when signature verification fails', () => {
    expect(
      shouldConfirmGatewayPayment({
        isProduction: false,
        hasLiveCredentials: false,
        signatureVerified: false,
        liveCheckVerified: true,
        livePaymentStatus: 'SUCCESS',
        declaredSuccess: true,
      }),
    ).toBe(false);
  });

  it('fails closed when live credentials are active and server check fails or returns non-SUCCESS', () => {
    expect(
      shouldConfirmGatewayPayment({
        isProduction: true,
        hasLiveCredentials: true,
        signatureVerified: true,
        liveCheckVerified: false,
        livePaymentStatus: 'PENDING',
        declaredSuccess: true,
      }),
    ).toBe(false);

    expect(
      shouldConfirmGatewayPayment({
        isProduction: true,
        hasLiveCredentials: true,
        signatureVerified: true,
        liveCheckVerified: true,
        livePaymentStatus: 'PENDING',
        declaredSuccess: true,
      }),
    ).toBe(false);
  });

  it('never auto-confirms in production without live verification', () => {
    expect(
      shouldConfirmGatewayPayment({
        isProduction: true,
        hasLiveCredentials: false,
        signatureVerified: true,
        liveCheckVerified: false,
        livePaymentStatus: 'PENDING',
        declaredSuccess: true,
      }),
    ).toBe(false);
  });

  it('confirms only when live check verifies SUCCESS (or in local sandbox)', () => {
    expect(
      shouldConfirmGatewayPayment({
        isProduction: true,
        hasLiveCredentials: true,
        signatureVerified: true,
        liveCheckVerified: true,
        livePaymentStatus: 'SUCCESS',
        declaredSuccess: true,
      }),
    ).toBe(true);

    expect(
      shouldConfirmGatewayPayment({
        isProduction: false,
        hasLiveCredentials: false,
        signatureVerified: true,
        liveCheckVerified: false,
        livePaymentStatus: 'PENDING',
        declaredSuccess: true,
      }),
    ).toBe(true);
  });
});

describe('parseAllowedCorsOrigins & isSafePaymentRedirectUrl', () => {
  it('accepts multiple HTTPS origins in production and rejects plain HTTP', () => {
    const origins = parseAllowedCorsOrigins(
      'https://zandogo.cd/, http://evil.example, https://app.zandogo.cd',
      true,
    );
    expect(origins).toEqual(['https://zandogo.cd', 'https://app.zandogo.cd']);
  });

  it('allows only https payment redirects in production and blocks javascript/http URLs', () => {
    expect(isSafePaymentRedirectUrl('https://checkout.stripe.com/pay/cs_123', true)).toBe(true);
    expect(isSafePaymentRedirectUrl('http://insecure.example.com/pay', true)).toBe(false);
    expect(isSafePaymentRedirectUrl('javascript:alert(1)', false)).toBe(false);
    expect(isSafePaymentRedirectUrl('http://localhost:3000/callback', false)).toBe(true);
  });
});

describe('hasValidFileMagicBytes', () => {
  it('accepts genuine JPEG, PNG, and PDF headers and rejects spoofed HTML/executables', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPdf = Buffer.from('%PDF-1.7\n', 'ascii');
    const spoofedHtml = Buffer.from('<html><script>alert(1)</script></html>', 'utf8');

    expect(hasValidFileMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
    expect(hasValidFileMagicBytes(validPng, 'image/png')).toBe(true);
    expect(hasValidFileMagicBytes(validPdf, 'application/pdf')).toBe(true);
    expect(hasValidFileMagicBytes(spoofedHtml, 'image/jpeg')).toBe(false);
    expect(hasValidFileMagicBytes(spoofedHtml, 'application/pdf')).toBe(false);

    const validMp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
    const validWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f]);
    expect(hasValidFileMagicBytes(validMp4, 'video/mp4')).toBe(true);
    expect(hasValidFileMagicBytes(validWebm, 'video/webm')).toBe(true);
    expect(hasValidFileMagicBytes(spoofedHtml, 'video/mp4')).toBe(false);
  });

  it('validates safe chat photo attachment URLs and blocks SVG/XSS payloads', () => {
    expect(isSafeChatAttachmentUrl('chat/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg')).toBe(true);
    expect(isSafeChatAttachmentUrl('https://cdn.zandogo.cd/chat/photo.webp')).toBe(true);
    expect(isSafeChatAttachmentUrl('https://cdn.zandogo.cd/chat/xss.svg')).toBe(false);
    expect(isSafeChatAttachmentUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true);
    expect(isSafeChatAttachmentUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isSafeChatAttachmentUrl('javascript:alert(1)')).toBe(false);
  });

  it('validates dispute evidence and delivery proof media references with prefix & XSS protections', () => {
    const disputeKey = 'disputes/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png';
    const proofKey = 'delivery-proofs/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg';

    expect(isSafeMediaReference(disputeKey, ['disputes'])).toBe(true);
    expect(isSafeMediaReference(proofKey, ['disputes'])).toBe(false);
    expect(isSafeMediaReference(proofKey, ['delivery-proofs'])).toBe(true);
    expect(
      isSafeMediaReference(
        '/api/uploads/local/disputes/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.jpg?expires=9999&sig=abc',
        ['disputes'],
      ),
    ).toBe(true);
    expect(isSafeMediaReference('data:image/png;base64,iVBORw0KGgo=', ['disputes'])).toBe(true);
    expect(isSafeMediaReference('data:image/svg+xml;base64,PHN2Zz4=', ['disputes'])).toBe(false);
    expect(isSafeMediaReference('https://evil.example/payload.svg', ['disputes'])).toBe(false);
    expect(isSafeMediaReference('../etc/passwd', ['disputes'])).toBe(false);
  });
});

describe('LoginAttemptTracker', () => {
  it('locks account after 5 consecutive failures and resets on success', () => {
    const tracker = new LoginAttemptTracker(5, 60_000, 300_000);
    const id = 'client@zandogo.cd';
    const t0 = 1_700_000_000_000;

    for (let i = 0; i < 4; i++) {
      const res = tracker.recordFailure(id, t0 + i * 1000);
      expect(res.locked).toBe(false);
    }

    const fifth = tracker.recordFailure(id, t0 + 5000);
    expect(fifth.locked).toBe(true);
    expect(tracker.isLocked(id, t0 + 60_000).locked).toBe(true);
    expect(tracker.isLocked(id, t0 + 5000 + 301_000).locked).toBe(false);

    tracker.recordSuccess(id);
    expect(tracker.isLocked(id, t0 + 6000).locked).toBe(false);
  });
});
