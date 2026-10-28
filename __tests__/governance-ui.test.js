const fs = require('fs');
const path = require('path');
const vm = require('vm');
const countryData = require('../country-data.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'governance-ui.js'), 'utf8');

function load(role, online = true) {
  const calls = [], rendered = [];
  const context = {
    T: { en: {}, fr: {} }, LANG: 'en', CU: { id: 'u1', role }, NAV: { doctor: [{ items: [] }], nurse: [{ items: [] }] },
    HFACountryData: countryData, ApiState: { enabled: online, authenticated: online, offline: false }, window: { hfaEscape: String, hfaFormat: key => key },
    t: key => key, tv: value => value, $: () => null,
    apiRequest: async url => { calls.push(url); return { data: { alerts: [], clinicians: [], patients: [], open: 0, critical: 0, resolved: 0 } }; }
  };
  context.window.renderSafety = () => rendered.push('browser-only');
  context.window.renderAdminControl = () => rendered.push('control');
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, calls, rendered };
}
const page = () => ({ innerHTML: '', querySelectorAll: () => [] });

describe('governance registers on the server', () => {
  test('doctors and nurses get a medication safety page for their own patients', async () => {
    const { context, calls } = load('doctor');
    expect(context.NAV.doctor[0].items[0].id).toBe('safety');
    expect(context.NAV.nurse[0].items[0].id).toBe('safety');
    context.$ = () => ({ isConnected: true, innerHTML: '', querySelectorAll: () => [] });
    context.window.renderSafety(page());
    await new Promise(resolve => setImmediate(resolve));
    expect(calls).toEqual(['/api/v1/safety/alerts']);
  });

  test('administrators see the licence and consent registers and alert counts from the server', async () => {
    const { context, calls } = load('admin');
    context.$ = () => ({ isConnected: true, innerHTML: '', querySelectorAll: () => [] });
    const screen = page();
    context.window.renderSafety(screen);
    await new Promise(resolve => setImmediate(resolve));
    expect(calls.sort()).toEqual(['/api/v1/admin/clinicians', '/api/v1/admin/consents', '/api/v1/admin/country-reviews', '/api/v1/safety/alerts']);
    expect(screen.innerHTML).toContain('id="gv-country-reviews"');
  });

  test('country review console selects Cameroon, renders review gates, and loads audit history', async () => {
    const { context, calls } = load('admin');
    const history = { isConnected: true, innerHTML: '' };
    const select = { addEventListener: jest.fn() };
    const countryBox = { isConnected: true, innerHTML: '', querySelectorAll: () => [] };
    context.$ = id => ({ tbt: {}, 'gv-country-reviews': countryBox, 'gv-country-history': history, 'gv-country-code': select }[id] || null);
    const reviews = ['clinical', 'privacy', 'emergency', 'language', 'payments', 'provider_credentials'].map(capability => ({
      capability, status: capability === 'clinical' ? 'expired' : 'pending', reviewOwner: '', source: '', sourceReference: '', expiresOn: null, scope: 'internal', note: ''
    }));
    context.apiRequest = async url => {
      calls.push(url);
      if (url === '/api/v1/admin/country-reviews') return { data: { countries: [{ countryCode: 'CM', country: 'Cameroon', launchReady: false, reviews }] } };
      if (url === '/api/v1/admin/country-reviews/CM/history') return { data: { events: [] } };
      return { data: { open: 0, critical: 0, resolved: 0, patients: [], clinicians: [] } };
    };
    const screen = page();
    context.window.renderSafety(screen);
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(calls).toContain('/api/v1/admin/country-reviews');
    expect(calls).toContain('/api/v1/admin/country-reviews/CM/history');
    expect(countryBox.innerHTML).toContain('gv_country_clinical');
    expect(countryBox.innerHTML).toContain('gv_review_reference');
    expect(countryBox.innerHTML).toContain('value="expired" selected disabled');
    expect(countryBox.innerHTML).toContain('value="CM" selected');
  });

  test('without the server the original screen is kept', () => {
    const { context, rendered, calls } = load('admin', false);
    context.window.renderSafety(page());
    expect(rendered).toEqual(['browser-only']);
    expect(calls).toHaveLength(0);
  });
});
