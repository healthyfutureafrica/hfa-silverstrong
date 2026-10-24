const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'real-world.js'), 'utf8');

function load({ online = true } = {}) {
  const calls = [], local = [];
  const context = {
    T: { en: {}, fr: {} }, LANG: 'fr', CU: { id: 'doc-1', role: 'doctor' }, DB: { users: [] }, crypto: globalThis.crypto,
    ApiState: { enabled: online, authenticated: online, offline: false },
    window: { hfaEscape: String, hfaFormat: key => key }, t: key => key, document: { getElementById: () => null },
    apiRequest: async (url, method, body) => { calls.push({ url, method, body }); return {}; }
  };
  context.window.notifyUser = (...args) => local.push(['notify', ...args]);
  context.window.fhTrack = (...args) => local.push(['track', ...args]);
  context.window.approvedDoctorPhoto = () => 'local-photo';
  context.window.pendingApprovalsCount = () => 0;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls, local };
}

describe('features that reach real people through the server', () => {
  test('a notification to someone else goes through the server, not just this browser', () => {
    const { context, calls, local } = load();
    context.window.notifyUser('pat-1', 'New lab result', 'Lab Results');
    expect(calls[0]).toMatchObject({ url: '/api/v1/notify', method: 'POST', body: { to: 'pat-1', resource: 'Lab Results' } });
    expect(local).toHaveLength(0);
    // Without the server the screen behaves as before.
    const offline = load({ online: false });
    offline.context.window.notifyUser('pat-1', 'x', 'Lab Results');
    expect(offline.calls).toHaveLength(0);
    expect(offline.local).toHaveLength(1);
  });

  test('Health Hub statistics send only the event type, a topic id and the language, never search words', () => {
    const { context, calls } = load();
    context.window.fhTrack('search', { query: 'my name is Ako and I have HIV' });
    context.window.fhTrack('view', { topicId: 'malaria' });
    expect(calls.map(call => call.body)).toEqual([{ type: 'search', topic: '', lang: 'fr' }, { type: 'view', topic: 'malaria', lang: 'fr' }]);
  });

  test('approved doctor portraits come from the server, and waiting items count as approvals', () => {
    const { context } = load();
    expect(context.window.approvedDoctorPhoto({ id: 'doc-1', doctorPhotoApprovedAt: '2026-10-25T08:00:00Z' })).toBe('/api/v1/users/doc-1/doctor-photo?v=2026-10-25T08%3A00%3A00Z');
    expect(context.window.approvedDoctorPhoto({ id: 'doc-2' })).toBeNull();
    context.DB.users.push({ id: 'doc-2', role: 'doctor', doctorPhotoStatus: 'pending' }, { id: 'pat-2', role: 'patient', idVerificationStatus: 'pending', idDocument: { id: 'x' } }, { id: 'nur-1', role: 'nurse', status: 'pending_approval' });
    expect(context.window.pendingApprovalsCount()).toBe(3);
  });
});
