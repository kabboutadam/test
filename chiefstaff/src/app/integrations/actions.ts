"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { connectIntegration, removeIntegration, syncIntegrations, type IntegrationKind } from "@/core/integrations";
import { runDeterministic } from "@/core/pipeline";

export interface FormResult {
  ok: boolean;
  message: string;
}

export async function connectAction(_previous: FormResult | null, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") as IntegrationKind;
  if (!["imap", "ics", "csv_url"].includes(kind)) return { ok: false, message: "unknown source" };
  try {
    const { summary } = await connectIntegration(user, {
      kind,
      label: String(formData.get("label") ?? "").trim(),
      host: String(formData.get("host") ?? ""),
      port: Number(formData.get("port") ?? 993) || 993,
      user: String(formData.get("user") ?? ""),
      password: String(formData.get("password") ?? ""),
      url: String(formData.get("url") ?? ""),
    });
    revalidatePath("/integrations");
    return { ok: true, message: summary };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "could not connect" };
  }
}

export async function removeAction(id: string): Promise<void> {
  const user = await requireUser();
  await removeIntegration(user.id, id);
  revalidatePath("/integrations");
}

/** Pull the non-Google sources now and run the deterministic steps, so a new link shows up immediately. */
export async function syncIntegrationsAction(): Promise<void> {
  const user = await requireUser();
  await syncIntegrations(user);
  await runDeterministic(user);
  revalidatePath("/integrations");
  revalidatePath("/brief");
}

/** Mint a key for Zapier, Make or a script. Shown once; only its hash is stored. */
export async function createApiKeyAction(_previous: FormResult | null, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim() || "integration";
  const token = `cs_${randomBytes(24).toString("base64url")}`;
  await db.apiToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), label } });
  revalidatePath("/integrations");
  return { ok: true, message: token };
}

export async function revokeApiKeyAction(id: string): Promise<void> {
  const user = await requireUser();
  await db.apiToken.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } });
  revalidatePath("/integrations");
}
