import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthService, AuthUser } from '../auth/auth.service';
import { LatLng } from '../domain/types';
import { FleetService } from '../fleet/fleet.service';
import { PositionsService } from './positions.service';

interface SubscribePayload {
  routeId: string;
}

interface DriverGpsPayload {
  routeId: string;
  location: LatLng;
  speedKmh?: number;
}

type AuthedSocket = Socket & { data: { user?: AuthUser } };

/**
 * Realtime channel for live positions — authenticated and authorized.
 *
 * Every connection must present a valid JWT (socket handshake `auth.token`).
 * Then:
 *   - Parents may `subscribe` only to routes their own children ride.
 *   - Drivers may send `driver:gps` only for their assigned route.
 *
 * This is what stops anyone from tracking arbitrary children or spoofing a bus.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class PositionsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(PositionsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly positions: PositionsService,
    private readonly auth: AuthService,
    private readonly fleet: FleetService,
  ) {}

  afterInit(): void {
    // Fan every position update out to the subscribers of that route.
    this.positions.onUpdate((position) => {
      this.server.to(room(position.routeId)).emit('position', position);
    });
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      this.deny(client, 'missing token');
      return;
    }
    try {
      client.data.user = await this.auth.verifyToken(token);
    } catch {
      this.deny(client, 'invalid token');
    }
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: SubscribePayload,
  ): { ok: boolean } {
    const user = client.data.user;
    if (!user || user.role !== 'parent' || !body?.routeId) return { ok: false };

    if (!this.parentRoutes(user.parentId).has(body.routeId)) {
      this.logger.warn(
        `Parent ${user.parentId} denied subscribe to ${body.routeId}`,
      );
      return { ok: false };
    }

    client.join(room(body.routeId));
    const current = this.positions.getForRoute(body.routeId);
    if (current) client.emit('position', current);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: SubscribePayload,
  ): void {
    if (body?.routeId) client.leave(room(body.routeId));
  }

  @SubscribeMessage('driver:gps')
  onDriverGps(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: DriverGpsPayload,
  ): { ok: boolean } {
    const user = client.data.user;
    if (!user || user.role !== 'driver' || !body?.routeId || !body.location) {
      return { ok: false };
    }
    // A driver may only report for the route their bus is assigned to.
    if (body.routeId !== user.routeId) {
      this.logger.warn(
        `Driver ${user.busId} denied gps for ${body.routeId} (assigned ${user.routeId})`,
      );
      return { ok: false };
    }
    const updated = this.positions.ingestGps(body.routeId, body.location, body.speedKmh);
    return { ok: updated != null };
  }

  private parentRoutes(parentId: string): Set<string> {
    // A parent may track each child's morning route and its afternoon drop-off
    // counterpart (same bus, reverse direction).
    const ids = new Set<string>();
    for (const child of this.fleet.getChildrenForParent(parentId)) {
      ids.add(child.routeId);
      const afternoon = this.fleet.getRoute(child.routeId)?.afternoonRouteId;
      if (afternoon) ids.add(afternoon);
    }
    return ids;
  }

  private deny(client: Socket, reason: string): void {
    this.logger.warn(`Socket ${client.id} rejected: ${reason}`);
    client.emit('unauthorized', { reason });
    client.disconnect(true);
  }
}

function room(routeId: string): string {
  return `route:${routeId}`;
}
