const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'dispatch-ui.js'), 'utf8');

describe('ambulance dispatch screens', () => {
  test('are loaded after the hospital contact directory and cached for offline use', () => {
    expect(page.indexOf('<script src="dispatch-ui.js"></script>')).toBeGreaterThan(page.indexOf('<script src="ambulance.js"></script>'));
    expect(fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8')).toContain("'dispatch-ui.js'");
    expect(fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8')).toContain('dispatch-ui.js');
    expect(fs.readFileSync(path.join(root, 'scripts', 'build-static.js'), 'utf8')).toContain("'dispatch-ui.js'");
  });

  test('route crew and admin pages through the page router', () => {
    expect(page).toContain("if (typeof HFADispatch!=='undefined' && HFADispatch.handles(page, r)) return HFADispatch.renderPage(page, pc);");
    expect(ui).toContain("NAV.ambulance = [");
    expect(ui).toContain("{ id: 'sos-console'");
    expect(ui).toContain("{ id: 'fleet'");
  });

  test('keep the emergency number one tap away and promise only what is true', () => {
    expect(ui).toContain('const callButton = ()');
    expect(ui).toContain("ds_eta_wait: 'Time of arrival is shown once a crew accepts.'");
    expect(ui).toContain("ds_s_no_unit: 'No HFA partner ambulance is free nearby.");
    expect(ui).not.toMatch(/simulat/i);
  });

  test('every element the sidebar builder looks up exists (regression: missing #sb-security broke the menu)', () => {
    const builder = page.match(/function buildSidebar\(\) \{[\s\S]*?\n\}/)[0];
    for (const [, id] of builder.matchAll(/\$\('([a-z0-9-]+)'\)/g)) expect(page).toContain(`id="${id}"`);
  });
});
