import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';

export const UPLOAD_PURPOSES = [
  'KYC_DOCUMENT',
  'PRODUCT_IMAGE',
  'PRODUCT_VIDEO',
  'DIGITAL_DOCUMENT',
  'CHAT_IMAGE',
  'DISPUTE_EVIDENCE',
  'DELIVERY_PROOF',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export class PresignUploadDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;

  /** Le type réel est revérifié côté service selon l'usage ; ceci n'est qu'un premier filtre */
  @IsString()
  contentType: string;

  /**
   * Taille exacte du fichier en octets. Elle est signée dans l'URL : le stockage
   * refuse tout envoi dont la taille diffère, donc un client ne peut pas
   * dépasser la limite en trichant sur ce champ.
   */
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  sizeBytes: number;
}
