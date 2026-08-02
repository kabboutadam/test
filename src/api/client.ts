/**
 * Minimal typed REST client for the BusMapp API. Adds the `/api` prefix and an
 * optional Bearer token. Throws ApiError on non-2xx so callers can branch on
 * `.status` (e.g. 401 -> sign out).
 */

import { apiUrl } from '@/api/config';
import { Child, Route, School, Subscription } from '@/models/types';

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

export interface VerifyResult {
  token: string;
  role: 'parent' | 'driver' | 'operator' | 'superadmin';
  parentId?: string;
  routeId?: string;
  schoolId?: string;
}

export function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  return request('/auth/otp/verify', { method: 'POST', body: { phone, code } });
}

// --- School operator (guarded, scoped to the operator's school) ---

export interface AdminOverview {
  school: { id: string; name: string; location: { latitude: number; longitude: number } } | null;
  routes: { id: string; name: string; stopCount: number; childCount: number; plateNumber: string | null }[];
  totals: { routes: number; buses: number; children: number };
}

export interface AdminChild {
  id: string;
  name: string;
  grade: string;
  address: string | null;
  routeId: string;
  routeName: string | null;
  location: { latitude: number; longitude: number } | null;
  scheduledTime: string | null;
  parentPhone: string | null;
  parentName: string | null;
}

export interface AdminNewChild {
  name: string;
  grade?: string;
  routeId: string;
  latitude: number;
  longitude: number;
  address?: string;
  parentPhone: string;
  parentName?: string;
}

export interface AdminChildPatch {
  name?: string;
  grade?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export function adminOverview(token: string): Promise<AdminOverview> {
  return request('/admin/overview', { token });
}

/** Create a route with just a name — the school is the destination and each
 * child's pin fills in the pickup stops. */
export function adminCreateRoute(
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return request('/admin/routes', { method: 'POST', body: { name }, token });
}

export function adminListChildren(token: string): Promise<AdminChild[]> {
  return request('/admin/children', { token });
}

export function adminAddChild(token: string, body: AdminNewChild): Promise<Child> {
  return request('/admin/children', { method: 'POST', body, token });
}

export function adminUpdateChild(
  token: string,
  id: string,
  body: AdminChildPatch,
): Promise<Child> {
  return request(`/admin/children/${id}`, { method: 'PATCH', body, token });
}

export function adminRemoveChild(token: string, id: string): Promise<{ ok: boolean }> {
  return request(`/admin/children/${id}`, { method: 'DELETE', token });
}

// --- Parent data (guarded) ---

export function fetchChildren(token: string): Promise<Child[]> {
  return request('/me/children', { token });
}

export interface NewChild {
  name: string;
  grade: string;
  routeId: string;
  stopId: string;
}

export function createChild(token: string, child: NewChild): Promise<Child> {
  return request('/me/children', { method: 'POST', body: child, token });
}

export interface ChildPatch {
  name?: string;
  grade?: string;
  routeId?: string;
  stopId?: string;
}

export function updateChild(token: string, id: string, patch: ChildPatch): Promise<Child> {
  return request(`/me/children/${id}`, { method: 'PATCH', body: patch, token });
}

export function deleteChild(token: string, id: string): Promise<{ ok: boolean }> {
  return request(`/me/children/${id}`, { method: 'DELETE', token });
}

export function fetchSubscription(token: string): Promise<Subscription> {
  return request('/me/subscription', { token });
}

export interface CheckoutResult {
  paymentId: string;
  checkoutId: string;
  provider: string;
  amountUsd: number;
  redirectUrl?: string;
}

/** Start a checkout — creates a pending payment; does not yet activate. */
export function createCheckout(
  token: string,
  planId: 'monthly' | 'yearly',
): Promise<CheckoutResult> {
  return request('/me/billing/checkout', { method: 'POST', body: { planId }, token });
}

/** Confirm a payment; on success the subscription is activated server-side. */
export function confirmPayment(token: string, paymentId: string): Promise<Subscription> {
  return request('/me/billing/confirm', { method: 'POST', body: { paymentId }, token });
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

export function fetchSchools(): Promise<School[]> {
  return request('/schools');
}

export function fetchRoutesForSchool(schoolId: string): Promise<Route[]> {
  return request(`/schools/${schoolId}/routes`);
}
