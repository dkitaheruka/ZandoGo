import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  imports: [AuthModule, AuditModule, CatalogModule, RealtimeModule],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
