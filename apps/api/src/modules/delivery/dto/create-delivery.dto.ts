import { IsIn, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID()
  subOrderId: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  pickupLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  pickupLng: number;

  @IsOptional()
  @IsIn(['pool', 'vendor_dedicated'])
  mode?: 'pool' | 'vendor_dedicated';

  @IsOptional()
  @IsUUID()
  dedicatedAgentId?: string;
}
