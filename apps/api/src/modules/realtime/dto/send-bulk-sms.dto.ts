import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendBulkSmsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  phoneNumbers: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(480)
  message: string;

  @IsOptional()
  @IsIn([0, 1])
  enqueue?: 0 | 1;
}
