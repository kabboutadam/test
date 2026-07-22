import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MeController } from './me.controller';

@Module({
  imports: [AuthModule, FleetModule, SubscriptionsModule],
  controllers: [MeController],
})
export class MeModule {}
