import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { FleetModule } from '../fleet/fleet.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { createSmsProvider, SMS_PROVIDER } from './sms/sms-provider';

const smsProvider: Provider = {
  provide: SMS_PROVIDER,
  useFactory: createSmsProvider,
};

@Module({
  imports: [
    FleetModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, smsProvider],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
