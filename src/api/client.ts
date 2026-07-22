/**
 * Minimal typed REST client for the BusMapp API. Adds the `/api` prefix and an
 * optional Bearer token. Throws ApiError on non-2xx so callers can branch on
 * `.status` (e.g. 401 -> sign out).
 */

import { apiUrl } from '@/api/config';
import { Child, Route, Subscription } from '@/models/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(apiUrl(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

// --- Auth ---

export function requestOtp(phone: string): Promise<{ sent: boolean; devCode?: string }> {
  return request('/auth/otp/request', { method: 'POST', body: { phone } });
}

export function verifyOtp(
  phone: string,
  code: string,
): Promise<{ token: string; parentId: string }> {
  return request('/auth/otp/verify', { method: 'POST', body: { phone, code } });
}

// --- Parent data (guarded) ---

export function fetchChildren(token: string): Promise<Child[]> {
  return request('/me/children', { token });
}

export function fetchSubscription(token: string): Promise<Subscription> {
  return request('/me/subscription', { token });
}

export function activateSubscription(
  token: string,
  planId: 'monthly' | 'yearly',
): Promise<Subscription> {
  return request('/me/subscription', { method: 'POST', body: { planId }, token });
}

export function registerPushToken(
  token: string,
  pushToken: string,
): Promise<{ ok: boolean }> {
  return request('/me/push-token', { method: 'POST', body: { token: pushToken }, token });
}

// --- Public ---

export function fetchRoutes(): Promise<Route[]> {
  return request('/routes');
}
