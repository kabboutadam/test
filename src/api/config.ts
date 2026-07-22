import Constants from 'expo-constants';

/**
 * Backend connection config, read from app.json `expo.extra`. Kept in one place
 * so switching the demo between the built-in simulator and the real NestJS API
 * is a single flag.
 *
 * app.json:
 *   "extra": { "useBackend": false, "apiBaseUrl": "http://localhost:3000" }
 *
 * On a physical device, replace `localhost` with your machine's LAN IP so the
 * phone can reach the server (e.g. http://192.168.1.20:3000).
 */
interface Extra {
  useBackend?: boolean;
  apiBaseUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  useBackend: extra.useBackend === true,
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:3000',
};

/** REST base (NestJS uses the `/api` global prefix). */
export const apiUrl = (path: string): string =>
  `${config.apiBaseUrl.replace(/\/$/, '')}/api${path}`;

/** Socket.IO connects to the server root (no `/api` prefix). */
export const socketUrl = config.apiBaseUrl.replace(/\/$/, '');
