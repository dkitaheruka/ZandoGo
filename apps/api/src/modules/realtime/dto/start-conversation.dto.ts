import { ConversationType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class StartConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsUUID()
  otherUserId: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
