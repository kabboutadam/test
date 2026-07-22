import { Injectable, Logger } from '@nestjs/common';

export interface PushMessage {
  to: string; // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends notifications through Expo's push service. Tokens are Expo push tokens
 * (ExponentPushToken[...]) obtained by the app. Expo relays to APNs/FCM, so this
 * works with the standard Expo build with no direct APNs/FCM setup.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  async send(messages: PushMessage[]): Promise<void> {
    if (messages.length === 0) return;
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.warn(`Expo push failed: ${res.status} ${await res.text()}`);
        return;
      }
      this.logger.log(`Sent ${messages.length} push message(s)`);
    } catch (err) {
      this.logger.warn(`Expo push error: ${String(err)}`);
    }
  }
}
