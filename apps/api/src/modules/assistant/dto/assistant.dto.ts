import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AssistantChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  content!: string;
}

export class AssistantChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantChatMessageDto)
  history?: AssistantChatMessageDto[];

  @IsOptional()
  @IsIn(['CLIENT', 'VENDOR', 'ADMIN'])
  roleContext?: 'CLIENT' | 'VENDOR' | 'ADMIN';

  @IsOptional()
  @IsString()
  preferredModel?: string;

  @IsOptional()
  @IsString()
  currentRoute?: string;

  @IsOptional()
  @IsIn(['fr', 'sw', 'ln', 'en'])
  language?: 'fr' | 'sw' | 'ln' | 'en';
}

export class GenerateProductDescriptionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsIn(['PHYSICAL', 'DIGITAL', 'SERVICE'])
  productType?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsIn(['WOMEN', 'MEN', 'UNISEX', 'PRO'])
  audience?: 'WOMEN' | 'MEN' | 'UNISEX' | 'PRO';

  @IsOptional()
  @IsString()
  pricingUnit?: string;

  @IsOptional()
  @IsString()
  basePriceUsd?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  preferredModel?: string;
}

export class AnalyzeDisputeDto {
  @IsOptional()
  @IsString()
  preferredModel?: string;
}

export class SmartSearchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  query!: string;

  @IsOptional()
  @IsString()
  preferredModel?: string;
}

export class SuggestReplyMessageDto {
  @IsString()
  @MaxLength(100)
  sender!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export class SuggestReplyDto {
  @IsOptional()
  @IsString()
  conversationTitle?: string;

  @IsOptional()
  @IsString()
  productTitle?: string;

  @IsOptional()
  @IsNumber()
  productPriceUsd?: number;

  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @IsOptional()
  @IsIn(['CUSTOMER_VENDOR', 'CUSTOMER_DELIVERY'])
  conversationType?: 'CUSTOMER_VENDOR' | 'CUSTOMER_DELIVERY';

  @IsOptional()
  @IsBoolean()
  hasClientLocation?: boolean;

  @IsOptional()
  @IsNumber()
  deliveryProposedFeeUsd?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SuggestReplyMessageDto)
  messages!: SuggestReplyMessageDto[];

  @IsOptional()
  @IsString()
  preferredModel?: string;

  @IsOptional()
  @IsIn(['fr', 'sw', 'ln', 'en'])
  language?: 'fr' | 'sw' | 'ln' | 'en';
}

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoMessagesEnabled?: boolean;

  @IsOptional()
  @IsIn(['WARM', 'FORMAL', 'CONCISE'])
  autoMessagesTone?: 'WARM' | 'FORMAL' | 'CONCISE';
}

export class TranslateChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsOptional()
  @IsIn(['auto', 'fr', 'sw', 'ln', 'en'])
  sourceLanguage?: 'auto' | 'fr' | 'sw' | 'ln' | 'en';

  @IsIn(['fr', 'sw', 'ln', 'en'])
  targetLanguage!: 'fr' | 'sw' | 'ln' | 'en';

  @IsOptional()
  @IsString()
  preferredModel?: string;
}


