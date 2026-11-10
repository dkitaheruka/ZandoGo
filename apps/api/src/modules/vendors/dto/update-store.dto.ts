import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  bannerUrl?: string;
}
