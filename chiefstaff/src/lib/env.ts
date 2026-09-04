/** Environment access with a loud failure instead of a silent `undefined`. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}. See .env.example`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get anthropicApiKey() {
    return required("ANTHROPIC_API_KEY");
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get googleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback";
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get demoUserEmail() {
    return process.env.DEMO_USER_EMAIL ?? null;
  },
};

/** True when Google OAuth is configured; the UI degrades gracefully without it. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
