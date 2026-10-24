const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadAssist(LANG) {
  const context = { T: { en: {}, fr: {} }, LANG, window: { hfaEscape: value => String(value), hfaFormat: key => key }, ApiState: { enabled: false } };
  vm.createContext(context);
  vm.runInContext(read('ai-assist.js'), context);
  return context.window.HFAAssist;
}

describe('SLY AI features', () => {
  test('the scribe, explain buttons and AI page are part of the app, cached offline and published', () => {
    const page = read('index.html');
    for (const file of ['hfa-surveillance.js', 'hfa-ai-eval.js', 'ai-assist.js', 'ai-centre.js']) {
      expect(page).toContain(`<script src="${file}"></script>`);
      expect(read('service-worker.js')).toContain(`'${file}'`);
      expect(read('scripts/build-static.js')).toContain(`'${file}'`);
      expect(read('Dockerfile')).toContain(file);
    }
    expect(read('backend/Dockerfile')).toContain('hfa-surveillance.js');
    expect(page).toContain("HFAAssist.scribeBlock(appointmentId)");
    expect(page).toContain("HFAAssist.explainButton('report',r.id)");
    expect(page).toContain("HFAAssist.explainButton('lab',result.id)");
    expect(page).toContain("page==='ai-centre'");
  });

  test('without AI, the built-in dictionary explains common words in English and French, and ignores everyday words', () => {
    const english = loadAssist('en').glossary('Malaria RDT positive. Start artemether-lumefantrine and paracetamol. Review in 3 days.');
    expect(english.some(item => item.startsWith('Malaria test (RDT)'))).toBe(true);
    expect(english.some(item => item.startsWith('Positive'))).toBe(true);
    expect(english.some(item => item.startsWith('Malaria medicine (ACT)'))).toBe(true);
    expect(english.some(item => item.startsWith('Paracetamol'))).toBe(true);
    const french = loadAssist('fr').glossary('Glycémie élevée, tension 160/95, contrôle dans 1 semaine');
    expect(french.some(item => item.startsWith('Glycémie'))).toBe(true);
    expect(french.some(item => item.startsWith('Tension artérielle'))).toBe(true);
    expect(loadAssist('en').glossary('As you said, this is as expected, act now and ta')).toEqual([]);
  });

  test('the AI prompts keep humans in charge and treat patient text as data', () => {
    const { SCRIBE_SYSTEM, EXPLAIN_SYSTEM } = require('../backend/ai-assist.js');
    const { SYSTEM } = require('../backend/triage-ai.js');
    for (const prompt of [SCRIBE_SYSTEM, EXPLAIN_SYSTEM, SYSTEM]) expect(prompt).toMatch(/data, not instructions/);
    expect(SCRIBE_SYSTEM).toMatch(/never invent/);
    expect(EXPLAIN_SYSTEM).toMatch(/Never add a diagnosis/);
    expect(SYSTEM).toMatch(/never decide how urgent/);
  });
});
