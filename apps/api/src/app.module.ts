import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AssistantModule } from './modules/assistant/assistant.module';
import { NegotiationsModule } from './modules/negotiations/negotiations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Plafond global appliqué à toutes les routes via APP_GUARD (surchargeable par @Throttle / @SkipThrottle)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
    AssistantModule,
    NegotiationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
