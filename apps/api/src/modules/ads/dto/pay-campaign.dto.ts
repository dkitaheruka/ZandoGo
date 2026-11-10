import { PaymentMethodCode } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class PayCampaignDto {
  @IsIn([
    PaymentMethodCode.CARD_STRIPE,
    PaymentMethodCode.MOBILE_MONEY_ORANGE,
    PaymentMethodCode.MOBILE_MONEY_AIRTEL,
    PaymentMethodCode.MOBILE_MONEY_MPESA,
  ])
  methodCode:
    | 'CARD_STRIPE'
    | 'MOBILE_MONEY_ORANGE'
    | 'MOBILE_MONEY_AIRTEL'
    | 'MOBILE_MONEY_MPESA';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}
