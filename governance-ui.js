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
    gv_licences_title: 'Clinician licence register', gv_licences_intro: 'Check each licence with the Ordre National des Médecins du Cameroun or the nursing council, then record it with its expiry date.',
    gv_no_licence: 'No licence number on file', gv_unverified: 'Not verified', gv_expired: 'Expired', gv_expiring: 'Expires in {days} days', gv_rejected: 'Not valid', gv_valid_until: 'Valid until {date}',
    gv_verify: 'Verify', gv_reject: 'Not valid', gv_expiry: 'Expiry date', gv_no_profile: 'Health profile not completed'
  });
  Object.assign(T.fr, {
    gv_nav: 'Sécurité des médicaments', gv_alerts_title: 'Alertes de sécurité des médicaments', gv_alerts_intro: 'Les allergies enregistrées de vos patients comparées à leurs médicaments, à vos plans et aux commandes en pharmacie. Vérifiez chacune et notez votre décision.',
    gv_no_alerts: 'Aucun conflit d’allergie trouvé pour vos patients.', gv_allergy: 'Allergie : {allergy} (enregistrée comme « {recorded} »)', gv_drug: 'Médicament : {drug}',
    gv_source_profile_medication: 'Dans la liste de médicaments du patient', gv_source_doctor_report: 'Dans un plan de consultation', gv_source_pharmacy_order: 'Dans une commande en pharmacie',
    gv_resolve: 'Marquer comme vérifié', gv_resolve_note: 'Qu’avez-vous décidé ? (ex. médicament arrêté, allergie non confirmée)', gv_resolved: 'Vérifié par {name}',
    gv_oversight: 'Alertes ouvertes : {open} ({critical} critiques) · résolues : {resolved}. Seuls les soignants des patients voient les détails.',
    gv_consents_title: 'Registre des consentements', gv_consents_intro: 'Les choix actuels de chaque patient, avec la date et la version du consentement.', gv_no_patients: 'Aucun patient pour l’instant.',
    gv_c_dataSharing: 'Équipe de soins', gv_c_research: 'Recherche', gv_c_ministry: 'Statistiques du Ministère', gv_c_sms: 'SMS', gv_c_whatsapp: 'WhatsApp', gv_changes: '{n} changements',
    gv_licences_title: 'Registre des licences des soignants', gv_licences_intro: 'Vérifiez chaque licence auprès de l’Ordre National des Médecins du Cameroun ou de l’ordre infirmier, puis enregistrez-la avec sa date d’expiration.',
    gv_no_licence: 'Aucun numéro de licence', gv_unverified: 'Non vérifiée', gv_expired: 'Expirée', gv_expiring: 'Expire dans {days} jours', gv_rejected: 'Non valable', gv_valid_until: 'Valable jusqu’au {date}',
    gv_verify: 'Vérifier', gv_reject: 'Non valable', gv_expiry: 'Date d’expiration', gv_no_profile: 'Profil de santé non complété'
  });

  for (const role of ['doctor', 'nurse']) NAV[role][0]?.items.push({ id: 'safety', l: () => t('gv_nav'), i: 'shield' });

  const yesNo = value => value === true ? '✅' : value === false ? '—' : '·';
  const fail = (box, error) => { if (box) box.innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; };

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
    if (item.alert === 'expiring') return `<span class="badge bwa">${esc(tf('gv_expiring', { days: item.daysToExpiry }))}</span>`;
    return `<span class="badge bsu">${esc(tf('gv_valid_until', { date: item.verification.expiresOn }))}</span>`;
  }

  async function renderAdminSafety(pc) {
    $('tbt').textContent = t('safety_nav');
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${t('safety_title')}</h2><p>${t('safety_sub')}</p></div>
      <div class="card mb18"><div class="ch"><div class="ct">${t('med_alerts_title')}</div></div><div id="gv-oversight"><p class="mu sm">…</p></div></div>
      <div class="card mb18"><div class="ch"><div class="ct">${esc(t('gv_licences_title'))}</div></div><p class="mu sm">${esc(t('gv_licences_intro'))}</p><div class="tw" id="gv-licences"><p class="mu sm">…</p></div></div>
      <div class="card"><div class="ch"><div class="ct">${esc(t('gv_consents_title'))}</div></div><p class="mu sm">${esc(t('gv_consents_intro'))}</p><div class="tw" id="gv-consents"><p class="mu sm">…</p></div></div></div>`;
    apiRequest('/api/v1/safety/alerts').then(({ data }) => { const box = $('gv-oversight'); if (box) box.innerHTML = `<p class="sm">${esc(tf('gv_oversight', data))}</p>`; }).catch(error => fail($('gv-oversight'), error));
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
        <td>${item.licenseNo ? `<div class="pc-actions" style="margin-top:0;align-items:center"><label class="sr-only" for="gv-exp-${esc(item.id)}">${esc(t('gv_expiry'))}</label><input class="fc" type="date" min="${tomorrow}" id="gv-exp-${esc(item.id)}" style="max-width:170px" value="${esc(item.verification?.expiresOn || '')}">
          <button class="btn bp bsm" data-licence="${esc(item.id)}" data-status="verified">${esc(t('gv_verify'))}</button><button class="btn bd2 bsm" data-licence="${esc(item.id)}" data-status="rejected">${esc(t('gv_reject'))}</button></div><div id="gv-lmsg-${esc(item.id)}"></div>` : ''}</td></tr>`).join('')}</tbody></table>` : `<p class="mu sm">—</p>`;
      box.querySelectorAll('[data-licence]').forEach(button => button.onclick = async () => {
        const id = button.dataset.licence, expiresOn = $(`gv-exp-${id}`).value;
        try { await apiRequest(`/api/v1/admin/clinicians/${encodeURIComponent(id)}/licence`, 'POST', { status: button.dataset.status, ...(expiresOn ? { expiresOn } : {}) }); paintLicences(); }
        catch (error) { fail($(`gv-lmsg-${id}`), error); }
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
