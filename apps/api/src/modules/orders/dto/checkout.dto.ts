import { Currency } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CheckoutDto {
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @IsEnum(Currency)
  currency: Currency;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deliveryOptionId?: string;
}
