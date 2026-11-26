import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { DownloadsController } from './downloads.controller';

@Module({
  imports: [AuthModule, AuditModule, UploadsModule],
  controllers: [CatalogController, DownloadsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
