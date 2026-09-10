import os from "node:os";

/** The address a phone on the same Wi-Fi can reach this machine at, or null. */
export function lanAddress(): string | null {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254")) return entry.address;
    }
  }
  return null;
}

/** Where the phone should point. APP_URL wins (a tunnel or a deployment); else the LAN. */
export function phoneServerUrl(): string {
  const configured = process.env.APP_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/+$/, "");
  const ip = lanAddress();
  return ip ? `http://${ip}:${process.env.PORT ?? 3000}` : "http://localhost:3000";
}
