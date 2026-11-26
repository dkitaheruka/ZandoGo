import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PresenceHeartbeatDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  visitorId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPath?: string;

  @IsOptional()
  @IsIn(['ONLINE', 'AWAY'])
  status?: 'ONLINE' | 'AWAY';
}

export class LeavePresenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;
}
