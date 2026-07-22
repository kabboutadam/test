import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { computeStopsAway, stopIndexOf } from '../domain/arrival';
import { BusPosition } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { PositionsService } from '../positions/positions.service';
import { NotificationDecider } from './notify-decider';
import { ExpoPushClient, PushMessage } from './push.client';
import { PushTokenStore } from './push-token.store';

/**
 * Watches every position update and pushes "N stops away" / "arriving"
 * notifications to the parents of children on that route, once per threshold per
 * run (see NotificationDecider). This is why push works with the app closed: the
 * trigger lives on the server, next to the live positions.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly decider = new NotificationDecider();

  constructor(
    private readonly positions: PositionsService,
    private readonly fleet: FleetService,
    private readonly tokens: PushTokenStore,
    private readonly push: ExpoPushClient,
  ) {}

  onModuleInit(): void {
    this.positions.onUpdate((position) => {
      void this.handle(position);
    });
  }

  private async handle(position: BusPosition): Promise<void> {
    const route = this.fleet.getRoute(position.routeId);
    if (!route) return;

    const messages: PushMessage[] = [];
    for (const child of this.fleet.getChildrenForRoute(position.routeId)) {
      const childStopIndex = stopIndexOf(route, child.stopId);
      if (childStopIndex < 0) continue;

      const arrival = computeStopsAway(position, route, childStopIndex);
      const decision = this.decider.evaluate(child.id, child.name, arrival);
      if (!decision) continue;

      const parentTokens = this.tokens.tokensFor(child.parentId);
      for (const to of parentTokens) {
        messages.push({
          to,
          title: decision.title,
          body: decision.body,
          data: {
            childId: child.id,
            routeId: route.id,
            stopsAway: decision.threshold,
          },
        });
      }
      this.logger.log(
        `${child.name}: ${decision.title} (${parentTokens.length} device(s))`,
      );
    }

    await this.push.send(messages);
  }
}
