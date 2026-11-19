import { ProductStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins 1 photo est requise' })
  @ArrayMaxSize(3, { message: '3 images maximum par produit' })
  @ArrayUnique()
  @Matches(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    each: true,
    message: 'Clé d’image invalide : envoyez les images via /uploads/presign',
  })
  imageKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  imageAltTexts?: string[];

  @IsOptional()
  @Matches(/^products-videos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp4|webm|mov)$/, {
    message: 'Clé de vidéo invalide : envoyez la vidéo via /uploads/presign (PRODUCT_VIDEO)',
  })
  videoKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10, { message: 'La vidéo de présentation ne peut pas dépasser 10 secondes' })
  videoDurationSec?: number;

  @IsOptional()
  @IsBoolean()
  removeVideo?: boolean;
}
