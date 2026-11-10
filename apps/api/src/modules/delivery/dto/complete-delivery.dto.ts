import { DeliveryProofType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';

export class CompleteDeliveryDto {
  @IsEnum(DeliveryProofType)
  proofType: DeliveryProofType;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  otpValue?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}
