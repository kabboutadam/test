import { Injectable } from '@nestjs/common';

/**
 * Registry of Expo push tokens per parent. In-memory for now; persist to a
 * `PushToken` table (parentId, token, platform, updatedAt) alongside the other
 * Prisma models for production so tokens survive restarts.
 */
@Injectable()
export class PushTokenStore {
  private readonly byParent = new Map<string, Set<string>>();

  add(parentId: string, token: string): void {
    const set = this.byParent.get(parentId) ?? new Set<string>();
    set.add(token);
    this.byParent.set(parentId, set);
  }

  remove(parentId: string, token: string): void {
    this.byParent.get(parentId)?.delete(token);
  }

  tokensFor(parentId: string): string[] {
    return [...(this.byParent.get(parentId) ?? [])];
  }
}
