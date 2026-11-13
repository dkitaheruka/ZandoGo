import { FulfillmentMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
  @MaxLength(32)
  storeType?: string;

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
