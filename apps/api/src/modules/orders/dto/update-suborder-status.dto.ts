import { SubOrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubOrderStatusDto {
  @IsEnum(SubOrderStatus)
  status: SubOrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
