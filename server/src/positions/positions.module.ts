import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PositionsGateway } from './positions.gateway';
import { PositionsService } from './positions.service';

@Module({
  imports: [AuthModule, FleetModule],
  providers: [PositionsService, PositionsGateway],
  exports: [PositionsService],
})
export class PositionsModule {}
