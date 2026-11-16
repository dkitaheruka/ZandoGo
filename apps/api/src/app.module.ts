import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { FinanceModule } from './modules/finance/finance.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { KycModule } from './modules/kyc/kyc.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { AdsModule } from './modules/ads/ads.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Fixe seulement les valeurs par défaut. La limitation n'agit que sur les contrôleurs qui
    // déclarent ThrottlerGuard (aujourd'hui : auth, uploads, paiement initiate).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    VendorsModule,
    CatalogModule,
    FinanceModule,
    OrdersModule,
    PaymentsModule,
    WalletsModule,
    KycModule,
    DeliveryModule,
    DisputesModule,
    AdsModule,
    RealtimeModule,
    UploadsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
