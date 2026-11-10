import { DisputeReason } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class OpenDisputeDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @IsEnum(DisputeReason)
  reasonCategory: DisputeReason;

  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  evidenceUrls?: string[];
}
