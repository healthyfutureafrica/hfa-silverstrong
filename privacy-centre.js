// "My data & privacy": the rights people have over their data, made usable (Cameroon Law No. 2024/017,
// aligned with GDPR Art. 15-21 and the HIPAA right of access):
//   - download the health record as HL7 FHIR R4 (for any hospital or app) or as a readable summary;
//   - change optional consents at any time, with the full history;
//   - see who opened the record or changed the account;
//   - ask for a correction, erasure, restriction or objection, answered within 30 days.
// Administrators answer the requests under "Data-rights requests". With the server, everything is stored
// and audited there.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const RESPONSE_DAYS = 30;
  const CHANGEABLE = ['research', 'ministry', 'sms'];
  const KINDS = ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability'];

  Object.assign(T.en, {
    pc_nav: 'My data & privacy', pc_title: 'My data & privacy', pc_intro: 'Your health data belongs to you. Download it, choose how it is used, see who opened it, and ask us to correct or delete it.',
    pc_staff_intro: 'See who opened or changed your account, and use your data-protection rights.',
    pc_export_title: 'Download my health record', pc_export_body: 'Take your record to any hospital, clinic or health app. The FHIR file uses HL7 FHIR R4, the international standard for exchanging health records.',
    pc_export_fhir: 'Download FHIR file (.json)', pc_export_summary: 'Readable summary (print or save as PDF)', pc_exporting: 'Preparing your file…',
    pc_export_done: 'Downloaded: {count} items in your record.', pc_export_note: 'Keep the file private: it contains your health information.',
    pc_consent_title: 'How my data is used', pc_consent_body: 'Optional choices can be changed at any time. Changing them never affects your care.',
    pc_consent_required: 'Sharing with my care team (required to use HFA)', pc_consent_required_note: 'Your doctors and nurses need your record to treat you safely. To stop it, ask for your account to be erased below.',
    pc_c_research: 'Anonymised use for health research', pc_c_ministry: 'Anonymised statistics for the Ministry of Public Health (MINSANTE)', pc_c_sms: 'SMS reminders about my appointments',
    pc_c_whatsapp: 'WhatsApp alerts', pc_c_whatsapp_note: 'Managed with your WhatsApp number in your profile.',
    pc_on: 'On', pc_off: 'Off', pc_saving: 'Saving…', pc_saved: 'Saved. Your choice is recorded with the date and time.',
    pc_consent_history: 'History of my choices', pc_no_history: 'No changes since registration.', pc_given: 'given', pc_withdrawn: 'withdrawn',
    pc_consent_profile_needed: 'Complete your health profile to set these choices.',
    pc_access_title: 'Who has opened my record', pc_access_body: 'Every time someone else opens your health information or changes your account, it is recorded here. If you do not recognise an entry, ask for a review below.',
    pc_access_empty: 'Nobody else has opened your record yet.',
    pc_act_HEALTH_RECORD_VIEW: 'Opened your health profile', pc_act_DOCUMENT_VIEWED: 'Viewed a document you uploaded', pc_act_ACCOUNT_UPDATED_BY_ADMIN: 'Changed your account details',
    pc_act_ACCOUNT_DELETED: 'Closed your account', pc_act_SIGN_IN_AS_START: 'Signed in to your account for support', pc_act_SIGN_IN_AS_STOP: 'Left your account',
    pc_act_PRIVACY_REQUEST_UPDATED: 'Answered your data-protection request',
    pc_requests_title: 'My data-protection requests', pc_requests_body: 'We answer within 30 days. You can also contact our Data Protection Officer at healthyfutureafrica@gmail.com.',
    pc_kind: 'What would you like?', pc_details: 'Details', pc_details_ph: 'For example: my date of birth is wrong, it should be 12 April 1988.',
    pc_k_access: 'A copy of all data you hold about me', pc_k_rectification: 'Correct wrong or incomplete information', pc_k_erasure: 'Delete my account and data',
    pc_k_restriction: 'Stop using my data while a problem is checked', pc_k_objection: 'Object to a use of my data', pc_k_portability: 'Send my record to another provider',
    pc_erasure_note: 'Medical law requires some records to be kept for 10 years after your last visit. We delete everything else and explain what must be kept.',
    pc_submit: 'Send request', pc_sent: 'Request received. We will answer by {date}.', pc_details_short: 'Please describe what you want changed (at least 10 characters).',
    pc_none: 'You have not made any request.', pc_received_on: 'Received {date}', pc_due: 'Answer due {date}', pc_overdue: 'Overdue',
    pc_s_received: 'Received', pc_s_in_progress: 'In progress', pc_s_completed: 'Completed', pc_s_refused: 'Refused', pc_answer: 'Our answer',
    pc_open_exists: 'You already have an open request of this kind.',
    pc_summary_title: 'Health record summary', pc_summary_generated: 'Generated on {date} from HFA SilverStrong. Patient-reported information is marked as such.',
    pc_print: 'Print or save as PDF', pc_s_identity: 'Identity', pc_s_allergies: 'Allergies', pc_s_conditions: 'Conditions (reported by the patient)',
    pc_s_medicines: 'Current medicines', pc_s_appointments: 'Appointments', pc_s_labs: 'Released lab results', pc_s_none: 'None recorded',
    pr_nav: 'Data-rights requests', pr_title: 'Data-rights requests', pr_intro: 'Requests from people about their data. The law gives us 30 days to answer each one.',
    pr_open: 'Open', pr_overdue: 'Overdue', pr_closed: 'Closed', pr_start: 'Start', pr_complete: 'Complete', pr_refuse: 'Refuse',
    pr_resolution: 'Answer to the person', pr_resolution_ph: 'Explain what was done, or why the request was refused and how to complain to the authority.',
    pr_resolution_short: 'Write an answer of at least 10 characters.', pr_none: 'No requests yet.', pr_person: 'Person', pr_request: 'Request', pr_status: 'Status', pr_actions: 'Actions'
  });
  Object.assign(T.fr, {
    pc_nav: 'Mes données & confidentialité', pc_title: 'Mes données & confidentialité', pc_intro: 'Vos données de santé vous appartiennent. Téléchargez-les, choisissez leur utilisation, voyez qui les a consultées et demandez leur correction ou leur suppression.',
    pc_staff_intro: 'Voyez qui a consulté ou modifié votre compte et exercez vos droits sur vos données.',
    pc_export_title: 'Télécharger mon dossier de santé', pc_export_body: 'Emportez votre dossier dans tout hôpital, clinique ou application de santé. Le fichier FHIR utilise HL7 FHIR R4, la norme internationale d’échange des dossiers de santé.',
    pc_export_fhir: 'Télécharger le fichier FHIR (.json)', pc_export_summary: 'Résumé lisible (imprimer ou enregistrer en PDF)', pc_exporting: 'Préparation de votre fichier…',
    pc_export_done: 'Téléchargé : {count} éléments dans votre dossier.', pc_export_note: 'Gardez ce fichier privé : il contient vos informations de santé.',
    pc_consent_title: 'Utilisation de mes données', pc_consent_body: 'Les choix facultatifs peuvent être modifiés à tout moment. Les modifier n’affecte jamais vos soins.',
    pc_consent_required: 'Partage avec mon équipe de soins (obligatoire pour utiliser HFA)', pc_consent_required_note: 'Vos médecins et infirmiers ont besoin de votre dossier pour vous soigner en sécurité. Pour l’arrêter, demandez l’effacement de votre compte ci-dessous.',
    pc_c_research: 'Utilisation anonymisée pour la recherche en santé', pc_c_ministry: 'Statistiques anonymisées pour le Ministère de la Santé Publique (MINSANTE)', pc_c_sms: 'Rappels SMS de mes rendez-vous',
    pc_c_whatsapp: 'Alertes WhatsApp', pc_c_whatsapp_note: 'Gérées avec votre numéro WhatsApp dans votre profil.',
    pc_on: 'Activé', pc_off: 'Désactivé', pc_saving: 'Enregistrement…', pc_saved: 'Enregistré. Votre choix est consigné avec la date et l’heure.',
    pc_consent_history: 'Historique de mes choix', pc_no_history: 'Aucun changement depuis l’inscription.', pc_given: 'donné', pc_withdrawn: 'retiré',
    pc_consent_profile_needed: 'Complétez votre profil de santé pour faire ces choix.',
    pc_access_title: 'Qui a consulté mon dossier', pc_access_body: 'Chaque fois qu’une autre personne consulte vos informations de santé ou modifie votre compte, c’est consigné ici. Si vous ne reconnaissez pas une ligne, demandez une vérification ci-dessous.',
    pc_access_empty: 'Personne d’autre n’a encore consulté votre dossier.',
    pc_act_HEALTH_RECORD_VIEW: 'A consulté votre profil de santé', pc_act_DOCUMENT_VIEWED: 'A consulté un document que vous avez déposé', pc_act_ACCOUNT_UPDATED_BY_ADMIN: 'A modifié les informations de votre compte',
    pc_act_ACCOUNT_DELETED: 'A fermé votre compte', pc_act_SIGN_IN_AS_START: 'S’est connecté à votre compte pour l’assistance', pc_act_SIGN_IN_AS_STOP: 'A quitté votre compte',
    pc_act_PRIVACY_REQUEST_UPDATED: 'A répondu à votre demande sur vos données',
    pc_requests_title: 'Mes demandes sur mes données', pc_requests_body: 'Nous répondons sous 30 jours. Vous pouvez aussi écrire à notre Délégué à la protection des données : healthyfutureafrica@gmail.com.',
    pc_kind: 'Que souhaitez-vous ?', pc_details: 'Détails', pc_details_ph: 'Par exemple : ma date de naissance est fausse, c’est le 12 avril 1988.',
    pc_k_access: 'Une copie de toutes les données que vous détenez sur moi', pc_k_rectification: 'Corriger des informations fausses ou incomplètes', pc_k_erasure: 'Supprimer mon compte et mes données',
    pc_k_restriction: 'Suspendre l’utilisation de mes données pendant une vérification', pc_k_objection: 'M’opposer à une utilisation de mes données', pc_k_portability: 'Transmettre mon dossier à un autre prestataire',
    pc_erasure_note: 'La loi médicale impose de conserver certains dossiers 10 ans après votre dernière visite. Nous supprimons tout le reste et expliquons ce qui doit être conservé.',
    pc_submit: 'Envoyer la demande', pc_sent: 'Demande reçue. Nous répondrons au plus tard le {date}.', pc_details_short: 'Décrivez ce que vous voulez changer (au moins 10 caractères).',
    pc_none: 'Vous n’avez fait aucune demande.', pc_received_on: 'Reçue le {date}', pc_due: 'Réponse attendue le {date}', pc_overdue: 'En retard',
    pc_s_received: 'Reçue', pc_s_in_progress: 'En cours', pc_s_completed: 'Traitée', pc_s_refused: 'Refusée', pc_answer: 'Notre réponse',
    pc_open_exists: 'Vous avez déjà une demande ouverte de ce type.',
    pc_summary_title: 'Résumé du dossier de santé', pc_summary_generated: 'Généré le {date} depuis HFA SilverStrong. Les informations déclarées par le patient sont indiquées comme telles.',
    pc_print: 'Imprimer ou enregistrer en PDF', pc_s_identity: 'Identité', pc_s_allergies: 'Allergies', pc_s_conditions: 'Affections (déclarées par le patient)',
    pc_s_medicines: 'Médicaments actuels', pc_s_appointments: 'Rendez-vous', pc_s_labs: 'Résultats de laboratoire communiqués', pc_s_none: 'Aucun',
    pr_nav: 'Demandes sur les données', pr_title: 'Demandes sur les données', pr_intro: 'Demandes des personnes au sujet de leurs données. La loi nous donne 30 jours pour répondre à chacune.',
    pr_open: 'Ouvertes', pr_overdue: 'En retard', pr_closed: 'Clôturées', pr_start: 'Commencer', pr_complete: 'Traiter', pr_refuse: 'Refuser',
    pr_resolution: 'Réponse à la personne', pr_resolution_ph: 'Expliquez ce qui a été fait, ou pourquoi la demande est refusée et comment saisir l’autorité de protection.',
    pr_resolution_short: 'Écrivez une réponse d’au moins 10 caractères.', pr_none: 'Aucune demande pour l’instant.', pr_person: 'Personne', pr_request: 'Demande', pr_status: 'Statut', pr_actions: 'Actions'
  });

  // Sidebar entries for every portal, next to the other privacy pages.
  for (const [role, sections] of Object.entries(NAV)) {
    const legal = sections.find(section => section.items.some(item => item.id === 'privacy'));
    if (!legal) continue;
    legal.items.unshift({ id: 'my-data', l: () => t('pc_nav'), i: 'shield' });
    if (role === 'admin') legal.items.push({ id: 'privacy-requests', l: () => t('pr_nav'), i: 'file' });
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .pc-switch{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--bd)}
    .pc-switch:last-child{border-bottom:0}.pc-switch>div{min-width:0}.pc-switch strong{display:block;font-size:.88rem}
    .pc-toggle{position:relative;flex-shrink:0;width:52px;height:30px}
    .pc-toggle input{position:absolute;inset:0;width:100%;height:100%;opacity:0;margin:0;cursor:pointer;z-index:1}
    .pc-toggle span{position:absolute;inset:0;border-radius:30px;background:var(--bd2);transition:background .18s}
    .pc-toggle span::after{content:'';position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s}
    .pc-toggle input:checked+span{background:var(--em)}.pc-toggle input:checked+span::after{transform:translateX(22px)}
    .pc-toggle input:focus-visible+span{outline:3px solid var(--go-l);outline-offset:2px}.pc-toggle input:disabled{cursor:not-allowed}.pc-toggle input:disabled+span{opacity:.6}
    .pc-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--bd);font-size:.84rem}
    .pc-row:last-child{border-bottom:0}.pc-row>div{min-width:0;overflow-wrap:anywhere}
    .pc-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.pc-actions .btn{white-space:normal;line-height:1.3}
    .pc-answer{margin-top:6px;padding:8px 12px;border-left:3px solid var(--em);background:var(--em-p);border-radius:0 var(--rs) var(--rs) 0;white-space:pre-wrap}
    .pc-summary h3{margin:16px 0 6px;font-size:.95rem;color:var(--em-d)}.pc-summary ul{padding-left:20px}.pc-summary li{margin:3px 0}
    @media (prefers-reduced-motion:reduce){.pc-toggle span,.pc-toggle span::after{transition:none}}
    @media print{body.pc-printing>*:not(#movr){display:none!important}body.pc-printing #movr{position:static;background:none;display:block!important}
      body.pc-printing #mbox{box-shadow:none;max-width:none;width:auto;max-height:none;overflow:visible}body.pc-printing .pc-noprint{display:none!important}}
  </style>`);

  const day = value => String(value || '').slice(0, 10);
  const statusBadge = status => `<span class="badge ${status === 'completed' ? 'bsu' : status === 'refused' ? 'bda' : status === 'in_progress' ? 'bin' : 'bwa'}">${esc(t('pc_s_' + status))}</span>`;
  const note = (id, text, kind = 'ao') => { const box = document.getElementById(id); if (box) box.innerHTML = text ? `<div class="alt ${kind}" role="${kind === 'ae' ? 'alert' : 'status'}">${esc(text)}</div>` : ''; };
  const backend = () => ApiState.enabled && ApiState.authenticated;
  const localList = key => (DB[key] = DB[key] || []);

  if (!DB.privacyAccess) DB.privacyAccess = [];

  // ───── Data loading (server, or this browser without one) ─────
  async function loadConsents() {
    if (backend()) return (await apiRequest('/api/v1/me/consents')).data;
    return { consents: CU.healthProfile?.consents || null, changeable: CHANGEABLE, history: localList('consentEvents').filter(event => event.userId === CU.id), whatsapp: { consent: !!CU.whatsappNotificationsConsent } };
  }
  async function loadAccess() {
    if (backend()) return (await apiRequest('/api/v1/me/access-log')).data.entries;
    return DB.privacyAccess.filter(entry => entry.userId === CU.id).map(entry => ({ ...entry, actorName: G(entry.actorId)?.name || 'HFA', actorRole: G(entry.actorId)?.role || 'admin' }));
  }
  async function loadRequests() {
    if (backend()) return (await apiRequest('/api/v1/me/privacy-requests')).data.requests;
    return localList('privacyRequests').filter(entry => entry.userId === CU.id).map(withOverdue);
  }
  const withOverdue = entry => ({ ...entry, overdue: !['completed', 'refused'].includes(entry.status) && entry.dueAt < new Date().toISOString() });

  // ───── Page ─────
  function renderPage(pc) {
    $('tbt').textContent = t('pc_title');
    const patient = CU.role === 'patient';
    pc.innerHTML = `<div class="page">
      <div class="ph"><h2>${esc(t('pc_title'))}</h2><p>${esc(t(patient ? 'pc_intro' : 'pc_staff_intro'))}</p></div>
      ${patient ? `<div class="card mb18"><div class="ch"><div class="ct">⬇️ ${esc(t('pc_export_title'))}</div></div>
        <p class="mu sm">${esc(t('pc_export_body'))}</p>
        <div class="pc-actions"><button type="button" class="btn bp" id="pc-fhir">${esc(t('pc_export_fhir'))}</button><button type="button" class="btn bs" id="pc-summary">${esc(t('pc_export_summary'))}</button></div>
        <p class="mu sm mt8">${esc(t('pc_export_note'))}</p><div id="pc-export-msg" aria-live="polite"></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">✅ ${esc(t('pc_consent_title'))}</div></div><p class="mu sm">${esc(t('pc_consent_body'))}</p><div id="pc-consents" aria-live="polite"><p class="mu sm">…</p></div></div>` : ''}
      <div class="card mb18"><div class="ch"><div class="ct">👁️ ${esc(t('pc_access_title'))}</div></div><p class="mu sm">${esc(t('pc_access_body'))}</p><div id="pc-access"><p class="mu sm">…</p></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">📨 ${esc(t('pc_requests_title'))}</div></div><p class="mu sm">${esc(t('pc_requests_body'))}</p>
        <form id="pc-request-form" novalidate class="mt8">
          <div class="fg"><label class="fl" for="pc-kind">${esc(t('pc_kind'))}</label><select class="fc" id="pc-kind">${KINDS.map(kind => `<option value="${kind}">${esc(t('pc_k_' + kind))}</option>`).join('')}</select></div>
          <p class="mu sm" id="pc-erasure-note" hidden>${esc(t('pc_erasure_note'))}</p>
          <div class="fg"><label class="fl" for="pc-details">${esc(t('pc_details'))}</label><textarea class="fc" id="pc-details" maxlength="2000" rows="3" placeholder="${esc(t('pc_details_ph'))}"></textarea></div>
          <div id="pc-request-msg" aria-live="polite"></div>
          <button type="submit" class="btn bp" id="pc-request-send">${esc(t('pc_submit'))}</button>
        </form><div id="pc-requests" class="mt18"></div></div>
    </div>`;
    if (patient) {
      $('pc-fhir').addEventListener('click', downloadFhir);
      $('pc-summary').addEventListener('click', showSummary);
      paintConsents();
    }
    $('pc-kind').addEventListener('change', event => { $('pc-erasure-note').hidden = event.target.value !== 'erasure'; });
    $('pc-request-form').addEventListener('submit', submitRequest);
    paintAccess();
    paintRequests();
  }

  async function paintConsents() {
    const box = $('pc-consents');
    try {
      const data = await loadConsents();
      if (!box.isConnected) return;
      const consents = data.consents;
      const toggle = (purpose, label, checked, disabled = false, extra = '') => `<div class="pc-switch"><div><strong id="pc-l-${purpose}">${esc(label)}</strong>${extra}</div>
        <label class="pc-toggle"><input type="checkbox" role="switch" data-purpose="${purpose}" aria-labelledby="pc-l-${purpose}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span aria-hidden="true"></span></label></div>`;
      box.innerHTML = `${consents ? '' : `<div class="alt ai mt8">${esc(t('pc_consent_profile_needed'))} <button type="button" class="btn bs bsm" onclick="navigate('complete-profile')">${esc(t('wz_my_profile'))}</button></div>`}
        ${toggle('dataSharing', t('pc_consent_required'), true, true, `<span class="mu sm">${esc(t('pc_consent_required_note'))}</span>`)}
        ${CHANGEABLE.map(purpose => toggle(purpose, t('pc_c_' + purpose), !!consents?.[purpose], !consents)).join('')}
        ${toggle('whatsapp', t('pc_c_whatsapp'), !!data.whatsapp?.consent, true, `<span class="mu sm">${esc(t('pc_c_whatsapp_note'))}</span>`)}
        <div id="pc-consent-msg"></div>
        <details class="mt8"><summary class="sm">${esc(t('pc_consent_history'))}</summary>${data.history.length ? data.history.map(event => `<div class="pc-row"><div>${esc(t('pc_c_' + event.purpose))}</div><div class="mu">${esc(t(event.granted ? 'pc_given' : 'pc_withdrawn'))} · ${esc(day(event.createdAt))}</div></div>`).join('') : `<p class="mu sm">${esc(t('pc_no_history'))}${consents?.recordedAt ? ` (${esc(day(consents.recordedAt))})` : ''}</p>`}</details>`;
      box.querySelectorAll('input[data-purpose]:not(:disabled)').forEach(input => input.addEventListener('change', () => changeConsent(input)));
    } catch (error) { box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; }
  }

  async function changeConsent(input) {
    const purpose = input.dataset.purpose, granted = input.checked;
    input.disabled = true; note('pc-consent-msg', t('pc_saving'), 'ai');
    try {
      if (backend()) {
        const result = await apiRequest('/api/v1/me/consents', 'POST', { purpose, granted });
        if (CU.healthProfile) CU.healthProfile.consents = result.data.consents;
      } else {
        const now = new Date().toISOString();
        CU.healthProfile.consents = { ...CU.healthProfile.consents, [purpose]: granted, recordedAt: now, version: '2026.1' };
        localList('consentEvents').unshift({ userId: CU.id, purpose, granted, version: '2026.1', source: 'privacy_centre', createdAt: now });
        log(granted ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN', purpose);
      }
      await paintConsents();
      note('pc-consent-msg', t('pc_saved'));
    } catch (error) { input.checked = !granted; input.disabled = false; note('pc-consent-msg', error.message, 'ae'); }
  }

  async function paintAccess() {
    const box = $('pc-access');
    try {
      const entries = await loadAccess();
      if (!box.isConnected) return;
      box.innerHTML = entries.length ? entries.map(entry => `<div class="pc-row"><div><strong>${esc(entry.actorName)}</strong> <span class="mu">· ${esc(tv(entry.actorRole))}</span><div>${esc(t('pc_act_' + entry.action) || entry.action)}</div></div><div class="mu">${esc(String(entry.createdAt).replace('T', ' ').slice(0, 16))}</div></div>`).join('')
        : `<p class="mu sm">${esc(t('pc_access_empty'))}</p>`;
    } catch (error) { box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; }
  }

  function requestCard(entry) {
    return `<div class="pc-row"><div><strong>${esc(t('pc_k_' + entry.kind))}</strong><div class="mu sm">${esc(tf('pc_received_on', { date: day(entry.createdAt) }))} · ${esc(tf('pc_due', { date: day(entry.dueAt) }))}</div>
      ${entry.details ? `<div class="sm mt8">${esc(entry.details)}</div>` : ''}
      ${entry.resolution ? `<div class="pc-answer sm"><strong>${esc(t('pc_answer'))}:</strong> ${esc(entry.resolution)}</div>` : ''}</div>
      <div>${statusBadge(entry.status)}${entry.overdue ? ` <span class="badge bda">${esc(t('pc_overdue'))}</span>` : ''}</div></div>`;
  }

  async function paintRequests() {
    const box = $('pc-requests');
    try {
      const requests = await loadRequests();
      if (!box.isConnected) return;
      box.innerHTML = requests.length ? requests.map(requestCard).join('') : `<p class="mu sm">${esc(t('pc_none'))}</p>`;
    } catch (error) { box.innerHTML = `<div class="alt ae" role="alert">${esc(error.message)}</div>`; }
  }

  async function submitRequest(event) {
    event.preventDefault();
    const kind = $('pc-kind').value, details = $('pc-details').value.trim();
    if (['rectification', 'erasure', 'restriction', 'objection'].includes(kind) && details.length < 10) return note('pc-request-msg', t('pc_details_short'), 'ae');
    if (/[<>]/.test(details)) return note('pc-request-msg', t('pc_details_short'), 'ae');
    const button = $('pc-request-send'); button.disabled = true;
    try {
      let saved;
      if (backend()) saved = (await apiRequest('/api/v1/me/privacy-requests', 'POST', { kind, details })).data.request;
      else {
        const list = localList('privacyRequests');
        if (list.some(entry => entry.userId === CU.id && entry.kind === kind && ['received', 'in_progress'].includes(entry.status))) throw new Error(t('pc_open_exists'));
        const now = new Date();
        saved = { id: 'pr' + Date.now(), userId: CU.id, kind, details, status: 'received', createdAt: now.toISOString(), dueAt: new Date(now.getTime() + RESPONSE_DAYS * 86400000).toISOString() };
        list.unshift(saved);
        log('PRIVACY_REQUEST_SUBMITTED', kind);
      }
      $('pc-request-form').reset(); $('pc-erasure-note').hidden = true;
      note('pc-request-msg', tf('pc_sent', { date: day(saved.dueAt) }));
      paintRequests();
    } catch (error) { note('pc-request-msg', error.message, 'ae'); }
    finally { button.disabled = false; }
  }

  // ───── Export ─────
  function localRecord() {
    const mine = list => (list || []).filter(entry => entry.patientId === CU.id);
    const people = Object.fromEntries(DB.users.filter(user => user.role !== 'patient').map(user => [user.id, user]));
    return {
      user: CU, health: CU.healthProfile || null, appointments: mine(DB.appointments), labResults: mine(DB.labResults), referrals: mine(DB.specialistReferrals),
      reports: mine(DB.doctorReports), careNotes: mine(DB.careNotes), people,
      files: mine(DB.medicalDocuments).map(entry => ({ id: entry.id, fileName: entry.fileName, category: entry.category, notes: entry.notes, uploadedAt: entry.uploadedAt }))
    };
  }

  async function buildBundle() {
    const record = localRecord();
    const local = HFAFhir.patientBundle({ ...record, consentHistory: (await loadConsents().catch(() => ({ history: [] }))).history });
    if (!backend()) return local;
    // The server's copy (health profile, consents, stored files) wins; this device adds appointments, reports and notes.
    const response = await fetch('/api/v1/me/fhir', { credentials: 'same-origin', headers: { 'X-HFA-Request': '1' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || t('backend_unavailable'));
    const server = await response.json();
    const seen = new Set(server.entry.map(entry => entry.fullUrl));
    server.entry.push(...local.entry.filter(entry => !seen.has(entry.fullUrl)));
    return server;
  }

  async function downloadFhir() {
    const button = $('pc-fhir'); button.disabled = true; note('pc-export-msg', t('pc_exporting'), 'ai');
    try {
      const bundle = await buildBundle();
      const problems = HFAFhir.validate(bundle);
      if (problems.length) throw new Error(problems[0]);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `hfa-health-record-${CU.hfaId || CU.id}.json` });
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      if (!backend()) log('RECORD_EXPORTED', 'FHIR R4');
      note('pc-export-msg', tf('pc_export_done', { count: bundle.entry.length }));
    } catch (error) { note('pc-export-msg', error.message, 'ae'); }
    finally { button.disabled = false; }
  }

  function showSummary() {
    const record = localRecord(), health = record.health || {}, medical = health.medical || {}, identity = health.identity || {};
    const list = items => items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : `<p class="mu sm">${esc(t('pc_s_none'))}</p>`;
    const allergies = medical.drugAllergies ? medical.drugAllergies.map(entry => `${entry.name} (${tv(entry.severity)})`).concat([medical.foodAllergies, medical.environmentalAllergies].filter(Boolean))
      : String(CU.allergies || '').split(/[,;]/).map(item => item.trim()).filter(item => item && !/^none$/i.test(item));
    const conditions = (medical.conditions || []).map(key => key === 'other' && medical.otherCondition ? medical.otherCondition : tv(key.replace(/_/g, ' ')));
    const medicines = (medical.medications || []).map(entry => [entry.name, entry.dose, entry.frequency].filter(Boolean).join(' · '));
    const appointments = record.appointments.map(entry => `${entry.date} ${entry.time} · ${entry.serviceName || tv(entry.type)} · ${G(entry.doctorId)?.name || ''} · ${tv(entry.status)}`);
    const labs = record.labResults.filter(entry => entry.releasedAt).map(entry => `${day(entry.releasedAt)} · ${entry.testType}${entry.notes ? ' · ' + entry.notes : ''}`);
    openMo(`<div class="pc-summary"><div class="mh"><div class="mt2">${esc(t('pc_summary_title'))}</div><button class="mc pc-noprint" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <p class="mu sm">${esc(tf('pc_summary_generated', { date: new Date().toISOString().slice(0, 16).replace('T', ' ') }))}</p>
      <h3>${esc(t('pc_s_identity'))}</h3>${list([CU.name, CU.hfaId, identity.dateOfBirth || CU.dateOfBirth, tv(identity.gender || CU.gender || ''), medical.bloodGroup || CU.bloodType, medical.genotype && `Genotype ${medical.genotype}`].filter(Boolean))}
      <h3>${esc(t('pc_s_allergies'))}</h3>${list(allergies)}
      <h3>${esc(t('pc_s_conditions'))}</h3>${list(conditions)}
      <h3>${esc(t('pc_s_medicines'))}</h3>${list(medicines)}
      <h3>${esc(t('pc_s_appointments'))}</h3>${list(appointments)}
      <h3>${esc(t('pc_s_labs'))}</h3>${list(labs)}
      <div class="mf pc-noprint"><button class="btn bs" onclick="closeMo()">${esc(t('close'))}</button><button class="btn bp" id="pc-print">${esc(t('pc_print'))}</button></div></div>`);
    $('pc-print').addEventListener('click', () => {
      document.body.classList.add('pc-printing');
      window.addEventListener('afterprint', () => document.body.classList.remove('pc-printing'), { once: true });
      window.print();
    });
  }

  // ───── Administrators: data-rights requests ─────
  async function loadAdminRequests() {
    if (backend()) return (await apiRequest('/api/v1/admin/privacy-requests')).data.requests;
    return localList('privacyRequests').map(entry => ({ ...withOverdue(entry), userName: G(entry.userId)?.name || '—', userRole: G(entry.userId)?.role || '', hfaId: G(entry.userId)?.hfaId || '', resolvedByName: G(entry.resolvedBy)?.name }))
      .sort((a, b) => (['completed', 'refused'].includes(a.status) - ['completed', 'refused'].includes(b.status)) || a.dueAt.localeCompare(b.dueAt));
  }

  async function renderAdmin(pc) {
    $('tbt').textContent = t('pr_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('pr_title'))}</h2><p>${esc(t('pr_intro'))}</p></div><div id="pr-body"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const body = $('pr-body');
    try {
      const requests = await loadAdminRequests();
      if (!body.isConnected) return;
      const open = requests.filter(entry => !['completed', 'refused'].includes(entry.status));
      body.innerHTML = `<div class="stats mb18"><div class="sc"><div class="sv">${open.length}</div><div class="sl">${esc(t('pr_open'))}</div></div><div class="sc"><div class="sv" style="color:var(--dg)">${open.filter(entry => entry.overdue).length}</div><div class="sl">${esc(t('pr_overdue'))}</div></div><div class="sc"><div class="sv">${requests.length - open.length}</div><div class="sl">${esc(t('pr_closed'))}</div></div></div>
        <div class="card">${requests.length ? `<div class="tw"><table><thead><tr><th>${esc(t('pr_person'))}</th><th>${esc(t('pr_request'))}</th><th>${esc(t('pr_status'))}</th><th>${esc(t('pr_actions'))}</th></tr></thead><tbody>${requests.map(entry => `<tr>
          <td><strong>${esc(entry.userName)}</strong><div class="mu sm">${esc(tv(entry.userRole))} · <code class="code-chip">${esc(entry.hfaId || '')}</code></div></td>
          <td><strong>${esc(t('pc_k_' + entry.kind))}</strong>${entry.details ? `<div class="sm">${esc(entry.details)}</div>` : ''}<div class="mu sm">${esc(tf('pc_received_on', { date: day(entry.createdAt) }))} · ${esc(tf('pc_due', { date: day(entry.dueAt) }))}</div>${entry.resolution ? `<div class="pc-answer sm">${esc(entry.resolution)}${entry.resolvedByName ? ` — ${esc(entry.resolvedByName)}` : ''}</div>` : ''}</td>
          <td>${statusBadge(entry.status)}${entry.overdue ? ` <span class="badge bda">${esc(t('pc_overdue'))}</span>` : ''}</td>
          <td>${['completed', 'refused'].includes(entry.status) ? '' : `<div class="pc-actions" style="margin-top:0">${entry.status === 'received' ? `<button class="btn bs bsm" data-pr="${esc(entry.id)}" data-status="in_progress">${esc(t('pr_start'))}</button>` : ''}<button class="btn bp bsm" data-pr="${esc(entry.id)}" data-status="completed">${esc(t('pr_complete'))}</button><button class="btn bd2 bsm" data-pr="${esc(entry.id)}" data-status="refused">${esc(t('pr_refuse'))}</button></div>`}</td></tr>`).join('')}</tbody></table></div>` : `<p class="mu sm">${esc(t('pr_none'))}</p>`}</div>`;
      body.querySelectorAll('button[data-pr]').forEach(button => button.addEventListener('click', () => button.dataset.status === 'in_progress' ? updateRequest(button.dataset.pr, 'in_progress') : askResolution(button.dataset.pr, button.dataset.status)));
    } catch (error) { body.innerHTML = `<div class="card"><div class="alt ae" role="alert">${esc(error.message)}</div></div>`; }
  }

  function askResolution(id, status) {
    openMo(`<div class="mh"><div class="mt2">${esc(t(status === 'completed' ? 'pr_complete' : 'pr_refuse'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <div class="fg"><label class="fl" for="pr-resolution">${esc(t('pr_resolution'))}</label><textarea class="fc" id="pr-resolution" rows="4" maxlength="2000" placeholder="${esc(t('pr_resolution_ph'))}"></textarea></div>
      <div id="pr-msg"></div><div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn ${status === 'completed' ? 'bp' : 'bd2'}" id="pr-save">${esc(t(status === 'completed' ? 'pr_complete' : 'pr_refuse'))}</button></div>`);
    $('pr-resolution').focus();
    $('pr-save').addEventListener('click', () => {
      const resolution = $('pr-resolution').value.trim();
      if (resolution.length < 10 || /[<>]/.test(resolution)) return note('pr-msg', t('pr_resolution_short'), 'ae');
      updateRequest(id, status, resolution).then(ok => { if (ok) closeMo(); });
    });
  }

  async function updateRequest(id, status, resolution) {
    try {
      if (backend()) await apiRequest(`/api/v1/admin/privacy-requests/${encodeURIComponent(id)}`, 'PATCH', { status, ...(resolution ? { resolution } : {}) });
      else {
        const entry = localList('privacyRequests').find(item => item.id === id);
        if (!entry || ['completed', 'refused'].includes(entry.status)) return false;
        Object.assign(entry, { status, ...(resolution ? { resolution } : {}), ...(status !== 'in_progress' ? { resolvedAt: new Date().toISOString(), resolvedBy: CU.id } : {}) });
        DB.privacyAccess.unshift({ id: 'pa' + Date.now(), userId: entry.userId, action: 'PRIVACY_REQUEST_UPDATED', actorId: CU.id, createdAt: new Date().toISOString() });
        log('PRIVACY_REQUEST_UPDATED', `${entry.kind} · ${status}`);
        if (G(entry.userId)?.role === 'patient') notifyUser(entry.userId, t('pc_act_PRIVACY_REQUEST_UPDATED'), 'Account');
      }
      renderAdmin($('pgc'));
      return true;
    } catch (error) { if ($('pr-msg')) note('pr-msg', error.message, 'ae'); else alert(error.message); return false; }
  }

  window.HFAPrivacy = { renderPage, renderAdmin, buildBundle };
})();
