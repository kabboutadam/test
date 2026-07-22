import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';

import { CurrentParent } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushTokenStore } from './push-token.store';

interface TokenBody {
  token: string;
}

/** Register/unregister this device's Expo push token for the signed-in parent. */
@UseGuards(JwtAuthGuard)
@Controller('me/push-token')
export class NotificationsController {
  constructor(private readonly tokens: PushTokenStore) {}

  @Post()
  register(@CurrentParent() parentId: string, @Body() body: TokenBody): { ok: boolean } {
    if (!body?.token) return { ok: false };
    this.tokens.add(parentId, body.token);
    return { ok: true };
  }

  @Delete()
  unregister(@CurrentParent() parentId: string, @Body() body: TokenBody): { ok: boolean } {
    if (body?.token) this.tokens.remove(parentId, body.token);
    return { ok: true };
  }
}
