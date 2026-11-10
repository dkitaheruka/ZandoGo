import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, AuditModule, CatalogModule],
  controllers: [CartController, OrdersController],
  providers: [CartService, OrdersService],
})
export class OrdersModule {}
