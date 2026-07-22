import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { LatLng } from '../domain/types';
import { PositionsService } from './positions.service';

interface SubscribePayload {
  routeId: string;
}

interface DriverGpsPayload {
  routeId: string;
  location: LatLng;
  speedKmh?: number;
}

/**
 * Realtime channel for live positions.
 *
 * Parents:  emit `subscribe {routeId}` -> join that route's room and receive
 *           `position` events every time the bus moves.
 * Drivers:  emit `driver:gps {routeId, location, speedKmh}` -> feed the bus's
 *           real position, which is snapped to the route and rebroadcast.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class PositionsGateway implements OnGatewayInit {
  private readonly logger = new Logger(PositionsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly positions: PositionsService) {}

  afterInit(): void {
    // Fan every position update out to the subscribers of that route.
    this.positions.onUpdate((position) => {
      this.server.to(room(position.routeId)).emit('position', position);
    });
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribePayload,
  ): void {
    if (!body?.routeId) return;
    client.join(room(body.routeId));
    const current = this.positions.getForRoute(body.routeId);
    if (current) client.emit('position', current);
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: SubscribePayload,
  ): void {
    if (body?.routeId) client.leave(room(body.routeId));
  }

  @SubscribeMessage('driver:gps')
  onDriverGps(@MessageBody() body: DriverGpsPayload): { ok: boolean } {
    if (!body?.routeId || !body.location) return { ok: false };
    const updated = this.positions.ingestGps(
      body.routeId,
      body.location,
      body.speedKmh,
    );
    return { ok: updated != null };
  }
}

function room(routeId: string): string {
  return `route:${routeId}`;
}
