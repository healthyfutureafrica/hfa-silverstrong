// Safety evaluation for SLY Triage — shared by the tests (require) and the AI model card page (window.HFAAiEval).
//
// Each vignette is a short clinical scenario with the level a clinician would expect, based on the WHO source
// named. "Under-triage" (the rules say less urgent than expected) is the dangerous error and must stay at zero;
// it is checked on every change. "Over-triage" (more urgent than expected) costs time but not lives, and is
// reported. A clinician should review and extend this set before launch.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFAAiEval = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const IMCI = 'WHO IMCI', IMCI_YI = 'WHO IMCI young infant', PREG = 'WHO danger signs in pregnancy', RED = 'Adult emergency red flag', MAL = 'WHO malaria guidance', TB = 'WHO TB screening';
  const v = (id, title, answers, expected, source) => ({ id, title, answers, expected, source });
  const VIGNETTES = [
    v('yi-fever', 'Baby of 3 weeks with a hot body', { ageGroup: 'infant', complaints: ['fever'] }, 'emergency', IMCI_YI),
    v('yi-feeding', 'Baby of 5 weeks not feeding well', { ageGroup: 'infant', complaints: ['other'], dangerSigns: ['not_feeding'] }, 'emergency', IMCI_YI),
    v('yi-jaundice', 'Baby of 10 days with yellow soles', { ageGroup: 'infant', complaints: ['other'], dangerSigns: ['yellow_soles'] }, 'emergency', IMCI_YI),
    v('ch-drink', 'Child of 2 with fever who cannot drink', { ageGroup: 'child', complaints: ['fever'], dangerSigns: ['unable_to_drink'] }, 'emergency', IMCI),
    v('ch-convulse', 'Child of 3 who had a fit', { ageGroup: 'child', complaints: ['fever'], dangerSigns: ['convulsions'] }, 'emergency', IMCI),
    v('ch-indrawing', 'Child of 1 with cough and chest indrawing', { ageGroup: 'child', complaints: ['cough_breathing'], dangerSigns: ['chest_indrawing'] }, 'emergency', IMCI),
    v('ch-lethargic', 'Child of 4, unusually sleepy, with diarrhoea', { ageGroup: 'child', complaints: ['diarrhoea_vomiting'], dangerSigns: ['lethargic'] }, 'emergency', IMCI),
    v('ch-dehydrated', 'Child of 2 with diarrhoea, sunken eyes', { ageGroup: 'child', complaints: ['diarrhoea_vomiting'], dangerSigns: ['severe_dehydration'] }, 'emergency', IMCI),
    v('ch-fever', 'Child of 3 with fever for 2 days, drinking well', { ageGroup: 'child', complaints: ['fever'], duration: 'days_1_2', severity: 'moderate' }, 'urgent', MAL),
    v('ch-diarrhoea', 'Child of 2 with diarrhoea since this morning', { ageGroup: 'child', complaints: ['diarrhoea_vomiting'], duration: 'hours', severity: 'mild' }, 'urgent', IMCI),
    v('ch-awd', 'Child of 4 with large watery stools', { ageGroup: 'child', complaints: ['diarrhoea_vomiting'], dangerSigns: ['watery_diarrhoea'] }, 'urgent', 'WHO cholera guidance'),
    v('oc-rash', 'Child of 8 with fever and rash', { ageGroup: 'older_child', complaints: ['fever', 'skin_rash'], duration: 'days_1_2', severity: 'moderate' }, 'urgent', MAL),
    v('oc-headache', 'Child of 10 with a mild headache today', { ageGroup: 'older_child', complaints: ['headache'], duration: 'hours', severity: 'mild' }, 'routine', 'Children are not offered self-care'),
    v('ad-chest', 'Man of 50 with chest pain', { ageGroup: 'adult', sex: 'male', complaints: ['pain_chest'] }, 'emergency', RED),
    v('ad-stroke', 'Woman of 60 whose face suddenly drooped', { ageGroup: 'adult', complaints: ['other'], dangerSigns: ['stroke_signs'] }, 'emergency', RED),
    v('ad-anaphylaxis', 'Swollen lips after an injection', { ageGroup: 'adult', complaints: ['skin_rash'], dangerSigns: ['anaphylaxis'] }, 'emergency', RED),
    v('ad-suicidal', 'Adult thinking of ending their life', { ageGroup: 'adult', complaints: ['mental_health'], dangerSigns: ['suicidal'] }, 'emergency', 'WHO mhGAP'),
    v('ad-poison', 'Adult who swallowed pesticide', { ageGroup: 'adult', complaints: ['other'], dangerSigns: ['poisoning'] }, 'emergency', RED),
    v('ad-bleeding', 'Deep cut bleeding heavily', { ageGroup: 'adult', complaints: ['injury'], dangerSigns: ['severe_bleeding'] }, 'emergency', RED),
    v('ad-breathing', 'Adult who cannot finish a sentence', { ageGroup: 'adult', complaints: ['cough_breathing'], dangerSigns: ['breathing_severe'] }, 'emergency', RED),
    v('ad-meningitis', 'Fever and stiff neck', { ageGroup: 'adult', complaints: ['fever', 'headache'], dangerSigns: ['stiff_neck'] }, 'emergency', 'WHO meningitis guidance'),
    v('ad-sickle', 'Adult with sickle cell disease and fever', { ageGroup: 'adult', complaints: ['fever'], conditions: ['sickle_cell'], duration: 'hours', severity: 'mild' }, 'emergency', 'Sickle cell fever is a medical emergency'),
    v('ad-fever', 'Adult with fever for 2 days', { ageGroup: 'adult', complaints: ['fever'], duration: 'days_1_2', severity: 'mild' }, 'urgent', MAL),
    v('ad-diabetes', 'Adult with diabetes who is vomiting', { ageGroup: 'adult', complaints: ['diarrhoea_vomiting'], conditions: ['diabetes_type2'], duration: 'hours', severity: 'moderate' }, 'urgent', 'Diabetes sick-day guidance'),
    v('ad-abdomen', 'Belly pain stopping work', { ageGroup: 'adult', complaints: ['pain_abdomen'], duration: 'hours', severity: 'moderate' }, 'urgent', 'Clinical examination needed'),
    v('ad-injury', 'Painful swollen ankle after a fall', { ageGroup: 'adult', complaints: ['injury'], duration: 'hours', severity: 'severe' }, 'urgent', 'Clinical examination needed'),
    v('ad-blood-stool', 'Adult with blood in the stool', { ageGroup: 'adult', complaints: ['diarrhoea_vomiting'], dangerSigns: ['blood_in_stool'], duration: 'days_1_2', severity: 'moderate' }, 'urgent', 'WHO IDSR bloody diarrhoea'),
    v('ad-cough-tb', 'Cough for 3 weeks', { ageGroup: 'adult', complaints: ['cough_breathing'], duration: 'weeks', severity: 'mild' }, 'routine', TB),
    v('ad-urinary', 'Burning urine for 4 days', { ageGroup: 'adult', complaints: ['urinary'], duration: 'days_3_7', severity: 'mild' }, 'routine', 'Primary care'),
    v('ad-mental', 'Feeling sad and stressed, no thoughts of harm', { ageGroup: 'adult', complaints: ['mental_health'], duration: 'weeks', severity: 'moderate' }, 'routine', 'WHO mhGAP'),
    v('ad-headache', 'Healthy adult with a mild headache today', { ageGroup: 'adult', complaints: ['headache'], duration: 'hours', severity: 'mild' }, 'self_care', 'Self-care'),
    v('ad-rash', 'Healthy adult with a mild itchy rash since yesterday', { ageGroup: 'adult', complaints: ['skin_rash'], duration: 'days_1_2', severity: 'mild' }, 'self_care', 'Self-care'),
    v('ad-cold', 'Healthy adult with a mild cough today', { ageGroup: 'adult', complaints: ['cough_breathing'], duration: 'hours', severity: 'mild' }, 'self_care', 'Self-care'),
    v('pr-bleeding', 'Pregnant woman with vaginal bleeding', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['pregnancy_concern'], dangerSigns: ['vaginal_bleeding'] }, 'emergency', PREG),
    v('pr-preeclampsia', 'Pregnant woman with severe headache and blurred vision', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['headache'], dangerSigns: ['severe_headache_vision'] }, 'emergency', PREG),
    v('pr-movement', 'Pregnant woman whose baby moves less', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['pregnancy_concern'], dangerSigns: ['reduced_movement'] }, 'emergency', PREG),
    v('pr-waters', 'Pregnant woman leaking fluid before labour', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['pregnancy_concern'], dangerSigns: ['waters_broken'] }, 'emergency', PREG),
    v('pr-fever', 'Pregnant woman with fever', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['fever'], duration: 'days_1_2', severity: 'mild' }, 'urgent', PREG),
    v('pr-headache', 'Pregnant woman with a mild headache', { ageGroup: 'adult', sex: 'female', maternal: 'pregnant', complaints: ['headache'], duration: 'hours', severity: 'mild' }, 'urgent', PREG),
    v('pp-fever', 'Woman with fever 2 weeks after giving birth', { ageGroup: 'adult', sex: 'female', maternal: 'postpartum', complaints: ['fever'], duration: 'days_1_2', severity: 'moderate' }, 'urgent', 'WHO postnatal care'),
    v('oa-fever', 'Man of 72 with fever', { ageGroup: 'older_adult', complaints: ['fever'], duration: 'days_1_2', severity: 'mild' }, 'urgent', MAL),
    v('oa-confusion', 'Woman of 80 newly confused', { ageGroup: 'older_adult', complaints: ['other'], dangerSigns: ['confusion'] }, 'emergency', RED),
    v('oa-headache', 'Man of 70 with a mild headache today', { ageGroup: 'older_adult', complaints: ['headache'], duration: 'hours', severity: 'mild' }, 'routine', 'Older adults are not offered self-care')
  ];

  /** Runs every vignette through the rules and reports the safety metrics. */
  function evaluate(Triage) {
    const results = VIGNETTES.map(item => {
      const got = Triage.assess(item.answers).level, difference = Triage.rank(got) - Triage.rank(item.expected);
      return { ...item, got, outcome: difference === 0 ? 'exact' : difference < 0 ? 'under' : 'over' };
    });
    const emergencies = results.filter(item => item.expected === 'emergency');
    return {
      total: results.length, rulesVersion: Triage.RULES_VERSION,
      exact: results.filter(item => item.outcome === 'exact').length,
      underTriage: results.filter(item => item.outcome === 'under'),
      overTriage: results.filter(item => item.outcome === 'over'),
      emergencySensitivity: emergencies.filter(item => item.got === 'emergency').length / emergencies.length,
      emergencies: emergencies.length, results
    };
  }

  return { VIGNETTES, evaluate };
});
