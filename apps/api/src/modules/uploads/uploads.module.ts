import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocalUploadsMediaController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [LocalUploadsMediaController, UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
