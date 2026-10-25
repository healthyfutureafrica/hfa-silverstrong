// "SLY AI" page: the model card for every AI feature, the triage safety evaluation run live, real-world
// monitoring (how often clinicians agree), and outbreak early warning — following the WHO guidance
// "Ethics and governance of artificial intelligence for health" (2021).
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat, TR = window.HFATriage, EV = window.HFAAiEval, SV = window.HFASurveillance;
  const lang = value => value[LANG] || value.en;

  Object.assign(T.en, {
    aic_nav: 'SLY AI', aic_title: 'SLY AI — what it does and how we check it',
    aic_intro: 'SLY helps at every step of care: before (symptom check), during (clinical notes), after (explaining results) and for the whole population (outbreak warning). Fixed safety rules and clinicians make the decisions; AI only assists.',
    aic_status_on: 'AI help is ON · model {model} · {used} of {limit} requests used today', aic_status_off: 'AI help is OFF on this service. Every feature still works with rules, templates and the built-in dictionary.',
    aic_features: 'AI features', aic_what: 'What it does', aic_method: 'Method', aic_data: 'Data sent', aic_human: 'Human check', aic_cost: 'Cost',
    aic_eval: 'Safety evaluation (runs live on this page)', aic_eval_intro: '{total} clinical scenarios based on WHO guidance, run through the triage rules version {version} now.',
    aic_cases: 'Scenarios', aic_exact: 'Exact match', aic_under: 'Missed urgency (must be 0)', aic_sensitivity: 'Emergencies caught',
    aic_over: 'More urgent than needed', aic_eval_caveat: 'These scenarios were written by the HFA team with the rules. Independent clinical review and real-world validation are needed before launch.',
    aic_show_cases: 'Show every scenario', aic_expected: 'Expected', aic_got: 'SLY', aic_source: 'Source',
    aic_monitor: 'Real-world monitoring (last 90 days)', aic_agreement: 'Clinicians agreed', aic_raised: 'Raised by clinician (SLY too low)', aic_lowered: 'Lowered by clinician',
    aic_awaiting: 'Awaiting review', aic_ai_calls: 'AI requests (30 days)', aic_ai_cost: 'Estimated AI cost (30 days)', aic_no_reviews: 'No reviewed cases yet.',
    aic_outbreak: 'Outbreak early warning', aic_outbreak_intro: 'Unusual groups of symptoms by region from symptom checks in the last 7 days, compared with the 4 weeks before. Statistics only, no AI cost. Signals are not diagnoses: they tell surveillance staff where to look.',
    aic_no_signals: 'No unusual clusters this week.', aic_signal_count: '{current} this week · usual {baseline} a week', aic_alert: 'Alert', aic_watch: 'Watch',
    aic_export: 'Download weekly counts (CSV, DHIS2-style)', aic_counted: '{counted} symptom checks counted, {unknown} without a region.',
    aic_principles: 'WHO principles for AI in health, and how SLY follows them', aic_limits: 'Limits',
    aic_limit_1: 'SLY does not diagnose or prescribe. Results are suggestions a clinician confirms.', aic_limit_2: 'AI can misread words or invent details. Drafts are labelled and must be checked.',
    aic_limit_3: 'Symptom checks only cover people who use HFA, so outbreak signals can miss cases elsewhere.', aic_limit_4: 'The rules and scenarios need review by Cameroonian clinicians and the Ministry of Public Health before real use.'
  });
  Object.assign(T.fr, {
    aic_nav: 'IA SLY', aic_title: 'IA SLY — ce qu’elle fait et comment nous la vérifions',
    aic_intro: 'SLY aide à chaque étape des soins : avant (vérification des symptômes), pendant (notes cliniques), après (explication des résultats) et pour toute la population (alerte d’épidémie). Des règles de sécurité fixes et les soignants décident ; l’IA ne fait qu’aider.',
    aic_status_on: 'Aide IA ACTIVÉE · modèle {model} · {used} sur {limit} demandes utilisées aujourd’hui', aic_status_off: 'Aide IA DÉSACTIVÉE sur ce service. Chaque fonction marche quand même avec les règles, des modèles et le dictionnaire intégré.',
    aic_features: 'Fonctions IA', aic_what: 'Ce qu’elle fait', aic_method: 'Méthode', aic_data: 'Données envoyées', aic_human: 'Contrôle humain', aic_cost: 'Coût',
    aic_eval: 'Évaluation de sécurité (exécutée en direct sur cette page)', aic_eval_intro: '{total} scénarios cliniques fondés sur l’OMS, passés maintenant dans les règles de triage version {version}.',
    aic_cases: 'Scénarios', aic_exact: 'Exactement juste', aic_under: 'Urgence manquée (doit être 0)', aic_sensitivity: 'Urgences repérées',
    aic_over: 'Plus urgent que nécessaire', aic_eval_caveat: 'Ces scénarios ont été écrits par l’équipe HFA avec les règles. Une revue clinique indépendante et une validation réelle sont nécessaires avant le lancement.',
    aic_show_cases: 'Voir chaque scénario', aic_expected: 'Attendu', aic_got: 'SLY', aic_source: 'Source',
    aic_monitor: 'Suivi en conditions réelles (90 derniers jours)', aic_agreement: 'Accord des soignants', aic_raised: 'Relevé par le soignant (SLY trop bas)', aic_lowered: 'Abaissé par le soignant',
    aic_awaiting: 'En attente de vérification', aic_ai_calls: 'Demandes IA (30 jours)', aic_ai_cost: 'Coût IA estimé (30 jours)', aic_no_reviews: 'Aucun cas vérifié pour l’instant.',
    aic_outbreak: 'Alerte précoce d’épidémie', aic_outbreak_intro: 'Groupes inhabituels de symptômes par région, à partir des vérifications des 7 derniers jours, comparés aux 4 semaines précédentes. Statistiques uniquement, sans coût d’IA. Ce ne sont pas des diagnostics : ils indiquent où regarder.',
    aic_no_signals: 'Aucun regroupement inhabituel cette semaine.', aic_signal_count: '{current} cette semaine · d’habitude {baseline} par semaine', aic_alert: 'Alerte', aic_watch: 'Surveiller',
    aic_export: 'Télécharger les chiffres hebdomadaires (CSV, format DHIS2)', aic_counted: '{counted} vérifications comptées, {unknown} sans région.',
    aic_principles: 'Principes de l’OMS pour l’IA en santé, et comment SLY les suit', aic_limits: 'Limites',
    aic_limit_1: 'SLY ne pose pas de diagnostic et ne prescrit pas. Les résultats sont des suggestions qu’un soignant confirme.', aic_limit_2: 'L’IA peut mal lire des mots ou inventer des détails. Les brouillons sont signalés et doivent être vérifiés.',
    aic_limit_3: 'Les vérifications ne couvrent que les utilisateurs de HFA : des cas ailleurs peuvent échapper aux alertes.', aic_limit_4: 'Les règles et les scénarios doivent être revus par des soignants camerounais et le Ministère de la Santé Publique avant un usage réel.'
  });

  for (const sections of Object.values(NAV)) {
    const legal = sections.find(section => section.items.some(item => item.id === 'privacy'));
    if (legal) legal.items.unshift({ id: 'ai-centre', l: () => t('aic_nav'), i: 'pulse' });
  }

  const FEATURES = [
    { icon: '🩺', name: { en: 'Symptom check (SLY Triage)', fr: 'Vérification des symptômes (Triage SLY)' },
      what: { en: 'Tells patients how soon to get care and hands the case to their clinicians.', fr: 'Dit au patient dans quel délai consulter et transmet le cas à ses soignants.' },
      method: { en: 'Fixed WHO-based rules decide. Optional AI reads the patient’s own words and can only raise the level.', fr: 'Des règles fixes fondées sur l’OMS décident. L’IA facultative lit les mots du patient et ne peut que relever le niveau.' },
      data: { en: 'With consent: words without names, phone or ID numbers; age group, sex, pregnancy, condition codes.', fr: 'Avec consentement : mots sans noms, téléphones ni numéros d’identité ; tranche d’âge, sexe, grossesse, codes d’affections.' },
      human: { en: 'A nurse or doctor confirms or changes every level.', fr: 'Un infirmier ou un médecin confirme ou modifie chaque niveau.' }, cost: { en: 'Rules free; AI about USD 0.0005 per check', fr: 'Règles gratuites ; IA environ 0,0005 USD par vérification' } },
    { icon: '📱', name: { en: 'WhatsApp symptom check', fr: 'Vérification des symptômes sur WhatsApp' },
      what: { en: 'The same questions on any phone, with numbered replies.', fr: 'Les mêmes questions sur tout téléphone, avec des réponses chiffrées.' },
      method: { en: 'Rules only.', fr: 'Règles uniquement.' }, data: { en: 'Nothing sent to an AI service.', fr: 'Rien n’est envoyé à un service d’IA.' },
      human: { en: 'Verified patients’ checks go to their care team.', fr: 'Les vérifications des patients vérifiés vont à leur équipe de soins.' }, cost: { en: 'Free replies only', fr: 'Uniquement des réponses gratuites' } },
    { icon: '✍️', name: { en: 'Clinical scribe', fr: 'Assistant de rédaction clinique' },
      what: { en: 'Turns a clinician’s rough notes into a SOAP note with suggested ICD-11 codes, safety flags and gaps.', fr: 'Transforme les notes rapides du soignant en note SOAP avec codes CIM-11 suggérés, alertes et manques.' },
      method: { en: 'Claude Haiku, low effort, structured output. Never adds findings that are not in the notes.', fr: 'Claude Haiku, effort faible, sortie structurée. N’ajoute jamais de constatation absente des notes.' },
      data: { en: 'Notes and the symptom-check summary, without names, phone or ID numbers.', fr: 'Notes et résumé de la vérification, sans noms, téléphones ni numéros d’identité.' },
      human: { en: 'The clinician edits and saves; codes are marked “check”.', fr: 'Le soignant modifie et enregistre ; les codes sont marqués « à vérifier ».' }, cost: { en: 'About USD 0.0005 per draft', fr: 'Environ 0,0005 USD par brouillon' } },
    { icon: '💬', name: { en: 'Explain in simple words', fr: 'Expliquer simplement' },
      what: { en: 'Explains a doctor’s report or lab result in plain English or French, with questions to ask.', fr: 'Explique un compte rendu ou un résultat en français ou anglais simple, avec des questions à poser.' },
      method: { en: 'Claude Haiku; built-in medical dictionary when AI is off.', fr: 'Claude Haiku ; dictionnaire médical intégré quand l’IA est désactivée.' },
      data: { en: 'The report or result text, without names, phone or ID numbers.', fr: 'Le texte du compte rendu ou du résultat, sans noms, téléphones ni numéros d’identité.' },
      human: { en: 'Never changes treatment; tells the patient to ask their doctor.', fr: 'Ne change jamais le traitement ; invite à demander au médecin.' }, cost: { en: 'About USD 0.0005 per explanation; dictionary free', fr: 'Environ 0,0005 USD par explication ; dictionnaire gratuit' } },
    { icon: '📈', name: { en: 'Outbreak early warning', fr: 'Alerte précoce d’épidémie' },
      what: { en: 'Finds unusual clusters (suspected cholera, meningitis, measles/mpox, fever trends) by region.', fr: 'Repère les regroupements inhabituels (choléra, méningite, rougeole/mpox suspects, hausses de fièvre) par région.' },
      method: { en: 'WHO IDSR syndromes and a Poisson test. No AI model.', fr: 'Syndromes SIMR de l’OMS et test de Poisson. Pas de modèle d’IA.' },
      data: { en: 'Counts by region and week; counts under 3 hidden in exports.', fr: 'Chiffres par région et semaine ; chiffres sous 3 masqués dans les exports.' },
      human: { en: 'Surveillance staff investigate every signal.', fr: 'Les équipes de surveillance examinent chaque signal.' }, cost: { en: 'Free', fr: 'Gratuit' } }
  ];
  const PRINCIPLES = [
    [{ en: 'Protect autonomy', fr: 'Protéger l’autonomie' }, { en: 'Consent for each AI use; clinicians decide; patients can switch choices off and see who opened their record.', fr: 'Consentement pour chaque usage de l’IA ; les soignants décident ; le patient peut retirer ses choix et voir qui a consulté son dossier.' }],
    [{ en: 'Promote well-being and safety', fr: 'Promouvoir le bien-être et la sécurité' }, { en: 'Fixed WHO-based rules, AI can only raise urgency, zero missed emergencies on the evaluation, emergency number always shown.', fr: 'Règles fixes fondées sur l’OMS, l’IA ne peut que relever l’urgence, zéro urgence manquée à l’évaluation, numéro d’urgence toujours affiché.' }],
    [{ en: 'Ensure transparency', fr: 'Assurer la transparence' }, { en: 'This page, reasons shown with every result, AI drafts labelled, rules versioned.', fr: 'Cette page, raisons affichées avec chaque résultat, brouillons IA signalés, règles versionnées.' }],
    [{ en: 'Foster responsibility and accountability', fr: 'Favoriser la responsabilité' }, { en: 'Every view and decision in the audit log; clinicians must explain when they lower a level.', fr: 'Chaque consultation et décision dans le journal d’audit ; le soignant doit justifier toute baisse de niveau.' }],
    [{ en: 'Ensure inclusiveness and equity', fr: 'Assurer l’inclusion et l’équité' }, { en: 'Works on basic phones through WhatsApp, offline, in French and English, with large buttons and plain words.', fr: 'Fonctionne sur téléphones simples via WhatsApp, hors ligne, en français et en anglais, avec de grands boutons et des mots simples.' }],
    [{ en: 'Promote responsive and sustainable AI', fr: 'Promouvoir une IA réactive et durable' }, { en: 'Real-world monitoring of clinician agreement, the lowest-cost model, daily caps, and every feature still working without AI.', fr: 'Suivi réel de l’accord des soignants, modèle le moins coûteux, plafonds quotidiens, et chaque fonction marche sans IA.' }]
  ];

  const staff = () => ['admin', 'doctor', 'nurse'].includes(CU?.role);
  const backend = () => ApiState.enabled && ApiState.authenticated;
  const tile = (value, label, tone = '') => `<div class="sc"><div class="sv" ${tone ? `style="color:${tone}"` : ''}>${esc(String(value))}</div><div class="sl">${esc(label)}</div></div>`;
  const percent = value => `${Math.round(value * 100)}%`;

  function renderPage(pc) {
    $('tbt').textContent = t('aic_nav');
    const evaluation = EV.evaluate(TR);
    pc.innerHTML = `<div class="page">
      <div class="legal-hero"><h2>${esc(t('aic_title'))}</h2><p>${esc(t('aic_intro'))}</p></div>
      <div id="aic-status" class="mb18"></div>
      <div class="card mb18"><div class="ch"><div class="ct">${esc(t('aic_features'))}</div></div><div class="legal-grid">${FEATURES.map(item => `<div class="legal-card"><h3>${item.icon} ${esc(lang(item.name))}</h3>
        <p><strong>${esc(t('aic_what'))}:</strong> ${esc(lang(item.what))}</p><p><strong>${esc(t('aic_method'))}:</strong> ${esc(lang(item.method))}</p>
        <p><strong>${esc(t('aic_data'))}:</strong> ${esc(lang(item.data))}</p><p><strong>${esc(t('aic_human'))}:</strong> ${esc(lang(item.human))}</p><p><strong>${esc(t('aic_cost'))}:</strong> ${esc(lang(item.cost))}</p></div>`).join('')}</div></div>
      <div class="card mb18"><div class="ch"><div class="ct">🧪 ${esc(t('aic_eval'))}</div></div><p class="mu sm">${esc(tf('aic_eval_intro', { total: evaluation.total, version: evaluation.rulesVersion }))}</p>
        <div class="stats mt8">${tile(evaluation.total, t('aic_cases'))}${tile(evaluation.exact, t('aic_exact'))}${tile(evaluation.underTriage.length, t('aic_under'), evaluation.underTriage.length ? 'var(--dg)' : 'var(--em)')}${tile(percent(evaluation.emergencySensitivity), t('aic_sensitivity'), 'var(--em)')}${tile(evaluation.overTriage.length, t('aic_over'))}</div>
        <p class="mu sm mt8">${esc(t('aic_eval_caveat'))}</p>
        <details class="mt8"><summary class="sm">${esc(t('aic_show_cases'))}</summary><div class="tw"><table><thead><tr><th>${esc(t('aic_cases'))}</th><th>${esc(t('aic_expected'))}</th><th>${esc(t('aic_got'))}</th><th>${esc(t('aic_source'))}</th></tr></thead><tbody>
          ${evaluation.results.map(item => `<tr><td>${esc(EV.title(item, LANG))}</td><td>${esc(TR.label('level_' + item.expected, LANG))}</td><td>${item.outcome === 'exact' ? '✅' : item.outcome === 'under' ? '❌' : '⬆️'} ${esc(TR.label('level_' + item.got, LANG))}</td><td class="mu sm">${esc(TR.sourceLabel(item.source, LANG))}</td></tr>`).join('')}</tbody></table></div></details></div>
      ${staff() ? `<div class="card mb18"><div class="ch"><div class="ct">📊 ${esc(t('aic_monitor'))}</div></div><div id="aic-metrics"><p class="mu sm">…</p></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">📈 ${esc(t('aic_outbreak'))}</div></div><p class="mu sm">${esc(t('aic_outbreak_intro'))}</p><div id="aic-outbreak"><p class="mu sm">…</p></div></div>` : ''}
      <div class="card mb18"><div class="ch"><div class="ct">🌍 ${esc(t('aic_principles'))}</div></div><div class="legal-grid">${PRINCIPLES.map(([title, text]) => `<div class="legal-card"><span class="legal-badge">WHO</span><h3>${esc(lang(title))}</h3><p>${esc(lang(text))}</p></div>`).join('')}</div></div>
      <div class="card"><div class="ch"><div class="ct">${esc(t('aic_limits'))}</div></div><ul style="padding-left:20px">${[1, 2, 3, 4].map(n => `<li class="sm" style="margin:4px 0">${esc(t('aic_limit_' + n))}</li>`).join('')}</ul></div>
    </div>`;
    paintStatus();
    if (staff()) { paintMetrics(); paintOutbreak(); }
  }

  async function paintStatus() {
    const box = $('aic-status'); if (!box) return;
    let status = null;
    if (backend()) try { status = (await apiRequest('/api/v1/ai/status')).data; } catch (error) { status = null; }
    if (!box.isConnected) return;
    box.innerHTML = status?.enabled ? `<div class="alt ao">✅ ${esc(tf('aic_status_on', { model: status.model, used: status.usedToday, limit: status.dailyLimit }))}</div>` : `<div class="alt ai">ℹ️ ${esc(t('aic_status_off'))}</div>`;
  }

  function localMetrics() {
    const cases = DB.triageCases.filter(item => item.level), reviewed = cases.filter(item => item.finalLevel);
    return { cases: cases.length, reviewed: reviewed.length, awaiting: cases.filter(item => item.status === 'awaiting_review').length,
      agreed: reviewed.filter(item => item.finalLevel === item.level).length, raisedByClinician: reviewed.filter(item => TR.rank(item.finalLevel) > TR.rank(item.level)).length,
      loweredByClinician: reviewed.filter(item => TR.rank(item.finalLevel) < TR.rank(item.level)).length, aiCalls30Days: 0, estimatedCostUsd30Days: 0 };
  }
  async function paintMetrics() {
    const box = $('aic-metrics'); if (!box) return;
    try {
      const m = backend() ? (await apiRequest('/api/v1/ai/metrics')).data : localMetrics();
      if (!box.isConnected) return;
      box.innerHTML = `<div class="stats">${tile(m.reviewed ? percent(m.agreed / m.reviewed) : '—', t('aic_agreement'), 'var(--em)')}${tile(m.raisedByClinician, t('aic_raised'), m.raisedByClinician ? 'var(--dg)' : '')}${tile(m.loweredByClinician, t('aic_lowered'))}${tile(m.awaiting, t('aic_awaiting'))}${tile(m.aiCalls30Days, t('aic_ai_calls'))}${tile('$' + Number(m.estimatedCostUsd30Days).toFixed(4), t('aic_ai_cost'))}</div>
        ${m.reviewed ? '' : `<p class="mu sm mt8">${esc(t('aic_no_reviews'))}</p>`}`;
    } catch (error) { box.innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; }
  }

  // Without the server, only the symptom checks kept in this browser are counted.
  function localEvents() {
    return DB.triageCases.filter(item => item.level && item.answers).map(item => ({ date: item.createdAt, region: G(item.patientId)?.healthProfile?.location?.region || null, division: G(item.patientId)?.healthProfile?.location?.division || null, complaints: item.answers.complaints, dangerSigns: item.answers.dangerSigns }));
  }
  async function paintOutbreak() {
    const box = $('aic-outbreak'); if (!box) return;
    try {
      const data = backend() ? (await apiRequest('/api/v1/ai/outbreak')).data : SV.analyse(localEvents());
      if (!box.isConnected) return;
      const place = signal => [signal.division, signal.region === 'unknown' ? '—' : signal.region.replace(/_/g, ' ')].filter(Boolean).join(', ');
      box.innerHTML = `        ${data.signals.length ? data.signals.map(signal => `<div class="pc-row"><div><strong>${esc(lang(SV.SYNDROMES[signal.syndrome].label))}</strong> · ${esc(place(signal))}
          <div class="mu sm">${esc(tf('aic_signal_count', { current: signal.current, baseline: signal.baselinePerWeek.toFixed(1) }))} · ${esc(SV.ruleText(signal, LANG))}</div>
          <div class="sm">${esc(lang(SV.SYNDROMES[signal.syndrome].action))}</div></div>
          <span class="badge ${signal.level === 'alert' ? 'bda' : 'bwa'}">${esc(t(signal.level === 'alert' ? 'aic_alert' : 'aic_watch'))}</span></div>`).join('') : `<p class="mu sm">${esc(t('aic_no_signals'))}</p>`}
        <p class="mu sm mt8">${esc(tf('aic_counted', { counted: data.counted, unknown: data.unknownPlace }))}</p>
        <button type="button" class="btn bs bsm mt8" id="aic-export">⬇️ ${esc(t('aic_export'))}</button>`;
      $('aic-export').onclick = () => {
        const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([SV.toCsv(data.weekly)], { type: 'text/csv' })), download: `hfa-syndromic-weekly-${new Date().toISOString().slice(0, 10)}.csv` });
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      };
    } catch (error) { box.innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; }
  }

  window.HFAAiCentre = { renderPage };
})();
