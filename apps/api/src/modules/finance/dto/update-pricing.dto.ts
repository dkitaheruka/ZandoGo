import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdatePricingDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  storeCreationFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  servicePhysicalFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  serviceDigitalFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  servicePrestationFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  certificationMonthlyFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  certificationQuarterlyFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  adEssentialMonthlyFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  adProCarouselMonthlyFeeUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  defaultCommissionPercent?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  paymentTransactionFeePercent?: number;

  @IsOptional()
  @IsBoolean()
  allowImmediateVendorWithdrawal?: boolean;
}
