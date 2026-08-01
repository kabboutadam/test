/**
 * Tenant-isolation proof. Boots the real API (in-memory mode) and exercises the
 * HTTP surface as a super-admin, two schools' operators, and two parents — then
 * asserts that no tenant can read or touch another tenant's data.
 *
 * Run:  npm run test:isolation   (builds first, then runs this)
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.TEST_PORT ?? '4055';
const BASE = `http://127.0.0.1:${PORT}/api`;
const ADMIN_PHONE = '+961 70 000 000';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

async function login(phone) {
  const req = await api('/auth/otp/request', { method: 'POST', body: { phone } });
  const code = req.data?.devCode;
  if (!code) throw new Error(`no dev code for ${phone} (is SMS_PROVIDER=console?)`);
  const ver = await api('/auth/otp/verify', { method: 'POST', body: { phone, code } });
  if (!ver.data?.token) throw new Error(`login failed for ${phone}: ${JSON.stringify(ver.data)}`);
  return ver.data.token;
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/health');
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error('server did not become healthy');
}

async function run() {
  const admin = await login(ADMIN_PHONE);

  // Super-admin creates two schools in different areas, each with an operator.
  const schoolA = (await api('/platform/schools', {
    method: 'POST', token: admin,
    body: { name: 'Tripoli Modern School', latitude: 34.436, longitude: 35.834, subscriptionStatus: 'active' },
  })).data;
  const schoolB = (await api('/platform/schools', {
    method: 'POST', token: admin,
    body: { name: 'Saida National School', latitude: 33.563, longitude: 35.369, subscriptionStatus: 'active' },
  })).data;
  check('super-admin created school A', schoolA?.id?.startsWith('sch_'));
  check('super-admin created school B', schoolB?.id?.startsWith('sch_'));

  const opAPhone = '+961 71 111 111';
  const opBPhone = '+961 71 222 222';
  await api(`/platform/schools/${schoolA.id}/operators`, {
    method: 'POST', token: admin, body: { name: 'Tripoli Ops', phone: opAPhone },
  });
  await api(`/platform/schools/${schoolB.id}/operators`, {
    method: 'POST', token: admin, body: { name: 'Saida Ops', phone: opBPhone },
  });

  const opA = await login(opAPhone);
  const opB = await login(opBPhone);

  // Each operator builds a route and adds a child with a home pin + parent phone.
  const routeA = (await api('/admin/routes', {
    method: 'POST', token: opA,
    body: { name: 'Route A', stops: [
      { name: 'Start', latitude: 34.44, longitude: 35.83 },
      { name: 'School', latitude: 34.436, longitude: 35.834 },
    ] },
  })).data;
  const routeB = (await api('/admin/routes', {
    method: 'POST', token: opB,
    body: { name: 'Route B', stops: [
      { name: 'Start', latitude: 33.57, longitude: 35.37 },
      { name: 'School', latitude: 33.563, longitude: 35.369 },
    ] },
  })).data;

  const parentAPhone = '+961 76 333 333';
  const parentBPhone = '+961 76 444 444';
  const childA = (await api('/admin/children', {
    method: 'POST', token: opA,
    body: { name: 'Aya', grade: 'Grade 2', routeId: routeA.id, latitude: 34.441, longitude: 35.832, address: 'Tripoli, Al Mina', parentPhone: parentAPhone },
  })).data;
  const childB = (await api('/admin/children', {
    method: 'POST', token: opB,
    body: { name: 'Sami', grade: 'Grade 3', routeId: routeB.id, latitude: 33.571, longitude: 35.371, address: 'Saida, Old City', parentPhone: parentBPhone },
  })).data;
  check('operator A added a child', childA?.id?.startsWith('child_'));
  check('operator B added a child', childB?.id?.startsWith('child_'));

  // --- Isolation between schools ---
  const aKids = (await api('/admin/children', { token: opA })).data;
  check('operator A sees only its own kids', Array.isArray(aKids) && aKids.length === 1 && aKids[0].id === childA.id);
  check('operator A cannot see school B kid in its list', !aKids.some((c) => c.id === childB.id));

  const aOverview = (await api('/admin/overview', { token: opA })).data;
  check('operator A overview shows only its routes', aOverview?.routes?.every((r) => r.id === routeA.id));

  const crossDelete = await api(`/admin/children/${childB.id}`, { method: 'DELETE', token: opA });
  check('operator A cannot delete school B child (403)', crossDelete.status === 403);

  const crossPatch = await api(`/admin/children/${childB.id}`, { method: 'PATCH', token: opA, body: { grade: 'hax' } });
  check('operator A cannot edit school B child (403)', crossPatch.status === 403);

  const crossBus = await api('/admin/buses', { method: 'POST', token: opA, body: { plateNumber: 'X', driverName: 'Y', driverPhone: '+961 3 000 999', routeId: routeB.id } });
  check('operator A cannot attach a bus to school B route (403/404)', crossBus.status === 403 || crossBus.status === 404);

  // --- Isolation between parents ---
  const parentA = await login(parentAPhone);
  const parentB = await login(parentBPhone);
  const pAKids = (await api('/me/children', { token: parentA })).data;
  check('parent A sees only their own child', Array.isArray(pAKids) && pAKids.length === 1 && pAKids[0].id === childA.id);
  check('parent A cannot see parent B child', !pAKids.some((c) => c.id === childB.id));

  const pBDeletesA = await api(`/me/children/${childA.id}`, { method: 'DELETE', token: parentB });
  check('parent B cannot delete parent A child (403)', pBDeletesA.status === 403);

  // --- Privilege boundaries ---
  const opTriesPlatform = await api('/platform/schools', { method: 'POST', token: opA, body: { name: 'x', latitude: 1, longitude: 1 } });
  check('operator cannot create a school (403)', opTriesPlatform.status === 403);

  const parentTriesAdmin = await api('/admin/children', { token: parentA });
  check('parent cannot reach the school admin API (403)', parentTriesAdmin.status === 403);

  const noToken = await api('/admin/children');
  check('unauthenticated admin call rejected (401)', noToken.status === 401);

  // --- School-level access gate (school pays, families track) ---
  const subActive = (await api('/me/subscription', { token: parentA })).data;
  check('parent entitled while school active', subActive?.status === 'active');

  await api(`/platform/schools/${schoolA.id}/subscription`, { method: 'PATCH', token: admin, body: { status: 'expired' } });
  const subExpired = (await api('/me/subscription', { token: parentA })).data;
  check('parent locked when school access expires', subExpired?.status === 'none');

  await api(`/platform/schools/${schoolA.id}/subscription`, { method: 'PATCH', token: admin, body: { status: 'active' } });
  const subRestored = (await api('/me/subscription', { token: parentA })).data;
  check('parent unlocked when school access restored', subRestored?.status === 'active');
}

const server = spawn('node', ['dist/main.js'], {
  env: { ...process.env, PORT, JWT_SECRET: 'test-secret', SUPERADMIN_PHONES: ADMIN_PHONE, SMS_PROVIDER: 'console', USE_PRISMA: '' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

try {
  await waitForHealth();
  console.log('\nTenant isolation:');
  await run();
} catch (err) {
  console.error(err);
  failed++;
} finally {
  server.kill('SIGTERM');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
