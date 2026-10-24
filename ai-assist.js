// SLY AI help inside clinical screens:
// - Scribe (doctors, nurses): rough notes → draft SOAP note, suggested ICD-11 codes, safety flags and gaps.
// - Explain (patients): a doctor's report or released lab result in plain English or French.
// Both are drafts a person checks. When AI is not switched on, the scribe gives a SOAP
// template and Explain uses the built-in medical glossary below — free and offline.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;

  Object.assign(T.en, {
    ai_scribe_notes: 'Rough notes (SLY can turn them into a SOAP note)', ai_scribe_ph: 'e.g. fever 2d, headache, no vomiting, RDT not done, plan RDT + paracetamol',
    ai_scribe_btn: '✨ Draft with SLY', ai_scribe_working: 'SLY is drafting…', ai_scribe_done: 'Draft ready. Check and edit every line before saving.',
    ai_scribe_template: 'AI drafting is off here, so SLY filled a SOAP template with your notes.', ai_flags: 'Safety flags', ai_missing: 'You may want to record',
    ai_icd: 'Suggested ICD-11 codes (check before use)', ai_icd_verified: 'matches HFA list', ai_icd_check: 'check in the ICD-11 browser',
    ai_explain_btn: '💬 Explain in simple words', ai_explain_title: 'In simple words', ai_explain_working: 'SLY is writing a simple explanation…',
    ai_key_points: 'Remember', ai_questions: 'Questions to ask your doctor', ai_seek_care: 'This document suggests you need care soon. Contact your doctor or a health centre today.',
    ai_explain_disclaimer: 'SLY explains what is written. It does not change your treatment. Ask your doctor if anything is unclear.',
    ai_glossary_title: 'Words in this document', ai_glossary_none: 'SLY found no medical words it can explain here. Ask your doctor to explain.',
    ai_glossary_note: 'AI explanations are off here, so SLY used its built-in medical dictionary.', ai_lab_note: 'SLY read the test name and the specialist’s notes, not the file itself.'
  });
  Object.assign(T.fr, {
    ai_scribe_notes: 'Notes rapides (SLY peut en faire une note SOAP)', ai_scribe_ph: 'ex. fièvre 2j, céphalées, pas de vomissements, TDR non fait, plan TDR + paracétamol',
    ai_scribe_btn: '✨ Rédiger avec SLY', ai_scribe_working: 'SLY rédige…', ai_scribe_done: 'Brouillon prêt. Vérifiez et modifiez chaque ligne avant d’enregistrer.',
    ai_scribe_template: 'La rédaction IA est désactivée ici : SLY a rempli un modèle SOAP avec vos notes.', ai_flags: 'Alertes de sécurité', ai_missing: 'À consigner éventuellement',
    ai_icd: 'Codes CIM-11 suggérés (à vérifier)', ai_icd_verified: 'conforme à la liste HFA', ai_icd_check: 'vérifier dans le navigateur CIM-11',
    ai_explain_btn: '💬 Expliquer simplement', ai_explain_title: 'En mots simples', ai_explain_working: 'SLY écrit une explication simple…',
    ai_key_points: 'À retenir', ai_questions: 'Questions à poser à votre médecin', ai_seek_care: 'Ce document indique que vous devez consulter bientôt. Contactez votre médecin ou un centre de santé aujourd’hui.',
    ai_explain_disclaimer: 'SLY explique ce qui est écrit. Il ne change pas votre traitement. Demandez à votre médecin si quelque chose n’est pas clair.',
    ai_glossary_title: 'Mots de ce document', ai_glossary_none: 'SLY n’a trouvé aucun mot médical à expliquer ici. Demandez à votre médecin.',
    ai_glossary_note: 'Les explications IA sont désactivées ici : SLY a utilisé son dictionnaire médical intégré.', ai_lab_note: 'SLY a lu le nom du test et les notes du spécialiste, pas le fichier lui-même.'
  });

  // Free, offline glossary used when AI is off. Patterns match English and French spellings.
  const GLOSSARY = [
    [/\b(rdt|tdr|malaria|paludisme)\b/i, 'Malaria test (RDT): a quick finger-prick test that shows if malaria parasites are in your blood.', 'Test du paludisme (TDR) : un test rapide au bout du doigt qui montre si le parasite du paludisme est dans votre sang.'],
    [/\b(positive?|positif|positive)\b/i, 'Positive: the test found what it was looking for.', 'Positif : le test a trouvé ce qu’il cherchait.'],
    [/\b(negative?|négatif|negatif|négative)\b/i, 'Negative: the test did not find it.', 'Négatif : le test ne l’a pas trouvé.'],
    [/\b(ha?emoglobin|hémoglobine|hb)\b/i, 'Haemoglobin (Hb): carries oxygen in your blood. Low haemoglobin is called anaemia and can make you tired.', 'Hémoglobine (Hb) : transporte l’oxygène dans le sang. Une hémoglobine basse s’appelle anémie et peut fatiguer.'],
    [/\b(an(a)?emia|anémie)\b/i, 'Anaemia: not enough red blood cells or haemoglobin.', 'Anémie : pas assez de globules rouges ou d’hémoglobine.'],
    [/\b(glucose|glyc(a)?emia|glycémie|blood sugar|sucre)\b/i, 'Blood sugar (glucose): the amount of sugar in your blood. It is checked for diabetes.', 'Glycémie : la quantité de sucre dans le sang. Elle est mesurée pour le diabète.'],
    [/\b(hba1c)\b/i, 'HbA1c: your average blood sugar over the last 2 to 3 months.', 'HbA1c : votre sucre moyen dans le sang sur les 2 à 3 derniers mois.'],
    [/\b(bp|blood pressure|tension|hypertension)\b/i, 'Blood pressure: how hard your blood pushes on your vessels. High blood pressure (hypertension) often has no signs but can harm the heart, brain and kidneys.', 'Tension artérielle : la force du sang dans les vaisseaux. Une tension élevée (hypertension) ne se sent souvent pas mais peut abîmer le cœur, le cerveau et les reins.'],
    [/\b(widal|typho[iï]d|typhoïde)\b/i, 'Typhoid test (Widal): a blood test for typhoid fever. It is not always reliable; your doctor decides with your symptoms.', 'Test de la typhoïde (Widal) : une prise de sang pour la fièvre typhoïde. Il n’est pas toujours fiable ; le médecin décide avec vos symptômes.'],
    [/\b(hiv|vih|cd4|viral load|charge virale)\b/i, 'HIV tests: show if HIV is present (HIV test) or how much virus is in the blood (viral load). Treatment keeps the virus low.', 'Tests VIH : montrent si le VIH est présent (test VIH) ou la quantité de virus (charge virale). Le traitement garde le virus bas.'],
    [/\b(urinalysis|urine|ecbu|bandelette)\b/i, 'Urine test: checks your urine for infection, sugar or blood.', 'Examen d’urine : cherche une infection, du sucre ou du sang dans l’urine.'],
    [/\b(fbc|cbc|nfs|hémogramme|blood count)\b/i, 'Full blood count: counts the cells in your blood (red cells, white cells, platelets).', 'Numération formule sanguine (NFS) : compte les cellules du sang (globules rouges, blancs, plaquettes).'],
    [/\b(white (blood )?cells?|wbc|leucocytes?|globules blancs)\b/i, 'White blood cells: fight infection. A high count can mean an infection.', 'Globules blancs : combattent les infections. Un taux élevé peut signaler une infection.'],
    [/\b(creatinine|créatinine|kidney|rein)\b/i, 'Creatinine: shows how well your kidneys clean the blood.', 'Créatinine : montre si les reins nettoient bien le sang.'],
    [/\b(genotype|génotype|sickle|drépanocytose|drepanocytose)\b/i, 'Genotype (AA, AS, SS): shows if you carry the sickle cell gene. SS means sickle cell disease.', 'Génotype (AA, AS, SS) : montre si vous portez le gène de la drépanocytose. SS signifie drépanocytose.'],
    [/\b(tb|tuberculosis|tuberculose|genexpert)\b/i, 'Tuberculosis test (for example GeneXpert): looks for TB germs, usually in sputum.', 'Test de la tuberculose (par ex. GeneXpert) : cherche le microbe de la TB, souvent dans les crachats.'],
    [/\b(paracetamol|paracétamol)\b/i, 'Paracetamol: lowers fever and pain. Do not take more than the dose on the box.', 'Paracétamol : fait baisser la fièvre et la douleur. Ne dépassez pas la dose indiquée.'],
    [/\b(artemether|artéméther|coartem|lumefantrine|luméfantrine)\b/i, 'Malaria medicine (ACT): take every dose for all the days, even if you feel better.', 'Médicament du paludisme (CTA) : prenez toutes les doses pendant tous les jours, même si vous allez mieux.'],
    [/\b(antibiotic|antibiotique|amoxicillin|amoxicilline)\b/i, 'Antibiotic: kills bacteria. Finish the whole course. Tell the doctor about any allergy.', 'Antibiotique : tue les bactéries. Finissez tout le traitement. Signalez toute allergie au médecin.'],
    [/\b(ors|sro|oral rehydration|réhydratation)\b/i, 'Oral rehydration salts (ORS): mix with clean water and drink often to replace water lost with diarrhoea.', 'Sels de réhydratation orale (SRO) : à mélanger avec de l’eau propre et à boire souvent pour remplacer l’eau perdue.'],
    [/\b(follow[- ]?up|review|contrôle|suivi)\b/i, 'Follow-up: a planned visit to check how you are doing.', 'Suivi / contrôle : une visite prévue pour voir comment vous allez.']
  ];
  const glossary = text => GLOSSARY.filter(([pattern]) => pattern.test(text)).map(entry => LANG === 'fr' ? entry[2] : entry[1]);

  const aiOn = () => ApiState.enabled && ApiState.authenticated && ApiState.aiTriage;

  // ───── Scribe ─────
  function scribeBlock(appointmentId) {
    if (!['doctor', 'nurse'].includes(CU?.role)) return '';
    return `<div class="fg"><label class="fl" for="ai-notes">${esc(t('ai_scribe_notes'))}</label><textarea class="fc" id="ai-notes" rows="3" maxlength="4000" placeholder="${esc(t('ai_scribe_ph'))}"></textarea></div>
      <button type="button" class="btn bs bsm mb12" id="ai-scribe" onclick="HFAAssist.scribe('${esc(appointmentId)}')">${esc(t('ai_scribe_btn'))}</button><div id="ai-scribe-out" aria-live="polite"></div>`;
  }

  async function latestCaseId(patientId) {
    try {
      const cases = (await apiRequest('/api/v1/triage/queue')).data.cases || [];
      const recent = cases.filter(item => item.patientId === patientId && Date.now() - Date.parse(item.createdAt) < 7 * 86400000);
      return recent.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
    } catch (error) { return undefined; }
  }

  async function scribe(appointmentId) {
    const notes = ($('ai-notes')?.value || '').trim(), out = $('ai-scribe-out'), button = $('ai-scribe');
    const apt = DB.appointments.find(item => item.id === appointmentId), patient = G(apt?.patientId);
    if (!notes || /[<>]/.test(notes)) { out.innerHTML = `<div class="alt ae">${esc(t('fill_required'))}</div>`; return; }
    const fill = (summary, plan) => { if ($('dr-summary')) $('dr-summary').value = summary; if ($('dr-plan')) $('dr-plan').value = plan; };
    if (!aiOn()) {
      fill('', `S: ${notes}\nO: \nA: \nP: `);
      out.innerHTML = `<div class="alt ai">${esc(t('ai_scribe_template'))}</div>`;
      return;
    }
    button.disabled = true; out.innerHTML = `<div class="alt ai">${esc(t('ai_scribe_working'))}</div>`;
    try {
      const triageCaseId = patient ? await latestCaseId(patient.id) : undefined;
      const { draft } = (await apiRequest('/api/v1/ai/scribe', 'POST', { notes, ...(triageCaseId ? { triageCaseId } : {}), ...(patient ? { patientName: patient.name } : {}) }, 30000)).data;
      const codes = draft.icd11.map(item => `${item.code} ${item.title}`).join('; ');
      fill(`${draft.assessment}${codes ? ` [ICD-11: ${codes}]` : ''}`, `S: ${draft.subjective}\nO: ${draft.objective}\nA: ${draft.assessment}\nP: ${draft.plan}`);
      out.innerHTML = `<div class="alt ao">${esc(t('ai_scribe_done'))}</div>
        ${draft.safetyFlags.length ? `<div class="triage-alert mt8"><strong>⚠️ ${esc(t('ai_flags'))}</strong><ul style="padding-left:18px">${draft.safetyFlags.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
        ${draft.missingInformation.length ? `<p class="sm mt8"><strong>${esc(t('ai_missing'))}:</strong> ${esc(draft.missingInformation.join('; '))}</p>` : ''}
        ${draft.icd11.length ? `<p class="sm mt8"><strong>${esc(t('ai_icd'))}:</strong> ${draft.icd11.map(item => `<code class="code-chip">${esc(item.code)}</code> ${esc(item.title)} <span class="mu">(${esc(t(item.verified ? 'ai_icd_verified' : 'ai_icd_check'))})</span>`).join(' · ')} — <a href="https://icd.who.int/browse/latest-release/mms/en" target="_blank" rel="noopener">icd.who.int</a></p>` : ''}`;
    } catch (error) { out.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; }
    finally { button.disabled = false; }
  }

  // ───── Explain ─────
  const explainButton = (kind, id) => CU?.role === 'patient' ? `<button type="button" class="btn bs bsm" style="margin-top:6px" onclick="HFAAssist.explain('${kind}','${esc(id)}')">${esc(t('ai_explain_btn'))}</button>` : '';

  function documentText(kind, id) {
    if (kind === 'report') { const report = DB.doctorReports.find(item => item.id === id && item.patientId === CU.id); return report && `${report.summary}\n${report.plan}`; }
    const result = DB.labResults.find(item => item.id === id && item.patientId === CU.id && item.status === 'released');
    return result && `${result.testType}${result.notes ? `\n${result.notes}` : ''}`;
  }

  async function explain(kind, id) {
    const text = documentText(kind, id);
    if (!text) return;
    const header = `<div class="mh"><div class="mt2">${esc(t('ai_explain_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>`;
    const footer = `<p class="mu sm mt18">${esc(t('ai_explain_disclaimer'))}${kind === 'lab' ? ' ' + esc(t('ai_lab_note')) : ''}</p><div class="mf"><button class="btn bp" onclick="closeMo()">${esc(t('close'))}</button></div>`;
    const words = glossary(text);
    const glossaryHtml = words.length ? `<h3 class="sm mt18">${esc(t('ai_glossary_title'))}</h3><ul style="padding-left:18px">${words.map(item => `<li class="sm">${esc(item)}</li>`).join('')}</ul>` : '';
    if (!aiOn()) { openMo(`${header}<div class="alt ai">${esc(t('ai_glossary_note'))}</div>${glossaryHtml || `<p class="mu sm mt8">${esc(t('ai_glossary_none'))}</p>`}${footer}`); return; }
    openMo(`${header}<div id="ai-explain-body" aria-live="polite"><div class="alt ai">${esc(t('ai_explain_working'))}</div></div>${footer}`);
    try {
      const { result } = (await apiRequest('/api/v1/ai/explain', 'POST', { kind, text: text.slice(0, 4000), language: LANG === 'fr' ? 'fr' : 'en' }, 30000)).data;
      const body = $('ai-explain-body'); if (!body) return;
      body.innerHTML = `${result.seekCareNow ? `<div class="triage-alert mb12"><strong>⚠️</strong> ${esc(t('ai_seek_care'))}</div>` : ''}
        <p style="font-size:1rem;line-height:1.6">${esc(result.explanation)}</p>
        ${result.keyPoints.length ? `<h3 class="sm mt18">${esc(t('ai_key_points'))}</h3><ul style="padding-left:18px">${result.keyPoints.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
        ${result.questionsForDoctor.length ? `<h3 class="sm mt18">${esc(t('ai_questions'))}</h3><ul style="padding-left:18px">${result.questionsForDoctor.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}${glossaryHtml}`;
    } catch (error) {
      const body = $('ai-explain-body');
      if (body) body.innerHTML = `<div class="alt ae">${esc(error.message)}</div>${glossaryHtml}`;
    }
  }

  window.HFAAssist = { scribeBlock, scribe, explainButton, explain, glossary };
})();
