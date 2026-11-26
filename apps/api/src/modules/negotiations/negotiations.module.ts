import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NegotiationsController } from './negotiations.controller';
import { NegotiationsService } from './negotiations.service';

@Module({
  imports: [AuthModule],
  controllers: [NegotiationsController],
  providers: [NegotiationsService],
  exports: [NegotiationsService],
})
export class NegotiationsModule {}
