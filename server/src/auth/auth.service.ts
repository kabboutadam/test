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

/**
 * The authenticated identity carried in the JWT. A phone belongs to either a
 * parent (sees their children) or a bus driver (streams that bus's GPS).
 */
export type AuthUser =
  | { role: 'parent'; parentId: string; phone: string }
  | { role: 'driver'; busId: string; routeId: string; phone: string }
  | { role: 'operator'; operatorId: string; schoolId: string; phone: string };

export interface VerifyResult {
  token: string;
  role: AuthUser['role'];
  parentId?: string;
  routeId?: string;
  schoolId?: string;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const isProd = process.env.NODE_ENV === 'production';

/**
 * Phone-OTP auth. A user requests a code for their phone, then verifies it to
 * receive a JWT. The role is derived from the phone: a parent phone → parent
 * token; a bus's driverPhone → driver token scoped to that bus's route. No SMS
 * provider yet, so in non-production the code is logged and returned for testing.
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
    const known =
      this.fleet.getParentByPhone(normalized) ||
      this.fleet.getBusByDriverPhone(normalized) ||
      this.fleet.getOperatorByPhone(normalized);
    if (!known) {
      // Don't reveal whether a phone is registered; pretend success.
      this.logger.warn(`OTP requested for unknown phone ${normalized}`);
      return { sent: true };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.otps.set(normalized, { code, expiresAt: Date.now() + OTP_TTL_MS });
    this.deliverOtp(normalized, code);
    return isProd ? { sent: true } : { sent: true, devCode: code };
  }

  /** Verify an OTP and issue a role-scoped JWT. */
  async verifyOtp(phone: string, code: string): Promise<VerifyResult> {
    const normalized = normalizePhone(phone);
    const entry = this.otps.get(normalized);
    if (!entry || entry.expiresAt < Date.now() || entry.code !== code) {
      throw new UnauthorizedException('Invalid or expired code');
    }
    this.otps.delete(normalized);

    const parent = this.fleet.getParentByPhone(normalized);
    if (parent) {
      const payload: AuthUser = {
        role: 'parent',
        parentId: parent.id,
        phone: normalized,
      };
      return { token: await this.jwt.signAsync(payload), role: 'parent', parentId: parent.id };
    }

    const bus = this.fleet.getBusByDriverPhone(normalized);
    if (bus) {
      const payload: AuthUser = {
        role: 'driver',
        busId: bus.id,
        routeId: bus.routeId,
        phone: normalized,
      };
      return { token: await this.jwt.signAsync(payload), role: 'driver', routeId: bus.routeId };
    }

    const operator = this.fleet.getOperatorByPhone(normalized);
    if (operator) {
      const payload: AuthUser = {
        role: 'operator',
        operatorId: operator.id,
        schoolId: operator.schoolId,
        phone: normalized,
      };
      return { token: await this.jwt.signAsync(payload), role: 'operator', schoolId: operator.schoolId };
    }

    throw new UnauthorizedException('No account for this phone');
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
