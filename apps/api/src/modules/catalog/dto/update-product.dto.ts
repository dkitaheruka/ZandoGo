import { ProductStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceUsd?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePriceCdf?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}
