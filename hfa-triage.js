// SLY Triage rules — shared by the server (require), the site (window.HFATriage) and, later, the WhatsApp bot.
//
// The urgency decision is made ONLY by these fixed, reviewable rules, never by an AI model. AI may add
// findings it reads in the patient's own words (which can only raise urgency) and draft the clinician's
// summary. Every result is a suggestion that a nurse or doctor confirms or changes.
//
// Sources: WHO/UNICEF Integrated Management of Childhood Illness (IMCI) general danger signs and young-infant
// signs; WHO danger signs in pregnancy and after birth; common adult emergency red flags; WHO malaria
// guidance (suspected malaria needs a test the same day) and TB screening (cough of 2 weeks or more).
// RULES_VERSION changes whenever a rule changes, and is stored with every case. A clinician must review
// these rules before use with real patients.
(function (root, factory) {
  const countryData = typeof module === 'object' && module.exports ? require('./country-data.js') : root.HFACountryData;
  const api = factory(countryData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFATriage = api;
})(typeof self !== 'undefined' ? self : this, function (countryData) {
  const RULES_VERSION = '2026.10-1';
  const EMERGENCY_NUMBER = countryData.get('CM')?.emergencyNumber || null;
  const LEVELS = ['self_care', 'routine', 'urgent', 'emergency'];
  const rank = level => LEVELS.indexOf(level);

  const AGE_GROUPS = ['infant', 'child', 'older_child', 'adult', 'older_adult'];
  const COMPLAINTS = ['fever', 'cough_breathing', 'diarrhoea_vomiting', 'pain_chest', 'pain_abdomen', 'headache', 'injury', 'skin_rash', 'urinary', 'pregnancy_concern', 'mental_health', 'other'];
  const DURATIONS = ['hours', 'days_1_2', 'days_3_7', 'weeks'];
  const SEVERITIES = ['mild', 'moderate', 'severe'];
  const MATERNAL = ['no', 'pregnant', 'postpartum'];

  // Every danger sign leads to "emergency" except those listed in URGENT_SIGNS.
  const SIGNS = {
    common: ['unconscious', 'convulsions', 'breathing_severe', 'severe_bleeding', 'anaphylaxis', 'poisoning', 'suicidal'],
    adult: ['chest_pain', 'stroke_signs', 'confusion', 'stiff_neck', 'severe_dehydration', 'blood_in_stool', 'watery_diarrhoea'],
    child: ['unable_to_drink', 'vomits_everything', 'lethargic', 'chest_indrawing', 'severe_dehydration', 'stiff_neck', 'blood_in_stool', 'watery_diarrhoea'],
    infant: ['not_feeding', 'fast_breathing', 'chest_indrawing', 'fever_or_cold', 'lethargic', 'yellow_soles'],
    maternal: ['vaginal_bleeding', 'severe_headache_vision', 'severe_abdominal_pain', 'waters_broken', 'reduced_movement']
  };
  const URGENT_SIGNS = ['blood_in_stool', 'watery_diarrhoea'];
  const ALL_SIGNS = [...new Set(Object.values(SIGNS).flat())];

  /** The danger signs to ask about for this person (always including the common ones). */
  function signsFor({ ageGroup, maternal } = {}) {
    const list = [...SIGNS.common];
    if (ageGroup === 'infant') list.push(...SIGNS.infant);
    else if (ageGroup === 'child') list.push(...SIGNS.child);
    else list.push(...SIGNS.adult);
    if (maternal === 'pregnant' || maternal === 'postpartum') list.push(...SIGNS.maternal);
    return [...new Set(list)];
  }
  const asksMaternal = ({ ageGroup, sex } = {}) => sex !== 'male' && ['older_child', 'adult'].includes(ageGroup);

  /** Keeps only known values, so the rules never see free-form input. */
  function normalise(input = {}) {
    const pick = (value, allowed) => allowed.includes(value) ? value : null;
    const list = (value, allowed) => [...new Set((Array.isArray(value) ? value : []).filter(item => allowed.includes(item)))];
    return {
      ageGroup: pick(input.ageGroup, AGE_GROUPS), sex: pick(input.sex, ['male', 'female', 'undisclosed']),
      maternal: pick(input.maternal, MATERNAL) || 'no', complaints: list(input.complaints, COMPLAINTS),
      dangerSigns: list(input.dangerSigns, ALL_SIGNS), duration: pick(input.duration, DURATIONS), severity: pick(input.severity, SEVERITIES),
      conditions: list(input.conditions, ['sickle_cell', 'diabetes_type1', 'diabetes_type2', 'hiv_aids', 'heart_disease', 'chronic_kidney_disease', 'asthma', 'hypertension', 'tuberculosis', 'epilepsy', 'cancer'])
    };
  }

  /**
   * Applies the rules. Returns the suggested level, every rule that fired (with its source), the advice to
   * show and the danger signs that were asked and answered "no".
   */
  function assess(input, countryCode = 'CM') {
    const a = normalise(input);
    if (!a.ageGroup) throw new Error('ageGroup is required');
    const reasons = [];
    const add = (level, rule, source) => reasons.push({ level, rule, source });
    const has = complaint => a.complaints.includes(complaint);
    const child = a.ageGroup === 'infant' || a.ageGroup === 'child';
    const maternal = a.maternal === 'pregnant' || a.maternal === 'postpartum';

    for (const sign of a.dangerSigns) {
      const source = SIGNS.infant.includes(sign) && a.ageGroup === 'infant' ? 'WHO IMCI young infant' : SIGNS.child.includes(sign) && a.ageGroup === 'child' ? 'WHO IMCI general danger sign'
        : SIGNS.maternal.includes(sign) ? 'WHO danger sign in pregnancy' : 'Emergency red flag';
      add(URGENT_SIGNS.includes(sign) ? 'urgent' : 'emergency', `sign_${sign}`, source);
    }
    // Problems that are dangerous for particular people.
    if (a.ageGroup === 'infant' && (has('fever') || has('cough_breathing') || has('diarrhoea_vomiting'))) add('emergency', 'infant_illness', 'WHO IMCI young infant');
    if (has('fever') && a.conditions.includes('sickle_cell')) add('emergency', 'fever_sickle_cell', 'Sickle cell: fever can mean serious infection');
    if (has('pain_chest') && ['adult', 'older_adult'].includes(a.ageGroup)) add('emergency', 'adult_chest_pain', 'Emergency red flag');
    if (has('fever')) add('urgent', 'fever_malaria_test', 'WHO malaria guidance: test suspected malaria the same day');
    if (has('diarrhoea_vomiting') && (child || a.ageGroup === 'older_adult')) add('urgent', 'dehydration_risk', 'WHO IMCI: assess dehydration');
    if (has('diarrhoea_vomiting') && (a.conditions.includes('diabetes_type1') || a.conditions.includes('diabetes_type2'))) add('urgent', 'diabetes_vomiting', 'Diabetes: risk of dangerous blood sugar');
    if (maternal && (has('fever') || has('pain_abdomen') || has('urinary') || has('pregnancy_concern') || has('headache'))) add('urgent', 'maternal_problem', 'WHO antenatal and postnatal care');
    if (a.ageGroup === 'older_adult' && (has('fever') || has('cough_breathing') || has('pain_abdomen'))) add('urgent', 'older_adult', 'Older adults can become seriously ill quickly');
    if (a.severity === 'severe') add('urgent', 'severe_pain_or_distress', 'Patient reports severe symptoms');
    if (has('pain_abdomen') && a.severity !== 'mild') add('urgent', 'abdominal_pain', 'Abdominal pain needs examination');
    if (has('injury') && a.severity !== 'mild') add('urgent', 'injury', 'Injury needs examination');
    if (has('cough_breathing') && a.duration === 'weeks') add('routine', 'cough_tb_screen', 'WHO: cough of 2 weeks or more needs a TB test');
    if (has('mental_health')) add('routine', 'mental_health_support', 'WHO mhGAP: offer support and follow-up');
    if (a.duration === 'weeks') add('routine', 'long_lasting', 'Lasting problems need a consultation');

    // Self-care only for healthy, non-pregnant adults with mild, recent, low-risk problems and no other rule.
    const lowRisk = a.complaints.length > 0 && a.complaints.every(item => ['cough_breathing', 'headache', 'skin_rash'].includes(item));
    if (!reasons.length && a.ageGroup === 'adult' && !maternal && !a.conditions.length && a.severity === 'mild' && ['hours', 'days_1_2'].includes(a.duration) && lowRisk) add('self_care', 'mild_self_care', 'Mild, recent, low-risk problem');
    if (!reasons.length) add('routine', 'needs_consultation', 'Default: a clinician should see every other problem');

    const level = reasons.reduce((top, reason) => rank(reason.level) > rank(top) ? reason.level : top, 'self_care');
    reasons.sort((x, y) => rank(y.level) - rank(x.level));
    const asked = signsFor(a);
    return { level, reasons, answers: a, checkedNegative: asked.filter(sign => !a.dangerSigns.includes(sign)), rulesVersion: RULES_VERSION, emergencyNumber: countryData.get(countryCode)?.emergencyNumber || null };
  }

  /** Combines the patient's answers with findings read from their words: findings can only add, never remove. */
  function merge(answers, findings = {}) {
    const base = normalise(answers), extra = normalise({ ...base, complaints: findings.complaints, dangerSigns: findings.dangerSigns });
    const severity = [base.severity, SEVERITIES.includes(findings.severity) ? findings.severity : null].filter(Boolean).sort((x, y) => SEVERITIES.indexOf(y) - SEVERITIES.indexOf(x))[0] || null;
    return { ...base, complaints: [...new Set([...base.complaints, ...extra.complaints])], dangerSigns: [...new Set([...base.dangerSigns, ...extra.dangerSigns])], severity, duration: base.duration || (DURATIONS.includes(findings.duration) ? findings.duration : null) };
  }

  // ───── Words (English and French) ─────
  const L = {
    en: {
      level_emergency: 'Emergency', level_urgent: 'Urgent — today', level_routine: 'See a clinician soon', level_self_care: 'Self-care at home',
      advice_emergency: 'Go to the nearest hospital now or contact local emergency services. Do not wait for a reply here.',
      advice_emergency_numbered: 'Go to the nearest hospital now or call {number}. Do not wait for a reply here.',
      advice_urgent: 'You need an in-person assessment today. Go to a health centre today; do not wait for a routine video, voice or chat consultation.',
      advice_routine: 'Book a consultation in the next few days. Come back here if anything gets worse.',
      advice_self_care: 'You can care for this at home. If it gets worse, or is not better in 3 days, book a consultation.',
      age_infant: 'Baby under 2 months', age_child: 'Child 2 months to 5 years', age_older_child: 'Child 5 to 14 years', age_adult: 'Adult 15 to 64', age_older_adult: 'Adult 65 or older',
      maternal_no: 'Not pregnant', maternal_pregnant: 'Pregnant', maternal_postpartum: 'Gave birth in the last 6 weeks',
      c_fever: 'Fever or hot body', c_cough_breathing: 'Cough or breathing problem', c_diarrhoea_vomiting: 'Diarrhoea or vomiting', c_pain_chest: 'Chest pain', c_pain_abdomen: 'Belly pain',
      c_headache: 'Headache', c_injury: 'Injury or wound', c_skin_rash: 'Skin rash or itching', c_urinary: 'Pain when passing urine', c_pregnancy_concern: 'Worry about pregnancy', c_mental_health: 'Stress, sadness or worry', c_other: 'Something else',
      d_hours: 'Started today', d_days_1_2: '1 to 2 days', d_days_3_7: '3 to 7 days', d_weeks: '2 weeks or more',
      s_mild: 'Mild — I can do my normal activities', s_moderate: 'Moderate — it stops some activities', s_severe: 'Severe — I can hardly do anything',
      sign_unconscious: 'Cannot be woken, or fainted and is not responding normally', sign_convulsions: 'Fits or convulsions (now or during this illness)',
      sign_breathing_severe: 'Struggling to breathe, cannot speak in full sentences, or blue lips', sign_severe_bleeding: 'Heavy bleeding that does not stop',
      sign_anaphylaxis: 'Swelling of the face, lips or throat after a medicine, food or sting', sign_poisoning: 'Swallowed poison, chemicals or too many tablets',
      sign_suicidal: 'Thoughts of ending life or of harming someone', sign_chest_pain: 'Pain or pressure in the chest', sign_stroke_signs: 'Sudden face drooping, arm weakness or difficulty speaking',
      sign_confusion: 'New confusion or very strange behaviour', sign_stiff_neck: 'Stiff neck with fever', sign_severe_dehydration: 'Very thirsty or cannot drink, sunken eyes, very little urine',
      sign_blood_in_stool: 'Blood in the stool', sign_watery_diarrhoea: 'Very large amounts of watery diarrhoea (like rice water)',
      sign_unable_to_drink: 'Not able to drink or breastfeed', sign_vomits_everything: 'Vomits everything', sign_lethargic: 'Unusually sleepy or hard to wake',
      sign_chest_indrawing: 'Lower chest pulls in when breathing in', sign_not_feeding: 'Not feeding well', sign_fast_breathing: 'Breathing very fast or grunting',
      sign_fever_or_cold: 'Hot body (fever) or very cold body', sign_yellow_soles: 'Yellow palms or soles',
      sign_vaginal_bleeding: 'Bleeding from the vagina', sign_severe_headache_vision: 'Severe headache or blurred vision', sign_severe_abdominal_pain: 'Severe belly pain',
      sign_waters_broken: 'Water breaking or fluid leaking before labour', sign_reduced_movement: 'Baby moving less than usual',
      r_infant_illness: 'A baby under 2 months with this problem must be checked by a health worker now.',
      r_fever_sickle_cell: 'Fever in someone with sickle cell disease can be a serious infection.',
      r_adult_chest_pain: 'Chest pain in an adult can be a heart attack.',
      r_fever_malaria_test: 'Fever needs a malaria test today.',
      r_dehydration_risk: 'Diarrhoea or vomiting can quickly dry out young children and older people.',
      r_diabetes_vomiting: 'Vomiting with diabetes can make blood sugar dangerous.',
      r_maternal_problem: 'This problem during or after pregnancy should be checked today.',
      r_older_adult: 'Older adults can become seriously ill quickly.',
      r_severe_pain_or_distress: 'You said the symptoms are severe.',
      r_abdominal_pain: 'Belly pain that stops activities needs an examination.',
      r_injury: 'This injury needs an examination.',
      r_cough_tb_screen: 'A cough lasting 2 weeks or more needs a TB test.',
      r_mental_health_support: 'You deserve support. A clinician can help and follow up with you.',
      r_long_lasting: 'A problem lasting 2 weeks or more needs a consultation.',
      r_mild_self_care: 'Mild, recent problem with no danger signs.',
      r_needs_consultation: 'A clinician should look at this.',
      r_sign: 'Danger sign: {sign}.',
      crisis: 'If you are thinking of ending your life, you are not alone. Stay with someone you trust and seek immediate help at the nearest hospital or from local emergency services.'
    },
    fr: {
      level_emergency: 'Urgence vitale', level_urgent: 'Urgent — aujourd’hui', level_routine: 'Consulter bientôt', level_self_care: 'Soins à la maison',
      advice_emergency: 'Allez maintenant à l’hôpital le plus proche ou contactez les services d’urgence locaux. N’attendez pas de réponse ici.',
      advice_emergency_numbered: 'Allez maintenant à l’hôpital le plus proche ou appelez le {number}. N’attendez pas de réponse ici.',
      advice_urgent: 'Vous devez être examiné en personne aujourd’hui. Rendez-vous dans un centre de santé aujourd’hui ; n’attendez pas une consultation vidéo, vocale ou par chat.',
      advice_routine: 'Réservez une consultation dans les prochains jours. Revenez ici si quelque chose s’aggrave.',
      advice_self_care: 'Vous pouvez vous soigner à la maison. Si cela s’aggrave ou ne va pas mieux dans 3 jours, réservez une consultation.',
      age_infant: 'Bébé de moins de 2 mois', age_child: 'Enfant de 2 mois à 5 ans', age_older_child: 'Enfant de 5 à 14 ans', age_adult: 'Adulte de 15 à 64 ans', age_older_adult: 'Adulte de 65 ans ou plus',
      maternal_no: 'Pas enceinte', maternal_pregnant: 'Enceinte', maternal_postpartum: 'A accouché il y a moins de 6 semaines',
      c_fever: 'Fièvre ou corps chaud', c_cough_breathing: 'Toux ou problème de respiration', c_diarrhoea_vomiting: 'Diarrhée ou vomissements', c_pain_chest: 'Douleur à la poitrine', c_pain_abdomen: 'Mal au ventre',
      c_headache: 'Mal de tête', c_injury: 'Blessure ou plaie', c_skin_rash: 'Boutons ou démangeaisons', c_urinary: 'Douleur en urinant', c_pregnancy_concern: 'Inquiétude sur la grossesse', c_mental_health: 'Stress, tristesse ou inquiétude', c_other: 'Autre chose',
      d_hours: 'Commencé aujourd’hui', d_days_1_2: '1 à 2 jours', d_days_3_7: '3 à 7 jours', d_weeks: '2 semaines ou plus',
      s_mild: 'Léger — je fais mes activités normales', s_moderate: 'Moyen — cela empêche certaines activités', s_severe: 'Fort — je ne peux presque rien faire',
      sign_unconscious: 'Ne se réveille pas, ou s’est évanoui et ne répond pas normalement', sign_convulsions: 'Convulsions (maintenant ou pendant cette maladie)',
      sign_breathing_severe: 'Respire avec beaucoup de peine, ne peut pas finir ses phrases, ou lèvres bleues', sign_severe_bleeding: 'Saignement abondant qui ne s’arrête pas',
      sign_anaphylaxis: 'Gonflement du visage, des lèvres ou de la gorge après un médicament, un aliment ou une piqûre', sign_poisoning: 'A avalé du poison, un produit chimique ou trop de comprimés',
      sign_suicidal: 'Pensées de mettre fin à sa vie ou de faire du mal à quelqu’un', sign_chest_pain: 'Douleur ou serrement dans la poitrine', sign_stroke_signs: 'Visage qui tombe, bras faible ou difficulté à parler, d’un coup',
      sign_confusion: 'Confusion nouvelle ou comportement très étrange', sign_stiff_neck: 'Cou raide avec fièvre', sign_severe_dehydration: 'Très soif ou ne peut pas boire, yeux enfoncés, très peu d’urine',
      sign_blood_in_stool: 'Sang dans les selles', sign_watery_diarrhoea: 'Très grande quantité de diarrhée liquide (comme de l’eau de riz)',
      sign_unable_to_drink: 'Ne peut pas boire ni téter', sign_vomits_everything: 'Vomit tout', sign_lethargic: 'Anormalement endormi ou difficile à réveiller',
      sign_chest_indrawing: 'Le bas de la poitrine se creuse à l’inspiration', sign_not_feeding: 'Ne tète pas bien', sign_fast_breathing: 'Respire très vite ou geint',
      sign_fever_or_cold: 'Corps chaud (fièvre) ou très froid', sign_yellow_soles: 'Paumes ou plantes des pieds jaunes',
      sign_vaginal_bleeding: 'Saignement vaginal', sign_severe_headache_vision: 'Mal de tête violent ou vision floue', sign_severe_abdominal_pain: 'Mal au ventre violent',
      sign_waters_broken: 'Perte des eaux ou liquide qui coule avant le travail', sign_reduced_movement: 'Le bébé bouge moins que d’habitude',
      r_infant_illness: 'Un bébé de moins de 2 mois avec ce problème doit être vu par un agent de santé maintenant.',
      r_fever_sickle_cell: 'La fièvre chez une personne drépanocytaire peut être une infection grave.',
      r_adult_chest_pain: 'Une douleur à la poitrine chez l’adulte peut être une crise cardiaque.',
      r_fever_malaria_test: 'La fièvre nécessite un test du paludisme aujourd’hui.',
      r_dehydration_risk: 'La diarrhée ou les vomissements déshydratent vite les jeunes enfants et les personnes âgées.',
      r_diabetes_vomiting: 'Vomir avec un diabète peut rendre la glycémie dangereuse.',
      r_maternal_problem: 'Ce problème pendant ou après la grossesse doit être vu aujourd’hui.',
      r_older_adult: 'Les personnes âgées peuvent tomber gravement malades très vite.',
      r_severe_pain_or_distress: 'Vous avez dit que les symptômes sont forts.',
      r_abdominal_pain: 'Un mal au ventre qui empêche les activités doit être examiné.',
      r_injury: 'Cette blessure doit être examinée.',
      r_cough_tb_screen: 'Une toux de 2 semaines ou plus nécessite un test de tuberculose.',
      r_mental_health_support: 'Vous méritez du soutien. Un soignant peut vous aider et vous suivre.',
      r_long_lasting: 'Un problème qui dure 2 semaines ou plus nécessite une consultation.',
      r_mild_self_care: 'Problème léger et récent, sans signe de danger.',
      r_needs_consultation: 'Un soignant doit examiner cela.',
      r_sign: 'Signe de danger : {sign}.',
      crisis: 'Si vous pensez à mettre fin à vos jours, vous n’êtes pas seul. Restez avec une personne de confiance et cherchez immédiatement de l’aide à l’hôpital le plus proche ou auprès des services d’urgence locaux.'
    }
  };
  // French names of the rule sources (WHO guidance and clinical reasons) shown with each result.
  const SOURCE_FR = {
    'WHO IMCI young infant': 'OMS PCIME jeune nourrisson',
    'WHO IMCI general danger sign': 'OMS PCIME signe général de danger',
    'WHO danger sign in pregnancy': 'OMS signe de danger pendant la grossesse',
    'Emergency red flag': 'Signe d’alerte d’urgence',
    'Sickle cell: fever can mean serious infection': 'Drépanocytose : la fièvre peut signaler une infection grave',
    'WHO malaria guidance: test suspected malaria the same day': 'OMS paludisme : tester un paludisme suspect le jour même',
    'WHO IMCI: assess dehydration': 'OMS PCIME : évaluer la déshydratation',
    'Diabetes: risk of dangerous blood sugar': 'Diabète : risque de glycémie dangereuse',
    'WHO antenatal and postnatal care': 'OMS soins prénatals et postnatals',
    'Older adults can become seriously ill quickly': 'Les personnes âgées peuvent s’aggraver très vite',
    'Patient reports severe symptoms': 'Le patient signale des symptômes forts',
    'Abdominal pain needs examination': 'Une douleur abdominale doit être examinée',
    'Injury needs examination': 'Une blessure doit être examinée',
    'WHO: cough of 2 weeks or more needs a TB test': 'OMS : une toux de 2 semaines ou plus nécessite un test de tuberculose',
    'WHO mhGAP: offer support and follow-up': 'OMS mhGAP : proposer soutien et suivi',
    'Lasting problems need a consultation': 'Un problème durable nécessite une consultation',
    'Mild, recent, low-risk problem': 'Problème léger, récent et à faible risque',
    'Default: a clinician should see every other problem': 'Par défaut : un soignant doit voir tout autre problème',
    'WHO IMCI': 'OMS PCIME',
    'WHO danger signs in pregnancy': 'OMS signes de danger pendant la grossesse',
    'Adult emergency red flag': 'Signe d’alerte d’urgence chez l’adulte',
    'WHO malaria guidance': 'OMS recommandations paludisme',
    'WHO TB screening': 'OMS dépistage de la tuberculose',
    'WHO cholera guidance': 'OMS recommandations choléra',
    'Children are not offered self-care': 'Pas de soins à domicile proposés aux enfants',
    'WHO mhGAP': 'OMS mhGAP',
    'WHO meningitis guidance': 'OMS recommandations méningite',
    'Sickle cell fever is a medical emergency': 'La fièvre chez le drépanocytaire est une urgence médicale',
    'Diabetes sick-day guidance': 'Diabète : conduite à tenir en cas de maladie',
    'Clinical examination needed': 'Examen clinique nécessaire',
    'WHO IDSR bloody diarrhoea': 'OMS SIMR diarrhée sanglante',
    'Primary care': 'Soins primaires',
    'Self-care': 'Soins à domicile',
    'Older adults are not offered self-care': 'Pas de soins à domicile proposés aux personnes âgées',
    'WHO postnatal care': 'OMS soins postnatals'
  };
  const sourceLabel = (source, language = 'en') => language === 'fr' ? SOURCE_FR[source] || source : source;
  const label = (key, language = 'en') => (L[language] || L.en)[key] || L.en[key] || key;
  const emergencyAdvice = (result, language = 'en') => result.emergencyNumber
    ? label('advice_emergency_numbered', language).replace('{number}', result.emergencyNumber)
    : label('advice_emergency', language);
  /** The sentence explaining one rule that fired. */
  function reasonText(reason, language = 'en') {
    if (reason.rule.startsWith('sign_')) return label('r_sign', language).replace('{sign}', label(reason.rule, language));
    return label('r_' + reason.rule, language);
  }

  /** Plain clinician summary, used when no AI draft is available (and always shown next to an AI draft). */
  function clinicianSummary(result, { text = '', health = null, language = 'en' } = {}) {
    const a = result.answers, out = [];
    out.push(`${label('age_' + a.ageGroup, language)}${a.maternal !== 'no' ? `, ${label('maternal_' + a.maternal, language).toLowerCase()}` : ''}.`);
    if (a.complaints.length) out.push(`${language === 'fr' ? 'Problèmes :' : 'Problems:'} ${a.complaints.map(item => label('c_' + item, language).toLowerCase()).join(', ')}${a.duration ? ` — ${label('d_' + a.duration, language).toLowerCase()}` : ''}${a.severity ? `${language === 'fr' ? ' ;' : ';'} ${label('s_' + a.severity, language).split(' — ')[0].toLowerCase()}` : ''}.`);
    out.push(a.dangerSigns.length ? `${language === 'fr' ? 'Signes de danger signalés :' : 'Danger signs reported:'} ${a.dangerSigns.map(sign => label('sign_' + sign, language)).join('; ')}.`
      : `${language === 'fr' ? 'Aucun des' : 'None of the'} ${result.checkedNegative.length} ${language === 'fr' ? 'signes de danger demandés' : 'danger signs asked about'}.`);
    const medical = health?.medical;
    if (medical) {
      const severity = { mild: ['mild', 'légère'], moderate: ['moderate', 'modérée'], severe: ['severe', 'sévère'], anaphylaxis: ['anaphylaxis', 'anaphylaxie'] };
      const allergies = (medical.drugAllergies || []).map(item => `${item.name} (${(severity[item.severity] || [item.severity, item.severity])[language === 'fr' ? 1 : 0]})`);
      if (allergies.length) out.push(`${language === 'fr' ? 'Allergies :' : 'Allergies:'} ${allergies.join(', ')}.`);
      if (medical.conditions?.length) out.push(`${language === 'fr' ? 'Affections déclarées :' : 'Reported conditions:'} ${medical.conditions.join(', ').replace(/_/g, ' ')}.`);
      if (medical.medications?.length) out.push(`${language === 'fr' ? 'Médicaments :' : 'Medicines:'} ${medical.medications.map(item => [item.name, item.dose].filter(Boolean).join(' ')).join(', ')}.`);
    }
    if (text) out.push(language === 'fr' ? `Mots du patient : « ${String(text).slice(0, 600)} »` : `Patient's words: “${String(text).slice(0, 600)}”`);
    out.push(`${language === 'fr' ? 'Règles' : 'Rules'} ${result.rulesVersion}${language === 'fr' ? ' :' : ':'} ${label('level_' + result.level, language)} — ${result.reasons.map(reason => reasonText(reason, language)).join(' ')}`);
    return out.join('\n');
  }

  return { sourceLabel, SOURCE_FR, RULES_VERSION, EMERGENCY_NUMBER, LEVELS, AGE_GROUPS, COMPLAINTS, DURATIONS, SEVERITIES, MATERNAL, SIGNS, ALL_SIGNS, URGENT_SIGNS, rank, signsFor, asksMaternal, normalise, assess, merge, label, emergencyAdvice, reasonText, clinicianSummary };
});
