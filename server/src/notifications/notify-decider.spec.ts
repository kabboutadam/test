/* Ad-hoc test runner: npx ts-node src/notifications/notify-decider.spec-run.ts */
import { Arrival } from '../domain/arrival';
import { NotificationDecider } from './notify-decider';

let failures = 0;
function check(label: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  } else {
    console.log(`ok   ${label}`);
  }
}

const incoming = (n: number): Arrival => ({ stopsAway: n, phase: 'incoming' });
const arriving: Arrival = { stopsAway: 0, phase: 'arriving' };
const passed: Arrival = { stopsAway: 0, phase: 'passed' };

const d = new NotificationDecider([3, 1, 0]);
const fired = (a: Arrival) => d.evaluate('c1', 'Maya', a)?.threshold ?? null;

// A single run: 5,4 quiet; 3 fires; 2 quiet; 1 fires; arriving fires; passed quiet.
check('5 away quiet', fired(incoming(5)), null);
check('4 away quiet', fired(incoming(4)), null);
check('3 away fires 3', fired(incoming(3)), 3);
check('3 again quiet', fired(incoming(3)), null);
check('2 away quiet', fired(incoming(2)), null);
check('1 away fires 1', fired(incoming(1)), 1);
check('arriving fires 0', fired(arriving), 0);
check('passed quiet', fired(passed), null);

// New run re-arms.
check('new run 4 quiet', fired(incoming(4)), null);
check('new run 3 fires 3', fired(incoming(3)), 3);
check('new run 1 fires 1', fired(incoming(1)), 1);

// Independent child tracked separately.
check('other child 3 fires', d.evaluate('c2', 'Karim', incoming(3))?.threshold ?? null, 3);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
