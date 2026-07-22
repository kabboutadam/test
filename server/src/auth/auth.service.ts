import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { normalizePhone } from '../domain/phone';
import { FleetService } from '../fleet/fleet.service';

interface OtpEntry {
  code: string;
  expiresAt: number;
}

export interface AuthUser {
  parentId: string;
  phone: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const isProd = process.env.NODE_ENV === 'production';

/**
 * Phone-OTP auth. A parent requests a code for their phone, then verifies it to
 * receive a JWT. There is no SMS provider wired in yet, so in non-production the
 * code is logged and returned in the response for testing. Swap `deliverOtp`
 * for a real SMS gateway (e.g. a Lebanese aggregator, Twilio) for production.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otps = new Map<string, OtpEntry>();

  constructor(
    private readonly fleet: FleetService,
    private readonly jwt: JwtService,
  ) {}

  /** Generate + "send" an OTP. Returns the code only in non-production. */
  async requestOtp(phone: string): Promise<{ sent: boolean; devCode?: string }> {
    const normalized = normalizePhone(phone);
    if (!this.fleet.getParentByPhone(normalized)) {
      // Don't reveal whether a phone is registered; pretend success.
      this.logger.warn(`OTP requested for unknown phone ${normalized}`);
      return { sent: true };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.otps.set(normalized, { code, expiresAt: Date.now() + OTP_TTL_MS });
    this.deliverOtp(normalized, code);
    return isProd ? { sent: true } : { sent: true, devCode: code };
  }

  /** Verify an OTP and issue a JWT. */
  async verifyOtp(phone: string, code: string): Promise<{ token: string; parentId: string }> {
    const normalized = normalizePhone(phone);
    const entry = this.otps.get(normalized);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== code) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    const parent = this.fleet.getParentByPhone(normalized);
    if (!parent) throw new UnauthorizedException('No account for this phone');

    this.otps.delete(normalized);
    const payload: AuthUser = { parentId: parent.id, phone: normalized };
    const token = await this.jwt.signAsync(payload);
    return { token, parentId: parent.id };
  }

  async verifyToken(token: string): Promise<AuthUser> {
    try {
      return await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private deliverOtp(phone: string, code: string): void {
    // TODO: send via SMS provider. For now, log it.
    this.logger.log(`OTP for ${phone}: ${code}`);
  }
}
