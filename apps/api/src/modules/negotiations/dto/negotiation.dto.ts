import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateNegotiationDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  requestedQty?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  requestedPriceUsd: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  transportMode?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  requestedDeliveryFeeUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  destinationCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateNegotiationDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  agreedPriceUsd?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: 'PENDING_VENDOR_REVIEW' | 'ACCEPTED_BY_VENDOR' | 'REJECTED' | 'CONVERTED_TO_ORDER';
}
