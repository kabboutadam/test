import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module';
import { FleetModule } from './fleet/fleet.module';
import { MeModule } from './me/me.module';
import { PositionsModule } from './positions/positions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    AuthModule,
    FleetModule,
    MeModule,
    PositionsModule,
    SubscriptionsModule,
  ],
})
export class AppModule {}
