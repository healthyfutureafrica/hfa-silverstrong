// Prescription safety screening, shared by the site (window.HFAMedSafety) and the server (require).
// Checks a new prescription against the patient's recorded drug allergies, current medicines and itself for:
// allergy and cross-allergy conflicts, well-documented major/moderate interactions and duplicate medicines.
// It screens common, well-known problems only; it is not a complete interaction reference and never replaces the
// prescriber's judgement. A clinician must review these rules before real patients (same as hfa-triage.js).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFAMedSafety = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const RULES_VERSION = 'medsafety-2026.11';

  // Medicines commonly prescribed in primary care in Cameroon (suggestions only; free text is allowed).
  const FORMULARY = ['Amlodipine', 'Nifedipine', 'Hydrochlorothiazide', 'Furosemide', 'Lisinopril', 'Enalapril', 'Captopril', 'Losartan',
    'Spironolactone', 'Atenolol', 'Propranolol', 'Isosorbide dinitrate', 'Metformin', 'Glibenclamide', 'Gliclazide', 'Insulin',
    'Atorvastatin', 'Simvastatin', 'Aspirin', 'Clopidogrel', 'Warfarin', 'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Naproxen',
    'Tramadol', 'Morphine', 'Amoxicillin', 'Amoxicillin-Clavulanate', 'Ampicillin', 'Cloxacillin', 'Penicillin V', 'Benzathine penicillin',
    'Ceftriaxone', 'Cefixime', 'Azithromycin', 'Erythromycin', 'Clarithromycin', 'Doxycycline', 'Ciprofloxacin', 'Levofloxacin',
    'Cotrimoxazole', 'Metronidazole', 'Fluconazole', 'Artemether-Lumefantrine', 'Artesunate', 'Quinine', 'Omeprazole', 'Ranitidine',
    'Salbutamol', 'Beclometasone', 'Prednisolone', 'Dexamethasone', 'Sertraline', 'Fluoxetine', 'Amitriptyline', 'Diazepam',
    'Carbamazepine', 'Phenytoin', 'Phenobarbital', 'Ferrous sulfate', 'Folic acid', 'Sildenafil', 'Potassium chloride', 'Methotrexate',
    'Theophylline', 'Digoxin', 'Rifampicin', 'Isoniazid', 'Efavirenz', 'Dolutegravir', 'Tenofovir/Lamivudine/Dolutegravir',
    'ORS (oral rehydration salts)', 'Zinc sulfate', 'Albendazole', 'Mebendazole', 'Loratadine', 'Chlorphenamine'];

  // Drug classes used by allergy and interaction rules (lower-case name prefixes).
  const CLASS = {
    penicillins: ['amoxicillin', 'ampicillin', 'cloxacillin', 'penicillin', 'benzathine penicillin', 'piperacillin'],
    cephalosporins: ['ceftriaxone', 'cefixime', 'cefuroxime', 'cephalexin', 'cefalexin'],
    nsaids: ['ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'indometacin', 'meloxicam'],
    sulfonamides: ['cotrimoxazole', 'sulfamethoxazole', 'sulfadoxine'],
    aceInhibitors: ['lisinopril', 'enalapril', 'captopril', 'ramipril'],
    arbs: ['losartan', 'valsartan', 'irbesartan'],
    statinsCyp3a4: ['simvastatin', 'atorvastatin'],
    macrolidesStrong: ['clarithromycin', 'erythromycin'],
    ssris: ['sertraline', 'fluoxetine', 'paroxetine', 'citalopram'],
    quinolones: ['ciprofloxacin', 'levofloxacin'],
    nitrates: ['isosorbide', 'nitroglycerin', 'glyceryl trinitrate'],
    potassiumRaising: ['spironolactone', 'potassium chloride', 'amiloride'],
    enzymeInducers: ['rifampicin', 'carbamazepine', 'phenytoin', 'phenobarbital', 'efavirenz'],
    anticoagulants: ['warfarin'],
    antiplatelets: ['clopidogrel', 'aspirin']
  };
  const ALLERGY_TERMS = [
    { terms: ['penicillin', 'pénicilline', 'amoxicillin', 'amoxicilline', 'beta-lactam', 'bêta-lactam'], block: CLASS.penicillins, caution: CLASS.cephalosporins },
    { terms: ['cephalosporin', 'céphalosporine', 'ceftriaxone'], block: CLASS.cephalosporins, caution: CLASS.penicillins },
    { terms: ['aspirin', 'aspirine', 'nsaid', 'ains', 'ibuprofen', 'ibuprofène', 'diclofenac'], block: CLASS.nsaids, caution: [] },
    { terms: ['sulfa', 'sulpha', 'sulfonamide', 'sulfamide', 'cotrimoxazole', 'bactrim'], block: CLASS.sulfonamides, caution: [] }
  ];
  const T = (en, fr) => ({ en, fr });
  const INTERACTIONS = [
    { a: CLASS.anticoagulants, b: [...CLASS.nsaids, 'clopidogrel'], level: 'major', why: T('Bleeding risk is significantly increased.', 'Risque hémorragique fortement accru.') },
    { a: CLASS.anticoagulants, b: ['metronidazole', 'cotrimoxazole', 'fluconazole', ...CLASS.quinolones, ...CLASS.macrolidesStrong], level: 'major', why: T('Can raise the INR sharply — monitor closely or choose another medicine.', 'Peut augmenter fortement l’INR — surveiller ou choisir un autre médicament.') },
    { a: CLASS.anticoagulants, b: CLASS.enzymeInducers, level: 'major', why: T('Can make warfarin ineffective.', 'Peut rendre la warfarine inefficace.') },
    { a: [...CLASS.aceInhibitors, ...CLASS.arbs], b: CLASS.potassiumRaising, level: 'major', why: T('Risk of dangerous hyperkalaemia — check potassium and kidney function.', 'Risque d’hyperkaliémie dangereuse — contrôler potassium et fonction rénale.') },
    { a: CLASS.statinsCyp3a4, b: CLASS.macrolidesStrong, level: 'major', why: T('Risk of myopathy and rhabdomyolysis.', 'Risque de myopathie et de rhabdomyolyse.') },
    { a: ['sildenafil'], b: CLASS.nitrates, level: 'major', why: T('Severe low blood pressure — do not combine.', 'Hypotension sévère — association contre-indiquée.') },
    { a: CLASS.ssris, b: ['tramadol'], level: 'major', why: T('Serotonin syndrome and seizure risk.', 'Risque de syndrome sérotoninergique et de convulsions.') },
    { a: ['methotrexate'], b: ['cotrimoxazole'], level: 'major', why: T('Bone-marrow toxicity.', 'Toxicité médullaire.') },
    { a: ['dolutegravir', 'tenofovir/lamivudine/dolutegravir'], b: ['rifampicin', 'carbamazepine', 'phenytoin', 'phenobarbital'], level: 'major', why: T('Lowers dolutegravir levels — dose adjustment needed.', 'Diminue le dolutégravir — ajustement de dose nécessaire.') },
    { a: ['artemether-lumefantrine'], b: ['rifampicin', 'carbamazepine', 'phenytoin', 'efavirenz'], level: 'major', why: T('Can make the antimalarial fail.', 'Peut faire échouer le traitement antipaludique.') },
    { a: ['digoxin'], b: ['clarithromycin', 'erythromycin', 'spironolactone', 'furosemide'], level: 'moderate', why: T('Digoxin toxicity risk — monitor levels and potassium.', 'Risque de toxicité de la digoxine — surveiller.') },
    { a: CLASS.nsaids.filter(d => d !== 'aspirin'), b: [...CLASS.aceInhibitors, ...CLASS.arbs, 'hydrochlorothiazide', 'furosemide'], level: 'moderate', why: T('Reduces blood-pressure control and can harm the kidneys.', 'Réduit le contrôle tensionnel et peut nuire aux reins.') },
    { a: ['aspirin'], b: CLASS.nsaids.filter(d => d !== 'aspirin'), level: 'moderate', why: T('More stomach bleeding.', 'Plus de saignements digestifs.') },
    { a: ['clopidogrel'], b: ['omeprazole'], level: 'moderate', why: T('Omeprazole can weaken clopidogrel — prefer pantoprazole.', 'L’oméprazole peut affaiblir le clopidogrel — préférer le pantoprazole.') },
    { a: CLASS.quinolones, b: ['theophylline'], level: 'moderate', why: T('Theophylline levels may rise.', 'Le taux de théophylline peut augmenter.') },
    { a: ['simvastatin'], b: ['amlodipine'], level: 'moderate', why: T('Keep simvastatin at 20 mg a day or less with amlodipine.', 'Limiter la simvastatine à 20 mg/j avec l’amlodipine.') },
    { a: ['metformin'], b: ['prednisolone', 'dexamethasone'], level: 'moderate', why: T('Steroids raise blood sugar — monitor glucose.', 'Les corticoïdes augmentent la glycémie — surveiller.') }
  ];

  const key = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const isOf = (drug, list) => list.some(prefix => drug === prefix || drug.startsWith(prefix + ' ') || drug.startsWith(prefix + '-') || drug.startsWith(prefix + '/') || drug.startsWith(prefix));
  const pick = (text, language) => text[language] || text.en;

  /**
   * @param items   [{drug, dose, frequency, duration, quantity}] being prescribed
   * @param patient {drugAllergies:[{name, severity}] | [string], medicines:[string]} from the health profile
   * @returns {findings:[{level:'major'|'moderate', kind:'allergy'|'interaction'|'duplicate', message:{en,fr}, drugs:[...]}], rulesVersion}
   */
  function check(items, patient = {}) {
    const findings = [];
    const add = (level, kind, en, fr, drugs) => { if (!findings.some(f => f.kind === kind && f.message.en === en)) findings.push({ level, kind, message: { en, fr }, drugs }); };
    const prescribed = (items || []).map(item => key(item && item.drug)).filter(Boolean);
    const current = (patient.medicines || []).map(key).filter(Boolean).filter(drug => !prescribed.some(p => p === drug));
    // Duplicates within the prescription and with what the patient already takes.
    prescribed.forEach((drug, index) => {
      if (prescribed.indexOf(drug) !== index) add('moderate', 'duplicate', `${drug} is listed twice.`, `${drug} figure deux fois.`, [drug]);
    });
    (patient.medicines || []).map(key).forEach(drug => {
      if (prescribed.includes(drug)) add('moderate', 'duplicate', `The patient already takes ${drug}.`, `Le patient prend déjà ${drug}.`, [drug]);
    });
    // Allergies (recorded name or class), including cross-reactions.
    const allergies = (patient.drugAllergies || []).map(entry => typeof entry === 'string' ? { name: entry, severity: '' } : entry).filter(entry => entry && entry.name);
    for (const allergy of allergies) {
      const name = key(allergy.name), severe = ['severe', 'anaphylaxis'].includes(allergy.severity);
      for (const drug of prescribed) {
        if (drug === name || drug.startsWith(name) || name.startsWith(drug)) add('major', 'allergy', `Recorded allergy to ${allergy.name}${allergy.severity ? ` (${allergy.severity})` : ''}: ${drug}.`, `Allergie enregistrée à ${allergy.name}${allergy.severity ? ` (${allergy.severity})` : ''} : ${drug}.`, [drug]);
      }
      for (const group of ALLERGY_TERMS) {
        if (!group.terms.some(term => name.includes(key(term)))) continue;
        prescribed.filter(drug => isOf(drug, group.block)).forEach(drug => add('major', 'allergy', `${drug} belongs to the same family as the recorded allergy (${allergy.name}).`, `${drug} appartient à la même famille que l’allergie enregistrée (${allergy.name}).`, [drug]));
        prescribed.filter(drug => isOf(drug, group.caution)).forEach(drug => add(severe ? 'major' : 'moderate', 'allergy', `Possible cross-reaction between ${drug} and the recorded allergy (${allergy.name}).`, `Réaction croisée possible entre ${drug} et l’allergie enregistrée (${allergy.name}).`, [drug]));
      }
    }
    // Interactions: at least one side must be newly prescribed.
    const all = [...prescribed, ...current];
    for (const rule of INTERACTIONS) {
      for (const first of all.filter(drug => isOf(drug, rule.a))) {
        for (const second of all.filter(drug => drug !== first && isOf(drug, rule.b))) {
          if (!prescribed.includes(first) && !prescribed.includes(second)) continue;
          add(rule.level, 'interaction', `${first} + ${second}: ${rule.why.en}`, `${first} + ${second} : ${rule.why.fr}`, [first, second]);
        }
      }
    }
    findings.sort((x, y) => (x.level === 'major' ? 0 : 1) - (y.level === 'major' ? 0 : 1));
    return { findings, rulesVersion: RULES_VERSION };
  }

  /** The allergy and medicine lists check() needs, from a stored health profile ({medical:{…}}). */
  function patientContext(record) {
    const medical = (record && record.medical) || {};
    return { drugAllergies: medical.drugAllergies || [], medicines: (medical.medications || []).map(item => item.name).filter(Boolean) };
  }

  return { check, patientContext, FORMULARY, RULES_VERSION, message: (finding, language) => pick(finding.message, language) };
});
