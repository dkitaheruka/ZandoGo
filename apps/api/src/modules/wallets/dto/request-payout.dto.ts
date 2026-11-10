import { IsNumber, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class RequestPayoutDto {
  @IsUUID()
  walletId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(80)
  method: string;
}
