import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PositionsModule } from '../positions/positions.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushClient } from './push.client';
import { PushTokenStore } from './push-token.store';

@Module({
  imports: [AuthModule, FleetModule, PositionsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushTokenStore, ExpoPushClient],
})
export class NotificationsModule {}
