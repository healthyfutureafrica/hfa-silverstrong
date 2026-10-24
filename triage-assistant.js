// SLY Triage: "Check my symptoms" for patients and the triage queue for nurses and doctors.
//
// The patient answers WHO-based questions in four short steps. The result is worked out on this device at
// once (hfa-triage.js), so emergency advice never waits for the network, then the case is sent to the care
// team. With the server, it may also read the patient's own words with AI (only with their consent),
// which can only raise the level. A clinician always confirms or changes the suggested level.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat, TR = window.HFATriage;
  const L = key => TR.label(key, LANG);

  Object.assign(T.en, {
    st_nav: 'Check my symptoms', st_title: 'Check my symptoms with SLY', st_intro: 'Answer a few questions. SLY tells you how soon to get care and sends your answers to your care team, who will check them.',
    st_not_diagnosis: 'SLY does not diagnose. A nurse or doctor reviews every check.', st_emergency_now: 'Emergency now?', st_call: 'Call {number}',
    st_start: 'Start', st_next: 'Next', st_back: 'Back', st_see_result: 'See my result', st_step: 'Step {n} of 4',
    st_who: 'Who is unwell?', st_who_me: 'Me', st_who_child: 'My child', st_who_other: 'Someone else', st_age: 'Age', st_sex: 'Sex', st_male: 'Male', st_female: 'Female',
    st_maternal: 'Pregnancy', st_problems: 'What is the problem?', st_problems_hint: 'Choose all that apply.',
    st_words: 'Tell us in your own words (optional)', st_words_ph: 'For example: fever since yesterday, headache, vomited twice this morning…',
    st_ai_consent: 'Let SLY’s AI read my words to help my care team. Names, phone numbers and ID numbers are removed first. My words may be processed by Anthropic (Claude) outside Cameroon.',
    st_signs: 'Is any of this happening now?', st_signs_hint: 'Tick every one that is true. If none, choose “None of these”.', st_none: 'None of these',
    st_how_long: 'How long has it lasted?', st_how_bad: 'How bad is it?',
    st_pick_age: 'Choose the age group.', st_pick_problem: 'Choose at least one problem.', st_pick_signs: 'Tick the signs that are true, or choose “None of these”.', st_pick_duration: 'Choose how long and how bad.',
    st_result: 'Your result', st_why: 'Why', st_what_now: 'What to do now', st_book_urgent: 'Book an urgent consultation', st_book: 'Book a consultation', st_selfcare_tips: 'Self-care tips',
    st_sent: 'Sent to your care team. A nurse or doctor will review it.', st_sending: 'Sending to your care team…', st_not_sent: 'Could not reach your care team: {error}. Follow the advice above. If it is an emergency, call {number}.',
    st_updated: 'Updated after SLY read your words.', st_ai_used: 'AI helped read your words.', st_history: 'My symptom checks', st_no_history: 'No symptom checks yet.',
    st_awaiting: 'Waiting for review', st_confirmed: 'Confirmed by {name}', st_changed: 'Changed by {name}', st_clinician_note: 'Message from your care team', st_again: 'Check again',
    tq_title: 'Triage queue', tq_intro: 'Symptom checks from your patients, most urgent first. SLY’s level is a suggestion: confirm it or change it.',
    tq_oversight: 'Oversight view: administrators see the status of the queue, not the symptoms.', tq_no_clinician: 'No clinician can see this patient yet. Assign a doctor or nurse.',
    tq_empty: 'No symptom checks to review.', tq_suggested: 'Suggested', tq_final: 'Final', tq_ai_draft: 'AI draft — check it before relying on it', tq_rules_summary: 'Answers and rules',
    tq_patient_words: 'Patient’s words', tq_confirm: 'Confirm {level}', tq_change: 'Change level', tq_note: 'Message to the patient (they will see it)', tq_note_ph: 'For example: please go to the emergency department now.',
    tq_lower_reason: 'Explain why you lower the level (at least 10 characters).', tq_save: 'Save decision', tq_reviewed: 'Reviewed', tq_waiting: 'Awaiting review', tq_since: '{time} ago'
  });
  Object.assign(T.fr, {
    st_nav: 'Vérifier mes symptômes', st_title: 'Vérifier mes symptômes avec SLY', st_intro: 'Répondez à quelques questions. SLY vous dit dans quel délai consulter et transmet vos réponses à votre équipe de soins, qui les vérifiera.',
    st_not_diagnosis: 'SLY ne pose pas de diagnostic. Un infirmier ou un médecin vérifie chaque réponse.', st_emergency_now: 'Urgence maintenant ?', st_call: 'Appeler le {number}',
    st_start: 'Commencer', st_next: 'Suivant', st_back: 'Retour', st_see_result: 'Voir mon résultat', st_step: 'Étape {n} sur 4',
    st_who: 'Qui est malade ?', st_who_me: 'Moi', st_who_child: 'Mon enfant', st_who_other: 'Une autre personne', st_age: 'Âge', st_sex: 'Sexe', st_male: 'Homme', st_female: 'Femme',
    st_maternal: 'Grossesse', st_problems: 'Quel est le problème ?', st_problems_hint: 'Choisissez tout ce qui s’applique.',
    st_words: 'Expliquez avec vos mots (facultatif)', st_words_ph: 'Par exemple : fièvre depuis hier, mal de tête, a vomi deux fois ce matin…',
    st_ai_consent: 'Laisser l’IA de SLY lire mes mots pour aider mon équipe de soins. Les noms, numéros de téléphone et d’identité sont retirés avant. Mes mots peuvent être traités par Anthropic (Claude) hors du Cameroun.',
    st_signs: 'L’un de ces signes est-il présent maintenant ?', st_signs_hint: 'Cochez tous ceux qui sont vrais. Sinon, choisissez « Aucun de ces signes ».', st_none: 'Aucun de ces signes',
    st_how_long: 'Depuis combien de temps ?', st_how_bad: 'Quelle intensité ?',
    st_pick_age: 'Choisissez la tranche d’âge.', st_pick_problem: 'Choisissez au moins un problème.', st_pick_signs: 'Cochez les signes présents ou choisissez « Aucun de ces signes ».', st_pick_duration: 'Choisissez la durée et l’intensité.',
    st_result: 'Votre résultat', st_why: 'Pourquoi', st_what_now: 'Que faire maintenant', st_book_urgent: 'Réserver une consultation urgente', st_book: 'Réserver une consultation', st_selfcare_tips: 'Conseils de soins',
    st_sent: 'Envoyé à votre équipe de soins. Un infirmier ou un médecin va le vérifier.', st_sending: 'Envoi à votre équipe de soins…', st_not_sent: 'Impossible de joindre votre équipe de soins : {error}. Suivez le conseil ci-dessus. En cas d’urgence, appelez le {number}.',
    st_updated: 'Mis à jour après la lecture de vos mots par SLY.', st_ai_used: 'L’IA a aidé à lire vos mots.', st_history: 'Mes vérifications de symptômes', st_no_history: 'Aucune vérification pour l’instant.',
    st_awaiting: 'En attente de vérification', st_confirmed: 'Confirmé par {name}', st_changed: 'Modifié par {name}', st_clinician_note: 'Message de votre équipe de soins', st_again: 'Vérifier à nouveau',
    tq_title: 'File de triage', tq_intro: 'Vérifications de symptômes de vos patients, les plus urgentes d’abord. Le niveau de SLY est une suggestion : confirmez-le ou modifiez-le.',
    tq_oversight: 'Vue de supervision : les administrateurs voient l’état de la file, pas les symptômes.', tq_no_clinician: 'Aucun soignant ne peut voir ce patient. Assignez un médecin ou un infirmier.',
    tq_empty: 'Aucune vérification à examiner.', tq_suggested: 'Suggéré', tq_final: 'Final', tq_ai_draft: 'Brouillon IA — vérifiez-le avant de vous y fier', tq_rules_summary: 'Réponses et règles',
    tq_patient_words: 'Mots du patient', tq_confirm: 'Confirmer : {level}', tq_change: 'Modifier le niveau', tq_note: 'Message au patient (il le verra)', tq_note_ph: 'Par exemple : allez maintenant aux urgences.',
    tq_lower_reason: 'Expliquez pourquoi vous baissez le niveau (au moins 10 caractères).', tq_save: 'Enregistrer la décision', tq_reviewed: 'Vérifié', tq_waiting: 'En attente', tq_since: 'il y a {time}'
  });

  // Sidebar: patients check symptoms; doctors and nurses review (admins already have the queue).
  NAV.patient.find(section => section.items.some(item => item.id === 'messages'))?.items.unshift({ id: 'triage', l: () => t('st_nav'), i: 'pulse' });
  for (const role of ['doctor', 'nurse']) NAV[role][0]?.items.push({ id: 'triage-queue', l: () => t('tq_title'), i: 'pulse' });

  document.head.insertAdjacentHTML('beforeend', `<style>
    .st-emergency{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#FDECEE;border:2px solid var(--dg);color:#7a0d1a;border-radius:var(--r);padding:12px 16px;margin-bottom:16px;font-weight:600}
    .st-call{display:inline-flex;align-items:center;gap:8px;background:var(--dg);color:#fff;border-radius:999px;padding:10px 18px;font-weight:700;text-decoration:none;font-size:1rem}
    .st-call:focus-visible{outline:3px solid var(--go-l);outline-offset:2px}
    .st-progress{height:8px;border-radius:8px;background:var(--si-l);overflow:hidden;margin:6px 0 18px}.st-progress span{display:block;height:100%;background:linear-gradient(90deg,var(--em),var(--go-l));border-radius:8px}
    .st-q{font-size:1.15rem;font-weight:700;margin:4px 0 10px}.st-hint{color:var(--t3);font-size:.85rem;margin-bottom:10px}
    .st-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px;margin-bottom:16px}
    .st-chip{display:flex;align-items:center;gap:10px;min-height:52px;padding:12px 14px;border:2px solid var(--bd);border-radius:14px;background:var(--sf);color:var(--t1);font:inherit;font-size:.92rem;text-align:left;cursor:pointer}
    .st-chip[aria-pressed="true"],.st-chip[aria-checked="true"]{border-color:var(--em);background:var(--em-p);font-weight:600}
    .st-chip.st-danger[aria-pressed="true"]{border-color:var(--dg);background:#FDECEE}
    .st-chip.st-none{justify-content:center;font-weight:700}
    .st-nav{display:flex;justify-content:space-between;gap:10px;margin-top:8px}
    .st-result{border-radius:var(--rl);padding:20px;color:#fff;margin-bottom:16px}
    .st-result h3{font-size:1.5rem;margin:2px 0 6px}.st-result p{font-size:1rem;line-height:1.5}
    .st-l-emergency{background:linear-gradient(135deg,#E5172F,#B80F22)}.st-l-urgent{background:linear-gradient(135deg,#F59E0B,#D97706);color:#231400}
    .st-l-routine{background:linear-gradient(135deg,#1F7BC2,#1a6fa3)}.st-l-self_care{background:linear-gradient(135deg,#2A8F5C,#006B3F)}
    .st-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.74rem;font-weight:700;color:#fff}
    .st-b-emergency{background:var(--dg)}.st-b-urgent{background:#B45309}.st-b-routine{background:#1a6fa3}.st-b-self_care{background:var(--em)}
    .st-reasons{padding-left:20px;margin:6px 0 12px}.st-reasons li{margin:4px 0}
    .st-ai-box{border-left:4px solid var(--go-l);background:var(--go-p);padding:10px 14px;border-radius:0 var(--rs) var(--rs) 0;white-space:pre-wrap;margin:8px 0}
    .st-pre{white-space:pre-wrap;background:var(--si-p);border:1px solid var(--bd);border-radius:var(--rs);padding:10px 12px;font-size:.84rem;margin:8px 0}
    .tq-case{border-left:6px solid var(--bd2)}.tq-case.tq-emergency{border-left-color:var(--dg)}.tq-case.tq-urgent{border-left-color:#D97706}.tq-case.tq-routine{border-left-color:#1a6fa3}.tq-case.tq-self_care{border-left-color:var(--em)}
    .st-consent{display:flex;gap:10px;align-items:flex-start;font-size:.84rem;margin:4px 0 14px;color:var(--t2)}.st-consent input{width:22px;height:22px;flex-shrink:0;margin-top:2px}
  </style>`);

  const levelBadge = level => `<span class="st-badge st-b-${esc(level)}">${esc(L('level_' + level))}</span>`;
  const backend = () => ApiState.enabled && ApiState.authenticated;
  const callButton = () => `<a class="st-call" href="tel:${TR.EMERGENCY_NUMBER}">📞 ${esc(tf('st_call', { number: TR.EMERGENCY_NUMBER }))}</a>`;
  const ago = iso => { const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return minutes < 60 ? `${minutes} min` : minutes < 2880 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} d`; };

  function ageGroupOf(dateOfBirth) {
    const born = Date.parse(dateOfBirth);
    if (!born) return null;
    const days = (Date.now() - born) / 86400000;
    return days < 61 ? 'infant' : days < 5 * 365.25 ? 'child' : days < 15 * 365.25 ? 'older_child' : days < 65 * 365.25 ? 'adult' : 'older_adult';
  }

  // ───── Patient: the four steps ─────
  let S = null;
  function fresh() {
    const health = CU.healthProfile || {};
    return { step: 0, who: 'me', ageGroup: ageGroupOf(health.identity?.dateOfBirth || CU.dateOfBirth), sex: ['male', 'female'].includes(String(health.identity?.gender || CU.gender || '').toLowerCase()) ? String(health.identity?.gender || CU.gender).toLowerCase() : null,
      maternal: 'no', complaints: [], dangerSigns: [], noneChosen: false, duration: null, severity: null, text: '', aiConsent: false, requestId: crypto.randomUUID() };
  }
  const chip = (attrs, label, pressed, extra = '') => `<button type="button" class="st-chip ${extra}" ${attrs} aria-pressed="${pressed ? 'true' : 'false'}">${pressed ? '✅' : '⬜'} <span>${esc(label)}</span></button>`;
  const single = (name, values, current, labelKey) => `<div class="st-chips" role="radiogroup">${values.map(value => `<button type="button" class="st-chip" role="radio" data-${name}="${value}" aria-checked="${current === value}">${current === value ? '🔘' : '⚪'} <span>${esc(labelKey(value))}</span></button>`).join('')}</div>`;

  function renderPatient(pc) {
    $('tbt').textContent = t('st_nav');
    if (!S) S = fresh();
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('st_title'))}</h2><p>${esc(t('st_intro'))}</p></div>
      <div class="st-emergency" role="note"><span>🚨 ${esc(t('st_emergency_now'))} ${esc(L('advice_emergency'))}</span>${callButton()}</div>
      <div class="card mb18" id="st-card" aria-live="polite"></div>
      <div class="card"><div class="ch"><div class="ct">${esc(t('st_history'))}</div></div><div id="st-history"><p class="mu sm">…</p></div></div></div>`;
    paintStep();
    paintHistory();
  }

  function paintStep(message = '') {
    const card = $('st-card'); if (!card) return;
    const progress = n => `<p class="mu sm">${esc(tf('st_step', { n }))}</p><div class="st-progress" aria-hidden="true"><span style="width:${n * 25}%"></span></div>`;
    const nav = (back, next, nextLabel = t('st_next')) => `${message ? `<div class="alt ae" role="alert">${esc(message)}</div>` : ''}<div class="st-nav">${back ? `<button type="button" class="btn bs" data-go="back">${esc(t('st_back'))}</button>` : '<span></span>'}<button type="button" class="btn bp" data-go="next">${esc(nextLabel)}</button></div>`;
    let body = '';
    if (S.step === 0) body = `<p>${esc(t('st_not_diagnosis'))}</p><div class="st-nav"><span></span><button type="button" class="btn bp" data-go="next">${esc(t('st_start'))}</button></div>`;
    if (S.step === 1) body = `${progress(1)}<div class="st-q">${esc(t('st_who'))}</div>${single('who', ['me', 'child', 'other'], S.who, value => t('st_who_' + value))}
      <div class="st-q">${esc(t('st_age'))}</div>${single('age', TR.AGE_GROUPS, S.ageGroup, value => L('age_' + value))}
      <div class="st-q">${esc(t('st_sex'))}</div>${single('sex', ['female', 'male'], S.sex, value => t('st_' + value))}
      ${TR.asksMaternal(S) ? `<div class="st-q">${esc(t('st_maternal'))}</div>${single('maternal', TR.MATERNAL, S.maternal, value => L('maternal_' + value))}` : ''}${nav(false, true)}`;
    if (S.step === 2) body = `${progress(2)}<div class="st-q">${esc(t('st_problems'))}</div><p class="st-hint">${esc(t('st_problems_hint'))}</p>
      <div class="st-chips">${TR.COMPLAINTS.map(item => chip(`data-complaint="${item}"`, L('c_' + item), S.complaints.includes(item))).join('')}</div>
      <div class="fg"><label class="fl" for="st-words">${esc(t('st_words'))}</label><textarea class="fc" id="st-words" rows="3" maxlength="2000" placeholder="${esc(t('st_words_ph'))}">${esc(S.text)}</textarea></div>
      ${backend() && ApiState.aiTriage ? `<label class="st-consent"><input type="checkbox" id="st-ai" ${S.aiConsent ? 'checked' : ''}><span>${esc(t('st_ai_consent'))}</span></label>` : ''}${nav(true, true)}`;
    if (S.step === 3) {
      const signs = TR.signsFor(S);
      body = `${progress(3)}<div class="st-q">${esc(t('st_signs'))}</div><p class="st-hint">${esc(t('st_signs_hint'))}</p>
        <div class="st-chips">${signs.map(sign => chip(`data-sign="${sign}"`, L('sign_' + sign), S.dangerSigns.includes(sign), 'st-danger')).join('')}${chip('data-none="1"', t('st_none'), S.noneChosen, 'st-none')}</div>${nav(true, true)}`;
    }
    if (S.step === 4) body = `${progress(4)}<div class="st-q">${esc(t('st_how_long'))}</div>${single('duration', TR.DURATIONS, S.duration, value => L('d_' + value))}
      <div class="st-q">${esc(t('st_how_bad'))}</div>${single('severity', TR.SEVERITIES, S.severity, value => L('s_' + value))}${nav(true, true, t('st_see_result'))}`;
    card.innerHTML = body;
    card.querySelectorAll('[data-who]').forEach(el => el.onclick = () => { S.who = el.dataset.who; if (S.who !== 'me') { S.ageGroup = null; S.sex = null; } paintStep(); });
    card.querySelectorAll('[data-age]').forEach(el => el.onclick = () => { S.ageGroup = el.dataset.age; if (!TR.asksMaternal(S)) S.maternal = 'no'; paintStep(); });
    card.querySelectorAll('[data-sex]').forEach(el => el.onclick = () => { S.sex = el.dataset.sex; if (!TR.asksMaternal(S)) S.maternal = 'no'; paintStep(); });
    card.querySelectorAll('[data-maternal]').forEach(el => el.onclick = () => { S.maternal = el.dataset.maternal; paintStep(); });
    card.querySelectorAll('[data-duration]').forEach(el => el.onclick = () => { S.duration = el.dataset.duration; paintStep(); });
    card.querySelectorAll('[data-severity]').forEach(el => el.onclick = () => { S.severity = el.dataset.severity; paintStep(); });
    card.querySelectorAll('[data-complaint]').forEach(el => el.onclick = () => { keepWords(); toggle(S.complaints, el.dataset.complaint); paintStep(); });
    card.querySelectorAll('[data-sign]').forEach(el => el.onclick = () => { toggle(S.dangerSigns, el.dataset.sign); S.noneChosen = false; paintStep(); });
    card.querySelectorAll('[data-none]').forEach(el => el.onclick = () => { S.dangerSigns = []; S.noneChosen = true; paintStep(); });
    card.querySelectorAll('[data-go]').forEach(el => el.onclick = () => go(el.dataset.go));
  }
  const toggle = (list, value) => { const index = list.indexOf(value); if (index >= 0) list.splice(index, 1); else list.push(value); };
  function keepWords() { if ($('st-words')) S.text = $('st-words').value; if ($('st-ai')) S.aiConsent = $('st-ai').checked; }

  function go(direction) {
    keepWords();
    if (direction === 'back') { S.step = Math.max(0, S.step - 1); return paintStep(); }
    if (S.step === 1 && !S.ageGroup) return paintStep(t('st_pick_age'));
    if (S.step === 2 && !S.complaints.length && !S.text.trim()) return paintStep(t('st_pick_problem'));
    if (S.step === 2 && /[<>]/.test(S.text)) return paintStep(t('st_pick_problem'));
    if (S.step === 3) {
      // Signs must be signs for this person: drop any left over from changed answers.
      const asked = TR.signsFor(S); S.dangerSigns = S.dangerSigns.filter(sign => asked.includes(sign));
      if (!S.dangerSigns.length && !S.noneChosen) return paintStep(t('st_pick_signs'));
      // An emergency sign ends the questions at once.
      if (S.dangerSigns.some(sign => !TR.URGENT_SIGNS.includes(sign))) return finish();
    }
    if (S.step === 4) { if (!S.duration || !S.severity) return paintStep(t('st_pick_duration')); return finish(); }
    S.step += 1; paintStep();
  }

  const answersOf = () => ({ ageGroup: S.ageGroup, ...(S.sex ? { sex: S.sex } : {}), maternal: S.maternal, complaints: S.complaints, dangerSigns: S.dangerSigns,
    ...(S.duration ? { duration: S.duration } : {}), ...(S.severity ? { severity: S.severity } : {}), forSomeoneElse: S.who !== 'me' });

  function resultCard(result, note = '') {
    const level = result.level, crisis = result.answers?.dangerSigns?.includes('suicidal') || (result.reasons || []).some(reason => reason.rule === 'sign_suicidal');
    const actions = level === 'emergency' ? callButton()
      : level === 'urgent' ? `<button type="button" class="btn bp" onclick="showBookApt('URGENT-TRIAGE')">${esc(t('st_book_urgent'))}</button>`
      : level === 'routine' ? `<button type="button" class="btn bp" onclick="showBookApt()">${esc(t('st_book'))}</button>`
      : `<button type="button" class="btn bp" onclick="navigate('freehub')">${esc(t('st_selfcare_tips'))}</button>`;
    return `<div class="st-result st-l-${esc(level)}" role="status"><p class="sm">${esc(t('st_result'))}</p><h3>${esc(L('level_' + level))}</h3><p>${esc(L('advice_' + level))}</p></div>
      ${crisis ? `<div class="st-emergency">${esc(L('crisis').replace('{number}', TR.EMERGENCY_NUMBER))}</div>` : ''}
      <div class="pc-actions">${actions}<button type="button" class="btn bs" id="st-again">${esc(t('st_again'))}</button></div>
      <div class="st-q mt18">${esc(t('st_why'))}</div><ul class="st-reasons">${(result.reasons || []).map(reason => `<li>${esc(TR.reasonText(reason, LANG))}</li>`).join('')}</ul>
      <p class="mu sm">${esc(t('st_not_diagnosis'))}</p><div id="st-status" class="mt8">${note}</div>`;
  }

  async function finish() {
    const card = $('st-card'), answers = answersOf();
    const local = TR.assess({ ...answers, conditions: CU.healthProfile?.medical?.conditions || [] });
    card.innerHTML = resultCard(local, `<div class="alt ai">${esc(t('st_sending'))}</div>`);
    const again = () => { S = fresh(); paintStep(); };
    $('st-again').onclick = again;
    const submitted = S; S = fresh(); // a new check starts clean even if this one is still sending
    const status = (html) => { const box = $('st-status'); if (box) box.innerHTML = html; };
    try {
      if (backend()) {
        const response = await apiRequest('/api/v1/triage', 'POST', { requestId: submitted.requestId, answers, text: submitted.text.trim(), aiConsent: !!submitted.aiConsent }, 30000);
        const server = response.data.case;
        // The server may know more (the patient's words); it can only raise the level shown.
        const raised = TR.rank(server.level) > TR.rank(local.level);
        if (raised && $('st-card')) { $('st-card').innerHTML = resultCard(server); $('st-again').onclick = again; }
        status(`<div class="alt ao" role="status">${raised ? esc(t('st_updated')) + ' ' : ''}${esc(t('st_sent'))}${response.data.aiUsed ? ' ' + esc(t('st_ai_used')) : ''}</div>`);
      } else {
        const item = { id: 'tr' + Date.now(), patientId: CU.id, level: local.level, priority: local.level, status: 'awaiting_review', answers: local.answers, reasons: local.reasons,
          checkedNegative: local.checkedNegative, rulesVersion: local.rulesVersion, text: submitted.text.trim(), rulesSummary: TR.clinicianSummary(local, { text: submitted.text.trim(), health: CU.healthProfile }),
          symptoms: [...local.answers.complaints.map(item => L('c_' + item)), submitted.text.trim()].filter(Boolean).join(', '), location: '', createdAt: new Date().toISOString() };
        DB.triageCases.unshift(item);
        for (const clinicianId of [CU.assignedDoctor, CU.assignedNurse].filter(Boolean)) if (typeof notifyUser === 'function') notifyUser(clinicianId, local.level === 'emergency' ? 'Emergency triage needs your review now.' : 'A new symptom check needs your review.', 'Urgent Care');
        if (typeof notifyPatientActivity === 'function') notifyPatientActivity(CU.id, 'Urgent Care');
        log('SUBMIT_TRIAGE', `Urgent Care · ${local.level}`);
        status(`<div class="alt ao" role="status">${esc(t('st_sent'))}</div>`);
      }
      paintHistory();
    } catch (error) {
      status(`<div class="alt ae" role="alert">${esc(tf('st_not_sent', { error: error.message, number: TR.EMERGENCY_NUMBER }))}</div>`);
      S = submitted; S.step = 4; // keep the answers so the patient can send again
    }
  }

  async function loadMine() {
    if (backend()) return (await apiRequest('/api/v1/triage/mine')).data.cases;
    return DB.triageCases.filter(item => item.patientId === CU.id && item.level).map(item => ({ ...item, reviewerName: G(item.reviewerId)?.name || null }));
  }
  async function paintHistory() {
    const box = $('st-history'); if (!box) return;
    try {
      const cases = await loadMine();
      if (!box.isConnected) return;
      box.innerHTML = cases.length ? cases.map(item => `<div class="pc-row"><div><div>${levelBadge(item.finalLevel || item.level)} <span class="mu sm">${esc(String(item.createdAt).replace('T', ' ').slice(0, 16))}</span></div>
        <div class="sm mt8">${esc((item.answers?.complaints || []).map(code => L('c_' + code)).join(', '))}</div>
        ${item.note ? `<div class="pc-answer sm"><strong>${esc(t('st_clinician_note'))}:</strong> ${esc(item.note)}</div>` : ''}</div>
        <div class="mu sm">${item.status === 'awaiting_review' ? esc(t('st_awaiting')) : esc(tf(item.status === 'confirmed' ? 'st_confirmed' : 'st_changed', { name: item.reviewerName || '—' }))}</div></div>`).join('')
        : `<p class="mu sm">${esc(t('st_no_history'))}</p>`;
    } catch (error) { box.innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; }
  }

  // ───── Clinicians: the queue ─────
  function demoQueue() {
    const mine = patient => CU.role === 'admin' || patient && (patient.assignedDoctor === CU.id || patient.assignedNurse === CU.id || (CU.hospital && patient.hospital === CU.hospital));
    const sort = (a, b) => (a.status === 'awaiting_review' ? 0 : 1) - (b.status === 'awaiting_review' ? 0 : 1) || TR.rank(b.level) - TR.rank(a.level) || String(a.createdAt).localeCompare(String(b.createdAt));
    return DB.triageCases.filter(item => item.level && mine(G(item.patientId))).map(item => {
      const patient = G(item.patientId);
      if (CU.role === 'admin') return { id: item.id, level: item.level, finalLevel: item.finalLevel, status: item.status, createdAt: item.createdAt, patientName: patient?.name, hfaId: patient?.hfaId, hasClinician: !!(patient?.assignedDoctor || patient?.assignedNurse) };
      return { ...item, patientName: patient?.name, hfaId: patient?.hfaId, reviewerName: G(item.reviewerId)?.name || null, note: item.review?.note || '' };
    }).sort(sort);
  }

  let QUEUE = new Map();
  async function renderQueue(pc) {
    $('tbt').textContent = t('tq_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('tq_title'))}</h2><p>${esc(t('tq_intro'))}</p></div><div id="tq-body"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const body = $('tq-body');
    try {
      const data = backend() ? (await apiRequest('/api/v1/triage/queue')).data : { cases: demoQueue(), oversightOnly: CU.role === 'admin' };
      if (!body.isConnected) return;
      const cases = data.cases;
      QUEUE = new Map(cases.map(item => [item.id, item]));
      const waiting = cases.filter(item => item.status === 'awaiting_review');
      const stats = `<div class="stats mb18">${TR.LEVELS.slice().reverse().map(level => `<div class="sc"><div class="sv">${waiting.filter(item => item.level === level).length}</div><div class="sl">${esc(L('level_' + level))}</div></div>`).join('')}</div>`;
      if (data.oversightOnly) {
        body.innerHTML = `${stats}<div class="alt ai mb18">${esc(t('tq_oversight'))}</div><div class="card">${cases.length ? cases.map(item => `<div class="pc-row"><div><strong>${esc(item.patientName || '—')}</strong> <code class="code-chip">${esc(item.hfaId || '')}</code><div class="mu sm">${esc(tf('tq_since', { time: ago(item.createdAt) }))}</div>${item.hasClinician ? '' : `<div class="alt ae sm mt8">${esc(t('tq_no_clinician'))}</div>`}</div><div>${levelBadge(item.finalLevel || item.level)} <span class="mu sm">${esc(t(item.status === 'awaiting_review' ? 'tq_waiting' : 'tq_reviewed'))}</span></div></div>`).join('') : `<p class="mu sm">${esc(t('tq_empty'))}</p>`}</div>`;
        return;
      }
      body.innerHTML = stats + (cases.length ? cases.map(caseCard).join('') : `<div class="card"><p class="mu sm">${esc(t('tq_empty'))}</p></div>`);
      body.querySelectorAll('[data-confirm]').forEach(button => button.onclick = () => decide(button.dataset.confirm, 'confirm'));
      body.querySelectorAll('[data-change]').forEach(button => button.onclick = () => decide(button.dataset.change, 'change'));
    } catch (error) { body.innerHTML = `<div class="card"><div class="alt ae" role="alert">${esc(error.message)}</div></div>`; }
  }

  function caseCard(item) {
    const open = item.status === 'awaiting_review', id = esc(item.id);
    return `<div class="card mb18 tq-case tq-${esc(item.finalLevel || item.level)}"><div class="ch" style="flex-wrap:wrap;gap:8px"><div><div class="ct">${esc(item.patientName || '—')} <code class="code-chip">${esc(item.hfaId || '')}</code></div>
      <div class="mu sm">${esc(tf('tq_since', { time: ago(item.createdAt) }))} · ${esc(L('age_' + item.answers?.ageGroup))}${item.answers?.forSomeoneElse ? ' · ' + esc(t('st_who_other')) : ''}</div></div>
      <div>${esc(t('tq_suggested'))}: ${levelBadge(item.level)}${item.finalLevel ? ` · ${esc(t('tq_final'))}: ${levelBadge(item.finalLevel)}` : ''}</div></div>
      <ul class="st-reasons">${(item.reasons || []).map(reason => `<li>${esc(TR.reasonText(reason, LANG))} <span class="mu sm">(${esc(reason.source)})</span></li>`).join('')}</ul>
      ${item.aiSummary ? `<div class="sm"><strong>🤖 ${esc(t('tq_ai_draft'))}</strong><div class="st-ai-box">${esc(item.aiSummary)}</div></div>` : ''}
      <details ${item.aiSummary ? '' : 'open'}><summary class="sm">${esc(t('tq_rules_summary'))}</summary><div class="st-pre">${esc(item.rulesSummary || '')}</div></details>
      ${open ? `<div class="mt8"><div class="fg"><label class="fl" for="tq-note-${id}">${esc(t('tq_note'))}</label><textarea class="fc" id="tq-note-${id}" rows="2" maxlength="1000" placeholder="${esc(t('tq_note_ph'))}"></textarea></div>
        <div class="pc-actions"><button type="button" class="btn bp" data-confirm="${id}">${esc(tf('tq_confirm', { level: L('level_' + item.level) }))}</button>
        <select class="fc" id="tq-level-${id}" style="max-width:240px" aria-label="${esc(t('tq_change'))}">${TR.LEVELS.slice().reverse().filter(level => level !== item.level).map(level => `<option value="${level}">${esc(L('level_' + level))}</option>`).join('')}</select>
        <button type="button" class="btn bs" data-change="${id}">${esc(t('tq_change'))}</button></div><div id="tq-msg-${id}"></div></div>`
        : `<p class="mu sm mt8">${esc(t('tq_reviewed'))}${item.reviewerName ? ' · ' + esc(item.reviewerName) : ''}${item.note ? ` — “${esc(item.note)}”` : ''}</p>`}</div>`;
  }

  async function decide(id, decision) {
    const loaded = QUEUE.get(id), item = backend() ? null : DB.triageCases.find(entry => entry.id === id);
    if (!loaded) return;
    const note = ($(`tq-note-${id}`)?.value || '').trim(), suggested = loaded.level;
    const finalLevel = decision === 'confirm' ? suggested : $(`tq-level-${id}`).value;
    const box = $(`tq-msg-${id}`);
    if (/[<>]/.test(note)) { box.innerHTML = `<div class="alt ae">${esc(t('tq_lower_reason'))}</div>`; return; }
    if (TR.rank(finalLevel) < TR.rank(suggested) && note.length < 10) { box.innerHTML = `<div class="alt ae" role="alert">${esc(t('tq_lower_reason'))}</div>`; return; }
    try {
      if (backend()) await apiRequest(`/api/v1/triage/${encodeURIComponent(id)}/review`, 'POST', { decision, finalLevel, note });
      else {
        Object.assign(item, { status: decision === 'confirm' ? 'confirmed' : 'changed', finalLevel, reviewerId: CU.id, reviewedAt: new Date().toISOString(), review: { decision, note } });
        log('TRIAGE_REVIEWED', `${item.level} → ${finalLevel}`);
        if (typeof notifyUser === 'function') notifyUser(item.patientId, 'A clinician has reviewed your symptom check.', 'Urgent Care');
      }
      renderQueue($('pgc'));
    } catch (error) { box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; }
  }

  // The old urgent-help form asked patients to choose their own urgency; every entry point now opens SLY.
  window.showTriage = () => { closeMo(); S = null; navigate('triage'); };
  window.renderTriageQueue = renderQueue;
  window.HFATriageUI = { renderPatient, renderQueue, ageGroupOf };
})();
