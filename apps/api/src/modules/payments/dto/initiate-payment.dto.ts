import { PaymentMethodCode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethodCode)
  methodCode: PaymentMethodCode;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;
}
