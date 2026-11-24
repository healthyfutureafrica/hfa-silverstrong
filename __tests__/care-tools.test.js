const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'care-tools-ui.js'), 'utf8');
const MedSafety = require('../hfa-medsafety.js');

describe('care tools: e-prescriptions, lab orders, support, call health card', () => {
  test('scripts load after the dispatch screens, with the safety rules before the screens that use them', () => {
    const order = ['dispatch-ui.js', 'hfa-medsafety.js', 'care-tools-ui.js'].map(file => page.indexOf(`<script src="${file}"></script>`));
    expect(order.every(index => index > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const file of ['service-worker.js', 'Dockerfile', path.join('scripts', 'build-static.js')]) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      expect(text).toContain('hfa-medsafety.js'); expect(text).toContain('care-tools-ui.js');
    }
    expect(fs.readFileSync(path.join(root, 'backend', 'Dockerfile'), 'utf8')).toContain('hfa-medsafety.js');
  });

  test('new clinical collections sync and are routed', () => {
    expect(fs.readFileSync(path.join(root, 'clinical-sync.js'), 'utf8')).toContain("'prescriptions', 'labOrders'");
    expect(page).toContain("if (typeof HFACareTools!=='undefined' && HFACareTools.handles(page, r)) return HFACareTools.renderPage(page, pc);");
    for (const id of ["'prescriptions'", "'my-prescriptions'", "'e-prescriptions'", "'lab-orders'", "'support'"]) expect(ui).toContain(id);
  });

  test('the doctor’s screen screens with the same rules the server enforces and asks for an override reason', () => {
    expect(ui).toContain('HFAMedSafety.check(items, patientContext(patient))');
    expect(ui).toContain("findings.some(f => f.level === 'major') && reason.length < 10");
    const { findings } = MedSafety.check([{ drug: 'Amoxicillin' }, { drug: 'Ibuprofen' }], { drugAllergies: [{ name: 'Penicillin', severity: 'mild' }], medicines: ['Warfarin'] });
    expect(findings.filter(f => f.level === 'major').map(f => f.kind).sort()).toEqual(['allergy', 'interaction']);
    expect(MedSafety.check([{ drug: 'Paracetamol' }], { drugAllergies: [], medicines: [] }).findings).toEqual([]);
  });

  test('user-entered text is escaped before display', () => {
    expect(ui).toContain('const esc = window.hfaEscape');
    expect(ui).not.toMatch(/\$\{(item|r|o|k|m)\.(drug|text|subject|notes|patientName|clinicalInfo)\}/);
  });
});
