// Outbreak early warning from SLY Triage — shared by the server (require) and the site (window.HFASurveillance).
//
// Groups symptom checks into syndromes used in WHO/Africa CDC Integrated Disease Surveillance and Response
// (IDSR), counts them by region and division per week, and raises signals:
// - "alert" syndromes (suspected cholera, meningitis, measles/mpox-like fever with rash): a small cluster in one
//   division within 7 days is enough to warn the district surveillance team;
// - trend syndromes (fever, respiratory, diarrhoea): this week's count is unusually high compared with the previous
//   4 weeks (Poisson test, p < 0.01, at least 5 cases and at least twice the baseline).
// Statistics only — no AI model and no cost. Signals are not diagnoses: they tell surveillance staff where to look.
// Inputs carry no names or IDs; the weekly export hides counts below 3 so people cannot be recognised.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFASurveillance = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const DAY = 86400000;
  const SMALL_CELL = 3;
  const SYNDROMES = {
    awd: { kind: 'alert', min: 2, label: { en: 'Acute watery diarrhoea (suspected cholera)', fr: 'Diarrhée aqueuse aiguë (choléra suspect)' }, action: { en: 'Notify the district surveillance officer today and test stool samples.', fr: 'Informez aujourd’hui le responsable de surveillance du district et faites tester les selles.' } },
    meningitis: { kind: 'alert', min: 2, label: { en: 'Fever with stiff neck (suspected meningitis)', fr: 'Fièvre avec raideur de la nuque (méningite suspecte)' }, action: { en: 'Notify the district surveillance officer today; lumbar puncture at a hospital.', fr: 'Informez aujourd’hui le responsable de surveillance du district ; ponction lombaire à l’hôpital.' } },
    fever_rash: { kind: 'alert', min: 2, label: { en: 'Fever with rash (suspected measles or mpox)', fr: 'Fièvre avec éruption (rougeole ou mpox suspecte)' }, action: { en: 'Notify the district surveillance officer and check vaccination status.', fr: 'Informez le responsable de surveillance du district et vérifiez le statut vaccinal.' } },
    bloody_diarrhoea: { kind: 'alert', min: 3, label: { en: 'Bloody diarrhoea (suspected shigellosis)', fr: 'Diarrhée sanglante (shigellose suspecte)' }, action: { en: 'Notify the district surveillance officer and check water sources.', fr: 'Informez le responsable de surveillance du district et vérifiez les sources d’eau.' } },
    fever: { kind: 'trend', label: { en: 'Fever (malaria and other infections)', fr: 'Fièvre (paludisme et autres infections)' }, action: { en: 'Check malaria test stocks and positivity in the area.', fr: 'Vérifiez les stocks et la positivité des tests de paludisme dans la zone.' } },
    respiratory: { kind: 'trend', label: { en: 'Cough or breathing problems', fr: 'Toux ou problèmes respiratoires' }, action: { en: 'Look for influenza-like illness or pneumonia clusters.', fr: 'Recherchez des grappes de syndromes grippaux ou de pneumonies.' } },
    diarrhoea: { kind: 'trend', label: { en: 'Diarrhoea or vomiting', fr: 'Diarrhée ou vomissements' }, action: { en: 'Check water and sanitation, and oral rehydration salt stocks.', fr: 'Vérifiez l’eau, l’assainissement et les stocks de sels de réhydratation orale.' } }
  };

  /** Syndromes one symptom check belongs to (it can belong to several). */
  function syndromesOf({ complaints = [], dangerSigns = [] }) {
    const has = value => complaints.includes(value), sign = value => dangerSigns.includes(value);
    const out = [];
    if (sign('watery_diarrhoea')) out.push('awd');
    if (has('fever') && sign('stiff_neck')) out.push('meningitis');
    if (has('fever') && has('skin_rash')) out.push('fever_rash');
    if (sign('blood_in_stool')) out.push('bloody_diarrhoea');
    if (has('fever')) out.push('fever');
    if (has('cough_breathing')) out.push('respiratory');
    if (has('diarrhoea_vomiting')) out.push('diarrhoea');
    return out;
  }

  /** P(X >= k) for X ~ Poisson(lambda). */
  function poissonTail(k, lambda) {
    if (k <= 0) return 1;
    let term = Math.exp(-lambda), cumulative = term;
    for (let i = 1; i < k; i++) { term *= lambda / i; cumulative += term; }
    return Math.max(0, 1 - cumulative);
  }

  const isoWeek = date => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return `${d.getUTCFullYear()}-W${String(Math.ceil(((d - start) / DAY + 1) / 7)).padStart(2, '0')}`;
  };

  /**
   * @param {Array<{date, region, division, complaints, dangerSigns}>} events  one per symptom check
   * @returns {{signals, weekly, counted, unknownPlace}}
   */
  function analyse(events, { now = Date.now() } = {}) {
    const current = now - 7 * DAY, baselineStart = now - 35 * DAY;
    const groups = new Map(), weekly = new Map();
    let counted = 0, unknownPlace = 0;
    for (const event of events) {
      const time = Date.parse(event.date);
      if (!time || time < baselineStart || time > now) continue;
      counted++;
      if (!event.region) unknownPlace++;
      for (const syndrome of syndromesOf(event)) {
        for (const area of [{ region: event.region || 'unknown', division: null }, { region: event.region || 'unknown', division: event.division || null }]) {
          if (area.division === null && SYNDROMES[syndrome].kind === 'alert') continue; // alerts are local
          if (SYNDROMES[syndrome].kind === 'trend' && area.division !== null) continue; // trends by region
          const key = `${syndrome}|${area.region}|${area.division || ''}`;
          const group = groups.get(key) || { syndrome, region: area.region, division: area.division, current: 0, baseline: 0 };
          if (time >= current) group.current++; else group.baseline++;
          groups.set(key, group);
        }
        const weekKey = `${isoWeek(new Date(time))}|${event.region || 'unknown'}|${syndrome}`;
        weekly.set(weekKey, (weekly.get(weekKey) || 0) + 1);
      }
    }
    const signals = [];
    for (const group of groups.values()) {
      const definition = SYNDROMES[group.syndrome], baselinePerWeek = group.baseline / 4;
      if (definition.kind === 'alert' && group.current >= definition.min) {
        signals.push({ ...group, baselinePerWeek, level: 'alert', rule: `${definition.min}+ cases in one division within 7 days` });
      } else if (definition.kind === 'trend' && group.current >= 5 && group.current >= 2 * Math.max(baselinePerWeek, 1)) {
        const pValue = poissonTail(group.current, Math.max(baselinePerWeek, 0.5));
        if (pValue < 0.01) signals.push({ ...group, baselinePerWeek, pValue, level: 'watch', rule: 'Unusually high this week compared with the previous 4 weeks (Poisson p < 0.01)' });
      }
    }
    signals.sort((a, b) => (a.level === 'alert' ? 0 : 1) - (b.level === 'alert' ? 0 : 1) || b.current - a.current);
    const rows = [...weekly].map(([key, count]) => { const [week, region, syndrome] = key.split('|'); return { week, region, syndrome, count: count < SMALL_CELL ? `<${SMALL_CELL}` : count }; })
      .sort((a, b) => a.week.localeCompare(b.week) || a.region.localeCompare(b.region) || a.syndrome.localeCompare(b.syndrome));
    return { signals, weekly: rows, counted, unknownPlace };
  }

  /** The rule that raised a signal, in English or French. */
  function ruleText(signal, language = 'en') {
    const fr = language === 'fr';
    if (signal.level === 'alert') return fr ? `${SYNDROMES[signal.syndrome].min} cas ou plus dans un même département en 7 jours` : `${SYNDROMES[signal.syndrome].min}+ cases in one division within 7 days`;
    return fr ? 'Nombre inhabituellement élevé cette semaine par rapport aux 4 semaines précédentes (Poisson p < 0,01)' : 'Unusually high this week compared with the previous 4 weeks (Poisson p < 0.01)';
  }

  /** Weekly aggregate as CSV (DHIS2-style data values: period, org unit, data element, value). */
  function toCsv(weekly) {
    return ['period,region,syndrome,value', ...weekly.map(row => [row.week, row.region, row.syndrome, row.count].join(','))].join('\n');
  }

  return { SYNDROMES, SMALL_CELL, syndromesOf, poissonTail, analyse, toCsv, isoWeek, ruleText };
});
