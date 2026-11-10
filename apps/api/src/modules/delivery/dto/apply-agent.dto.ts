import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  vehicleType?: string;
}
