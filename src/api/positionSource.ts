/**
 * A PositionSource emits a map of routeId -> BusPosition and can be started,
 * stopped, and reset. The app doesn't care whether positions come from the
 * built-in simulator or the backend socket — that's the whole point of this
 * seam. AppContext picks one based on `config.useBackend`.
 */

import { io, Socket } from 'socket.io-client';

import { BusPosition } from '@/models/types';
import { socketUrl } from '@/api/config';

export type PositionsListener = (positions: Record<string, BusPosition>) => void;

export interface PositionSource {
  subscribe(listener: PositionsListener): () => void;
  start(): void;
  stop(): void;
  reset(): void;
}

/**
 * Live positions from the NestJS server over Socket.IO. Subscribes to each
 * route's room and merges incoming `position` events into a single map.
 */
export class BackendPositionSource implements PositionSource {
  private socket: Socket | null = null;
  private readonly positions: Record<string, BusPosition> = {};
  private readonly listeners = new Set<PositionsListener>();

  constructor(
    private readonly routeIds: string[],
    private readonly token: string,
  ) {}

  start(): void {
    if (this.socket) return;
    const socket = io(socketUrl, {
      transports: ['websocket'],
      auth: { token: this.token },
    });
    this.socket = socket;

    socket.on('connect', () => {
      for (const routeId of this.routeIds) {
        socket.emit('subscribe', { routeId });
      }
    });

    socket.on('position', (position: BusPosition) => {
      this.positions[position.routeId] = position;
      this.emit();
    });
  }

  stop(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  /** The server owns the simulation; a client reset is a no-op here. */
  reset(): void {}

  subscribe(listener: PositionsListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.positions });
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = { ...this.positions };
    for (const l of this.listeners) l(snapshot);
  }
}
