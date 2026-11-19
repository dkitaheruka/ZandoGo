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
  attributes?: Record<string, string>; // ex: { couleur: "rouge", taille: "XL" }

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOverride?: number;

  @IsNumber()
  @Min(0)
  stockQty: number;
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

  /**
   * Clés renvoyées par POST /uploads/presign (purpose PRODUCT_IMAGE) : les fichiers sont déjà
   * dans le bucket public. Format strict : rejette une URL, un chemin ou une traversée de
   * dossier. La première image sert de vignette dans le catalogue.
   */
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
