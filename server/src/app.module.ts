import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { FleetModule } from './fleet/fleet.module';
import { HealthModule } from './health/health.module';
import { MeModule } from './me/me.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlatformModule } from './platform/platform.module';
import { PositionsModule } from './positions/positions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    BillingModule,
    FleetModule,
    HealthModule,
    MeModule,
    NotificationsModule,
    PlatformModule,
    PositionsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
