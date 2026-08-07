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

  // Simple app flow: create a route with just a name (school auto-destination).
  const simpleRoute = (await api('/admin/routes', {
    method: 'POST', token: opA, body: { name: 'Simple Bus' },
  })).data;
  check('name-only route created with a destination stop', simpleRoute?.id && simpleRoute.stops?.length >= 1);
  const simpleChild = (await api('/admin/children', {
    method: 'POST', token: opA,
    body: { name: 'Lea', routeId: simpleRoute.id, latitude: 34.44, longitude: 35.83, parentPhone: '+961 76 555 555' },
  })).data;
  check('child added to a name-only route', simpleChild?.id?.startsWith('child_'));

  // Add a child with NO route — auto-joins the school's pickup list.
  const autoChild = (await api('/admin/children', {
    method: 'POST', token: opA,
    body: { name: 'Rana', latitude: 34.442, longitude: 35.833, parentPhone: '+961 76 666 666' },
  })).data;
  check('child added with no route (auto pickup list)', autoChild?.id?.startsWith('child_') && !!autoChild.routeId);

  // Arrange the pickup order and compute times.
  const arranged = (await api('/admin/arrange', {
    method: 'POST', token: opA,
    body: { childIds: [autoChild.id, childA.id], schoolArrival: '07:30' },
  })).data;
  check('arrange returns computed pickup times', arranged?.schedule?.length >= 1 && /^\d{2}:\d{2}$/.test(arranged.schedule[0].scheduledTime));
  check('arrange reports its timing mode', arranged?.mode === 'road' || arranged?.mode === 'estimate');

  // Multiple buses: create a second list, add a kid to it, arrange just it.
  const bus2 = (await api('/admin/routes', { method: 'POST', token: opA, body: { name: 'Bus 2' } })).data;
  check('second bus created', bus2?.id?.startsWith('route_'));
  const bus2Child = (await api('/admin/children', {
    method: 'POST', token: opA,
    body: { name: 'Sami', routeId: bus2.id, latitude: 34.45, longitude: 35.84, parentPhone: '+961 76 777 777' },
  })).data;
  check('child added to a chosen bus', bus2Child?.routeId === bus2.id);
  const sched2 = (await api('/admin/arrange', {
    method: 'POST', token: opA,
    body: { routeId: bus2.id, childIds: [bus2Child.id], schoolArrival: '08:00' },
  })).data;
  check('arrange targets a single bus', sched2?.schedule?.length === 1 && /^\d{2}:\d{2}$/.test(sched2.schedule[0].scheduledTime));

  // Move a child from their bus onto bus 2.
  await api('/admin/children/' + autoChild.id, { method: 'PATCH', token: opA, body: { routeId: bus2.id } });
  const afterMove = (await api('/admin/children', { token: opA })).data;
  check('child moved to another bus', afterMove.find((c) => c.id === autoChild.id)?.routeId === bus2.id);

  // --- Isolation between schools ---
  const aKids = (await api('/admin/children', { token: opA })).data;
  check('operator A sees its own kids', Array.isArray(aKids) && aKids.some((c) => c.id === childA.id));
  check('operator A cannot see school B kid in its list', !aKids.some((c) => c.id === childB.id));

  const aOverview = (await api('/admin/overview', { token: opA })).data;
  check('operator A overview excludes school B routes', aOverview?.routes?.every((r) => r.id !== routeB.id) && aOverview.routes.some((r) => r.id === routeA.id));

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

  // --- Driver GPS ingestion over HTTP (the background-location path) ---
  await api('/admin/buses', {
    method: 'POST', token: opA,
    body: { plateNumber: 'B 111', driverName: 'Nabil', driverPhone: '+961 3 111 222', routeId: routeA.id },
  });
  const driverA = await login('+961 3 111 222');
  const gpsOk = await api('/driver/positions', {
    method: 'POST', token: driverA,
    body: { routeId: routeA.id, points: [{ latitude: 34.44, longitude: 35.83, speedKmh: 30 }] },
  });
  check('driver can post GPS for their own route', gpsOk.data?.ok === true);
  const gpsWrong = await api('/driver/positions', {
    method: 'POST', token: driverA,
    body: { routeId: routeB.id, points: [{ latitude: 34.44, longitude: 35.83 }] },
  });
  check('driver cannot post GPS for another route (403)', gpsWrong.status === 403);
  const gpsParent = await api('/driver/positions', {
    method: 'POST', token: parentA,
    body: { routeId: routeA.id, points: [{ latitude: 34.44, longitude: 35.83 }] },
  });
  check('parent cannot post driver GPS (403)', gpsParent.status === 403);

  // Lebanon phone normalization: a driver registered with a LOCAL-format number
  // can log in with any format of the same number (and vice-versa).
  await api('/admin/buses', {
    method: 'POST', token: opA,
    body: { plateNumber: 'B 222', driverName: 'Sami', driverPhone: '03 999 888', routeId: simpleRoute.id },
  });
  const localFmtLogin = await login('+9613999888'); // different format, same number
  check('driver logs in across phone formats (local ⇄ +961)', typeof localFmtLogin === 'string' && localFmtLogin.length > 20);

  // Driver's pickup manifest: their own route's kids, in order.
  const manifest = (await api('/driver/manifest', { token: driverA })).data;
  check('driver manifest lists their route kids in order',
    manifest?.routeName === routeA.name &&
    Array.isArray(manifest.pickups) &&
    manifest.pickups.some((p) => p.name === 'Aya') &&
    manifest.pickups.every((p, i, a) => i === 0 || a[i - 1].order <= p.order));
  const manifestParent = await api('/driver/manifest', { token: parentA });
  check('parent cannot read driver manifest (403)', manifestParent.status === 403);

  // Delete a bus (route): empty deletes; with kids is blocked; cross-school denied.
  const tempBus = (await api('/admin/routes', { method: 'POST', token: opA, body: { name: 'Temp bus' } })).data;
  const delEmpty = await api('/admin/routes/' + tempBus.id, { method: 'DELETE', token: opA });
  check('operator deletes an empty bus', delEmpty.data?.ok === true);
  const delWithKids = await api('/admin/routes/' + routeA.id, { method: 'DELETE', token: opA });
  check('deleting a bus with kids is blocked (400)', delWithKids.status === 400);
  const delCross = await api('/admin/routes/' + routeB.id, { method: 'DELETE', token: opA });
  check('operator cannot delete another school bus (403/404)', delCross.status === 403 || delCross.status === 404);

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
  env: { ...process.env, PORT, JWT_SECRET: 'test-secret', SUPERADMIN_PHONES: ADMIN_PHONE, SMS_PROVIDER: 'console', USE_PRISMA: '', OSRM_URL: '' },
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
