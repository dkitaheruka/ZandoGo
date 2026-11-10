import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddDisputeMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  attachmentUrl?: string;
}
