import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { userFromBearer } from "./api-auth";

/** JSON helpers for the mobile API. Every route uses these, so shape stays uniform. */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export function error(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Resolve the caller or return a 401. Routes call this first. */
export async function authed(request: NextRequest): Promise<{ user: User } | { response: NextResponse }> {
  const user = await userFromBearer(request.headers.get("authorization"));
  if (!user) return { response: error("not signed in", 401) };
  return { user };
}

export async function body<T>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
