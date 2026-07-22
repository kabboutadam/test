/* Ad-hoc test: npx ts-node src/auth/sms/sms-provider.spec.ts */
import { ConsoleSmsProvider, TwilioSmsProvider } from './sms-provider';

let failures = 0;
function check(label: string, cond: boolean): void {
  if (!cond) { failures++; console.log(`FAIL ${label}`); }
  else console.log(`ok   ${label}`);
}

async function main(): Promise<void> {
  // Console provider: name + no throw.
  const c = new ConsoleSmsProvider();
  check('console name', c.name === 'console');
  await c.send('+9613555777', 'hi');

  // Twilio provider: verify the request shape with a stubbed fetch.
  const calls: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200, text: async () => '' } as Response;
  }) as typeof fetch;

  try {
    const t = new TwilioSmsProvider('AC_test', 'tok_test', '+15550001111');
    await t.send('+9613000111', 'Your BusMapp verification code is 123456');
  } finally {
    globalThis.fetch = realFetch;
  }

  const call = calls[0];
  check('twilio one call', calls.length === 1);
  check('twilio url', call.url === 'https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json');
  const auth = (call.init.headers as Record<string, string>).Authorization;
  const expectedAuth = 'Basic ' + Buffer.from('AC_test:tok_test').toString('base64');
  check('twilio basic auth', auth === expectedAuth);
  const body = String(call.init.body);
  check('twilio To', body.includes('To=%2B9613000111'));
  check('twilio From', body.includes('From=%2B15550001111'));
  check('twilio Body', body.includes('Body=Your+BusMapp+verification+code+is+123456'));

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
