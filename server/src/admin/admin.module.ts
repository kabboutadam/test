import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PositionsModule } from '../positions/positions.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, FleetModule, PositionsModule],
  controllers: [AdminController],
})
export class AdminModule {}
