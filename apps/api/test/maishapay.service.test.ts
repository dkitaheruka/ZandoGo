import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { MaishaPayService } from '../src/modules/payments/maishapay.service';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('MaishaPay two-key configuration', () => {
  it('uses the public key as bearer auth and sends both keys in live mode', async () => {
    let requestInit: RequestInit | undefined;
    globalThis.fetch = async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ data: { transaction_id: 'provider-tx' } }), {
        status: 200,
      });
    };

    const config = new ConfigService({
      NODE_ENV: 'production',
      MAISHAPAY_GATEWAY_MODE: 'production',
      MAISHAPAY_API_KEY: 'public-key-without-prefix',
      MAISHAPAY_SECRET_KEY: 'secret-key',
    });
    const service = new MaishaPayService(config);

    expect(service.isLiveConfigured).toBe(true);
    await service.initiateMobileMoneyPayment({
      transactionReference: 'order-ref',
      amount: 10,
      currency: 'USD',
      provider: 'MPESA',
      customerPhone: '+243810000001',
      customerName: 'Demo Buyer',
      callbackUrl: 'https://example.test/callback',
    });

    expect(new Headers(requestInit?.headers).get('authorization')).toBe(
      'Bearer public-key-without-prefix',
    );
    const payload = JSON.parse(String(requestInit?.body));
    expect(payload.publicApiKey).toBe('public-key-without-prefix');
    expect(payload.secretApiKey).toBe('secret-key');
    expect(payload.gatewayMode).toBe('1');
  });

  it('surfaces provider HTTP errors instead of returning a pending payment', async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status_code: 400,
          errors: { message: 'Merchant account not found, Please enter the correct APIKey' },
        }),
        { status: 400 },
      );

    const service = new MaishaPayService(
      new ConfigService({
        NODE_ENV: 'development',
        MAISHAPAY_GATEWAY_MODE: 'sandbox',
        MAISHAPAY_API_KEY: 'invalid-sandbox-key',
        MAISHAPAY_SECRET_KEY: 'sandbox-secret',
      }),
    );

    await expect(
      service.initiateMobileMoneyPayment({
        transactionReference: 'order-ref',
        amount: 10,
        currency: 'USD',
        provider: 'MPESA',
        customerPhone: '+243810000001',
        customerName: 'Demo Buyer',
        callbackUrl: 'http://localhost:3000/api/payments/callbacks/gateway',
      }),
    ).rejects.toThrow('Merchant account not found');
  });

  it('normalizes numeric provider transaction IDs to strings', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { transaction_id: 276949 } }), { status: 200 });

    const service = new MaishaPayService(
      new ConfigService({
        NODE_ENV: 'development',
        MAISHAPAY_GATEWAY_MODE: 'sandbox',
        MAISHAPAY_API_KEY: 'sandbox-public',
        MAISHAPAY_SECRET_KEY: 'sandbox-secret',
      }),
    );
    const result = await service.initiateMobileMoneyPayment({
      transactionReference: 'order-ref',
      amount: 10,
      currency: 'USD',
      provider: 'AIRTEL',
      customerPhone: '+243987489410',
      customerName: 'Demo Buyer',
      callbackUrl: 'http://localhost:3000/api/payments/callbacks/gateway',
    });

    expect(result.transactionId).toBe('276949');
    expect(typeof result.transactionId).toBe('string');
  });

  it('does not treat an HTTP 200 status lookup without an explicit payment state as paid', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status_code: 200, message: 'General Payments' }), {
        status: 200,
      });

    const service = new MaishaPayService(
      new ConfigService({
        NODE_ENV: 'development',
        MAISHAPAY_GATEWAY_MODE: 'sandbox',
        MAISHAPAY_API_KEY: 'sandbox-public',
        MAISHAPAY_SECRET_KEY: 'sandbox-secret',
      }),
    );
    const result = await service.checkTransactionStatus('provider-tx');

    expect(result.verified).toBe(true);
    expect(result.paymentStatus).toBe('PENDING');
  });

  it('verifies webhook HMAC with the secret API key when no separate secret is configured', () => {
    const secret = 'secret-key';
    const body = Buffer.from('{"event":"payment.updated"}');
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const service = new MaishaPayService(
      new ConfigService({
        NODE_ENV: 'production',
        MAISHAPAY_API_KEY: 'public-key',
        MAISHAPAY_SECRET_KEY: secret,
      }),
    );

    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
    expect(service.verifyWebhookSignature(body, '0'.repeat(64))).toBe(false);
  });
});
