import { FulfillmentMode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TransportDestinationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(80)
  originCity: string;

  @IsString()
  @MaxLength(80)
  destinationCity: string;

  @IsNumber()
  @Min(0)
  basePriceUsd: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKmUsd?: number;

  @IsString()
  @MaxLength(60)
  estimatedDelay: string;

  @IsString()
  @MaxLength(60)
  vehicleMode: string;
}

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  storeName: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  storeType?: string;

  @IsOptional()
  @IsBoolean()
  isTransportAgency?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransportDestinationDto)
  transportDestinations?: TransportDestinationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un module de service pour votre boutique' })
  @IsIn(['PHYSICAL', 'DIGITAL', 'SERVICE'], { each: true })
  enabledServices?: ('PHYSICAL' | 'DIGITAL' | 'SERVICE')[];

  @IsOptional()
  @IsEnum(FulfillmentMode)
  fulfillmentMode?: FulfillmentMode;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  customerPhone?: string;
}
