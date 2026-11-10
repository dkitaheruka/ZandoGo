import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class SetCommissionRuleDto {
  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionRate: number;
}
