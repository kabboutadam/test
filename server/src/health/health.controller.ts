import { Controller, Get } from '@nestjs/common';

/** Liveness probe for platform health checks (Render/Fly/Railway). Public. */
@Controller('health')
export class HealthController {
  @Get()
  health(): { ok: boolean; service: string; time: string } {
    return { ok: true, service: 'busmapp-api', time: new Date().toISOString() };
  }
}
