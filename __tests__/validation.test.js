const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'validation.js'), 'utf8');

function load(lang = 'en') {
  const listeners = {};
  const context = {
    LANG: lang, window: {}, setTimeout, Date,
    document: { addEventListener: (type, handler) => { listeners[type] = handler; }, head: { insertAdjacentHTML() {} }, getElementById: () => null }
  };
  vm.runInNewContext(source, context);
  return { ...context.window.HFAValidation, listeners };
}
const field = (attributes = {}, dataset = {}) => ({ getAttribute: name => attributes[name] ?? null, dataset });
const day = offset => { const date = new Date(Date.now() + offset * 86400000); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

describe('data entry checks in the browser', () => {
  const { RULES, TIDY, phone } = load();

  test('phone numbers typed the way people type them become +237…', () => {
    expect(phone('677 30 04 00')).toBe('+237677300400');
    expect(phone('(237) 677-300-400')).toBe('+237677300400');
    expect(phone('00237677300400')).toBe('+237677300400');
    expect(phone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(RULES.phone('+237677300400')).toBeNull();
    expect(RULES.phone('+23767730040').error).toMatch(/9 digits/);
    expect(RULES.phone('+237477300400').error).toMatch(/starts with 6 or 2/);
    expect(RULES.phone('call me').error).toMatch(/\+237/);
  });

  test('names, emails and sign-in identifiers', () => {
    expect(TIDY.name('  Ako   Mbah ')).toBe('Ako Mbah');
    expect(RULES.name('Ngo Bassong Élise')).toBeNull();
    expect(RULES.name("N'Diaye-Mbappé")).toBeNull();
    expect(RULES.name('1').error).toBeTruthy();
    expect(RULES.name('<b>x</b>').error).toBeTruthy();
    expect(TIDY.email(' Ako@Example.COM ')).toBe('ako@example.com');
    expect(RULES.email('ako@example')).toHaveProperty('error');
    expect(RULES.email('ako@gmial.com').warning).toMatch(/gmail\.com/);
    expect(RULES.login('ako@example.com')).toBeNull();
    expect(RULES.login('677300400')).toBeNull();
    expect(RULES.login('ako').error).toBeTruthy();
  });

  test('passwords: length from the field, warning on a stray space', () => {
    expect(RULES.password('short', field({ minlength: '12' })).error).toMatch(/12/);
    expect(RULES.password('long-enough-pass', field({ minlength: '12' }))).toBeNull();
    expect(RULES.password(' long-enough-pass', field({ minlength: '12' })).warning).toBeTruthy();
  });

  test('dates: real calendar days, bookings not in the past, believable birth dates', () => {
    expect(RULES['future-date']('2027-02-30').error).toMatch(/real date/);
    expect(RULES['future-date'](day(-1)).error).toMatch(/today or a later/);
    expect(RULES['future-date'](day(0))).toBeNull();
    expect(RULES['future-date'](day(500)).warning).toMatch(/year/);
    expect(RULES.dob(day(1)).error).toMatch(/year of birth/);
    expect(RULES.dob('1890-01-01').error).toMatch(/year of birth/);
    expect(RULES.dob('1922-01-01').warning).toMatch(/over 100/);
    expect(RULES.dob('1990-06-15')).toBeNull();
  });

  test('times: valid clock times, a warning outside usual hours', () => {
    const time = field({}, {});
    expect(RULES.time('09:30', time)).toBeNull();
    expect(RULES.time('9.30', time).error).toBeTruthy();
    expect(RULES.time('02:00', time).warning).toMatch(/usual hours/);
    expect(RULES.licence('cm-med-2020-0042')).toBeNull();
    expect(RULES.licence('<x>')).toHaveProperty('error');
  });

  test('messages are in French when the app is', () => {
    const fr = load('fr');
    expect(fr.RULES['future-date']('2027-02-30').error).toBe('Saisissez une date réelle.');
    expect(fr.RULES.phone('+2376').error).toMatch(/numéro/);
  });

  test('checks run before a button’s own handler, on Enter and when leaving a field', () => {
    const { listeners } = load();
    expect(Object.keys(listeners).sort()).toEqual(['change', 'click', 'focusout', 'input', 'keydown', 'submit']);
  });
});
