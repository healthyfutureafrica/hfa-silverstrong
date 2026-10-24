// Server-backed versions of features that used to live in one browser only, for real people on the HFA server:
// - notifications reach the other person on their own device (backend/notify.js);
// - "Forgot password?": a one-time code from the clinic, set by an administrator (backend/account-recovery.js);
// - identity documents go to the server, and administrators verify them;
// - doctor portraits are approved by an administrator before patients see them (backend/doctor-photos.js);
// - Free Health Hub statistics are anonymous counts on the server (backend/hub-stats.js).
// Without the server (public website) the original screens keep working as before.
(function () {
  const esc = window.hfaEscape;
  const online = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline;

  Object.assign(T.en, {
    rw_forgot: 'Forgot password?', rw_forgot_title: 'Reset your password', rw_forgot_body: 'Call or visit your clinic or HFA. After checking who you are, they give you a one-time reset code (valid 30 minutes). Enter it here with a new password.',
    rw_code: 'Reset code', rw_new_pw: 'New password (at least 12 characters)', rw_reset_btn: 'Set new password', rw_reset_done: 'Password changed. Sign in with your new password.',
    rw_reset_code_btn: 'Create password reset code', rw_reset_code_title: 'One-time reset code', rw_reset_code_body: 'Give this code to the person only after checking who they are (CNI, phone number on file). It works once, for 30 minutes.',
    rw_id_title: 'Identity documents to verify', rw_id_none: 'No identity documents waiting.', rw_id_open: 'Open document', rw_verify: 'Verified', rw_reject_id: 'Not valid',
    rw_hub_note: 'Anonymous counts from everyone who used the Free Health Hub in the last 30 days. No names, accounts or search words are kept.'
  });
  Object.assign(T.fr, {
    rw_forgot: 'Mot de passe oublié ?', rw_forgot_title: 'Réinitialiser votre mot de passe', rw_forgot_body: 'Appelez ou rendez-vous à votre clinique ou chez HFA. Après avoir vérifié votre identité, on vous donne un code de réinitialisation à usage unique (valable 30 minutes). Saisissez-le ici avec un nouveau mot de passe.',
    rw_code: 'Code de réinitialisation', rw_new_pw: 'Nouveau mot de passe (au moins 12 caractères)', rw_reset_btn: 'Enregistrer le nouveau mot de passe', rw_reset_done: 'Mot de passe changé. Connectez-vous avec votre nouveau mot de passe.',
    rw_reset_code_btn: 'Créer un code de réinitialisation', rw_reset_code_title: 'Code de réinitialisation à usage unique', rw_reset_code_body: 'Donnez ce code à la personne uniquement après avoir vérifié son identité (CNI, numéro enregistré). Il fonctionne une fois, pendant 30 minutes.',
    rw_id_title: 'Pièces d’identité à vérifier', rw_id_none: 'Aucune pièce d’identité en attente.', rw_id_open: 'Ouvrir le document', rw_verify: 'Vérifiée', rw_reject_id: 'Non valable',
    rw_hub_note: 'Chiffres anonymes de toutes les personnes ayant utilisé l’Espace Santé gratuit ces 30 derniers jours. Aucun nom, compte ni mot recherché n’est conservé.'
  });

  const wrap = (name, replacement) => { const original = window[name]; if (typeof original === 'function') window[name] = (...args) => replacement(original, ...args); };
  const putUser = user => { const index = DB.users.findIndex(item => item.id === user.id); if (index >= 0) DB.users[index] = { ...DB.users[index], ...user }; if (CU?.id === user.id) Object.assign(CU, user); };

  // ───── Notifications to the other person ─────
  wrap('notifyUser', (original, userId, message, resource = 'Lab Results', meta = {}) => {
    if (!online() || !userId || userId === CU?.id) return original(userId, message, resource, meta);
    apiRequest('/api/v1/notify', 'POST', { to: userId, resource, eventId: crypto.randomUUID() }).catch(() => {});
  });

  // ───── Free Health Hub statistics ─────
  wrap('fhTrack', (original, type, payload = {}) => {
    original(type, payload);
    if (!ApiState.enabled || ApiState.offline || !['view', 'search', 'cta'].includes(type)) return;
    apiRequest('/api/v1/hub/events', 'POST', { type, topic: String(payload.topicId || '').replace(/[^a-z0-9_-]/g, '').slice(0, 60), lang: LANG === 'fr' ? 'fr' : 'en' }).catch(() => {});
  });
  wrap('renderFhAnalytics', (original, pc) => {
    if (!online() || CU?.role !== 'admin') return original(pc);
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${t('fh_analytics_title')}</h2><p>${esc(t('rw_hub_note'))}</p></div><div id="rw-hub"><div class="card"><p class="mu sm">…</p></div></div></div>`;
    apiRequest('/api/v1/admin/hub-stats').then(({ data }) => {
      const box = $('rw-hub'); if (!box) return;
      const total = type => data.rows.filter(row => row.type === type).reduce((sum, row) => sum + row.count, 0);
      const topics = {};
      data.rows.filter(row => row.type === 'view' && row.topic).forEach(row => { topics[row.topic] = (topics[row.topic] || 0) + row.count; });
      const top = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 10), max = top[0]?.[1] || 1;
      box.innerHTML = `<div class="stats"><div class="sc ce"><div class="sv">${total('view')}</div><div class="sl">${t('fh_total_views')}</div></div><div class="sc cb"><div class="sv">${total('search')}</div><div class="sl">${t('fh_total_searches')}</div></div><div class="sc cg"><div class="sv">${total('cta')}</div><div class="sl">${t('fh_total_cta')}</div></div></div>
        <div class="card"><div class="ch"><div class="ct">${t('fh_top_topics')}</div></div>${top.length ? top.map(([id, count]) => { const topic = FREE_HEALTH_TOPICS.find(item => item.id === id); return `<div class="goal-row"><div style="flex:1"><div class="bo sm">${esc(topic ? fhL(topic.name) : id)}</div><div class="goal-progress"><span style="width:${Math.round(count / max * 100)}%"></span></div></div><span class="mu sm">${count}</span></div>`; }).join('') : `<div class="rating-empty">${t('fh_no_activity')}</div>`}</div>`;
    }).catch(error => { const box = $('rw-hub'); if (box) box.innerHTML = `<div class="card"><div class="alt ae">${esc(error.message)}</div></div>`; });
  });

  // ───── Identity documents ─────
  wrap('idVerificationCard', original => {
    if (!online()) return original();
    const status = CU.idVerificationStatus || (CU.idDocument ? 'pending' : null);
    const label = status === 'verified' ? t('id_status_verified') : status === 'pending' ? t('id_status_pending') : t('id_status_not_uploaded');
    return `<div class="card mt18"><div class="ch"><div><div class="ct">${t('id_verification_title')}</div><div class="rating-note">${t('id_verification_desc')}</div></div><span class="badge ${status === 'verified' ? 'bsu' : status === 'pending' ? 'bwa' : 'bda'}">${esc(label)}</span></div>
      ${['national_id', 'passport'].includes(CU.idDocumentType) ? `<div class="bo sm" style="margin-bottom:4px">${t('id_type_label')}: ${t('id_type_' + CU.idDocumentType)}</div>` : ''}
      ${CU.idDocument ? `<div class="mu sm" style="margin-bottom:8px">${esc(CU.idDocument.fileName)} · ${t('id_uploaded_on')} ${esc(String(CU.idUploadedAt || '').slice(0, 10))}</div>` : ''}
      <button class="btn bp bsm" onclick="showIdUpload()">${CU.idDocument ? t('replace_id_document') : t('upload_id_document')}</button></div>`;
  });
  wrap('saveIdUpload', async original => {
    if (!online()) return original();
    const input = $('pf-id'), type = $('pf-id-type').value, note = text => { $('pf-id-status').textContent = text; };
    if (!['national_id', 'passport'].includes(type)) return note(t('id_type_required'));
    if (!input?.files.length) return note(t('id_required'));
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) return note(t('photo_file_required'));
    const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    try {
      const { user } = await apiRequest('/api/v1/account/id-document', 'POST', { idDocumentType: type, idDocument: { fileName: file.name.replace(/[<>\u0000-\u001f/\\]/g, '_').slice(0, 180), content } }, 60000);
      putUser(user); log('UPLOAD_ID_DOCUMENT', 'Identity Verification'); closeMo(); navigate(CP);
    } catch (error) { note(error.message); }
  });

  // ───── Doctor portraits ─────
  wrap('approvedDoctorPhoto', (original, doctor) => {
    if (!ApiState.enabled) return original(doctor);
    return doctor?.doctorPhotoApprovedAt ? `/api/v1/users/${encodeURIComponent(doctor.id)}/doctor-photo?v=${encodeURIComponent(doctor.doctorPhotoApprovedAt)}` : null;
  });
  wrap('doctorPhotoCard', original => {
    if (!online()) return original();
    const status = CU.doctorPhotoStatus;
    return `<div class="card mt18"><div class="ch"><div class="ct">${t('doctor_profile_photo')}</div>${doctorPortrait(CU)}</div>
      ${status ? `<p class="mu sm mb12">${t(status === 'pending' ? 'photo_pending' : status === 'rejected' ? 'photo_rejected' : 'approved_doctor_photo')}</p>` : ''}
      <button class="btn bs" onclick="showDoctorPhotoUpload()">${IC.file} ${t('upload_profile_photo')}</button></div>`;
  });
  wrap('saveDoctorPhoto', async original => {
    if (!online()) return original();
    const file = $('doctor-photo-file')?.files[0], status = $('doctor-photo-status');
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { status.textContent = t('photo_file_required'); return; }
    const content = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    try { const { data } = await apiRequest('/api/v1/doctor-photo', 'POST', { content }, 60000); putUser(data.user); log('SUBMIT_DOCTOR_PHOTO', 'Profile Photos'); closeMo(); navigate(CP); }
    catch (error) { status.textContent = error.message; }
  });
  wrap('doctorPhotoReviewPanel', original => {
    if (!online()) return original();
    if (CU.role !== 'admin') return '';
    const doctors = DB.users.filter(user => user.role === 'doctor' && user.doctorPhotoStatus === 'pending');
    return `<section class="mt18"><h3 class="ct mb12">${t('doctor_photo_reviews')}</h3>${doctors.length ? doctors.map(doctor => `<div class="ai2 mb12"><img class="doctor-photo-preview" src="/api/v1/admin/doctor-photos/${encodeURIComponent(doctor.id)}" alt="${t('photo_pending')}"><div class="adi"><strong>${esc(doctor.name)}</strong><div class="mu sm">${esc(tv(doctor.specialty || ''))}</div></div><div class="aac"><button class="btn bp bsm" onclick="reviewDoctorPhoto('${esc(doctor.id)}',true)">${IC.chk} ${t('approve')}</button><button class="btn bd2 bsm" onclick="reviewDoctorPhoto('${esc(doctor.id)}',false)">${IC.x} ${t('reject')}</button></div></div>`).join('') : `<p class="mu sm">${t('no_photo_reviews')}</p>`}</section>`;
  });
  wrap('reviewDoctorPhoto', async (original, doctorId, approve) => {
    if (!online()) return original(doctorId, approve);
    try { const { data } = await apiRequest(`/api/v1/admin/doctor-photos/${encodeURIComponent(doctorId)}`, 'POST', { approve }); putUser(data.user); navigate(CP); }
    catch (error) { alert(error.message); }
  });
  // The approvals count also includes doctor portraits and identity documents waiting on the server.
  wrap('pendingApprovalsCount', original => {
    if (!online()) return original();
    const accounts = DB.users.filter(user => ['doctor', 'nurse', 'pharmacist'].includes(user.role) && user.status === 'pending_approval').length;
    return accounts + DB.users.filter(user => user.doctorPhotoStatus === 'pending' || (user.idVerificationStatus === 'pending' && user.idDocument && user.role !== 'admin')).length;
  });

  // Identity documents waiting on the approvals page.
  wrap('renderApprovals', (original, pc) => {
    original(pc);
    if (!online() || CU?.role !== 'admin') return;
    const waiting = DB.users.filter(user => user.idVerificationStatus === 'pending' && user.idDocument && user.role !== 'admin');
    pc.querySelector('.page')?.insertAdjacentHTML('beforeend', `<div class="card mt18"><div class="ch"><div class="ct">${esc(t('rw_id_title'))}</div></div>${waiting.length ? waiting.map(user => `<div class="pc-row"><div><strong>${esc(user.name)}</strong> <span class="mu sm">· ${esc(tv(user.role))} · ${esc(t('id_type_' + (user.idDocumentType || 'national_id')))}</span></div>
      <div class="pc-actions" style="margin-top:0"><a class="btn bs bsm" href="/api/admin/users/${encodeURIComponent(user.id)}/documents/identity" target="_blank" rel="noopener">${esc(t('rw_id_open'))}</a>
      <button class="btn bp bsm" onclick="backendAdminUpdate('${esc(user.id)}',{idVerificationStatus:'verified'})">${IC.chk} ${esc(t('rw_verify'))}</button>
      <button class="btn bd2 bsm" onclick="backendAdminUpdate('${esc(user.id)}',{idVerificationStatus:'rejected'})">${IC.x} ${esc(t('rw_reject_id'))}</button></div></div>`).join('') : `<p class="mu sm">${esc(t('rw_id_none'))}</p>`}</div>`);
  });

  // ───── Password reset ─────
  wrap('showEditUser', (original, id) => {
    original(id);
    const user = G(id);
    if (!online() || CU?.role !== 'admin' || !user || user.role === 'admin') return;
    $('mbox')?.insertAdjacentHTML('beforeend', `<div class="mt18"><button type="button" class="btn bs bsm" id="rw-reset-code">🔑 ${esc(t('rw_reset_code_btn'))}</button><div id="rw-reset-out" class="mt8"></div></div>`);
    $('rw-reset-code').onclick = async () => {
      try {
        const { data } = await apiRequest(`/api/v1/admin/users/${encodeURIComponent(id)}/reset-code`, 'POST', {});
        $('rw-reset-out').innerHTML = `<div class="alt ao"><strong>${esc(t('rw_reset_code_title'))}:</strong> <code class="code-chip" style="font-size:1.1rem">${esc(data.code)}</code><br><span class="sm">${esc(t('rw_reset_code_body'))}</span></div>`;
      } catch (error) { $('rw-reset-out').innerHTML = `<div class="alt ae">${esc(error.message)}</div>`; }
    };
  });

  function showForgot() {
    if (!ApiState.enabled) return typeof showAccountsUnavailable === 'function' ? showAccountsUnavailable() : null;
    openMo(`<div class="mh"><div class="mt2">${esc(t('rw_forgot_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <p class="mu sm mb12">${esc(t('rw_forgot_body'))}</p>
      <div class="fg"><label class="fl" for="rw-login">${esc($('lbl-email')?.textContent || 'Email')}</label><input class="fc" id="rw-login" autocomplete="username" value="${esc($('le')?.value || '')}"></div>
      <div class="fg"><label class="fl" for="rw-code">${esc(t('rw_code'))}</label><input class="fc" id="rw-code" autocomplete="one-time-code" placeholder="XXXX-XXXX" maxlength="12"></div>
      <div class="fg"><label class="fl" for="rw-pw">${esc(t('rw_new_pw'))}</label><input class="fc" id="rw-pw" type="password" autocomplete="new-password" minlength="12" maxlength="128"></div>
      <div id="rw-msg" aria-live="polite"></div>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bp" id="rw-reset">${esc(t('rw_reset_btn'))}</button></div>`);
    $('rw-reset').onclick = async () => {
      const login = $('rw-login').value.trim(), code = $('rw-code').value.trim(), password = $('rw-pw').value;
      const show = (text, kind) => { $('rw-msg').innerHTML = `<div class="alt ${kind}">${esc(text)}</div>`; };
      if (password.length < 12) return show(t('sec_pw_short'), 'ae');
      try {
        await apiRequest('/api/auth/reset-password', 'POST', { email: !login.includes('@') && typeof HFAPatientRegistration !== 'undefined' ? HFAPatientRegistration.normPhone(login) : login, code, newPassword: password });
        closeMo(); if ($('le')) $('le').value = login; amsg(t('rw_reset_done'), 'o');
      } catch (error) { show(error.message, 'ae'); }
    };
  }
  // "Forgot password?" under the sign-in button.
  const form = document.getElementById('fl');
  form?.querySelector(':scope > .btn.bp')?.insertAdjacentHTML('afterend', `<button type="button" class="btn bgh w100 mt8" id="rw-forgot" data-i18n="rw_forgot">${esc(t('rw_forgot'))}</button>`);
  document.getElementById('rw-forgot')?.addEventListener('click', showForgot);

  window.HFARealWorld = { showForgot };
})();
