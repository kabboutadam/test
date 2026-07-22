import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { FleetModule } from './fleet/fleet.module';
import { MeModule } from './me/me.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PositionsModule } from './positions/positions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    BillingModule,
    FleetModule,
    MeModule,
    NotificationsModule,
    PositionsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
