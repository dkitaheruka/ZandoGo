import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
  @ArrayMaxSize(6, { message: '6 images maximum par produit' })
  @ArrayUnique()
  @Matches(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/, {
    each: true,
    message: 'Clé d’image invalide : envoyez les images via /uploads/presign',
  })
  imageKeys?: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins une variante est requise (même pour un produit simple)' })
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];
}
