import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";
import { env } from "./env";

const COOKIE = "chiefstaff_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function key(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * The signed-in executive, or the seeded demo user when DEMO_USER_EMAIL is set
 * and no session exists — so the product is browsable before Google is wired up.
 */
export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, key());
      const user = await db.user.findUnique({ where: { id: String(payload.sub) } });
      if (user) return user;
    } catch {
      // Expired or tampered cookie: fall through to the demo path.
    }
  }

  if (env.demoUserEmail) {
    return db.user.findUnique({ where: { email: env.demoUserEmail } });
  }
  return null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}
