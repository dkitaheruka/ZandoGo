import { Currency } from '@prisma/client';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';

export class SetExchangeRateDto {
  @IsEnum(Currency)
  fromCurrency: Currency;

  @IsEnum(Currency)
  toCurrency: Currency;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  @Max(100000000)
  rate: number;
}
