const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// A very small DOM: enough for the session guard's warning box and notice.
function fakeDocument() {
  const appended = [];
  const element = () => {
    const node = { className: '', innerHTML: '', textContent: '', dataset: {}, removed: false, listeners: {},
      setAttribute() {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {},
      remove() { this.removed = true; },
      querySelector(selector) { return (this.children[selector] = this.children[selector] || element()); }, children: {} };
    return node;
  };
  return {
    appended,
    head: { insertAdjacentHTML() {} },
    body: { appendChild(node) { appended.push(node); } },
    appWrap: { classList: { contains: () => false } }, // the app screen is showing
    getElementById(id) { return id === 'app-wrap' ? this.appWrap : null; },
    createElement: element,
    addEventListener() {}
  };
}

describe('automatic sign-out after inactivity', () => {
  function load() {
    let now = Date.parse('2026-10-24T08:00:00Z');
    const document = fakeDocument();
    const RealDate = Date;
    class FakeDate extends RealDate { static now() { return now; } }
    const context = {
      T: { en: {}, fr: {} }, LANG: 'en', CU: { id: 'pat1', name: 'Patient' }, document, Date: FakeDate,
      localStorage: { store: {}, getItem(key) { return this.store[key] ?? null; }, setItem(key, value) { this.store[key] = value; } },
      setInterval: () => 1, clearInterval() {}, setTimeout() {}, closeMo: jest.fn(), doLogout: jest.fn(),
      window: { hfaEscape: value => String(value), hfaFormat: (key, values) => `${key}:${JSON.stringify(values)}`, addEventListener() {} }
    };
    context.t = key => context.T.en[key] || key;
    vm.createContext(context);
    vm.runInContext(read('session-guard.js'), context);
    return { context, document, advance: ms => { now += ms; } };
  }

  test('warns one minute before and signs out after 15 minutes without activity', () => {
    const { context, document, advance } = load();
    const guard = context.window.HFASessionGuard;
    expect(guard.IDLE_MS).toBe(15 * 60 * 1000);
    guard.check(); // sign-in seen: the clock starts now
    advance(13 * 60 * 1000); guard.check();
    expect(document.appended).toHaveLength(0);
    advance(90 * 1000); guard.check();
    expect(document.appended).toHaveLength(1);
    expect(document.appended[0].className).toBe('sg-overlay');
    advance(30 * 1000); guard.check();
    expect(context.doLogout).toHaveBeenCalledTimes(1);
    expect(document.appended[0].removed).toBe(true);
    expect(document.appended[1].className).toBe('sg-notice');
  });

  test('activity keeps the session open and nothing happens when signed out', () => {
    const { context, document, advance } = load();
    const guard = context.window.HFASessionGuard;
    guard.check();
    for (let minute = 0; minute < 40; minute++) { advance(60 * 1000); guard.touch(); guard.check(); }
    expect(context.doLogout).not.toHaveBeenCalled();
    context.CU = null;
    advance(60 * 60 * 1000); guard.check();
    expect(context.doLogout).not.toHaveBeenCalled();
    expect(document.appended).toHaveLength(0);
  });
});

describe('stored XSS defence and compliance pages', () => {
  const content = read('index.html');

  test('text typed by users is escaped before it is shown', () => {
    const context = {};
    vm.createContext(context);
    vm.runInContext(content.match(/^const hx = .*$/m)[0] + ';this.hx=hx;', context);
    expect(context.hx('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(context.hx("N'Diaye & \"Co\"")).toBe('N&#39;Diaye &amp; &quot;Co&quot;');
    expect(context.hx(undefined)).toBe('');
    for (const sink of ['${hx(m.text)}', '${hx(n.text)}', '${hx(item.symptoms)}', '${hx(r.summary)}', '${hx(r.plan)}', '${hx(referral.reason)}', '${hx(review?.comment||\'\')}'])
      expect(content).toContain(sink);
  });

  test('the privacy centre, FHIR export and session guard are loaded, cached offline and published', () => {
    for (const file of ['hfa-fhir.js', 'privacy-centre.js', 'session-guard.js']) {
      expect(content).toContain(`<script src="${file}"></script>`);
      expect(read('service-worker.js')).toContain(`'${file}'`);
      expect(read('scripts/build-static.js')).toContain(`'${file}'`);
      expect(read('Dockerfile')).toContain(file);
    }
    expect(read('backend/Dockerfile')).toContain('hfa-fhir.js');
  });

  test('legal texts cite the current Cameroon data-protection law and the skip link is first', () => {
    expect(content).toContain('Law No. 2024/017');
    expect(content).not.toMatch(/Law No\. 2010\/012 on cybersecurity and personal data protection/);
    expect(content).toMatch(/<body>\s*<a href="#pgc" class="skip-link"/);
    expect(content).toContain('<main id="pgc" tabindex="-1"></main>');
  });
});
