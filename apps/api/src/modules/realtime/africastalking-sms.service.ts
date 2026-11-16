import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AfricasTalkingSmsResult {
  sent: boolean;
  provider: 'AFRICASTALKING';
  recipient: string;
  messageId?: string;
  status: string;
}

/**
 * Service d'envoi de notifications SMS transactionnelles via l'API Africa's Talking
 * (https://developers.africastalking.com/docs/sms/sending).
 */
@Injectable()
export class AfricasTalkingSmsService {
  private readonly logger = new Logger(AfricasTalkingSmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendSms(to: string, message: string): Promise<AfricasTalkingSmsResult> {
    const apiKey = this.config.get<string>('AFRICASTALKING_API_KEY');
    const username = this.config.get<string>('AFRICASTALKING_USERNAME') || 'sandbox';
    const senderId = this.config.get<string>('AFRICASTALKING_SENDER_ID') || 'ZandoGo';

    const normalizedRecipient = to.startsWith('+') ? to : `+243${to.replace(/^0+/, '')}`;

    if (!apiKey) {
      this.logger.log(`[Africa's Talking DryRun] SMS -> ${normalizedRecipient}: ${message}`);
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        recipient: normalizedRecipient,
        status: 'SKIPPED_NO_API_KEY',
      };
    }

    const endpoint =
      username === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

    const form = new URLSearchParams({
      username,
      to: normalizedRecipient,
      message,
      from: senderId,
    });

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
      const data = (await response.json()) as {
        SMSMessageData?: { Recipients?: { messageId?: string; status?: string }[] };
      };
      const firstRecipient = data.SMSMessageData?.Recipients?.[0];
      return {
        sent: true,
        provider: 'AFRICASTALKING',
        recipient: normalizedRecipient,
        messageId: firstRecipient?.messageId,
        status: firstRecipient?.status || 'Success',
      };
    } catch (err) {
      this.logger.error(`Erreur Africa's Talking SMS : ${String(err)}`);
      return {
        sent: false,
        provider: 'AFRICASTALKING',
        recipient: normalizedRecipient,
        status: 'ERROR',
      };
    }
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

  async sendCourierDeliveryOtp(params: { phone: string; orderNumber: string; otpCode: string; driverName: string }) {
    const text = `ZandoGo Livraison : ${params.driverName} est en route pour ${params.orderNumber}. Code secret de remise : ${params.otpCode}.`;
    return this.sendSms(params.phone, text);
  }
}
