import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildMessagingEndpoint,
  describeSmsStatusCode,
  filterOptedOutRecipients,
  normalizeSmsRecipient,
  parseAfricasTalkingResponse,
  resolveNetworkName,
  verifyAfricasTalkingCallbackToken,
  type ParsedSmsRecipientResult,
} from './africastalking-sms.helpers';

export interface AfricasTalkingSmsResult {
  sent: boolean;
  provider: 'AFRICASTALKING';
  recipient: string;
  messageId?: string;
  statusCode?: number;
  status: string;
  cost?: string;
  summaryMessage?: string;
}

export interface AfricasTalkingBulkSmsResult {
  sent: boolean;
  provider: 'AFRICASTALKING';
  totalRequested: number;
  sentCount: number;
  skippedOptOutCount: number;
  summaryMessage: string;
  recipients: ParsedSmsRecipientResult[];
}

export interface AfricasTalkingInboxMessage {
  id: number;
  from: string;
  to: string;
  text: string;
  date: string;
  linkId?: string;
}

const OPT_OUT_SETTING_KEY = 'sms_opt_out_numbers';

/**
 * Service complet Africa's Talking SMS (Live & Sandbox) :
 * - Envoi unitaire (/version1/messaging) avec gestion stricte des statusCodes 100..502 & enqueue=1
 * - Envoi groupé Bulk SMS (/version1/messaging/bulk JSON en Live, /version1/messaging en Sandbox) + filtre Opt-Out
 * - Lecture boîte de réception (GET /version1/messaging)
 * - Traitement des 4 callbacks officiels (Delivery Reports, Incoming Messages, Bulk Opt-Out, Subscriptions)
 */
@Injectable()
export class AfricasTalkingSmsService {
  private readonly logger = new Logger(AfricasTalkingSmsService.name);
  private readonly inMemoryOptOuts = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private getCredentials() {
    const apiKey = (this.config.get<string>('AFRICASTALKING_API_KEY') || '').trim();
    const username = (this.config.get<string>('AFRICASTALKING_USERNAME') || 'sandbox').trim();
    const senderId = (this.config.get<string>('AFRICASTALKING_SENDER_ID') || 'ZandoGo').trim();
    const defaultEnqueue: 0 | 1 =
      this.config.get<string>('AFRICASTALKING_ENQUEUE') === '0' ? 0 : 1;
    const isSandbox = username.toLowerCase() === 'sandbox';

    return { apiKey, username, senderId, defaultEnqueue, isSandbox };
  }

  verifyCallbackToken(providedToken?: string): boolean {
    const expectedSecret = this.config.get<string>('AFRICASTALKING_WEBHOOK_TOKEN');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return verifyAfricasTalkingCallbackToken({
      expectedSecret,
      providedToken,
      isProduction,
    });
  }

  async getOptOutNumbers(): Promise<string[]> {
    try {
      const row = await this.prisma.platformSetting.findUnique({
        where: { key: OPT_OUT_SETTING_KEY },
      });
      const stored = Array.isArray(row?.value) ? (row.value as unknown[]) : [];
      for (const item of stored) {
        if (typeof item === 'string') {
          const normalized = normalizeSmsRecipient(item);
          if (normalized) this.inMemoryOptOuts.add(normalized);
        }
      }
    } catch {
      // Fall back to in-memory cache if DB setting isn't readable
    }
    return Array.from(this.inMemoryOptOuts);
  }

  private async addOptOutNumber(phoneNumber: string, actorUserId?: string): Promise<string> {
    const normalized = normalizeSmsRecipient(phoneNumber);
    if (!normalized) return '';
    this.inMemoryOptOuts.add(normalized);
    try {
      const current = await this.getOptOutNumbers();
      const updated = Array.from(new Set([...current, normalized]));
      await this.prisma.platformSetting.upsert({
        where: { key: OPT_OUT_SETTING_KEY },
        update: { value: updated, updatedBy: actorUserId || 'africastalking-webhook' },
        create: { key: OPT_OUT_SETTING_KEY, value: updated, updatedBy: actorUserId || 'africastalking-webhook' },
      });
    } catch (err) {
      this.logger.warn(`Impossible de persister opt-out SMS ${normalized} : ${String(err)}`);
    }
    return normalized;
  }

  async sendSms(
    to: string,
    message: string,
    options?: {
      enqueue?: 0 | 1;
      keyword?: string;
      linkId?: string;
      retryDurationInHours?: number;
    },
  ): Promise<AfricasTalkingSmsResult> {
    const { apiKey, username, senderId, defaultEnqueue, isSandbox } = this.getCredentials();
    const normalizedRecipient = normalizeSmsRecipient(to);

    if (!normalizedRecipient) {
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        recipient: to,
        statusCode: 403,
        status: 'InvalidPhoneNumber',
      };
    }

    if (!apiKey) {
      this.logger.log(`[Africa's Talking DryRun] SMS -> ${normalizedRecipient}: ${message}`);
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        recipient: normalizedRecipient,
        status: 'SKIPPED_NO_API_KEY',
      };
    }

    const endpoint = buildMessagingEndpoint({ isSandbox, mode: 'standard' });
    const enqueue = options?.enqueue ?? defaultEnqueue;

    const form = new URLSearchParams({
      username,
      to: normalizedRecipient,
      message,
      from: senderId,
      bulkSMSMode: '1',
      enqueue: String(enqueue),
    });
    if (options?.keyword) form.set('keyword', options.keyword);
    if (options?.linkId) form.set('linkId', options.linkId);
    if (options?.retryDurationInHours && options.retryDurationInHours > 0) {
      form.set('retryDurationInHours', String(Math.round(options.retryDurationInHours)));
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          apiKey,
        },
        body: form.toString(),
      });

      const rawJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.logger.warn(
          `Africa's Talking HTTP ${response.status} pour ${normalizedRecipient} : ${JSON.stringify(rawJson)}`,
        );
        return {
          sent: false,
          provider: 'AFRICASTALKING',
          recipient: normalizedRecipient,
          statusCode: response.status,
          status: `HTTP_${response.status}`,
        };
      }

      const parsed = parseAfricasTalkingResponse(rawJson, normalizedRecipient);
      const first = parsed.recipients[0];
      if (!first || !first.accepted) {
        const code = first?.statusCode ?? 500;
        this.logger.warn(
          `Africa's Talking rejet (${code} ${describeSmsStatusCode(code)}) pour ${normalizedRecipient}: ${first?.status || parsed.summaryMessage}`,
        );
        return {
          sent: false,
          provider: 'AFRICASTALKING',
          recipient: normalizedRecipient,
          messageId: first?.messageId,
          statusCode: code,
          status: first?.status || describeSmsStatusCode(code),
          cost: first?.cost,
          summaryMessage: parsed.summaryMessage,
        };
      }

      return {
        sent: true,
        provider: 'AFRICASTALKING',
        recipient: first.number || normalizedRecipient,
        messageId: first.messageId,
        statusCode: first.statusCode,
        status: first.status,
        cost: first.cost,
        summaryMessage: parsed.summaryMessage,
      };
    } catch (err) {
      this.logger.error(`Erreur Africa's Talking SMS : ${String(err)}`);
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        recipient: normalizedRecipient,
        statusCode: 500,
        status: 'ERROR',
      };
    }
  }

  /**
   * Envoi Bulk SMS conforme à la doc Africa's Talking :
   * - Filtre automatiquement les numéros ayant activé Bulk SMS Opt-Out
   * - En Live : POST JSON vers https://api.africastalking.com/version1/messaging/bulk
   * - En Sandbox : POST x-www-form-urlencoded vers https://api.sandbox.africastalking.com/version1/messaging
   */
  async sendBulkSms(
    phoneNumbers: string[],
    message: string,
    options?: { enqueue?: 0 | 1 },
  ): Promise<AfricasTalkingBulkSmsResult> {
    const { apiKey, username, senderId, defaultEnqueue, isSandbox } = this.getCredentials();
    const enqueue = options?.enqueue ?? defaultEnqueue;
    const optedOut = await this.getOptOutNumbers();
    const { allowed, excluded } = filterOptedOutRecipients(phoneNumbers, optedOut);

    if (allowed.length === 0) {
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        totalRequested: phoneNumbers.length,
        sentCount: 0,
        skippedOptOutCount: excluded.length,
        summaryMessage: 'Aucun destinataire éligible (numéros vides ou désinscrits Opt-Out).',
        recipients: [],
      };
    }

    if (!apiKey) {
      this.logger.log(
        `[Africa's Talking DryRun Bulk] ${allowed.length} destinataire(s) (${excluded.length} Opt-Out exclus): ${message}`,
      );
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        totalRequested: phoneNumbers.length,
        sentCount: 0,
        skippedOptOutCount: excluded.length,
        summaryMessage: `DryRun (pas de clé API) · ${allowed.length} destinataire(s) prêts`,
        recipients: allowed.map((num) => ({
          number: num,
          statusCode: 102,
          status: 'SKIPPED_NO_API_KEY',
          accepted: false,
        })),
      };
    }

    const endpoint = buildMessagingEndpoint({ isSandbox, mode: 'bulk_json' });

    try {
      const response = isSandbox
        ? await fetch(endpoint, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
              apiKey,
            },
            body: new URLSearchParams({
              username,
              to: allowed.join(','),
              message,
              from: senderId,
              bulkSMSMode: '1',
              enqueue: String(enqueue),
            }).toString(),
          })
        : await fetch(endpoint, {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              apiKey,
            },
            body: JSON.stringify({
              username,
              phoneNumbers: allowed,
              message,
              senderId,
              enqueue,
            }),
          });

      const rawJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.logger.warn(
          `Africa's Talking Bulk HTTP ${response.status} : ${JSON.stringify(rawJson)}`,
        );
        return {
          sent: false,
          provider: 'AFRICASTALKING',
          totalRequested: phoneNumbers.length,
          sentCount: 0,
          skippedOptOutCount: excluded.length,
          summaryMessage: `Erreur HTTP ${response.status}`,
          recipients: [],
        };
      }

      const parsed = parseAfricasTalkingResponse(rawJson);
      const sentCount = parsed.recipients.filter((r) => r.accepted).length;

      return {
        sent: parsed.anyAccepted,
        provider: 'AFRICASTALKING',
        totalRequested: phoneNumbers.length,
        sentCount,
        skippedOptOutCount: excluded.length,
        summaryMessage: parsed.summaryMessage || `Envoyé à ${sentCount}/${allowed.length}`,
        recipients: parsed.recipients,
      };
    } catch (err) {
      this.logger.error(`Erreur Africa's Talking Bulk SMS : ${String(err)}`);
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        totalRequested: phoneNumbers.length,
        sentCount: 0,
        skippedOptOutCount: excluded.length,
        summaryMessage: 'Erreur réseau lors de l’envoi Bulk SMS',
        recipients: [],
      };
    }
  }

  /**
   * Fetch Messages (GET /version1/messaging)
   */
  async fetchMessages(lastReceivedId = '0'): Promise<{
    configured: boolean;
    messages: AfricasTalkingInboxMessage[];
  }> {
    const { apiKey, username, isSandbox } = this.getCredentials();
    if (!apiKey) {
      return { configured: false, messages: [] };
    }

    const baseUrl = buildMessagingEndpoint({ isSandbox, mode: 'standard' });
    const qs = new URLSearchParams({
      username,
      lastReceivedId: String(lastReceivedId || '0'),
    });

    try {
      const response = await fetch(`${baseUrl}?${qs.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          apiKey,
        },
      });
      if (!response.ok) {
        this.logger.warn(`Africa's Talking Fetch Messages HTTP ${response.status}`);
        return { configured: true, messages: [] };
      }

      const data = (await response.json().catch(() => ({}))) as {
        SMSMessageData?: { Messages?: AfricasTalkingInboxMessage[] };
      };
      const messages = Array.isArray(data.SMSMessageData?.Messages)
        ? data.SMSMessageData!.Messages
        : [];
      return { configured: true, messages };
    } catch (err) {
      this.logger.error(`Erreur Africa's Talking Fetch Messages : ${String(err)}`);
      return { configured: true, messages: [] };
    }
  }

  async handleDeliveryReport(payload: Record<string, any>) {
    const messageId = String(payload.id || '').trim() || `dlr-${Date.now()}`;
    const status = String(payload.status || 'Unknown').trim();
    const phoneNumber = normalizeSmsRecipient(String(payload.phoneNumber || ''));
    const networkCode = payload.networkCode ? String(payload.networkCode).trim() : undefined;
    const networkName = resolveNetworkName(networkCode);
    const failureReason = payload.failureReason ? String(payload.failureReason).trim() : undefined;
    const retryCount = payload.retryCount !== undefined ? Number(payload.retryCount) : undefined;

    await this.audit
      .log({
        action: 'SMS_DELIVERY_REPORT',
        entityType: 'SmsMessage',
        entityId: messageId,
        afterState: {
          id: messageId,
          status,
          phoneNumber,
          networkCode,
          networkName,
          failureReason,
          retryCount,
        },
      })
      .catch((err) => this.logger.warn(`Audit DLR failed: ${String(err)}`));

    if (status === 'Failed' || status === 'Rejected' || status === 'Expired') {
      this.logger.warn(
        `SMS Delivery Report ${status} -> ${phoneNumber} (${networkName}) reason=${failureReason || 'n/a'}`,
      );
    }

    return {
      received: true,
      id: messageId,
      status,
      phoneNumber,
      networkName,
      failureReason,
    };
  }

  async handleIncomingMessage(payload: Record<string, any>) {
    const id = String(payload.id || `in-${Date.now()}`).trim();
    const from = normalizeSmsRecipient(String(payload.from || ''));
    const to = String(payload.to || '').trim();
    const text = String(payload.text || '').trim();
    const date = String(payload.date || new Date().toISOString()).trim();
    const linkId = payload.linkId ? String(payload.linkId).trim() : undefined;
    const cost = payload.cost ? String(payload.cost).trim() : undefined;
    const networkCode = payload.networkCode ? String(payload.networkCode).trim() : undefined;

    const normalizedCmd = text.toUpperCase();
    const autoOptOut =
      normalizedCmd === 'STOP' ||
      normalizedCmd === 'ARRET' ||
      normalizedCmd === 'ARRÊT' ||
      normalizedCmd === 'UNSUBSCRIBE';
    if (autoOptOut && from) {
      await this.addOptOutNumber(from, 'sms-keyword-stop');
    }

    await this.audit
      .log({
        action: 'SMS_INCOMING_MESSAGE',
        entityType: 'SmsMessage',
        entityId: id,
        afterState: {
          id,
          from,
          to,
          text,
          date,
          linkId,
          cost,
          networkCode,
          networkName: resolveNetworkName(networkCode),
          autoOptOut,
        },
      })
      .catch((err) => this.logger.warn(`Audit Incoming SMS failed: ${String(err)}`));

    return { received: true, id, from, to, autoOptOut };
  }

  async handleBulkOptOut(payload: Record<string, any>) {
    const senderId = String(payload.senderId || '').trim();
    const normalizedPhone = await this.addOptOutNumber(String(payload.phoneNumber || ''));

    await this.audit
      .log({
        action: 'SMS_BULK_OPT_OUT',
        entityType: 'SmsOptOut',
        entityId: normalizedPhone || `optout-${Date.now()}`,
        afterState: {
          senderId,
          phoneNumber: normalizedPhone,
          optedOutAt: new Date().toISOString(),
        },
      })
      .catch((err) => this.logger.warn(`Audit OptOut failed: ${String(err)}`));

    return { received: true, senderId, phoneNumber: normalizedPhone };
  }

  async handleSubscriptionNotification(payload: Record<string, any>) {
    const phoneNumber = normalizeSmsRecipient(String(payload.phoneNumber || ''));
    const shortCode = String(payload.shortCode || '').trim();
    const keyword = String(payload.keyword || '').trim();
    const updateType = String(payload.updateType || '').trim();

    await this.audit
      .log({
        action: 'SMS_SUBSCRIPTION_UPDATE',
        entityType: 'SmsSubscription',
        entityId: `${shortCode}:${keyword}:${phoneNumber}`,
        afterState: {
          phoneNumber,
          shortCode,
          keyword,
          updateType,
          recordedAt: new Date().toISOString(),
        },
      })
      .catch((err) => this.logger.warn(`Audit Subscription failed: ${String(err)}`));

    return { received: true, phoneNumber, shortCode, keyword, updateType };
  }

  async getRecentSmsActivity(limit = 50) {
    return this.prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            'SMS_DELIVERY_REPORT',
            'SMS_INCOMING_MESSAGE',
            'SMS_BULK_OPT_OUT',
            'SMS_SUBSCRIPTION_UPDATE',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  async sendOrderPaymentConfirmation(params: {
    phone: string;
    orderNumber: string;
    amountLabel: string;
    paymentRef?: string;
    maishaPayRef?: string;
    operatorLabel?: string;
    digitalDownloadUrl?: string;
  }) {
    const ref = params.paymentRef || params.maishaPayRef || 'CONFIRME';
    const opNote = params.operatorLabel ? ` via ${params.operatorLabel}` : '';
    const downloadNote = params.digitalDownloadUrl
      ? ` Téléchargez votre livre ici : ${params.digitalDownloadUrl}`
      : ' Suivi coursier actif sur ZandoGo Goma.';
    const text = `ZandoGo Goma : Paiement ${params.amountLabel}${opNote} confirmé (Réf ${ref}) pour ${params.orderNumber}.${downloadNote}`;
    return this.sendSms(params.phone, text);
  }

  async sendCourierDeliveryOtp(params: {
    phone: string;
    orderNumber: string;
    otpCode: string;
    driverName: string;
  }) {
    const text = `ZandoGo Livraison : ${params.driverName} est en route pour ${params.orderNumber}. Code secret de remise : ${params.otpCode}.`;
    return this.sendSms(params.phone, text);
  }
}
