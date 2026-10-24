const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'clinical-sync.js'), 'utf8');

function load(server) {
  const calls = [], hooks = {};
  const context = {
    T: { en: {}, fr: {} }, LANG: 'en', CU: { id: 'pat-1', role: 'patient' }, CP: 'appointments', window: { dispatchEvent() {} },
    DB: { appointments: [], messages: [] }, ApiState: { enabled: true, authenticated: true, offline: false },
    setInterval: () => 1, document: { activeElement: null, getElementById: () => null }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    $: () => ({ classList: { contains: () => true } }), renderPage: jest.fn(),
    HFAOffline: { register: (name, hook) => { hooks[name] = hook; }, saveSoon() {}, afterOnlineLogin: async () => 'ok', afterSessionRestore: async () => 'ok' },
    apiRequest: async (url, method = 'GET', body) => { calls.push({ url, method, body }); return server(url, method, body); }
  };
  context.t = key => key; context.tf = key => key; context.window.HFA_IMPERSONATED_BY = null;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls, hooks, sync: context.window.HFAClinicalSync };
}
const failure = (status, body = {}) => Object.assign(new Error(body.error || 'refused'), { status, body });

describe('clinical records sync', () => {
  test('downloads the record after sign-in, sends local edits with the confirmed version, and fetches only changes', async () => {
    const server = jest.fn(async (url, method, body) => {
      if (method === 'GET') return { data: { records: url.includes('since') ? [] : [{ collection: 'appointments', id: 'apt-1', version: 3, data: { id: 'apt-1', patientId: 'pat-1', status: 'scheduled' } }], serverTime: '2026-10-24T10:00:00Z' } };
      return { data: { version: body.baseVersion + 1 } };
    });
    const { context, calls, sync } = load(server);
    await context.HFAOffline.afterOnlineLogin({ id: 'pat-1' }, 'password');
    expect(context.DB.appointments[0].status).toBe('scheduled');
    expect(calls.filter(call => call.method === 'PUT')).toHaveLength(0);
    // A booking change made here is sent once, naming version 3.
    context.DB.appointments[0].status = 'rescheduled';
    await sync.push();
    await sync.push();
    const puts = calls.filter(call => call.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe('/api/v1/clinical/appointments/apt-1');
    expect(puts[0].body.baseVersion).toBe(3);
    // A new message is created with version 0, and the next download asks only for changes.
    context.DB.messages.push({ id: 'm-1', from: 'pat-1', to: 'doc-1', text: 'Hello' });
    await sync.push();
    expect(calls.at(-1).body.baseVersion).toBe(0);
    await sync.pull();
    expect(calls.at(-1).url).toBe('/api/v1/clinical?since=2026-10-24T10%3A00%3A00Z');
  });

  test('a change someone made first is replaced by the latest copy, a refused new record is removed, and network loss retries later', async () => {
    let mode = 'conflict';
    const server = async (url, method, body) => {
      if (method === 'GET') return { data: { records: [{ collection: 'appointments', id: 'apt-1', version: 1, data: { id: 'apt-1', patientId: 'pat-1', status: 'scheduled' } }], serverTime: 't1' } };
      if (mode === 'conflict') throw failure(409, { current: { collection: 'appointments', id: 'apt-1', version: 2, data: { id: 'apt-1', patientId: 'pat-1', status: 'completed' } } });
      if (mode === 'refuse') throw failure(403, { error: 'You can only create records about yourself' });
      throw new TypeError('network down');
    };
    const { context, calls, sync } = load(server);
    await sync.start();
    context.DB.appointments[0].status = 'cancelled';
    await sync.push();
    expect(context.DB.appointments[0].status).toBe('completed');
    mode = 'refuse';
    context.DB.appointments.push({ id: 'apt-x', patientId: 'pat-2', status: 'scheduled' });
    await sync.push();
    expect(context.DB.appointments.some(item => item.id === 'apt-x')).toBe(false);
    mode = 'network';
    context.DB.messages.push({ id: 'm-9', from: 'pat-1', to: 'doc-1', text: 'Offline message' });
    await sync.push();
    expect(context.DB.messages.some(item => item.id === 'm-9')).toBe(true);
    const tries = calls.filter(call => call.url.endsWith('/m-9')).length;
    await sync.push();
    expect(calls.filter(call => call.url.endsWith('/m-9')).length).toBe(tries + 1);
  });

  test('confirmed versions are kept in the offline copy, and an administrator signed in as staff never sends changes', async () => {
    const server = async (url, method) => method === 'GET' ? { data: { records: [{ collection: 'messages', id: 'm-1', version: 4, data: { id: 'm-1', from: 'a', to: 'b', text: 'x' } }], serverTime: 't2' } } : { data: { version: 9 } };
    const { context, calls, hooks, sync } = load(server);
    await sync.start();
    expect(hooks.clinicalSync.save().known.messages['m-1'].version).toBe(4);
    expect(hooks.clinicalSync.save().serverTime).toBe('t2');
    context.window.HFA_IMPERSONATED_BY = { id: 'adm-1' };
    context.DB.messages[0].text = 'changed while signed in as';
    await sync.push();
    expect(calls.filter(call => call.method === 'PUT')).toHaveLength(0);
  });
});
