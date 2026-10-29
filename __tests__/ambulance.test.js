const fs = require('fs');
const path = require('path');
const vm = require('vm');
const countryData = require('../country-data.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'ambulance.js'), 'utf8');

function setup({ providers = [], online = false, locationPermission = true, code = 'CM' } = {}) {
  const panel = { innerHTML: '' }, storage = new Map(), calls = [];
  const dictionary = { en: {}, fr: {} };
  const context = {
    T: dictionary, LANG: 'en', CU: null, priceCountry: () => code,
    HFACountryData: countryData, AbortController, setTimeout, clearTimeout,
    t: key => dictionary.en[key] || key,
    navigator: { geolocation: { getCurrentPosition: (success, failure) => {
      if (locationPermission) success({ coords: { latitude: 4.05, longitude: 9.7, accuracy: 18 } });
      else failure({ code: 1 });
    } } },
    document: { head: { insertAdjacentHTML: () => {} }, getElementById: id => id === 'st-ambulance-panel' ? panel : null },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    fetch: async url => {
      calls.push(url);
      if (!online) throw new Error('offline');
      return { ok: true, json: async () => ({ data: { providers } }) };
    },
    window: {}
  };
  context.window.hfaEscape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  context.window.hfaFormat = (key, values) => String(dictionary.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name]);
  context.window.HFACountryData = countryData;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, panel, storage, calls };
}

const provider = (id, name, latitude, longitude, phone, sms = null) => ({
  id, name, countryCode: 'CM', phone, sms, latitude, longitude, coverage: 'Test area',
  expiresOn: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)
});

describe('ambulance handoff', () => {
  test('uses an unexpired saved directory offline, ranks distance and only shares location through an explicit SMS link', async () => {
    const near = provider('near', 'Nearest Hospital', 4.051, 9.701, '+237676000001', '+237676000002');
    const far = provider('far', 'Far Hospital', 5.1, 10.1, '+237676000003');
    const app = setup();
    app.storage.set('hfa.verified-ambulance-directory.v1', JSON.stringify({
      fetchedAt: Date.now(), providers: [far, near]
    }));

    await app.context.window.HFAAmbulance.findNearest();

    expect(app.calls).toEqual(['/api/v1/facilities/ambulance?countryCode=CM']);
    expect(app.panel.innerHTML.indexOf('Nearest Hospital')).toBeLessThan(app.panel.innerHTML.indexOf('Far Hospital'));
    expect(app.panel.innerHTML).toContain('tel:+237676000001');
    expect(app.panel.innerHTML).toContain('sms:+237676000002?body=');
    expect(app.panel.innerHTML).toContain('Location to share: 4.05000, 9.70000');
    expect(app.panel.innerHTML).toContain('HFA has not booked a vehicle or processed a payment');
    expect(app.storage.get('hfa.verified-ambulance-directory.v1')).not.toContain('4.05000');
  });

  test('does not look up providers when mandatory GPS permission is denied', async () => {
    const app = setup({ locationPermission: false });
    await app.context.window.HFAAmbulance.findNearest();
    expect(app.calls).toHaveLength(0);
    expect(app.panel.innerHTML).toContain('Location is required');
  });

  test('network-loaded public contacts are cached without caching patient coordinates', async () => {
    const app = setup({ providers: [provider('h1', 'Verified Hospital', 4.051, 9.701, '+237676000001')], online: true });
    await app.context.window.HFAAmbulance.findNearest();
    const saved = app.storage.get('hfa.verified-ambulance-directory.v1');
    expect(saved).toContain('Verified Hospital');
    expect(saved).not.toContain('4.05000');
    expect(app.panel.innerHTML).toContain('has not booked a vehicle or processed a payment');
  });

  test('rejects a provider directory for another country', async () => {
    const app = setup({ code: 'NG', providers: [provider('cm', 'Cameroon Hospital', 4.051, 9.701, '+237676000001')], online: true });
    await app.context.window.HFAAmbulance.findNearest();
    expect(app.panel.innerHTML).toContain('No current verified ambulance contacts');
  });
});
