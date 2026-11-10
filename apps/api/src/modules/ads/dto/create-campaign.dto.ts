import { AdCostModel, AdType, Currency } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateCampaignDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsEnum(AdType)
  type: AdType;

  @IsEnum(AdCostModel)
  costModel: AdCostModel;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  budgetAmount: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;
}
