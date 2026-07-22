import { PrismaClient } from '@prisma/client';

/**
 * Lazily-created, shared PrismaClient. Only imported when USE_PRISMA=true (via
 * dynamic import in the repository factories), so memory mode never loads
 * @prisma/client and needs no `prisma generate` / database.
 */
let client: PrismaClient | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!client) {
    client = new PrismaClient();
    await client.$connect();
  }
  return client;
}
