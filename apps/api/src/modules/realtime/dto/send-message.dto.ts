import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string;
}
