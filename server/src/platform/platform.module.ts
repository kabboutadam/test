import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FleetModule } from '../fleet/fleet.module';
import { PlatformController } from './platform.controller';

/** Super-admin (platform owner) endpoints for onboarding schools. */
@Module({
  imports: [AuthModule, FleetModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
