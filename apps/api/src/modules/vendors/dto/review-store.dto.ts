import { StoreStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ReviewStoreDto {
  @IsEnum(StoreStatus)
  status: StoreStatus;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
