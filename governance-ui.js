// Screens for the server-held governance registers (backend/governance.js):
// - administrators: consent register, clinician licence register (verify with expiry), safety-alert counts;
// - doctors and nurses: medication safety alerts for their own patients, resolved with a written note.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const online = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline;

  Object.assign(T.en, {
    gv_nav: 'Medication safety', gv_alerts_title: 'Medication safety alerts', gv_alerts_intro: 'Your patients’ recorded allergies checked against their medicines, your plans and pharmacy orders. Check each one and record what you decided.',
    gv_no_alerts: 'No allergy conflicts found for your patients.', gv_allergy: 'Allergy: {allergy} (recorded as “{recorded}”)', gv_drug: 'Medicine: {drug}',
    gv_source_profile_medication: 'In the patient’s medicine list', gv_source_doctor_report: 'In a consultation plan', gv_source_pharmacy_order: 'In a pharmacy order',
    gv_resolve: 'Mark as checked', gv_resolve_note: 'What did you decide? (e.g. medicine stopped, allergy not confirmed)', gv_resolved: 'Checked by {name}',
    gv_oversight: 'Open alerts: {open} ({critical} critical) · resolved: {resolved}. Only the patients’ clinicians see the details.',
    gv_consents_title: 'Consent register', gv_consents_intro: 'Each patient’s current choices, recorded with the date and consent version.', gv_no_patients: 'No patients yet.',
    gv_c_dataSharing: 'Care team', gv_c_research: 'Research', gv_c_ministry: 'Ministry statistics', gv_c_sms: 'SMS', gv_c_whatsapp: 'WhatsApp', gv_changes: '{n} changes',
    gv_licences_title: 'Clinician licence register', gv_licences_intro: 'Check credentials with the official licensing authority for the clinician’s country. Record the country, verification method, source and expiry; HFA does not automatically verify licences.',
    gv_no_licence: 'No licence number on file', gv_unverified: 'Not verified', gv_expired: 'Expired', gv_expiring: 'Expires in {days} days', gv_rejected: 'Not valid', gv_valid_until: 'Valid until {date}',
    gv_reverification: 'Evidence required again', gv_verify: 'Verify', gv_reject: 'Not valid', gv_expiry: 'Licence expiry date', gv_no_profile: 'Health profile not completed',
    gv_verify_country: 'Licensing country', gv_verify_country_hint: 'Select the jurisdiction checked; do not infer it from the facility.',
    gv_verify_method: 'How was it checked?', gv_method_registry: 'Official registry', gv_method_authority: 'Direct authority confirmation', gv_method_document: 'Original document checked',
    gv_verify_source: 'Authority / source checked', gv_verify_reference: 'Non-sensitive evidence reference', gv_verify_note: 'Note (required when not valid)',
    gv_country_reviews_title: 'Country launch-readiness reviews', gv_country_reviews_intro: 'Administrative review register only. No country is launch-ready until every required capability is approved, in date, and supported by a recorded reviewer and source.',
    gv_country: 'Country', gv_country_readiness: 'Country status', gv_country_ready: 'All required reviews are current', gv_country_pending: 'Not launch-ready — reviews are missing, pending, rejected or expired',
    gv_country_clinical: 'Clinical content and pathways', gv_country_privacy: 'Privacy and legal review', gv_country_emergency: 'Emergency contacts', gv_country_language: 'Language and patient content',
    gv_country_payments: 'Payments and pricing', gv_country_provider_credentials: 'Provider credential process',
    gv_review_pending: 'Pending', gv_review_approved: 'Approved', gv_review_rejected: 'Rejected', gv_review_expired: 'Expired',
    gv_expired_select_status: 'Choose a new status to replace this expired review.',
    gv_review_owner: 'Responsible reviewer / team', gv_review_source: 'Authoritative source', gv_review_reference: 'Non-sensitive evidence reference',
    gv_review_expires: 'Review again by', gv_review_scope: 'Review visibility', gv_review_internal: 'Internal only', gv_review_public: 'Public summary allowed',
    gv_review_note: 'Review note (required if rejected)', gv_save_review: 'Save review', gv_review_history: 'Review history', gv_no_review_history: 'No review changes recorded.',
    credential_review_checked: 'HFA credential review recorded · {date}', credential_review_expired: 'Credential review expired', credential_review_pending: 'Credential review not confirmed'
  });
  Object.assign(T.fr, {
    gv_nav: 'Sécurité des médicaments', gv_alerts_title: 'Alertes de sécurité des médicaments', gv_alerts_intro: 'Les allergies enregistrées de vos patients comparées à leurs médicaments, à vos plans et aux commandes en pharmacie. Vérifiez chacune et notez votre décision.',
    gv_no_alerts: 'Aucun conflit d’allergie trouvé pour vos patients.', gv_allergy: 'Allergie : {allergy} (enregistrée comme « {recorded} »)', gv_drug: 'Médicament : {drug}',
    gv_source_profile_medication: 'Dans la liste de médicaments du patient', gv_source_doctor_report: 'Dans un plan de consultation', gv_source_pharmacy_order: 'Dans une commande en pharmacie',
    gv_resolve: 'Marquer comme vérifié', gv_resolve_note: 'Qu’avez-vous décidé ? (ex. médicament arrêté, allergie non confirmée)', gv_resolved: 'Vérifié par {name}',
    gv_oversight: 'Alertes ouvertes : {open} ({critical} critiques) · résolues : {resolved}. Seuls les soignants des patients voient les détails.',
    gv_consents_title: 'Registre des consentements', gv_consents_intro: 'Les choix actuels de chaque patient, avec la date et la version du consentement.', gv_no_patients: 'Aucun patient pour l’instant.',
    gv_c_dataSharing: 'Équipe de soins', gv_c_research: 'Recherche', gv_c_ministry: 'Statistiques du Ministère', gv_c_sms: 'SMS', gv_c_whatsapp: 'WhatsApp', gv_changes: '{n} changements',
    gv_licences_title: 'Registre des licences des soignants', gv_licences_intro: 'Vérifiez les titres auprès de l’autorité officielle compétente dans le pays du soignant. Enregistrez le pays, la méthode, la source et l’expiration ; HFA ne vérifie pas automatiquement les licences.',
    gv_no_licence: 'Aucun numéro de licence', gv_unverified: 'Non vérifiée', gv_expired: 'Expirée', gv_expiring: 'Expire dans {days} jours', gv_rejected: 'Non valable', gv_valid_until: 'Valable jusqu’au {date}',
    gv_reverification: 'Preuves à vérifier à nouveau', gv_verify: 'Vérifier', gv_reject: 'Non valable', gv_expiry: 'Date d’expiration de la licence', gv_no_profile: 'Profil de santé non complété',
    gv_verify_country: 'Pays de délivrance', gv_verify_country_hint: 'Sélectionnez la juridiction vérifiée ; ne la déduisez pas de l’établissement.',
    gv_verify_method: 'Méthode de vérification', gv_method_registry: 'Registre officiel', gv_method_authority: 'Confirmation directe de l’autorité', gv_method_document: 'Document original contrôlé',
    gv_verify_source: 'Autorité / source consultée', gv_verify_reference: 'Référence de preuve non sensible', gv_verify_note: 'Note (obligatoire si non valable)',
    gv_country_reviews_title: 'Contrôles de préparation par pays', gv_country_reviews_intro: 'Registre administratif uniquement. Aucun pays n’est prêt au lancement tant que chaque capacité requise n’est pas approuvée, à jour et appuyée par un évaluateur et une source enregistrés.',
    gv_country: 'Pays', gv_country_readiness: 'État du pays', gv_country_ready: 'Tous les contrôles requis sont à jour', gv_country_pending: 'Pas prêt au lancement — contrôles manquants, en attente, rejetés ou expirés',
    gv_country_clinical: 'Contenu et parcours cliniques', gv_country_privacy: 'Examen juridique et confidentialité', gv_country_emergency: 'Contacts d’urgence', gv_country_language: 'Langue et contenu patient',
    gv_country_payments: 'Paiements et tarification', gv_country_provider_credentials: 'Processus de vérification des soignants',
    gv_review_pending: 'En attente', gv_review_approved: 'Approuvé', gv_review_rejected: 'Rejeté', gv_review_expired: 'Expiré',
    gv_expired_select_status: 'Choisissez un nouveau statut pour remplacer ce contrôle expiré.',
    gv_review_owner: 'Évaluateur / équipe responsable', gv_review_source: 'Source faisant autorité', gv_review_reference: 'Référence de preuve non sensible',
    gv_review_expires: 'À réexaminer avant', gv_review_scope: 'Visibilité du contrôle', gv_review_internal: 'Interne uniquement', gv_review_public: 'Résumé public autorisé',
    gv_review_note: 'Note (obligatoire en cas de rejet)', gv_save_review: 'Enregistrer', gv_review_history: 'Historique des contrôles', gv_no_review_history: 'Aucun changement enregistré.',
    credential_review_checked: 'Contrôle des titres HFA enregistré · {date}', credential_review_expired: 'Contrôle des titres expiré', credential_review_pending: 'Contrôle des titres non confirmé'
  });

  for (const role of ['doctor', 'nurse']) NAV[role][0]?.items.push({ id: 'safety', l: () => t('gv_nav'), i: 'shield' });

  const yesNo = value => value === true ? '✅' : value === false ? '—' : '·';
  const fail = (box, error) => { if (box) box.innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; };
  const countryCapabilityLabel = capability => t(`gv_country_${capability}`);
  const reviewStatusLabel = status => t(`gv_review_${status}`);
  const countrySelectOptions = selected => HFACountryData.all().map(country => {
    const name = country.name[LANG] || country.name.en;
    return `<option value="${esc(country.code)}" ${country.code === selected ? 'selected' : ''}>${esc(name)}</option>`;
  }).join('');

  // ───── Clinicians: alerts for their patients ─────
  async function renderClinicianAlerts(pc) {
    $('tbt').textContent = t('gv_alerts_title');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('gv_alerts_title'))}</h2><p>${esc(t('gv_alerts_intro'))}</p></div><div id="gv-alerts"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    const box = $('gv-alerts');
    try {
      const { alerts } = (await apiRequest('/api/v1/safety/alerts')).data;
      if (!box.isConnected) return;
      box.innerHTML = alerts.length ? alerts.map(alert => `<div class="card mb18 tq-case ${alert.resolved ? 'tq-self_care' : alert.severity === 'critical' ? 'tq-emergency' : 'tq-urgent'}">
        <div class="ch" style="flex-wrap:wrap;gap:8px"><div class="ct">${esc(alert.patientName)} <code class="code-chip">${esc(alert.hfaId || '')}</code></div><span class="badge ${alert.resolved ? 'bsu' : alert.severity === 'critical' ? 'bda' : 'bwa'}">${esc(alert.resolved ? tf('gv_resolved', { name: alert.resolvedBy || '—' }) : tv(alert.severity))}</span></div>
        <p class="sm"><strong>${esc(tf('gv_allergy', { allergy: alert.allergy, recorded: alert.recorded }))}</strong><br>${esc(tf('gv_drug', { drug: alert.drug }))} · <span class="mu">${esc(t('gv_source_' + alert.source))}${alert.date ? ' · ' + esc(String(alert.date).slice(0, 10)) : ''}</span></p>
        ${alert.resolved ? `<div class="pc-answer sm">${esc(alert.note)}</div>` : `<div class="fg mt8"><label class="fl" for="gv-note-${esc(alert.key)}">${esc(t('gv_resolve_note'))}</label><textarea class="fc" id="gv-note-${esc(alert.key)}" rows="2" maxlength="500"></textarea></div><button class="btn bp bsm" data-resolve="${esc(alert.key)}">${esc(t('gv_resolve'))}</button><div id="gv-msg-${esc(alert.key)}"></div>`}
      </div>`).join('') : `<div class="card"><p class="mu sm">${esc(t('gv_no_alerts'))}</p></div>`;
      box.querySelectorAll('[data-resolve]').forEach(button => button.onclick = async () => {
        const key = button.dataset.resolve;
        try { await apiRequest(`/api/v1/safety/alerts/${encodeURIComponent(key)}/resolve`, 'POST', { note: $(`gv-note-${key}`).value.trim() }); renderClinicianAlerts($('pgc')); }
        catch (error) { fail($(`gv-msg-${key}`), error); }
      });
    } catch (error) { fail(box, error); }
  }

  // ───── Administrators: registers ─────
  function licenceBadge(item) {
    if (!item.licenseNo) return `<span class="badge bda">${esc(t('gv_no_licence'))}</span>`;
    if (item.alert === 'unverified') return `<span class="badge bwa">${esc(t('gv_unverified'))}</span>`;
    if (item.alert === 'rejected') return `<span class="badge bda">${esc(t('gv_rejected'))}</span>`;
    if (item.alert === 'expired') return `<span class="badge bda">${esc(t('gv_expired'))}</span>`;
    if (item.alert === 'reverification_required') return `<span class="badge bwa">${esc(t('gv_reverification'))}</span>`;
    if (item.alert === 'expiring') return `<span class="badge bwa">${esc(tf('gv_expiring', { days: item.daysToExpiry }))}</span>`;
    return `<span class="badge bsu">${esc(tf('gv_valid_until', { date: item.verification.expiresOn }))}</span>`;
  }

  async function paintCountryHistory(countryCode) {
    const box = $('gv-country-history');
    if (!box) return;
    try {
      const { events } = (await apiRequest(`/api/v1/admin/country-reviews/${encodeURIComponent(countryCode)}/history`)).data;
      if (!box.isConnected) return;
      box.innerHTML = events.length ? `<ul class="sm">${events.map(event => {
        const fromExpiry = event.before?.expires_on || event.before?.expiresOn;
        const toExpiry = event.after.expires_on || event.after.expiresOn;
        const from = event.before?.status === 'approved' && fromExpiry && fromExpiry < new Date().toISOString().slice(0, 10) ? 'expired' : event.before?.status || '—';
        const to = event.after.status === 'approved' && toExpiry && toExpiry < new Date().toISOString().slice(0, 10) ? 'expired' : event.after.status;
        return `<li>${esc(countryCapabilityLabel(event.capability))}: ${esc(reviewStatusLabel(from))} → ${esc(reviewStatusLabel(to))} · ${esc(event.actor)} · ${esc(String(event.at).slice(0, 10))}</li>`;
      }).join('')}</ul>` : `<p class="mu sm">${esc(t('gv_no_review_history'))}</p>`;
    } catch (error) { fail(box, error); }
  }

  async function paintCountryReviews(countryCode = 'CM') {
    const box = $('gv-country-reviews');
    if (!box) return;
    try {
      const { countries } = (await apiRequest('/api/v1/admin/country-reviews')).data;
      if (!box.isConnected) return;
      const country = countries.find(item => item.countryCode === countryCode) || countries.find(item => item.countryCode === 'CM');
      if (!country) throw new Error('Country review data is unavailable');
      const readyLabel = country.launchReady ? t('gv_country_ready') : t('gv_country_pending');
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      box.innerHTML = `
        <div class="fr">
          <div class="fg"><label class="fl" for="gv-country-code">${esc(t('gv_country'))}</label><select class="fc" id="gv-country-code">${countrySelectOptions(country.countryCode)}</select></div>
          <div class="fg"><span class="fl">${esc(t('gv_country_readiness'))}</span><p class="badge ${country.launchReady ? 'bsu' : 'bwa'}" role="status">${esc(readyLabel)}</p></div>
        </div>
        <p class="mu sm mb12">${esc(t('gv_country_reviews_intro'))}</p>
        <div class="g2">${country.reviews.map(review => `
          <section class="card">
            <div class="ch"><h3 class="ct">${esc(countryCapabilityLabel(review.capability))}</h3><span class="badge ${review.status === 'approved' ? 'bsu' : review.status === 'rejected' || review.status === 'expired' ? 'bda' : 'bwa'}">${esc(reviewStatusLabel(review.status))}</span></div>
            ${review.reviewedBy ? `<p class="mu sm mb12">${esc(review.reviewedBy)} · ${esc(String(review.reviewedAt).slice(0, 10))}</p>` : ''}
            <div class="fg"><label class="fl" for="gv-cr-owner-${esc(review.capability)}">${esc(t('gv_review_owner'))}</label><input class="fc" id="gv-cr-owner-${esc(review.capability)}" maxlength="160" value="${esc(review.reviewOwner)}"></div>
            <div class="fg"><label class="fl" for="gv-cr-source-${esc(review.capability)}">${esc(t('gv_review_source'))}</label><input class="fc" id="gv-cr-source-${esc(review.capability)}" maxlength="240" value="${esc(review.source)}"></div>
            <div class="fg"><label class="fl" for="gv-cr-reference-${esc(review.capability)}">${esc(t('gv_review_reference'))}</label><input class="fc" id="gv-cr-reference-${esc(review.capability)}" maxlength="500" required value="${esc(review.sourceReference)}"></div>
            <div class="fr">
              <div class="fg"><label class="fl" for="gv-cr-status-${esc(review.capability)}">${esc(t('status'))}</label><select class="fc" id="gv-cr-status-${esc(review.capability)}">
                ${review.status === 'expired' ? `<option value="expired" selected disabled>${esc(reviewStatusLabel('expired'))}</option>` : ''}
                ${['pending', 'approved', 'rejected'].map(status => `<option value="${status}" ${review.status === status ? 'selected' : ''}>${esc(reviewStatusLabel(status))}</option>`).join('')}
              </select></div>
              <div class="fg"><label class="fl" for="gv-cr-expires-${esc(review.capability)}">${esc(t('gv_review_expires'))}</label><input class="fc" type="date" min="${tomorrow}" id="gv-cr-expires-${esc(review.capability)}" value="${esc(review.status === 'expired' ? '' : review.expiresOn || '')}"></div>
            </div>
            <div class="fg"><label class="fl" for="gv-cr-scope-${esc(review.capability)}">${esc(t('gv_review_scope'))}</label><select class="fc" id="gv-cr-scope-${esc(review.capability)}">
              <option value="internal" ${review.scope === 'internal' ? 'selected' : ''}>${esc(t('gv_review_internal'))}</option>
              <option value="public" ${review.scope === 'public' ? 'selected' : ''}>${esc(t('gv_review_public'))}</option>
            </select></div>
            <div class="fg"><label class="fl" for="gv-cr-note-${esc(review.capability)}">${esc(t('gv_review_note'))}</label><textarea class="fc" id="gv-cr-note-${esc(review.capability)}" maxlength="1000" rows="2">${esc(review.note)}</textarea></div>
            <button type="button" class="btn bp bsm" data-save-country-review="${esc(review.capability)}">${esc(t('gv_save_review'))}</button>
            <div id="gv-cr-message-${esc(review.capability)}" role="status"></div>
          </section>`).join('')}</div>
        <details class="mt12"><summary>${esc(t('gv_review_history'))}</summary><div id="gv-country-history" class="mt8"><p class="mu sm">…</p></div></details>`;
      $('gv-country-code').addEventListener('change', event => paintCountryReviews(event.target.value));
      box.querySelectorAll('[data-save-country-review]').forEach(button => button.onclick = async () => {
        const capability = button.dataset.saveCountryReview;
        const value = suffix => $(`gv-cr-${suffix}-${capability}`);
        const body = {
          status: value('status').value, reviewOwner: value('owner').value, source: value('source').value,
          sourceReference: value('reference').value, expiresOn: value('expires').value,
          scope: value('scope').value, note: value('note').value
        };
        if (!['pending', 'approved', 'rejected'].includes(body.status)) {
          fail($(`gv-cr-message-${capability}`), new Error(t('gv_expired_select_status')));
          return;
        }
        button.disabled = true;
        try {
          await apiRequest(`/api/v1/admin/country-reviews/${encodeURIComponent(country.countryCode)}/${encodeURIComponent(capability)}`, 'PUT', body);
          await paintCountryReviews(country.countryCode);
        } catch (error) { fail($(`gv-cr-message-${capability}`), error); }
        finally { if (button.isConnected) button.disabled = false; }
      });
      paintCountryHistory(country.countryCode);
    } catch (error) { fail(box, error); }
  }

  async function renderAdminSafety(pc) {
    $('tbt').textContent = t('safety_nav');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${t('safety_title')}</h2><p>${t('safety_sub')}</p></div>
      <div class="card mb18"><div class="ch"><div class="ct">${t('med_alerts_title')}</div></div><div id="gv-oversight"><p class="mu sm">…</p></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">${esc(t('gv_country_reviews_title'))}</div></div><div id="gv-country-reviews"><p class="mu sm">…</p></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">${esc(t('gv_licences_title'))}</div></div><p class="mu sm">${esc(t('gv_licences_intro'))}</p><div class="tw" id="gv-licences"><p class="mu sm">…</p></div></div>
      <div class="card"><div class="ch"><div class="ct">${esc(t('gv_consents_title'))}</div></div><p class="mu sm">${esc(t('gv_consents_intro'))}</p><div class="tw" id="gv-consents"><p class="mu sm">…</p></div></div></div>`;
    apiRequest('/api/v1/safety/alerts').then(({ data }) => { const box = $('gv-oversight'); if (box) box.innerHTML = `<p class="sm">${esc(tf('gv_oversight', data))}</p>`; }).catch(error => fail($('gv-oversight'), error));
    paintCountryReviews('CM');
    paintLicences();
    apiRequest('/api/v1/admin/consents').then(({ data }) => {
      const box = $('gv-consents'); if (!box) return;
      const keys = ['dataSharing', 'research', 'ministry', 'sms'];
      box.innerHTML = data.patients.length ? `<table><thead><tr><th>${t('patient')}</th>${keys.map(key => `<th>${esc(t('gv_c_' + key))}</th>`).join('')}<th>${esc(t('gv_c_whatsapp'))}</th><th>${t('timestamp')}</th></tr></thead><tbody>${data.patients.map(row => `<tr>
        <td><strong class="sm">${esc(row.name)}</strong><div class="mu sm"><code class="code-chip">${esc(row.hfaId || '')}</code></div></td>
        ${row.consents ? keys.map(key => `<td>${yesNo(row.consents[key])}</td>`).join('') : `<td colspan="${keys.length}" class="mu sm">${esc(t('gv_no_profile'))}</td>`}
        <td>${yesNo(row.whatsapp)}</td>
        <td class="mu sm">${esc(String(row.lastChange || row.consents?.recordedAt || '').slice(0, 10))}${row.consents?.version ? ` · v${esc(row.consents.version)}` : ''}${row.changes ? ` · ${esc(tf('gv_changes', { n: row.changes }))}` : ''}</td></tr>`).join('')}</tbody></table>` : `<p class="mu sm">${esc(t('gv_no_patients'))}</p>`;
    }).catch(error => fail($('gv-consents'), error));
  }

  async function paintLicences() {
    const box = $('gv-licences'); if (!box) return;
    try {
      const { clinicians } = (await apiRequest('/api/v1/admin/clinicians')).data;
      if (!box.isConnected) return;
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      box.innerHTML = clinicians.length ? `<table><thead><tr><th>${t('user')}</th><th>${t('status')}</th><th>${t('actions')}</th></tr></thead><tbody>${clinicians.map(item => `<tr>
        <td><strong class="sm">${esc(item.name)}</strong><div class="mu sm">${esc(tv(item.role))}${item.specialty ? ' · ' + esc(tv(item.specialty)) : ''}${item.hospital ? ' · ' + esc(item.hospital) : ''}</div><div class="sm"><code class="code-chip">${esc(item.licenseNo || '—')}</code></div></td>
        <td>${licenceBadge(item)}</td>
        <td>${item.licenseNo ? `<div class="pc-actions" style="margin-top:0;align-items:center;min-width:380px;flex-wrap:wrap">
          <label class="sr-only" for="gv-country-${esc(item.id)}">${esc(t('gv_verify_country'))}</label><select class="fc" id="gv-country-${esc(item.id)}" aria-label="${esc(t('gv_verify_country_hint'))}" style="max-width:190px"><option value="">${esc(t('select'))}</option>${countrySelectOptions(item.verification?.countryCode || '')}</select>
          <label class="sr-only" for="gv-method-${esc(item.id)}">${esc(t('gv_verify_method'))}</label><select class="fc" id="gv-method-${esc(item.id)}" style="max-width:190px"><option value="">${esc(t('select'))}</option>
            <option value="official_registry" ${item.verification?.verificationMethod === 'official_registry' ? 'selected' : ''}>${esc(t('gv_method_registry'))}</option>
            <option value="direct_authority" ${item.verification?.verificationMethod === 'direct_authority' ? 'selected' : ''}>${esc(t('gv_method_authority'))}</option>
            <option value="original_document" ${item.verification?.verificationMethod === 'original_document' ? 'selected' : ''}>${esc(t('gv_method_document'))}</option></select>
          <label class="sr-only" for="gv-source-${esc(item.id)}">${esc(t('gv_verify_source'))}</label><input class="fc" id="gv-source-${esc(item.id)}" maxlength="240" required placeholder="${esc(t('gv_verify_source'))}" style="max-width:220px" value="${esc(item.verification?.source || '')}">
          <label class="sr-only" for="gv-reference-${esc(item.id)}">${esc(t('gv_verify_reference'))}</label><input class="fc" id="gv-reference-${esc(item.id)}" maxlength="500" required placeholder="${esc(t('gv_verify_reference'))}" style="max-width:220px" value="${esc(item.verification?.sourceReference || '')}">
          <label class="sr-only" for="gv-exp-${esc(item.id)}">${esc(t('gv_expiry'))}</label><input class="fc" type="date" min="${tomorrow}" id="gv-exp-${esc(item.id)}" style="max-width:170px" value="${esc(item.verification?.expiresOn || '')}">
          <label class="sr-only" for="gv-note-${esc(item.id)}">${esc(t('gv_verify_note'))}</label><input class="fc" id="gv-note-${esc(item.id)}" maxlength="500" placeholder="${esc(t('gv_verify_note'))}" style="max-width:220px" value="${esc(item.verification?.note || '')}">
          <button class="btn bp bsm" data-licence="${esc(item.id)}" data-status="verified">${esc(t('gv_verify'))}</button><button class="btn bd2 bsm" data-licence="${esc(item.id)}" data-status="rejected">${esc(t('gv_reject'))}</button></div><div id="gv-lmsg-${esc(item.id)}" role="status"></div>` : ''}</td></tr>`).join('')}</tbody></table>` : `<p class="mu sm">—</p>`;
      box.querySelectorAll('[data-licence]').forEach(button => button.onclick = async () => {
        const id = button.dataset.licence;
        const body = {
          status: button.dataset.status, countryCode: $(`gv-country-${id}`).value,
          verificationMethod: $(`gv-method-${id}`).value, source: $(`gv-source-${id}`).value,
          sourceReference: $(`gv-reference-${id}`).value, expiresOn: $(`gv-exp-${id}`).value,
          note: $(`gv-note-${id}`).value
        };
        button.disabled = true;
        try { await apiRequest(`/api/v1/admin/clinicians/${encodeURIComponent(id)}/licence`, 'POST', body); await paintLicences(); }
        catch (error) { fail($(`gv-lmsg-${id}`), error); }
        finally { if (button.isConnected) button.disabled = false; }
      });
    } catch (error) { fail(box, error); }
  }

  // Replace the browser-only screens when the server is there.
  const original = window.renderSafety;
  window.renderSafety = pc => {
    if (!online()) return original(pc);
    return CU.role === 'admin' ? renderAdminSafety(pc) : renderClinicianAlerts(pc);
  };
  const control = window.renderAdminControl;
  window.renderAdminControl = pc => {
    control(pc);
    if (!online()) return;
    const values = pc.querySelectorAll('.stats .sv');
    apiRequest('/api/v1/admin/clinicians').then(({ data }) => { if (values[1]) values[1].textContent = data.clinicians.filter(item => item.verification?.status === 'verified' && item.alert !== 'expired').length; }).catch(() => {});
    apiRequest('/api/v1/safety/alerts').then(({ data }) => { if (values[2]) values[2].textContent = data.open; }).catch(() => {});
    apiRequest('/api/v1/admin/consents').then(({ data }) => { if (values[3]) values[3].textContent = data.patients.filter(row => row.consents?.dataSharing).length; }).catch(() => {});
  };

  window.HFAGovernance = { renderClinicianAlerts, renderAdminSafety };
})();
