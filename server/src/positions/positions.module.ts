import { Module } from '@nestjs/common';

import { FleetModule } from '../fleet/fleet.module';
import { PositionsController } from './positions.controller';
import { PositionsGateway } from './positions.gateway';
import { PositionsService } from './positions.service';

@Module({
  imports: [FleetModule],
  controllers: [PositionsController],
  providers: [PositionsService, PositionsGateway],
})
export class PositionsModule {}
