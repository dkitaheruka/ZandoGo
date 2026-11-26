import { ConversationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  otherUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  orderNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  storeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  productImage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  productPriceUsd?: number;
}
