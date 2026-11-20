import { describe, expect, it } from 'bun:test';
import {
  buildMessagingEndpoint,
  describeSmsStatusCode,
  filterOptedOutRecipients,
  isSuccessSmsStatusCode,
  normalizeSmsRecipient,
  parseAfricasTalkingResponse,
  resolveNetworkName,
  verifyAfricasTalkingCallbackToken,
} from '../src/modules/realtime/africastalking-sms.helpers';

describe("Africa's Talking SMS protocol & compliance helpers", () => {
  it('normalizes local RDC and East African numbers to E.164 format', () => {
    expect(normalizeSmsRecipient('0820 001 122')).toBe('+243820001122');
    expect(normalizeSmsRecipient('+243 820-001-122')).toBe('+243820001122');
    expect(normalizeSmsRecipient('+254711123456')).toBe('+254711123456');
    expect(normalizeSmsRecipient('250788123456')).toBe('+250788123456');
    expect(normalizeSmsRecipient('')).toBe('');
  });

  it('classifies Africa’s Talking statusCodes 100/101/102 as accepted and 401-502 as rejected', () => {
    expect(isSuccessSmsStatusCode(100)).toBe(true);
    expect(isSuccessSmsStatusCode(101)).toBe(true);
    expect(isSuccessSmsStatusCode(102)).toBe(true);

    expect(isSuccessSmsStatusCode(401)).toBe(false);
    expect(isSuccessSmsStatusCode(402)).toBe(false);
    expect(isSuccessSmsStatusCode(403)).toBe(false);
    expect(isSuccessSmsStatusCode(405)).toBe(false);
    expect(isSuccessSmsStatusCode(406)).toBe(false);
    expect(isSuccessSmsStatusCode(409)).toBe(false);
    expect(isSuccessSmsStatusCode(500)).toBe(false);
    expect(describeSmsStatusCode(405)).toBe('InsufficientBalance');
    expect(describeSmsStatusCode(406)).toBe('UserInBlacklist');
  });

  it('routes Sandbox to /version1/messaging and Live bulk_json to /version1/messaging/bulk', () => {
    expect(buildMessagingEndpoint({ isSandbox: true, mode: 'standard' })).toBe(
      'https://api.sandbox.africastalking.com/version1/messaging',
    );
    expect(buildMessagingEndpoint({ isSandbox: true, mode: 'bulk_json' })).toBe(
      'https://api.sandbox.africastalking.com/version1/messaging',
    );
    expect(buildMessagingEndpoint({ isSandbox: false, mode: 'standard' })).toBe(
      'https://api.africastalking.com/version1/messaging',
    );
    expect(buildMessagingEndpoint({ isSandbox: false, mode: 'bulk_json' })).toBe(
      'https://api.africastalking.com/version1/messaging/bulk',
    );
  });

  it('parses Africa’s Talking SMSMessageData response including cost, messageId, and rejections', () => {
    const okPayload = {
      SMSMessageData: {
        Message: 'Sent to 1/1 Total Cost: KES 0.8000',
        Recipients: [
          {
            statusCode: 101,
            number: '+243820001122',
            status: 'Success',
            cost: 'KES 0.8000',
            messageId: 'ATPid_SampleTxnId123',
          },
        ],
      },
    };
    const parsedOk = parseAfricasTalkingResponse(okPayload);
    expect(parsedOk.anyAccepted).toBe(true);
    expect(parsedOk.recipients[0].messageId).toBe('ATPid_SampleTxnId123');
    expect(parsedOk.recipients[0].cost).toBe('KES 0.8000');

    const failPayload = {
      SMSMessageData: {
        Message: 'Sent to 0/1 Total Cost: 0',
        Recipients: [
          {
            statusCode: 409,
            number: '+234800000000',
            status: 'DoNotDisturbRejection',
            cost: '0',
            messageId: 'None',
          },
        ],
      },
    };
    const parsedFail = parseAfricasTalkingResponse(failPayload);
    expect(parsedFail.anyAccepted).toBe(false);
    expect(parsedFail.recipients[0].accepted).toBe(false);
    expect(parsedFail.recipients[0].messageId).toBeUndefined();
  });

  it('excludes Bulk SMS Opt-Out numbers and deduplicates recipients', () => {
    const result = filterOptedOutRecipients(
      ['0820001122', '+243820001122', '+243991112233', '+250788000111'],
      ['+243991112233'],
    );
    expect(result.allowed).toEqual(['+243820001122', '+250788000111']);
    expect(result.excluded).toEqual(['+243991112233']);
  });

  it('resolves telco networkCode values and validates webhook token fail-closed in production', () => {
    expect(resolveNetworkName('63902')).toBe('Safaricom Kenya');
    expect(resolveNetworkName('63510')).toBe('MTN Rwanda');
    expect(resolveNetworkName('99999')).toBe('Athena (Sandbox)');

    expect(
      verifyAfricasTalkingCallbackToken({
        expectedSecret: undefined,
        providedToken: undefined,
        isProduction: true,
      }),
    ).toBe(false);
    expect(
      verifyAfricasTalkingCallbackToken({
        expectedSecret: 'secret-at-token-32-chars-minimum',
        providedToken: 'wrong-token',
        isProduction: true,
      }),
    ).toBe(false);
    expect(
      verifyAfricasTalkingCallbackToken({
        expectedSecret: 'secret-at-token-32-chars-minimum',
        providedToken: 'secret-at-token-32-chars-minimum',
        isProduction: true,
      }),
    ).toBe(true);
  });
});
