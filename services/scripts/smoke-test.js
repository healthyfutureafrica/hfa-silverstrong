// End-to-end smoke test against a running stack (docker compose up). Goes through the gateway
// only, like a real client.   node scripts/smoke-test.js <ministry-api-key>
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const BASE = process.env.GATEWAY_URL || 'http://localhost:8090';
const ministryKey = process.argv[2];
const project = process.env.COMPOSE_PROJECT || 'hfa-micro';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`); };
const call = async (path, options = {}) => {
  const response = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json().catch(() => null), headers: response.headers };
};

(async () => {
  check('gateway is up', (await fetch(`${BASE}/healthz`)).status === 200);
  check('internal routes are not reachable from outside', (await call('/internal/v1/users', { method: 'POST', body: '{}' })).status === 404);

  const email = `smoke-${Date.now()}@example.invalid`;
  const password = 'Smoke-test-password-1';
  check('patient registration', (await call('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })).status === 201);
  const login = await call('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const cookie = login.headers.get('set-cookie') || '';
  check('login returns an access token and an HttpOnly refresh cookie', login.status === 200 && Boolean(login.body?.data?.accessToken) && /HttpOnly/i.test(cookie));
  const token = login.body.data.accessToken;
  const refreshed = await call('/api/v1/auth/refresh', { method: 'POST', body: '{}', headers: { Cookie: cookie.split(';')[0], 'X-HFA-Request': '1' } });
  check('refresh rotates the session', refreshed.status === 200 && refreshed.headers.get('set-cookie')?.split(';')[0] !== cookie.split(';')[0]);

  const profile = await call('/api/v1/patients', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ firstName: 'Smoke', lastName: 'Test', regionCode: 'CM-LT', districtCode: 'DLA-NYLON', phone: `+2376${String(Date.now()).slice(-8)}`, consents: [{ type: 'terms_of_service', granted: true }, { type: 'teleconsultation', granted: true }] })
  });
  check('patient profile created in the User Service', profile.status === 201, profile.body?.data?.hfaNumber);
  const own = await call(`/api/v1/patients/${profile.body?.data?.id}/profile`, { headers: { Authorization: `Bearer ${token}` } });
  check('patient reads their decrypted profile', own.body?.data?.patient?.firstName === 'Smoke');

  // Publish consultation events to Redis as the Consultation Service would.
  const district = `SMOKE-${Date.now().toString(36).toUpperCase()}`.slice(0, 20);
  for (let index = 0; index < 6; index++) {
    const event = { eventId: randomUUID(), type: 'consultation.completed', consultationId: randomUUID(), completedAt: new Date().toISOString(), diagnosisCodes: ['A09.0'], patient: { birthYear: 1990, sex: 'female' }, location: { regionCode: 'CM-LT', districtCode: district } };
    // Arguments are passed without a shell, so the JSON needs no quoting on any OS.
    execFileSync('docker', ['compose', '-p', project, 'exec', '-T', 'redis', 'redis-cli', 'XADD', 'consultations.completed', '*', 'event', JSON.stringify(event)], { stdio: 'pipe' });
  }
  let total = null;
  const from = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 20 && total !== 6; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const report = await call(`/api/v1/surveillance/aggregates?window=day&from=${from}&to=${to}&districtCode=${district}&groupBy=district,icd10`, { headers: { Authorization: `ApiKey ${ministryKey}` } });
    total = report.body?.data?.rows?.reduce((sum, row) => sum + (row.caseCount || 0), 0) ?? null;
  }
  check('Redis events are aggregated and served to the Ministry API', total === 6, `count ${total}`);
  check('Ministry API rejects requests without a key', (await call(`/api/v1/surveillance/aggregates?from=${from}&to=${to}`)).status === 401);

  const failed = results.filter(ok => !ok).length;
  console.log(failed ? `${failed} check(s) failed` : 'ALL SMOKE CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error('Smoke test crashed:', error.message); process.exit(1); });
