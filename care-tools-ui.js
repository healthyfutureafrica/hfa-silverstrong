// Care tools: e-prescriptions with safety screening (doctor → pharmacy → patient), lab test orders (doctor →
// laboratory), Help & support for every role, and the patient's Vital Health Card inside video calls.
// Records are clinical records (synced by clinical-sync.js); the server re-checks every rule
// (backend/prescriptions.js, backend/support.js) — these screens only make the right action easy.
(function () {
  const esc = window.hfaEscape, fmt = (key, values) => window.hfaFormat ? window.hfaFormat(key, values) : t(key);
  Object.assign(T.en, {
    ct_rx_nav: 'Prescriptions & tests', ct_my_rx_nav: 'My prescriptions & tests', ct_ph_nav: 'E-prescriptions', ct_lab_nav: 'Test orders', ct_support_nav: 'Help & support',
    ct_new_rx: 'New prescription', ct_order_test: 'Order a lab test', ct_patient: 'Patient', ct_pharmacy: 'Send to pharmacy', ct_no_pharmacy: 'No validated pharmacy is available yet.',
    ct_medicine: 'Medicine', ct_dose: 'Dose', ct_frequency: 'How often', ct_duration: 'For how long', ct_quantity: 'Quantity', ct_add_medicine: 'Add medicine', ct_remove: 'Remove',
    ct_notes: 'Instructions for the patient (optional)', ct_send_rx: 'Check and send to pharmacy', ct_checking: 'Safety check', ct_clear: 'No interaction, allergy or duplicate found in the recorded profile.',
    ct_major: 'MAJOR', ct_moderate: 'Caution', ct_override: 'Reason to prescribe despite the major warning (recorded with the prescription)', ct_override_needed: 'Give a reason (at least 10 characters) to prescribe despite a major warning.',
    ct_screen_note: 'Screening covers common, well-documented problems only and uses the allergies and medicines recorded in the patient’s profile; use your clinical judgement.',
    ct_fill: 'Choose the patient and pharmacy, and complete every medicine line.', ct_sent: 'Prescription sent to the pharmacy.', ct_order_sent: 'Lab test ordered.',
    ct_s_sent: 'Sent to pharmacy', ct_s_ready: 'Ready for collection', ct_s_collected: 'Collected', ct_s_cancelled: 'Cancelled',
    ct_o_ordered: 'Ordered', ct_o_sample_received: 'Sample received', ct_o_completed: 'Result uploaded', ct_o_cancelled: 'Cancelled',
    ct_prescribed_by: 'Prescribed by', ct_ready_at: 'Ready at', ct_bring_id: 'Bring your HFA number', ct_refill: 'Request a refill', ct_refill_sent: 'Refill requested', ct_refills: 'Refill requests', ct_refill_done: 'Mark handled',
    ct_cancel: 'Cancel', ct_mark_ready: 'Mark ready for collection', ct_mark_collected: 'Confirm collected', ct_warnings: 'Prescriber was warned', ct_override_reason: 'Override reason',
    ct_none_rx: 'No prescriptions yet.', ct_none_orders: 'No test orders.', ct_test: 'Test', ct_priority: 'Priority', ct_routine: 'Routine', ct_urgent: 'Urgent', ct_laboratory: 'Laboratory', ct_clinical_info: 'Clinical information (why the test is needed)',
    ct_send_order: 'Send order', ct_sample: 'Sample received', ct_upload: 'Upload result', ct_complete: 'Mark completed', ct_ordered_by: 'Ordered by', ct_tests_ordered: 'Tests ordered for you',
    ct_support_intro: 'Ask HFA for help with your account, payments, the app or your data. Support is not for emergencies — use SOS or call the emergency number.',
    ct_new_ticket: 'New request', ct_subject: 'Subject', ct_category: 'Category', ct_describe: 'Describe the problem', ct_send: 'Send', ct_reply: 'Reply', ct_resolve: 'Resolve', ct_no_tickets: 'No support requests.',
    ct_c_account: 'Account & sign-in', ct_c_billing: 'Payments & plans', ct_c_technical: 'App problem', ct_c_care: 'Care & appointments', ct_c_privacy: 'Privacy & my data', ct_c_other: 'Other',
    ct_t_open: 'Waiting for HFA', ct_t_answered: 'Answered', ct_t_resolved: 'Resolved', ct_high: 'High priority', ct_normal: 'Normal', ct_you: 'You', ct_hfa: 'HFA support',
    ct_needs_server: 'This page needs the HFA account server.', ct_vhc_call: 'Vital Health Card'
  });
  Object.assign(T.fr, {
    ct_rx_nav: 'Ordonnances & analyses', ct_my_rx_nav: 'Mes ordonnances & analyses', ct_ph_nav: 'E-ordonnances', ct_lab_nav: 'Demandes d’analyses', ct_support_nav: 'Aide & support',
    ct_new_rx: 'Nouvelle ordonnance', ct_order_test: 'Prescrire une analyse', ct_patient: 'Patient', ct_pharmacy: 'Envoyer à la pharmacie', ct_no_pharmacy: 'Aucune pharmacie validée n’est encore disponible.',
    ct_medicine: 'Médicament', ct_dose: 'Dose', ct_frequency: 'Fréquence', ct_duration: 'Durée', ct_quantity: 'Quantité', ct_add_medicine: 'Ajouter un médicament', ct_remove: 'Retirer',
    ct_notes: 'Consignes pour le patient (facultatif)', ct_send_rx: 'Vérifier et envoyer à la pharmacie', ct_checking: 'Contrôle de sécurité', ct_clear: 'Aucune interaction, allergie ni doublon trouvé dans le profil enregistré.',
    ct_major: 'MAJEUR', ct_moderate: 'Prudence', ct_override: 'Motif pour prescrire malgré l’alerte majeure (enregistré avec l’ordonnance)', ct_override_needed: 'Indiquez un motif (au moins 10 caractères) pour prescrire malgré une alerte majeure.',
    ct_screen_note: 'Le contrôle couvre les problèmes courants et documentés, à partir des allergies et traitements du profil du patient ; utilisez votre jugement clinique.',
    ct_fill: 'Choisissez le patient et la pharmacie et complétez chaque ligne.', ct_sent: 'Ordonnance envoyée à la pharmacie.', ct_order_sent: 'Analyse prescrite.',
    ct_s_sent: 'Envoyée à la pharmacie', ct_s_ready: 'Prête à retirer', ct_s_collected: 'Retirée', ct_s_cancelled: 'Annulée',
    ct_o_ordered: 'Prescrite', ct_o_sample_received: 'Prélèvement reçu', ct_o_completed: 'Résultat déposé', ct_o_cancelled: 'Annulée',
    ct_prescribed_by: 'Prescrite par', ct_ready_at: 'Prête à', ct_bring_id: 'Apportez votre numéro HFA', ct_refill: 'Demander un renouvellement', ct_refill_sent: 'Renouvellement demandé', ct_refills: 'Demandes de renouvellement', ct_refill_done: 'Marquer traité',
    ct_cancel: 'Annuler', ct_mark_ready: 'Marquer prête', ct_mark_collected: 'Confirmer le retrait', ct_warnings: 'Le prescripteur a été averti', ct_override_reason: 'Motif de dérogation',
    ct_none_rx: 'Aucune ordonnance.', ct_none_orders: 'Aucune demande.', ct_test: 'Analyse', ct_priority: 'Priorité', ct_routine: 'Routine', ct_urgent: 'Urgent', ct_laboratory: 'Laboratoire', ct_clinical_info: 'Renseignements cliniques (motif de l’analyse)',
    ct_send_order: 'Envoyer la demande', ct_sample: 'Prélèvement reçu', ct_upload: 'Déposer le résultat', ct_complete: 'Marquer terminée', ct_ordered_by: 'Prescrite par', ct_tests_ordered: 'Analyses prescrites pour vous',
    ct_support_intro: 'Demandez de l’aide à HFA pour votre compte, les paiements, l’application ou vos données. Le support ne traite pas les urgences — utilisez SOS ou appelez le numéro d’urgence.',
    ct_new_ticket: 'Nouvelle demande', ct_subject: 'Objet', ct_category: 'Catégorie', ct_describe: 'Décrivez le problème', ct_send: 'Envoyer', ct_reply: 'Répondre', ct_resolve: 'Résoudre', ct_no_tickets: 'Aucune demande.',
    ct_c_account: 'Compte & connexion', ct_c_billing: 'Paiements & formules', ct_c_technical: 'Problème d’application', ct_c_care: 'Soins & rendez-vous', ct_c_privacy: 'Confidentialité & données', ct_c_other: 'Autre',
    ct_t_open: 'En attente de HFA', ct_t_answered: 'Répondu', ct_t_resolved: 'Résolu', ct_high: 'Priorité haute', ct_normal: 'Normale', ct_you: 'Vous', ct_hfa: 'Support HFA',
    ct_needs_server: 'Cette page nécessite le serveur HFA.', ct_vhc_call: 'Carte de santé vitale'
  });

  const list = name => (Array.isArray(DB[name]) ? DB[name] : (DB[name] = []));
  const online = () => typeof ApiState !== 'undefined' && ApiState.enabled && ApiState.authenticated && !ApiState.offline;
  const newId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const when = value => value ? esc(String(value).slice(0, 16).replace('T', ' ')) : '';
  const badge = (text, tone) => `<span class="badge ${tone}">${esc(text)}</span>`;
  const rxTone = status => ({ sent: 'bin', ready: 'bwa', collected: 'bsu', cancelled: 'bda' }[status] || 'bse');
  const orderTone = status => ({ ordered: 'bin', sample_received: 'bwa', completed: 'bsu', cancelled: 'bda' }[status] || 'bse');
  const itemsHTML = items => `<ul class="ct-items">${(items || []).map(item => `<li><strong>${esc(item.drug)} ${esc(item.dose)}</strong> · ${esc(item.frequency)} · ${esc(item.duration)} · ×${esc(String(item.quantity))}</li>`).join('')}</ul>`;
  const findingsHTML = findings => findings && findings.length
    ? findings.map(f => `<div class="alt ${f.level === 'major' ? 'ae' : 'ai'} ct-finding"><strong>${esc(t(f.level === 'major' ? 'ct_major' : 'ct_moderate'))}</strong> · ${esc(HFAMedSafety.message(f, LANG))}</div>`).join('')
    : `<div class="alt ao ct-finding">✅ ${esc(t('ct_clear'))}</div>`;
  const steps = (order, current) => `<div class="ct-steps">${order.map((status, index) => `<span class="${order.indexOf(current) >= index ? 'done' : ''}">${index + 1}. ${esc(t(status))}</span>`).join('')}</div>`;
  function save(collection, record, message) { const items = list(collection), index = items.findIndex(item => item.id === record.id); if (index >= 0) items[index] = record; else items.unshift(record); if (message) toastMessage(message); navigate(CP); }
  function toastMessage(text) { const box = document.createElement('div'); box.className = 'alt ao ct-toast'; box.setAttribute('role', 'status'); box.textContent = text; document.body.appendChild(box); setTimeout(() => box.remove(), 3500); }
  const patientContext = patient => HFAMedSafety.patientContext(patient?.healthProfile || {});

  // ───────────── Doctor ─────────────
  let pharmacies = [];
  async function loadPharmacies() { if (!online()) return []; try { pharmacies = (await apiRequest('/api/v1/pharmacies')).data.pharmacies; } catch (error) { pharmacies = []; } return pharmacies; }
  const myPatients = () => typeof patientsForDoctor === 'function' ? patientsForDoctor(CU.id) : DB.users.filter(user => user.role === 'patient' && user.assignedDoctor === CU.id);
  function rxRow() {
    return `<div class="ct-rx-row"><input class="fc ct-drug" list="ct-formulary" maxlength="80" placeholder="${esc(t('ct_medicine'))}" aria-label="${esc(t('ct_medicine'))}">
      <input class="fc ct-dose" maxlength="40" placeholder="500 mg" aria-label="${esc(t('ct_dose'))}"><input class="fc ct-freq" maxlength="60" placeholder="${LANG === 'fr' ? '3 fois/jour' : '3 times a day'}" aria-label="${esc(t('ct_frequency'))}">
      <input class="fc ct-dur" maxlength="40" placeholder="${LANG === 'fr' ? '7 jours' : '7 days'}" aria-label="${esc(t('ct_duration'))}"><input class="fc ct-qty" type="number" min="1" max="1000" placeholder="21" aria-label="${esc(t('ct_quantity'))}">
      <button type="button" class="btn bgh bsm" onclick="this.parentElement.remove();HFACareTools.screen()" aria-label="${esc(t('ct_remove'))}">✕</button></div>`;
  }
  function readItems() {
    return [...document.querySelectorAll('#ct-rows .ct-rx-row')].map(row => ({ drug: row.querySelector('.ct-drug').value.trim(), dose: row.querySelector('.ct-dose').value.trim(), frequency: row.querySelector('.ct-freq').value.trim(),
      duration: row.querySelector('.ct-dur').value.trim(), quantity: parseInt(row.querySelector('.ct-qty').value, 10) })).filter(item => item.drug);
  }
  function screen() {
    const box = document.getElementById('ct-safety'); if (!box) return null;
    const items = readItems(), patient = G(document.getElementById('ct-patient').value);
    if (!items.length || !patient) { box.innerHTML = ''; document.getElementById('ct-override-wrap').classList.add('hid'); return null; }
    const { findings } = HFAMedSafety.check(items, patientContext(patient));
    box.innerHTML = `<div class="fl mt8">${esc(t('ct_checking'))}</div>${findingsHTML(findings)}<p class="mu sm">${esc(t('ct_screen_note'))}</p>`;
    document.getElementById('ct-override-wrap').classList.toggle('hid', !findings.some(f => f.level === 'major'));
    return findings;
  }
  async function newPrescription(patientId = '') {
    await loadPharmacies();
    const patients = myPatients();
    openMo(`<div class="mh"><div class="mt2">💊 ${esc(t('ct_new_rx'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <datalist id="ct-formulary">${HFAMedSafety.FORMULARY.map(drug => `<option value="${esc(drug)}"></option>`).join('')}</datalist>
      <div class="fr"><div class="fg"><label class="fl" for="ct-patient">${esc(t('ct_patient'))}</label><select class="fc" id="ct-patient" onchange="HFACareTools.screen()"><option value="">${esc(t('select'))}</option>${patients.map(p => `<option value="${esc(p.id)}" ${p.id === patientId ? 'selected' : ''}>${esc(p.name)} · ${esc(p.hfaId || '')}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl" for="ct-pharmacy">${esc(t('ct_pharmacy'))}</label><select class="fc" id="ct-pharmacy">${pharmacies.length ? pharmacies.map(p => `<option value="${esc(p.id)}">${esc(p.pharmacyName)}${p.pharmacyAddress ? ' — ' + esc(p.pharmacyAddress) : ''}</option>`).join('') : `<option value="">${esc(t('ct_no_pharmacy'))}</option>`}</select></div></div>
      <div class="ct-rx-head"><span>${esc(t('ct_medicine'))}</span><span>${esc(t('ct_dose'))}</span><span>${esc(t('ct_frequency'))}</span><span>${esc(t('ct_duration'))}</span><span>${esc(t('ct_quantity'))}</span><span></span></div>
      <div id="ct-rows" oninput="HFACareTools.screen()">${rxRow()}</div>
      <button type="button" class="btn bgh bsm" onclick="document.getElementById('ct-rows').insertAdjacentHTML('beforeend',HFACareTools.rxRow())">+ ${esc(t('ct_add_medicine'))}</button>
      <div class="fg mt8"><label class="fl" for="ct-notes">${esc(t('ct_notes'))}</label><textarea class="fc" id="ct-notes" maxlength="1000" rows="2"></textarea></div>
      <div id="ct-safety" aria-live="polite"></div>
      <div class="fg hid" id="ct-override-wrap"><label class="fl" for="ct-override">${esc(t('ct_override'))}</label><textarea class="fc" id="ct-override" maxlength="500" rows="2"></textarea></div>
      <div id="ct-msg"></div>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bp" onclick="HFACareTools.sendPrescription()" ${pharmacies.length ? '' : 'disabled'}>${esc(t('ct_send_rx'))}</button></div>`);
    screen();
  }
  function sendPrescription() {
    const msg = text => { document.getElementById('ct-msg').innerHTML = `<div class="alt ae">${esc(text)}</div>`; };
    const patientId = document.getElementById('ct-patient').value, pharmacistId = document.getElementById('ct-pharmacy').value, items = readItems();
    if (!patientId || !pharmacistId || !items.length || items.some(item => !item.dose || !item.frequency || !item.duration || !(item.quantity > 0))) return msg(t('ct_fill'));
    const findings = screen() || [], reason = document.getElementById('ct-override').value.trim();
    if (findings.some(f => f.level === 'major') && reason.length < 10) return msg(t('ct_override_needed'));
    const pharmacy = pharmacies.find(p => p.id === pharmacistId), patient = G(patientId), notes = document.getElementById('ct-notes').value.trim();
    const record = { id: newId('rx'), patientId, doctorId: CU.id, pharmacistId, items, status: 'sent', ...(notes ? { notes } : {}), ...(reason && findings.some(f => f.level === 'major') ? { overrideReason: reason } : {}),
      safety: findings, patientName: patient?.name || '', patientHfaId: patient?.hfaId || '', pharmacyName: pharmacy?.pharmacyName || '', doctorName: CU.name, createdAt: new Date().toISOString(), refillRequestedAt: null };
    notifyUser(pharmacistId, t('ct_sent'), 'Medical Records'); notifyUser(patientId, t('ct_sent'), 'Medical Records');
    closeMo(); save('prescriptions', record, t('ct_sent'));
  }
  async function orderTest(patientId = '') {
    const labs = DB.users.filter(user => user.role === 'labtech' && user.status === 'active');
    openMo(`<div class="mh"><div class="mt2">🔬 ${esc(t('ct_order_test'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <div class="fg"><label class="fl" for="ct-o-patient">${esc(t('ct_patient'))}</label><select class="fc" id="ct-o-patient"><option value="">${esc(t('select'))}</option>${myPatients().map(p => `<option value="${esc(p.id)}" ${p.id === patientId ? 'selected' : ''}>${esc(p.name)} · ${esc(p.hfaId || '')}</option>`).join('')}</select></div>
      <div class="fr"><div class="fg"><label class="fl" for="ct-o-test">${esc(t('ct_test'))}</label><input class="fc" id="ct-o-test" maxlength="200" list="ct-tests" placeholder="${LANG === 'fr' ? 'NFS, TDR paludisme…' : 'Full blood count, malaria RDT…'}">
        <datalist id="ct-tests">${['Full blood count', 'Malaria rapid diagnostic test', 'Fasting blood glucose', 'HbA1c', 'Lipid panel', 'Kidney function (creatinine, urea)', 'Liver function', 'Urinalysis', 'HIV test', 'Hepatitis B surface antigen', 'Typhoid (Widal)', 'Pregnancy test'].map(test => `<option value="${test}"></option>`).join('')}</datalist></div>
      <div class="fg"><label class="fl" for="ct-o-priority">${esc(t('ct_priority'))}</label><select class="fc" id="ct-o-priority"><option value="routine">${esc(t('ct_routine'))}</option><option value="urgent">${esc(t('ct_urgent'))}</option></select></div></div>
      <div class="fg"><label class="fl" for="ct-o-lab">${esc(t('ct_laboratory'))}</label><select class="fc" id="ct-o-lab">${labs.map(lab => `<option value="${esc(lab.id)}">${esc(lab.laboratory || lab.name)}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl" for="ct-o-info">${esc(t('ct_clinical_info'))}</label><textarea class="fc" id="ct-o-info" maxlength="1000" rows="2"></textarea></div><div id="ct-o-msg"></div>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bp" onclick="HFACareTools.sendOrder()" ${labs.length ? '' : 'disabled'}>${esc(t('ct_send_order'))}</button></div>`);
  }
  function sendOrder() {
    const patientId = document.getElementById('ct-o-patient').value, labTechId = document.getElementById('ct-o-lab').value, testType = document.getElementById('ct-o-test').value.trim();
    if (!patientId || !labTechId || testType.length < 2) { document.getElementById('ct-o-msg').innerHTML = `<div class="alt ae">${esc(t('ct_fill'))}</div>`; return; }
    const info = document.getElementById('ct-o-info').value.trim(), patient = G(patientId), lab = G(labTechId);
    const record = { id: newId('lo'), patientId, doctorId: CU.id, labTechId, testType, priority: document.getElementById('ct-o-priority').value, ...(info ? { clinicalInfo: info } : {}),
      status: 'ordered', resultId: null, patientName: patient?.name || '', patientHfaId: patient?.hfaId || '', doctorName: CU.name, laboratory: lab?.laboratory || lab?.name || '', orderedAt: new Date().toISOString() };
    notifyUser(labTechId, t('ct_order_sent'), 'Lab Results'); notifyUser(patientId, t('ct_order_sent'), 'Lab Results');
    closeMo(); save('labOrders', record, t('ct_order_sent'));
  }
  function renderDoctor(pc) {
    $('tbt').textContent = t('ct_rx_nav');
    topBtn(`<button class="btn bp bsm" onclick="HFACareTools.newPrescription()">💊 ${esc(t('ct_new_rx'))}</button> <button class="btn bs bsm" onclick="HFACareTools.orderTest()">🔬 ${esc(t('ct_order_test'))}</button>`);
    const rx = list('prescriptions').filter(r => r.doctorId === CU.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const orders = list('labOrders').filter(o => o.doctorId === CU.id).sort((a, b) => String(b.orderedAt).localeCompare(String(a.orderedAt)));
    const refills = rx.filter(r => r.refillRequestedAt && !r.refillHandledAt);
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ct_rx_nav'))}</h2></div>
      ${refills.length ? `<div class="card mb18"><div class="ch"><div class="ct">🔁 ${esc(t('ct_refills'))}</div></div>${refills.map(r => `<div class="ct-row"><div><strong>${esc(r.patientName)}</strong> · ${itemsHTML(r.items)}<span class="mu sm">${when(r.refillRequestedAt)}</span></div>
        <div class="ct-actions"><button class="btn bp bsm" onclick="HFACareTools.newPrescription('${esc(r.patientId)}')">💊 ${esc(t('ct_new_rx'))}</button><button class="btn bs bsm" onclick="HFACareTools.refillHandled('${esc(r.id)}')">${esc(t('ct_refill_done'))}</button></div></div>`).join('')}</div>` : ''}
      <div class="card mb18"><div class="ch"><div class="ct">💊 ${esc(t('ct_rx_nav'))}</div></div>${rx.length ? rx.map(r => `<div class="ct-row"><div><strong>${esc(r.patientName)}</strong> <code class="code-chip">${esc(r.patientHfaId || '')}</code> · ${esc(r.pharmacyName || '')} · <span class="mu sm">${when(r.createdAt)}</span>${itemsHTML(r.items)}
          ${r.overridden ? `<div class="mu sm">⚠ ${esc(t('ct_override_reason'))}: ${esc(r.overrideReason || '')}</div>` : ''}</div>
        <div class="ct-actions">${badge(t('ct_s_' + r.status), rxTone(r.status))}${r.status === 'sent' ? `<button class="btn bs bsm" onclick="HFACareTools.cancelRx('${esc(r.id)}')">${esc(t('ct_cancel'))}</button>` : ''}</div></div>`).join('') : `<p class="mu sm">${esc(t('ct_none_rx'))}</p>`}</div>
      <div class="card"><div class="ch"><div class="ct">🔬 ${esc(t('ct_lab_nav'))}</div></div>${orders.length ? orders.map(o => `<div class="ct-row"><div><strong>${esc(o.testType)}</strong> — ${esc(o.patientName)} · ${esc(o.laboratory)} ${o.priority === 'urgent' ? badge(t('ct_urgent'), 'bda') : ''}<div class="mu sm">${when(o.orderedAt)}</div></div>
        <div class="ct-actions">${badge(t('ct_o_' + o.status), orderTone(o.status))}${o.status === 'ordered' ? `<button class="btn bs bsm" onclick="HFACareTools.cancelOrder('${esc(o.id)}')">${esc(t('ct_cancel'))}</button>` : ''}</div></div>`).join('') : `<p class="mu sm">${esc(t('ct_none_orders'))}</p>`}</div></div>`;
  }
  const update = (collection, id, change) => { const record = list(collection).find(item => item.id === id); if (record) save(collection, { ...record, ...change }); };

  // ───────────── Patient ─────────────
  function renderPatient(pc) {
    $('tbt').textContent = t('ct_my_rx_nav');
    const rx = list('prescriptions').filter(r => r.patientId === CU.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const orders = list('labOrders').filter(o => o.patientId === CU.id);
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ct_my_rx_nav'))}</h2></div>
      ${rx.length ? rx.map(r => `<div class="card mb12"><div class="ch"><div><div class="ct">💊 ${esc(r.pharmacyName || '')}</div><div class="mu sm">${esc(t('ct_prescribed_by'))} ${esc(r.doctorName || '')} · ${when(r.createdAt)}</div></div>${badge(t('ct_s_' + r.status), rxTone(r.status))}</div>
        ${itemsHTML(r.items)}${r.notes ? `<p class="sm">${esc(r.notes)}</p>` : ''}
        ${r.status !== 'cancelled' ? steps(['ct_s_sent', 'ct_s_ready', 'ct_s_collected'], 'ct_s_' + r.status) : ''}
        ${r.status === 'ready' ? `<div class="alt ao mt8">💊 ${esc(t('ct_ready_at'))} <strong>${esc(r.pharmacyName || '')}</strong>. ${esc(t('ct_bring_id'))} <code class="code-chip">${esc(CU.hfaId || '')}</code></div>` : ''}
        ${r.status === 'collected' ? `<button class="btn bs bsm mt8" onclick="HFACareTools.refill('${esc(r.id)}')" ${r.refillRequestedAt ? 'disabled' : ''}>${esc(r.refillRequestedAt ? t('ct_refill_sent') : t('ct_refill'))}</button>` : ''}</div>`).join('') : `<div class="card mb12"><p class="mu sm">${esc(t('ct_none_rx'))}</p></div>`}
      ${orders.length ? `<div class="card"><div class="ct mb12">🔬 ${esc(t('ct_tests_ordered'))}</div>${orders.map(o => `<div class="ct-row"><div><strong>${esc(o.testType)}</strong> · ${esc(o.laboratory)}<div class="mu sm">${esc(t('ct_ordered_by'))} ${esc(o.doctorName)} · ${when(o.orderedAt)}</div></div>${badge(t('ct_o_' + o.status), orderTone(o.status))}</div>`).join('')}</div>` : ''}</div>`;
  }

  // ───────────── Pharmacist ─────────────
  function renderPharmacist(pc) {
    $('tbt').textContent = t('ct_ph_nav');
    const rx = list('prescriptions').filter(r => r.pharmacistId === CU.id).sort((a, b) => ({ sent: 0, ready: 1 }[a.status] ?? 2) - ({ sent: 0, ready: 1 }[b.status] ?? 2) || String(b.createdAt).localeCompare(String(a.createdAt)));
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ct_ph_nav'))}</h2></div>${rx.length ? rx.map(r => `<div class="card mb12"><div class="ch"><div><div class="ct">${esc(r.patientName)} <code class="code-chip">${esc(r.patientHfaId || '')}</code></div>
        <div class="mu sm">${esc(t('ct_prescribed_by'))} ${esc(r.doctorName || '')} · ${when(r.createdAt)}</div></div>${badge(t('ct_s_' + r.status), rxTone(r.status))}</div>
        ${itemsHTML(r.items)}${r.notes ? `<p class="sm">${esc(r.notes)}</p>` : ''}
        ${(r.safety || []).length ? `<div class="fl mt8">${esc(t('ct_warnings'))}</div>${findingsHTML(r.safety)}${r.overridden ? `<p class="sm"><strong>${esc(t('ct_override_reason'))}:</strong> ${esc(r.overrideReason || '')}</p>` : ''}` : ''}
        <div class="ct-actions mt8">${r.status === 'sent' ? `<button class="btn bp bsm" onclick="HFACareTools.pharmacyStatus('${esc(r.id)}','ready')">${esc(t('ct_mark_ready'))}</button>` : r.status === 'ready' ? `<button class="btn bp bsm" onclick="HFACareTools.pharmacyStatus('${esc(r.id)}','collected')">${esc(t('ct_mark_collected'))}</button>` : ''}</div></div>`).join('') : `<div class="card"><p class="mu sm">${esc(t('ct_none_rx'))}</p></div>`}</div>`;
  }
  function pharmacyStatus(id, status) {
    const record = list('prescriptions').find(item => item.id === id); if (!record) return;
    if (status === 'ready') notifyUser(record.patientId, t('ct_s_ready'), 'Medical Records');
    save('prescriptions', { ...record, status });
  }

  // ───────────── Laboratory ─────────────
  let pendingOrder = null;
  function renderLab(pc) {
    $('tbt').textContent = t('ct_lab_nav');
    const orders = list('labOrders').filter(o => o.labTechId === CU.id).sort((a, b) => (a.priority === 'urgent' ? -1 : 1) - (b.priority === 'urgent' ? -1 : 1) || String(a.orderedAt).localeCompare(String(b.orderedAt)));
    const open = orders.filter(o => ['ordered', 'sample_received'].includes(o.status)), done = orders.filter(o => !open.includes(o));
    const resultFor = o => list('labResults').find(r => r.patientId === o.patientId && r.labTechId === CU.id && r.testType === o.testType);
    const row = o => `<div class="ct-row"><div><strong>${esc(o.testType)}</strong> — ${esc(o.patientName)} <code class="code-chip">${esc(o.patientHfaId || '')}</code> ${o.priority === 'urgent' ? badge(t('ct_urgent'), 'bda') : ''}
        <div class="mu sm">${esc(t('ct_ordered_by'))} ${esc(o.doctorName)} · ${when(o.orderedAt)}${o.clinicalInfo ? ' · ' + esc(o.clinicalInfo) : ''}</div></div>
      <div class="ct-actions">${badge(t('ct_o_' + o.status), orderTone(o.status))}
        ${o.status === 'ordered' ? `<button class="btn bs bsm" onclick="HFACareTools.labStatus('${esc(o.id)}','sample_received')">${esc(t('ct_sample'))}</button>` : ''}
        ${open.includes(o) ? `<button class="btn bp bsm" onclick="HFACareTools.uploadFor('${esc(o.id)}')">${esc(t('ct_upload'))}</button>` : ''}
        ${open.includes(o) && resultFor(o) ? `<button class="btn bs bsm" onclick="HFACareTools.labComplete('${esc(o.id)}')">${esc(t('ct_complete'))}</button>` : ''}</div></div>`;
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ct_lab_nav'))}</h2></div><div class="card mb18">${open.length ? open.map(row).join('') : `<p class="mu sm">${esc(t('ct_none_orders'))}</p>`}</div>${done.length ? `<div class="card">${done.slice(0, 30).map(row).join('')}</div>` : ''}</div>`;
  }
  function uploadFor(id) {
    const order = list('labOrders').find(item => item.id === id); if (!order) return;
    pendingOrder = order; showLabUpload();
    const set = (field, value) => { const element = document.getElementById(field); if (element && [...(element.options || [])].some(option => option.value === value) || element?.tagName === 'INPUT') element.value = value; };
    set('lr-patient', order.patientId); set('lr-specialist', order.doctorId); set('lr-test', order.testType);
  }
  if (typeof window.saveLabResult === 'function') {
    const original = window.saveLabResult;
    // The uploaded result names its order, so the server completes the order in the same step.
    window.saveLabResult = (...args) => {
      const order = pendingOrder, results = list('labResults'), push = results.unshift;
      if (order) results.unshift = function (result, ...rest) { results.unshift = push; if (result && result.patientId === order.patientId) result.orderId = order.id; return push.call(this, result, ...rest); };
      pendingOrder = null;
      return original(...args);
    };
  }
  function labComplete(id) {
    const order = list('labOrders').find(item => item.id === id); if (!order) return;
    const result = list('labResults').find(r => r.patientId === order.patientId && r.labTechId === CU.id && r.testType === order.testType);
    if (result) save('labOrders', { ...order, status: 'completed', resultId: result.id });
  }

  // ───────────── Help & support ─────────────
  async function renderSupport(pc) {
    $('tbt').textContent = t('ct_support_nav');
    if (!online()) { pc.innerHTML = `<div class="page"><div class="card"><p class="mu sm">${esc(t('ct_needs_server'))}</p></div></div>`; return; }
    const admin = CU.role === 'admin';
    let tickets = [];
    try { tickets = (await apiRequest('/api/v1/support')).data.tickets; } catch (error) { pc.innerHTML = `<div class="page"><div class="alt ae">${esc(error.message)}</div></div>`; return; }
    const categories = ['account', 'billing', 'technical', 'care', 'privacy', 'other'];
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ct_support_nav'))}</h2><p>${esc(t('ct_support_intro'))}</p></div>
      ${admin ? '' : `<form class="card mb18" id="ct-ticket-form" novalidate><div class="ct mb12">${esc(t('ct_new_ticket'))}</div>
        <div class="fg"><label class="fl" for="ct-subject">${esc(t('ct_subject'))}</label><input class="fc" id="ct-subject" maxlength="120"></div>
        <div class="fr"><div class="fg"><label class="fl" for="ct-cat">${esc(t('ct_category'))}</label><select class="fc" id="ct-cat">${categories.map(c => `<option value="${c}">${esc(t('ct_c_' + c))}</option>`).join('')}</select></div>
          <div class="fg"><label class="fl" for="ct-prio">${esc(t('ct_priority'))}</label><select class="fc" id="ct-prio"><option value="normal">${esc(t('ct_normal'))}</option><option value="high">${esc(t('ct_high'))}</option></select></div></div>
        <div class="fg"><label class="fl" for="ct-desc">${esc(t('ct_describe'))}</label><textarea class="fc" id="ct-desc" maxlength="4000" rows="3"></textarea></div><div id="ct-ticket-msg"></div>
        <button type="submit" class="btn bp">${esc(t('ct_send'))}</button></form>`}
      ${tickets.length ? tickets.map(k => `<div class="card mb12"><div class="ch"><div><div class="ct">${esc(k.subject)}</div><div class="mu sm">${admin && k.user ? `${esc(k.user.name || '')} · ${esc(tv(k.user.role || ''))} · ` : ''}${esc(t('ct_c_' + k.category))} · ${when(k.createdAt)}${k.priority === 'high' ? ' · ' + esc(t('ct_high')) : ''}</div></div>${badge(t('ct_t_' + k.status), k.status === 'resolved' ? 'bsu' : k.status === 'answered' ? 'bwa' : 'bin')}</div>
        ${k.messages.map(m => `<div class="ct-msg ${m.fromSupport ? 'ct-support' : ''}"><strong>${esc(m.fromSupport ? t('ct_hfa') : (admin ? (k.user?.name || '') : t('ct_you')))}</strong> <span class="mu sm">${when(m.at)}</span><p class="sm">${esc(m.text)}</p></div>`).join('')}
        ${k.status !== 'resolved' ? `<div class="ct-reply"><input class="fc" id="ct-r-${esc(k.id)}" maxlength="4000" aria-label="${esc(t('ct_reply'))}"><button class="btn bs bsm" onclick="HFACareTools.reply('${esc(k.id)}')">${esc(t('ct_reply'))}</button>${admin ? `<button class="btn bp bsm" onclick="HFACareTools.resolve('${esc(k.id)}')">${esc(t('ct_resolve'))}</button>` : ''}</div>` : ''}</div>`).join('') : `<div class="card"><p class="mu sm">${esc(t('ct_no_tickets'))}</p></div>`}</div>`;
    document.getElementById('ct-ticket-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await apiRequest('/api/v1/support', 'POST', { subject: $('ct-subject').value.trim(), category: $('ct-cat').value, priority: $('ct-prio').value, description: $('ct-desc').value.trim() });
        renderSupport(pc);
      } catch (error) { $('ct-ticket-msg').innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; }
    });
  }
  async function reply(id) {
    const input = document.getElementById('ct-r-' + id); if (!input || input.value.trim().length < 2) return;
    try { await apiRequest(`/api/v1/support/${encodeURIComponent(id)}/reply`, 'POST', { text: input.value.trim() }); } catch (error) { alert(error.message); }
    renderSupport($('pgc'));
  }
  async function resolve(id) {
    try { await apiRequest(`/api/v1/support/${encodeURIComponent(id)}/resolve`, 'POST', {}); } catch (error) { alert(error.message); }
    renderSupport($('pgc'));
  }

  // ───────────── Vital Health Card inside video calls (clinicians) ─────────────
  let callPeer = null;
  if (typeof window.startVC === 'function') {
    const original = window.startVC;
    window.startVC = (contactId, ...rest) => {
      callPeer = contactId;
      const result = original(contactId, ...rest);
      const controls = document.querySelector('#vc .vcc'), peer = G(contactId);
      document.getElementById('ct-vhc-btn')?.remove(); document.getElementById('ct-vhc-panel')?.remove();
      if (controls && peer?.role === 'patient' && ['doctor', 'nurse'].includes(CU?.role) && window.HFAPatientRegistration?.vitalCard) {
        controls.insertAdjacentHTML('afterbegin', `<button type="button" class="vcb vcv" id="ct-vhc-btn" onclick="HFACareTools.toggleCard()" aria-label="${esc(t('ct_vhc_call'))}" title="${esc(t('ct_vhc_call'))}">🩸</button>`);
      }
      return result;
    };
  }
  function toggleCard() {
    const existing = document.getElementById('ct-vhc-panel');
    if (existing) { existing.remove(); return; }
    const peer = G(callPeer); if (!peer) return;
    document.querySelector('#vc .vca')?.insertAdjacentHTML('beforeend', `<div id="ct-vhc-panel" class="ct-vhc-panel">${HFAPatientRegistration.vitalCard(peer).replace(/<button[^>]*openCompletion[^>]*>[\s\S]*?<\/button>/, '')}</div>`);
  }

  // ───────────── Navigation and routing ─────────────
  const addNav = (role, item) => {
    const sections = NAV[role]; if (!Array.isArray(sections)) return;
    const target = sections.find(section => section.items.some(entry => ['messages', 'privacy'].includes(entry.id))) || sections[0];
    if (!target.items.some(entry => entry.id === item.id)) target.items.push(item);
  };
  addNav('doctor', { id: 'prescriptions', l: () => t('ct_rx_nav'), i: 'clip' });
  addNav('patient', { id: 'my-prescriptions', l: () => t('ct_my_rx_nav'), i: 'clip' });
  addNav('pharmacist', { id: 'e-prescriptions', l: () => t('ct_ph_nav'), i: 'file' });
  addNav('labtech', { id: 'lab-orders', l: () => t('ct_lab_nav'), i: 'pulse' });
  ['doctor', 'nurse', 'patient', 'pharmacist', 'labtech', 'ambulance', 'admin'].forEach(role => {
    const sections = NAV[role]; if (!Array.isArray(sections)) return;
    const legal = sections.find(section => section.items.some(entry => entry.id === 'privacy')) || sections[sections.length - 1];
    if (!legal.items.some(entry => entry.id === 'support')) legal.items.push({ id: 'support', l: () => t('ct_support_nav'), i: 'msg' });
  });
  const PAGES = { prescriptions: ['doctor', renderDoctor], 'my-prescriptions': ['patient', renderPatient], 'e-prescriptions': ['pharmacist', renderPharmacist], 'lab-orders': ['labtech', renderLab] };

  document.head.insertAdjacentHTML('beforeend', `<style>
    .ct-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--bd)}.ct-row:last-child{border-bottom:none}
    .ct-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}
    .ct-items{margin:6px 0 0 18px;font-size:.84rem}.ct-items li{padding:2px 0}
    .ct-finding{margin:6px 0 0;font-size:.82rem}
    #mbox:has(.ct-rx-row){max-width:820px;width:94vw}
    .ct-rx-head,.ct-rx-row{display:grid;grid-template-columns:2fr 1fr 1.3fr 1fr .7fr auto;gap:6px;align-items:center}.ct-rx-row{margin-bottom:6px}
    .ct-rx-head{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-top:8px}
    .ct-steps{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.ct-steps span{font-size:.74rem;padding:4px 8px;border-radius:6px;background:var(--bd)}.ct-steps span.done{background:var(--em-p,#e6f4ee);color:var(--em,#0a6b50);font-weight:600}
    .ct-msg{border-left:3px solid var(--bd);padding:6px 10px;margin-top:8px}.ct-msg.ct-support{border-left-color:var(--em,#0a6b50)}
    .ct-reply{display:flex;gap:6px;margin-top:10px}.ct-reply .fc{flex:1}
    .ct-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:3000;box-shadow:0 6px 20px rgba(0,0,0,.2)}
    .ct-vhc-panel{position:absolute;top:12px;right:12px;width:min(360px,92vw);max-height:80%;overflow:auto;z-index:3}
    @media(max-width:700px){.ct-rx-head{display:none}.ct-rx-row{grid-template-columns:1fr 1fr}.ct-row{flex-direction:column}.ct-actions{justify-content:flex-start}}
  </style>`);

  window.HFACareTools = {
    handles: (page, role) => (page === 'support') || (PAGES[page] && PAGES[page][0] === role),
    renderPage: (page, pc) => { if (page === 'support') return renderSupport(pc); return PAGES[page][1](pc); },
    newPrescription, sendPrescription, screen, rxRow, orderTest, sendOrder,
    cancelRx: id => update('prescriptions', id, { status: 'cancelled' }),
    refillHandled: id => update('prescriptions', id, { refillHandledAt: new Date().toISOString() }),
    cancelOrder: id => update('labOrders', id, { status: 'cancelled' }),
    refill: id => update('prescriptions', id, { refillRequestedAt: new Date().toISOString() }),
    pharmacyStatus, labStatus: (id, status) => update('labOrders', id, { status }), uploadFor, labComplete, reply, resolve, toggleCard
  };
})();
