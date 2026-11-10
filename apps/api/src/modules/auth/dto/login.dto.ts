import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password: string;
}
