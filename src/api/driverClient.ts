/**
 * Driver-side connection. Opens a socket to the backend and streams GPS for the
 * route the driver is running. The server snaps each reading onto the route and
 * rebroadcasts it to every parent watching that route.
 */

import { io, Socket } from 'socket.io-client';

import { socketUrl } from '@/api/config';
import { LatLng } from '@/models/types';

export class DriverClient {
  private socket: Socket | null = null;

  /** Connect with a driver JWT; the server authorizes gps against its route. */
  connect(token: string): void {
    if (this.socket) return;
    this.socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token },
    });
  }

  sendGps(routeId: string, location: LatLng, speedKmh?: number): void {
    this.socket?.emit('driver:gps', { routeId, location, speedKmh });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }
}
