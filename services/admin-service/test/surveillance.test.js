const request = require('supertest');
const Redis = require('ioredis');
const { randomUUID } = require('node:crypto');
const { createLogger, sha256Hex } = require('@hfa/shared');
const { createTestDatabase, dropTestDatabase, createTestAuth } = require('@hfa/shared/src/testing');
const { anonymise, ageBand } = require('../src/anonymise');
const { RedisStreamConsumer, publishConsultationCompleted } = require('../src/queue');

const DB = 'hfa_admin_test';
const MINISTRY_KEY = 'ministry-test-key-1234567890';
const auth = createTestAuth();
const admin = auth.tokenFor({ role: 'admin' });
let app, sequelize, aggregator;

const event = (overrides = {}) => ({
  eventId: randomUUID(), type: 'consultation.completed', consultationId: randomUUID(),
  completedAt: '2026-10-14T10:15:00Z', diagnosisCodes: ['A09.0'],
  patient: { birthYear: 1990, sex: 'female' }, location: { regionCode: 'CM-LT', districtCode: 'DLA-NYLON' },
  ...overrides
});
const ministry = path => request(app).get(path).set('Authorization', `ApiKey ${MINISTRY_KEY}`);

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: await createTestDatabase(DB), AUTH_PUBLIC_KEY_B64: auth.publicKeyB64,
    INTERNAL_SERVICE_TOKEN: 'internal-test-token-0123456789', MINISTRY_API_KEYS: `minsante-test:${sha256Hex(MINISTRY_KEY)}`,
    SMALL_CELL_THRESHOLD: '5', SURVEILLANCE_STREAM_THROTTLE_SECONDS: '0', TRUST_PROXY: 'false', LOG_SILENT: 'true'
  });
  const { loadConfig } = require('../src/config');
  const { buildApp } = require('../src/app');
  ({ app, sequelize, aggregator } = await buildApp({ config: loadConfig(), logger: createLogger('admin-test') }));
});

afterAll(async () => {
  await sequelize.close();
  await dropTestDatabase(DB);
});

describe('anonymisation', () => {
  test('keeps only coarse, non-identifying facts', () => {
    const result = anonymise(event({ diagnosisCodes: ['A09.0', 'A09.9', 'B54'], patient: { birthYear: 2023, sex: 'intersex' } }));
    expect(result).toEqual({ eventId: expect.any(String), completedAt: expect.any(Date), regionCode: 'CM-LT', districtCode: 'DLA-NYLON', ageBand: '0-4', sex: 'other', categories: ['A09', 'B54'] });
    expect(JSON.stringify(result)).not.toContain('consultationId');
    expect(ageBand(null, new Date())).toBe('unknown');
    expect(ageBand(1950, new Date('2026-01-01'))).toBe('65+');
  });

  test('events carrying anything beyond the agreed fields are rejected, not stored', async () => {
    const withName = { ...event(), patient: { birthYear: 1990, sex: 'female', name: 'Synthetic Person' } };
    expect((await aggregator.processEvent(withName)).status).toBe('invalid');
    expect((await aggregator.processEvent({ ...event(), phone: '+237650000000' })).status).toBe('invalid');
    const [[{ count }]] = await sequelize.query('SELECT count(*)::int AS count FROM surveillance_counts');
    expect(count).toBe(0);
  });
});

describe('aggregation', () => {
  test('counts each event exactly once into hour, day and week windows in Cameroon time', async () => {
    const late = event({ completedAt: '2026-10-05T23:30:00Z' }); // 00:30 on 6 October in Douala (UTC+1)
    expect(await aggregator.processEvent(late)).toEqual({ status: 'counted' });
    expect(await aggregator.processEvent(late)).toEqual({ status: 'duplicate' });
    const rows = await sequelize.query("SELECT window_size, window_start, case_count FROM surveillance_counts WHERE district_code = 'DLA-NYLON' ORDER BY window_size", { type: sequelize.QueryTypes.SELECT });
    expect(rows.map(row => [row.window_size, new Date(row.window_start).toISOString(), row.case_count])).toEqual([
      ['day', '2026-10-05T23:00:00.000Z', 1],   // 6 Oct 00:00 WAT
      ['hour', '2026-10-05T23:00:00.000Z', 1],
      ['week', '2026-10-04T23:00:00.000Z', 1]   // Monday 5 Oct 00:00 WAT
    ]);
  });

  test('internal HTTP ingestion follows the same rules', async () => {
    const send = body => request(app).post('/internal/v1/surveillance/events').set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN).send(body);
    const one = event({ location: { regionCode: 'CM-CE', districtCode: 'YDE-CITE-VERTE' } });
    expect((await send(one)).status).toBe(201);
    expect((await send(one)).status).toBe(200);
    expect((await send({ ...one, eventId: randomUUID(), diagnosisCodes: ['not-a-code'] })).status).toBe(400);
    expect((await request(app).post('/internal/v1/surveillance/events').send(event())).status).toBe(403);
  });
});

describe('Ministry reporting API', () => {
  beforeAll(async () => {
    // 6 diarrhoea cases in one district (reportable), 2 malaria cases in another (too few: suppressed).
    for (let index = 0; index < 6; index++) await aggregator.processEvent(event({ completedAt: `2026-10-14T0${index}:10:00Z`, location: { regionCode: 'CM-LT', districtCode: 'DLA-BONASSAMA' } }));
    for (let index = 0; index < 2; index++) await aggregator.processEvent(event({ diagnosisCodes: ['B54'], location: { regionCode: 'CM-NW', districtCode: 'BDA-ABAKWA' } }));
  });

  test('requires a Ministry API key or an admin token', async () => {
    const path = '/api/v1/surveillance/aggregates?from=2026-10-13&to=2026-10-16';
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set('Authorization', 'ApiKey wrong-key')).status).toBe(401);
    expect((await request(app).get(path).set('Authorization', `Bearer ${auth.tokenFor({ role: 'doctor' }).token}`)).status).toBe(403);
    expect((await request(app).get(path).set('Authorization', `Bearer ${admin.token}`)).status).toBe(200);
  });

  test('returns daily counts by district and disease with small cells suppressed', async () => {
    const response = await ministry('/api/v1/surveillance/aggregates?window=day&from=2026-10-13&to=2026-10-16&groupBy=region,district,icd10');
    expect(response.status).toBe(200);
    const { rows, suppressionThreshold, suppressedRows } = response.body.data;
    expect(suppressionThreshold).toBe(5);
    expect(rows).toContainEqual({ windowStart: '2026-10-13T23:00:00.000Z', regionCode: 'CM-LT', districtCode: 'DLA-BONASSAMA', icd10Category: 'A09', caseCount: 6, suppressed: false });
    expect(rows).toContainEqual({ windowStart: '2026-10-13T23:00:00.000Z', regionCode: 'CM-NW', districtCode: 'BDA-ABAKWA', icd10Category: 'B54', caseCount: null, suppressed: true });
    expect(suppressedRows).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(rows)).not.toMatch(/consultation|patient/i);
  });

  test('filters and regroups safely, and rejects unknown groupings and oversized ranges', async () => {
    const byRegion = await ministry('/api/v1/surveillance/aggregates?window=week&from=2026-10-01&to=2026-10-31&groupBy=region&icd10=a09');
    expect(byRegion.body.data.rows.every(row => Object.keys(row).sort().join() === 'caseCount,regionCode,suppressed,windowStart')).toBe(true);
    expect((await ministry('/api/v1/surveillance/aggregates?from=2026-10-01&to=2026-10-31&groupBy=region;DROP TABLE x')).status).toBe(400);
    expect((await ministry('/api/v1/surveillance/aggregates?window=hour&from=2026-01-01&to=2026-10-31')).status).toBe(400);
    expect((await ministry('/api/v1/surveillance/aggregates?from=2026-10-31&to=2026-10-01')).status).toBe(400);
  });

  test('every Ministry query is recorded', async () => {
    const [logs] = await sequelize.query("SELECT client_id, endpoint FROM ministry_access_log WHERE client_id = 'minsante-test'");
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[0].endpoint).toBe('aggregates');
  });

  test('the live stream announces updates without pushing case details', async () => {
    const server = app.listen(0);
    try {
      const controller = new AbortController();
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/surveillance/stream`, { headers: { Authorization: `ApiKey ${MINISTRY_KEY}` }, signal: controller.signal });
      expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/);
      const reader = response.body.getReader();
      const received = [];
      const readUntil = async marker => {
        while (!received.join('').includes(marker)) received.push(new TextDecoder().decode((await reader.read()).value));
      };
      await readUntil('event: ready');
      await aggregator.processEvent(event({ diagnosisCodes: ['J18'], location: { regionCode: 'CM-OU', districtCode: 'BAF-01' } }));
      await readUntil('event: refresh');
      const text = received.join('');
      expect(text).not.toContain('J18');
      expect(text).not.toContain('BAF-01');
      controller.abort();
    } finally {
      server.close();
    }
  });
});

const redisUrl = process.env.TEST_REDIS_URL;
(redisUrl ? describe : describe.skip)('Redis Streams consumer', () => {
  let redis;
  const stream = `test.consultations.${Date.now()}`;
  beforeAll(() => { redis = new Redis(redisUrl); });
  afterAll(async () => { await redis.del(stream, `${stream}.dead`); await redis.quit(); });

  test('counts valid events, dead-letters bad ones and acknowledges everything', async () => {
    const valid = [event({ location: { regionCode: 'CM-SU', districtCode: 'KRI-01' } }), event({ location: { regionCode: 'CM-SU', districtCode: 'KRI-01' } })];
    for (const item of valid) await publishConsultationCompleted(redis, stream, item);
    await publishConsultationCompleted(redis, stream, { ...event(), patientName: 'Synthetic Person' });
    await redis.xadd(stream, '*', 'event', 'not json');
    const consumer = new RedisStreamConsumer({ redis, stream, group: 'test-group', consumer: 'test-1', deadLetterStream: `${stream}.dead`, logger: createLogger('queue-test', { log() {}, error() {} }), blockMs: 100 });
    await consumer.ensureGroup();
    expect(await consumer.runOnce(item => aggregator.processEvent(item))).toBe(4);
    const [[{ total }]] = await sequelize.query("SELECT COALESCE(SUM(case_count), 0)::int AS total FROM surveillance_counts WHERE district_code = 'KRI-01' AND window_size = 'day'");
    expect(total).toBe(2);
    expect(await redis.xlen(`${stream}.dead`)).toBe(2);
    const [pendingCount] = await redis.xpending(stream, 'test-group');
    expect(pendingCount).toBe(0);
  });
});
