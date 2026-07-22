import { Logger } from '@nestjs/common';

/** DI token for the active SMS provider. */
export const SMS_PROVIDER = 'SMS_PROVIDER';

/**
 * Sends an SMS. Swap the implementation for a real gateway by env
 * (`SMS_PROVIDER=twilio`, etc.). The rest of auth is provider-agnostic.
 */
export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<void>;
}

/** Dev default: logs the message. No real SMS is sent. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('ConsoleSmsProvider');
  async send(to: string, text: string): Promise<void> {
    this.logger.log(`SMS to ${to}: ${text}`);
  }
}

/**
 * Twilio SMS via its REST API (no SDK — just an authenticated POST). Set:
 *   SMS_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM=+1XXXXXXXXXX   (a Twilio number or Messaging Service SID)
 *
 * For a Lebanese aggregator, implement SmsProvider the same way against their
 * HTTP API and select it here.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger('TwilioSmsProvider');

  constructor(
    private readonly sid = process.env.TWILIO_ACCOUNT_SID ?? '',
    private readonly token = process.env.TWILIO_AUTH_TOKEN ?? '',
    private readonly from = process.env.TWILIO_FROM ?? '',
  ) {
    if (!this.sid || !this.token || !this.from) {
      this.logger.warn('Twilio env vars missing — SMS sends will fail.');
    }
  }

  async send(to: string, text: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64');
    const body = new URLSearchParams({ To: to, From: this.from, Body: text });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Twilio send failed: ${res.status} ${detail}`);
    }
  }
}

/** Build the provider from env. Defaults to console (no real SMS). */
export function createSmsProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    case 'twilio':
      return new TwilioSmsProvider();
    default:
      return new ConsoleSmsProvider();
  }
}
