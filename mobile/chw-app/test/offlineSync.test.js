const crypto = require('node:crypto');
const { createPayloadCipher } = require('../src/crypto/payloadCipher');
const { createConsultationQueue } = require('../src/storage/consultationQueue');
const { createSyncService } = require('../src/sync/syncService');
const { createApiClient } = require('../src/api/client');

// In-memory stand-in for AsyncStorage with the same API.
function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: async key => (map.has(key) ? map.get(key) : null),
    setItem: async (key, value) => { map.set(key, value); },
    removeItem: async key => { map.delete(key); },
    getAllKeys: async () => [...map.keys()],
    multiGet: async keys => keys.map(key => [key, map.get(key) ?? null])
  };
}

function fakeNetInfo(online = false) {
  const listeners = new Set();
  return {
    state: { isConnected: online, isInternetReachable: online },
    fetch: async function () { return this.state; },
    addEventListener(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(isOnline) { this.state = { isConnected: isOnline, isInternetReachable: isOnline }; listeners.forEach(listener => listener(this.state)); }
  };
}

function setup({ online = false } = {}) {
  const key = crypto.randomBytes(32);
  const storage = memoryStorage();
  const clock = { now: 1_000_000 };
  const cipher = createPayloadCipher({ crypto, getKey: async () => key, Buffer });
  const queue = createConsultationQueue({ storage, cipher, now: () => clock.now, randomId: () => crypto.randomUUID() });
  const received = new Map();
  const api = {
    submitConsultation: jest.fn(async (consultation, idempotencyKey) => {
      if (!received.has(idempotencyKey)) received.set(idempotencyKey, { consultation, id: crypto.randomUUID() });
      return { ok: true, serverId: received.get(idempotencyKey).id };
    })
  };
  const netInfo = fakeNetInfo(online);
  const sync = createSyncService({ queue, api, netInfo, logger: { warn() {} }, intervalMs: 3600000 });
  return { key, storage, clock, cipher, queue, api, netInfo, sync, received };
}

const consultation = (overrides = {}) => ({ chwId: 'chw-1', patient: { fullName: 'Synthetic Child', ageYears: 2 }, vitals: { spo2: 97 }, notes: 'Synthetic note', triage: { level: 'routine', reasons: [] }, ...overrides });

describe('encrypted offline storage', () => {
  test('records are encrypted in AsyncStorage and bound to their id', async () => {
    const { storage, queue, cipher } = setup();
    const { localId } = await queue.save(consultation());
    const stored = [...storage.map.values()].join('');
    expect(stored).not.toContain('Synthetic Child');
    expect(stored).not.toContain('Synthetic note');
    const record = await queue.get(localId);
    expect(await queue.open(record)).toMatchObject({ patient: { fullName: 'Synthetic Child' } });
    await expect(cipher.decrypt(record.payload, 'chw-consultation:another-id')).rejects.toThrow();
  });

  test('a different device key cannot read the records', async () => {
    const { queue } = setup();
    const { localId } = await queue.save(consultation());
    const record = await queue.get(localId);
    const otherCipher = createPayloadCipher({ crypto, getKey: async () => crypto.randomBytes(32), Buffer });
    await expect(otherCipher.decrypt(record.payload, `chw-consultation:${localId}`)).rejects.toThrow();
  });
});

describe('offline-first sync', () => {
  test('saves while offline and sends automatically when the connection returns', async () => {
    const { queue, api, netInfo, sync, received, storage } = setup({ online: false });
    const stop = sync.start();
    await queue.save(consultation());
    await queue.save(consultation({ notes: 'Second' }));
    await sync.syncNow();
    expect(api.submitConsultation).not.toHaveBeenCalled();
    expect((await queue.counts()).pending).toBe(2);

    netInfo.set(true); // connectivity restored
    await new Promise(resolve => setTimeout(resolve, 10));
    await sync.syncNow();
    expect(received.size).toBe(2);
    expect(await queue.counts()).toEqual({ pending: 0, needsReview: 0, synced: 2 });
    expect([...storage.map.values()].join('')).not.toContain('Synthetic'); // local copies removed after sync
    stop();
  });

  test('emergencies and escalations are sent first', async () => {
    const { queue, api, sync, clock } = setup({ online: true });
    await queue.save(consultation({ notes: 'routine' }));
    clock.now += 1000;
    await queue.save(consultation({ notes: 'emergency', triage: { level: 'emergency', reasons: ['Convulsions'] } }));
    await sync.syncNow();
    expect(api.submitConsultation.mock.calls.map(([payload]) => payload.notes)).toEqual(['emergency', 'routine']);
  });

  test('a dropped connection never creates duplicates: the same Idempotency-Key is reused', async () => {
    const { queue, api, sync, clock, received } = setup({ online: true });
    const { localId } = await queue.save(consultation());
    api.submitConsultation.mockImplementationOnce(async (payload, key) => {
      received.set(key, { consultation: payload, id: 'server-1' }); // the server stored it...
      return { ok: false, kind: 'network', message: 'Connection reset' }; // ...but the reply was lost
    });
    await sync.syncNow();
    expect((await queue.get(localId)).status).toBe('pending');
    clock.now += 60 * 60000; // after the retry delay
    await sync.syncNow();
    expect(api.submitConsultation.mock.calls.map(([, key]) => key)).toEqual([localId, localId]);
    expect(received.size).toBe(1);
    expect(await queue.get(localId)).toMatchObject({ status: 'synced', serverId: 'server-1' });
  });

  test('retries back off, rejected records wait for review, and an expired login pauses sync', async () => {
    const { queue, api, sync, clock } = setup({ online: true });
    const retry = await queue.save(consultation({ notes: 'retry' }));
    api.submitConsultation.mockResolvedValueOnce({ ok: false, kind: 'server', message: 'HTTP 503' });
    await sync.syncNow();
    const afterFailure = await queue.get(retry.localId);
    expect(afterFailure).toMatchObject({ status: 'pending', attempts: 1, lastError: 'HTTP 503' });
    expect(afterFailure.nextAttemptAt).toBeGreaterThan(clock.now);
    api.submitConsultation.mockClear();
    await sync.syncNow();
    expect(api.submitConsultation).not.toHaveBeenCalled(); // still waiting out the back-off

    const invalid = await queue.save(consultation({ notes: 'invalid' }));
    api.submitConsultation.mockResolvedValueOnce({ ok: false, kind: 'rejected', message: 'districtCode is invalid' });
    await sync.syncNow();
    expect(await queue.get(invalid.localId)).toMatchObject({ status: 'needs_review', lastError: 'districtCode is invalid' });

    const later = await queue.save(consultation({ notes: 'later' }));
    api.submitConsultation.mockResolvedValueOnce({ ok: false, kind: 'auth', message: 'Please sign in again' });
    const result = await sync.syncNow();
    expect(result.skipped).toBe('signin_required');
    expect((await queue.get(later.localId)).status).toBe('pending');
  });

  test('only one sync runs at a time', async () => {
    const { queue, api, sync } = setup({ online: true });
    await queue.save(consultation());
    let release;
    api.submitConsultation.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ ok: true, serverId: 'x' }); }));
    const first = sync.syncNow();
    const second = sync.syncNow();
    await new Promise(resolve => setTimeout(resolve, 10));
    release();
    await Promise.all([first, second]);
    expect(api.submitConsultation).toHaveBeenCalledTimes(1);
  });

  test('synced entries are pruned after a week', async () => {
    const { queue, sync, clock, storage } = setup({ online: true });
    await queue.save(consultation());
    await sync.syncNow();
    clock.now += 8 * 86400000;
    expect(await queue.pruneSynced()).toBe(1);
    expect(storage.map.size).toBe(0);
  });
});

describe('API client', () => {
  const ok = body => new Response(JSON.stringify(body), { status: 201 });

  test('sends the Idempotency-Key and CSRF header, and classifies failures', async () => {
    const calls = [];
    let responses = [ok({ success: true, data: { consultationId: 'c-1' } })];
    const fetchImpl = async (url, options) => { calls.push({ url, options }); const next = responses.shift(); if (next instanceof Error) throw next; return next; };
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: async () => 'access-1', refreshSession: async () => false, fetchImpl });
    expect(await client.submitConsultation({ a: 1 }, 'local-1')).toEqual({ ok: true, serverId: 'c-1' });
    expect(calls[0].options.headers).toMatchObject({ 'Idempotency-Key': 'local-1', 'X-HFA-Request': '1', Authorization: 'Bearer access-1' });

    responses = [new TypeError('Network request failed')];
    expect(await client.submitConsultation({}, 'k')).toMatchObject({ ok: false, kind: 'network' });
    responses = [new Response('{}', { status: 503 })];
    expect(await client.submitConsultation({}, 'k')).toMatchObject({ kind: 'server' });
    responses = [new Response(JSON.stringify({ success: false, message: 'Validation failed' }), { status: 400 })];
    expect(await client.submitConsultation({}, 'k')).toMatchObject({ kind: 'rejected', message: 'Validation failed' });
    responses = [new Response('{}', { status: 401 })];
    expect(await client.submitConsultation({}, 'k')).toMatchObject({ kind: 'auth' });
  });

  test('refreshes the session once on 401 and retries', async () => {
    let token = 'expired';
    const responses = [new Response('{}', { status: 401 }), ok({ success: true, data: { consultationId: 'c-2' } })];
    const fetchImpl = jest.fn(async () => responses.shift());
    const client = createApiClient({ baseUrl: 'https://api.test', getAccessToken: async () => token, refreshSession: async () => { token = 'fresh'; return true; }, fetchImpl });
    expect(await client.submitConsultation({}, 'k')).toEqual({ ok: true, serverId: 'c-2' });
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });
});
