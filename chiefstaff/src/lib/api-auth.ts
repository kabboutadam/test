import { createHash, randomBytes, randomInt } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "./db";

/**
 * Auth for the phone app.
 *
 * The phone never sees a password and never touches Google OAuth. The web,
 * which is already signed in, shows a short code; the phone types it and
 * receives a long-lived bearer token. Same pattern as linking a TV, and for
 * the same reason: typing on the small screen is the part to minimise.
 */

const CODE_TTL_MS = 10 * 60_000;
/** No 0/O/1/I — read aloud across a room, these are the ones that go wrong. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createLinkCode(userId: string): Promise<{ code: string; expiresAt: Date }> {
  // One live code per person: issuing a new one invalidates the old.
  await db.linkCode.deleteMany({ where: { userId, usedAt: null } });

  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];

  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.linkCode.create({ data: { userId, code, expiresAt } });
  return { code, expiresAt };
}

/** Exchange a code for a token. The token is returned exactly once. */
export async function redeemLinkCode(
  rawCode: string,
  label: string,
): Promise<{ token: string; user: User } | null> {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const link = await db.linkCode.findUnique({ where: { code }, include: { user: true } });

  if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.linkCode.update({ where: { id: link.id }, data: { usedAt: new Date() } }),
    db.apiToken.create({ data: { userId: link.userId, tokenHash: hash(token), label } }),
  ]);

  return { token, user: link.user };
}

/** The user behind a bearer token, or null. Touches lastUsedAt sparingly. */
export async function userFromBearer(header: string | null): Promise<User | null> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const record = await db.apiToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!record || record.revokedAt) return null;

  // One write per hour per token, not per request.
  if (!record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 3_600_000) {
    await db.apiToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
  }
  return record.user;
}

export async function revokeBearer(header: string | null): Promise<boolean> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const { count } = await db.apiToken.updateMany({
    where: { tokenHash: hash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count > 0;
}
