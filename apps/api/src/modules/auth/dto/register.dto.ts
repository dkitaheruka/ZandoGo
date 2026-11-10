import { Currency } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(64)
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsOptional()
  @IsEnum(Currency)
  preferredCurrency?: Currency;
}
