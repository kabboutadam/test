import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from './current-user.decorator';
import { AuthService, AuthUser } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

interface RequestOtpBody {
  phone: string;
}

interface VerifyOtpBody {
  phone: string;
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() body: RequestOtpBody) {
    return this.auth.requestOtp(body.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: VerifyOtpBody) {
    return this.auth.verifyOtp(body.phone, body.code);
  }

  /** Echo the authenticated user — handy for the app to confirm its token. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
