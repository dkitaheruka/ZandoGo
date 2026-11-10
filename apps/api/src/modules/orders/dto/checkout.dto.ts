import { Currency } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  deliveryAddressId: string;

  @IsEnum(Currency)
  currency: Currency;
}
