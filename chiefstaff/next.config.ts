import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "googleapis"],
  // The repo above this folder has its own lockfile; this app's root is here.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
