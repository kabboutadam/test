import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CurrentSuperadmin } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizePhone } from '../domain/phone';
import { Operator, School, SubscriptionStatus } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';

interface CreateSchoolBody {
  name: string;
  latitude: number;
  longitude: number;
  subscriptionStatus?: SubscriptionStatus;
  renewsAt?: string | null;
}
interface CreateOperatorBody {
  name: string;
  phone: string;
}
interface SetSubscriptionBody {
  status: SubscriptionStatus;
  renewsAt?: string | null;
}

const STATUSES: SubscriptionStatus[] = ['trial', 'active', 'expired', 'none'];

/**
 * Platform-owner API. Only a super-admin (phone in SUPERADMIN_PHONES) can reach
 * these — this is where you onboard schools across Lebanon and hand each one a
 * login. Everything a school then does is isolated to its own tenant.
 */
@UseGuards(JwtAuthGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly fleet: FleetService) {}

  /** List every school with headline counts and access status. */
  @Get('schools')
  listSchools(@CurrentSuperadmin() _admin: { phone: string }) {
    return this.fleet.getSchools().map((school) => {
      const routes = this.fleet.getRoutesForSchool(school.id);
      const children = this.fleet.getChildrenForSchool(school.id);
      const operators = this.fleet
        .getOperators()
        .filter((o) => o.schoolId === school.id);
      return {
        id: school.id,
        name: school.name,
        location: school.location,
        subscriptionStatus: school.subscriptionStatus,
        renewsAt: school.renewsAt,
        counts: {
          routes: routes.length,
          children: children.length,
          operators: operators.length,
        },
        operators: operators.map((o) => ({ id: o.id, name: o.name, phone: o.phone })),
      };
    });
  }

  /** Onboard a new school. Defaults to a 14-day trial so it can start at once. */
  @Post('schools')
  async createSchool(
    @CurrentSuperadmin() _admin: { phone: string },
    @Body() body: CreateSchoolBody,
  ): Promise<School> {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    if (typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      throw new BadRequestException('latitude and longitude are required');
    }
    const status = body.subscriptionStatus ?? 'trial';
    if (!STATUSES.includes(status)) throw new BadRequestException('invalid status');

    const renewsAt =
      body.renewsAt ??
      (status === 'trial'
        ? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10)
        : null);

    return this.fleet.addSchool({
      id: `sch_${randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      location: { latitude: body.latitude, longitude: body.longitude },
      subscriptionStatus: status,
      renewsAt,
    });
  }

  /** Provision a login for a school: a phone that logs in via OTP as operator. */
  @Post('schools/:id/operators')
  async addOperator(
    @CurrentSuperadmin() _admin: { phone: string },
    @Param('id') schoolId: string,
    @Body() body: CreateOperatorBody,
  ): Promise<Operator> {
    const school = this.fleet.getSchool(schoolId);
    if (!school) throw new NotFoundException('school not found');
    if (!body?.name?.trim() || !body.phone?.trim()) {
      throw new BadRequestException('name and phone are required');
    }
    const phone = normalizePhone(body.phone);
    if (this.fleet.getOperatorByPhone(phone)) {
      throw new BadRequestException('an operator already uses this phone');
    }
    return this.fleet.addOperator({
      id: `op_${randomUUID().slice(0, 8)}`,
      name: body.name.trim(),
      phone,
      schoolId,
    });
  }

  /** Sell/renew or suspend a school's access (school pays, families track). */
  @Patch('schools/:id/subscription')
  async setSubscription(
    @CurrentSuperadmin() _admin: { phone: string },
    @Param('id') schoolId: string,
    @Body() body: SetSubscriptionBody,
  ): Promise<School> {
    const school = this.fleet.getSchool(schoolId);
    if (!school) throw new NotFoundException('school not found');
    if (!STATUSES.includes(body?.status)) throw new BadRequestException('invalid status');
    return this.fleet.updateSchool({
      ...school,
      subscriptionStatus: body.status,
      renewsAt: body.renewsAt ?? school.renewsAt,
    });
  }
}
