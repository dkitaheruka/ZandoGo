import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class VariantInputDto {
  @IsString()
  sku: string;

  @IsOptional()
  attributes?: Record<string, string>; // ex: { color: "rouge", size: "XL" }

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @IsNumber()
  @Min(0)
  stockQty: number;
}

export class PriceTierInputDto {
  @IsInt()
  @Min(1)
  minQty: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQty?: number | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPriceUsd: number;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['PHYSICAL', 'DIGITAL', 'SERVICE'])
  productType?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @IsOptional()
  @IsIn(['UNIT', 'KM', 'FIXED'])
  pricingUnit?: 'UNIT' | 'KM' | 'FIXED';

  @IsOptional()
  @IsIn(['B2C', 'B2B', 'BOTH'])
  audience?: 'B2C' | 'B2B' | 'BOTH';

  @IsOptional()
  @IsInt()
  @Min(1)
  minOrderQty?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PriceTierInputDto)
  priceTiers?: PriceTierInputDto[];

  @IsOptional()
  @Matches(/^digital-books\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/, {
    message: 'Clé PDF invalide : envoyez le document via /uploads/presign (DIGITAL_DOCUMENT)',
  })
  digitalFileKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  digitalFileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  digitalFileSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fulfillmentDetails?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  status?: 'DRAFT' | 'ACTIVE';

  @IsString()
  categoryId: string;

  @IsNumber()
  @Min(0)
  basePriceUsd: number;

  /** Optionnel : si absent, calculé automatiquement via le dernier taux de change saisi par l'admin */
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePriceCdf?: number;

  @IsOptional()
  @IsArray()
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

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une variante est requise (même pour un produit simple)' })
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];
}
