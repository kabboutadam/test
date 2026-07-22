import { Module } from '@nestjs/common';

import { FleetModule } from './fleet/fleet.module';
import { PositionsModule } from './positions/positions.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [FleetModule, PositionsModule, SubscriptionsModule],
})
export class AppModule {}
