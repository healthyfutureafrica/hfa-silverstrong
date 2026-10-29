// Super Admin access to every portal.
// 1. Portal preview: the screens switch to another portal; the Super Admin stays signed in as themself.
// 2. Sign in as: doctors, nurses, pharmacies and labs only. Patients can never be entered, so their
//    health records stay private. The server enforces these rules and writes every step to its audit log.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;
  const PORTALS = [['doctor', '🩺'], ['nurse', '💉'], ['patient', '🧑'], ['pharmacist', '💊'], ['labtech', '🧪'], ['admin', '🛡️']];
  const ENTERABLE = ['doctor', 'nurse', 'pharmacist', 'labtech'];

  Object.assign(T.en, {
    pa_nav: 'Portal access', pa_title: 'Portal access', pa_intro: 'Open any portal to check it, or sign in as a staff or pharmacy account to help them. Everything is recorded in the access log.',
    pa_view_title: 'View a portal', pa_view_desc: 'See the screens of a portal as its users see them. You stay signed in as yourself, so no one else’s data is opened.',
    pa_portal_admin: 'Admin', pa_portal_doctor: 'Doctor', pa_portal_nurse: 'Nurse', pa_portal_patient: 'Patient', pa_portal_pharmacist: 'Pharmacy', pa_portal_labtech: 'Lab',
    pa_current: 'You are here',
    pa_as_title: 'Sign in as a staff or pharmacy account', pa_as_desc: 'Use the app exactly as this person, with their real data, for support. Sessions end after one hour.',
    pa_patients_protected: 'Patient accounts can’t be entered, to protect their health records.',
    pa_search: 'Search by name, role or HFA number', pa_none: 'No matching accounts.', pa_sign_in_as: 'Sign in as',
    pa_confirm_title: 'Sign in as {name}?', pa_confirm_body: 'You will see and act as this person until you return. Everything you do is recorded in the access log.',
    pa_log_title: 'Access log', pa_log_empty: 'No access recorded yet.', pa_log_preview: 'Viewed the {portal} portal', pa_log_start: 'Signed in as {name}', pa_log_stop: 'Returned from {name}',
    pa_banner_preview: 'Preview of the {portal} portal. You are signed in as Super Admin; screens only, no one else’s data.',
    pa_banner_as: 'You are signed in as {name} ({role}) on behalf of {admin}. Everything you do is recorded.',
    pa_return: 'Return to Super Admin'
  });
  Object.assign(T.fr, {
    pa_nav: 'Accès aux portails', pa_title: 'Accès aux portails', pa_intro: 'Ouvrez n’importe quel portail pour le vérifier, ou connectez-vous au compte d’un membre du personnel ou d’une pharmacie pour l’aider. Tout est consigné dans le journal d’accès.',
    pa_view_title: 'Voir un portail', pa_view_desc: 'Affichez les écrans d’un portail tels que ses utilisateurs les voient. Vous restez connecté avec votre propre compte : aucune donnée d’autrui n’est ouverte.',
    pa_portal_admin: 'Administration', pa_portal_doctor: 'Médecin', pa_portal_nurse: 'Infirmier(e)', pa_portal_patient: 'Patient', pa_portal_pharmacist: 'Pharmacie', pa_portal_labtech: 'Laboratoire',
    pa_current: 'Vous êtes ici',
    pa_as_title: 'Se connecter au compte d’un membre du personnel ou d’une pharmacie', pa_as_desc: 'Utilisez l’application exactement comme cette personne, avec ses vraies données, pour l’assister. La session prend fin au bout d’une heure.',
    pa_patients_protected: 'Les comptes patients ne peuvent pas être ouverts, afin de protéger leurs dossiers de santé.',
    pa_search: 'Rechercher par nom, rôle ou numéro HFA', pa_none: 'Aucun compte correspondant.', pa_sign_in_as: 'Se connecter en tant que',
    pa_confirm_title: 'Se connecter en tant que {name} ?', pa_confirm_body: 'Vous verrez l’application et agirez comme cette personne jusqu’à votre retour. Tout ce que vous faites est consigné dans le journal d’accès.',
    pa_log_title: 'Journal d’accès', pa_log_empty: 'Aucun accès enregistré pour le moment.', pa_log_preview: 'A consulté le portail {portal}', pa_log_start: 'S’est connecté en tant que {name}', pa_log_stop: 'Est revenu du compte de {name}',
    pa_banner_preview: 'Aperçu du portail {portal}. Vous êtes connecté en tant que super administrateur ; écrans uniquement, aucune donnée d’autrui.',
    pa_banner_as: 'Vous êtes connecté en tant que {name} ({role}) pour le compte de {admin}. Tout ce que vous faites est consigné.',
    pa_return: 'Revenir au super administrateur'
  });

  // Preview and browser-only demo state (a server "sign in as" is known from the session itself).
  const state = { preview: null, demoAs: null };
  const portalName = role => t('pa_portal_' + role);

  function serverImpersonation() { return ApiState.enabled ? window.HFA_IMPERSONATED_BY || null : null; }
  function active() { return !!(state.preview || state.demoAs || serverImpersonation()); }

  function renderBanner() {
    const main = document.getElementById('main');
    if (!main) return;
    let banner = document.getElementById('access-banner');
    const actingFor = serverImpersonation() || (state.demoAs && { name: state.demoAs.admin.name });
    const text = state.preview ? tf('pa_banner_preview', { portal: portalName(state.preview.role) })
      : actingFor && CU ? tf('pa_banner_as', { name: CU.name, role: tv(CU.role), admin: actingFor.name }) : '';
    if (!text) { banner?.remove(); return; }
    if (!banner) { banner = document.createElement('div'); banner.id = 'access-banner'; banner.className = 'access-banner'; banner.setAttribute('role', 'status'); main.prepend(banner); }
    banner.innerHTML = `<span class="ab-ic" aria-hidden="true">${state.preview ? '👁️' : '🔐'}</span><span class="ab-text">${esc(text)}</span><button type="button" class="btn bsm ab-return" onclick="PortalAccess.returnToAdmin()">${esc(t('pa_return'))}</button>`;
  }

  async function recordPreview(role) {
    if (ApiState.enabled) await apiRequest('/api/v1/admin/portal-view', 'POST', { role });
    else log('PORTAL_PREVIEW', 'User Management');
  }

  async function preview(role) {
    const admin = state.preview?.admin || CU;
    if (!isSuperAdmin(admin)) return;
    try { await recordPreview(role); }
    catch (error) { alert(error.message); return; }
    if (role === 'admin') { returnToAdmin(); return; }
    state.preview = { admin, role };
    CU = { ...admin, role, previewRole: role, assignedDoctor: null, assignedNurse: null };
    CP = 'dashboard';
    goApp();
  }

  function confirmSignInAs(id) {
    const user = G(id);
    if (!user || !ENTERABLE.includes(user.role)) return;
    openMo(`<div class="mh"><div class="mt2">${esc(tf('pa_confirm_title', { name: user.name }))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <p>${esc(t('pa_confirm_body'))}</p>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bp" onclick="PortalAccess.signInAs('${esc(user.id)}')">${esc(t('pa_sign_in_as'))}</button></div>`);
  }

  async function signInAs(id) {
    closeMo();
    const target = G(id);
    if (!target || !ENTERABLE.includes(target.role)) return;
    try {
      if (ApiState.enabled) {
        const data = await apiRequest(`/api/v1/admin/impersonate/${encodeURIComponent(id)}`, 'POST', {});
        installBackendSession(data);
      } else {
        state.demoAs = { admin: CU };
        log('SIGN_IN_AS_START', 'User Management');
        CU = target;
      }
      CP = 'dashboard';
      goApp();
    } catch (error) { alert(error.message); }
  }

  async function returnToAdmin() {
    if (state.preview) { CU = state.preview.admin; state.preview = null; }
    else if (state.demoAs) { CU = state.demoAs.admin; state.demoAs = null; log('SIGN_IN_AS_STOP', 'User Management'); }
    else if (serverImpersonation()) {
      try { installBackendSession(await apiRequest('/api/v1/admin/impersonate/stop', 'POST', {})); }
      catch (error) { alert(error.message); window.HFA_IMPERSONATED_BY = null; doLogout(); return; }
    }
    CP = 'portal-access';
    goApp();
    navigate('portal-access');
  }

  function accountRows(query) {
    const q = String(query || '').trim().toLowerCase();
    const users = DB.users.filter(user => ENTERABLE.includes(user.role) && user.status === 'active')
      .filter(user => !q || [user.name, tv(user.role), user.role, user.hfaId, user.facilityName, user.pharmacyName].filter(Boolean).some(value => String(value).toLowerCase().includes(q)))
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
    if (!users.length) return `<p class="mu">${esc(t('pa_none'))}</p>`;
    return users.map(user => `<div class="pa-row">${HFAAvatar.html(user, { size: 'md' })}
      <div class="pa-who"><strong>${esc(user.name)}</strong><span class="mu sm">${esc(tv(user.role))}${user.facilityName || user.pharmacyName ? ' · ' + esc(user.facilityName || user.pharmacyName) : ''}</span>${user.hfaId ? `<code class="code-chip">${esc(user.hfaId)}</code>` : ''}</div>
      <button type="button" class="btn bs bsm" onclick="PortalAccess.confirmSignInAs('${esc(user.id)}')">${esc(t('pa_sign_in_as'))}</button></div>`).join('');
  }

  async function logEntries() {
    if (ApiState.enabled) {
      try { return (await apiRequest('/api/v1/admin/audit')).data.entries; } catch (error) { return []; }
    }
    return DB.auditLogs.filter(entry => ['PORTAL_PREVIEW', 'SIGN_IN_AS_START', 'SIGN_IN_AS_STOP'].includes(entry.action))
      .map(entry => ({ action: entry.action, createdAt: entry.timestamp, actorName: entry.userName, targetName: '', details: {} }));
  }
  function logText(entry) {
    if (entry.action === 'PORTAL_PREVIEW') return tf('pa_log_preview', { portal: portalName(entry.details?.portal || 'admin') });
    if (entry.action === 'SIGN_IN_AS_START') return tf('pa_log_start', { name: entry.targetName || '—' });
    if (entry.action === 'SIGN_IN_AS_STOP') return tf('pa_log_stop', { name: entry.targetName || '—' });
    return entry.action;
  }

  async function renderPage(pc) {
    $('tbt').textContent = t('pa_title');
    pc.innerHTML = `<div class="page">
      <div class="ph"><h2>${esc(t('pa_title'))}</h2><p>${esc(t('pa_intro'))}</p></div>
      <div class="card mb18"><div class="ch"><div><div class="ct">${esc(t('pa_view_title'))}</div><div class="rating-note">${esc(t('pa_view_desc'))}</div></div></div>
        <div class="pa-portals">${PORTALS.map(([role, icon]) => `<button type="button" class="pa-portal${role === 'admin' ? ' current' : ''}" onclick="PortalAccess.preview('${role}')"${role === 'admin' ? ' aria-current="page"' : ''}>
          <span class="pa-ic" aria-hidden="true">${icon}</span><strong>${esc(portalName(role))}</strong>${role === 'admin' ? `<span class="mu sm">${esc(t('pa_current'))}</span>` : ''}</button>`).join('')}</div>
      </div>
      <div class="card mb18"><div class="ch"><div><div class="ct">${esc(t('pa_as_title'))}</div><div class="rating-note">${esc(t('pa_as_desc'))}</div></div></div>
        <div class="alt ai">🔒 ${esc(t('pa_patients_protected'))}</div>
        <input class="fc" type="search" id="pa-search" placeholder="${esc(t('pa_search'))}" aria-label="${esc(t('pa_search'))}">
        <div class="pa-list" id="pa-list">${accountRows('')}</div>
      </div>
      <div class="card"><div class="ch"><div class="ct">${esc(t('pa_log_title'))}</div></div><div id="pa-log" class="mu">…</div></div>
    </div>`;
    document.getElementById('pa-search').addEventListener('input', event => { document.getElementById('pa-list').innerHTML = accountRows(event.target.value); });
    const entries = await logEntries();
    const box = document.getElementById('pa-log');
    if (!box) return;
    box.classList.remove('mu');
    box.innerHTML = entries.length ? `<div class="fac-table-wrap"><table class="fac-table"><tbody>${entries.slice(0, 30).map(entry => `<tr><td class="mu sm" style="white-space:nowrap">${esc(String(entry.createdAt || '').replace('T', ' ').slice(0, 16))}</td><td>${esc(entry.actorName || '')}</td><td>${esc(logText(entry))}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="mu">${esc(t('pa_log_empty'))}</p>`;
  }

  // Signing out from a preview or a demo "sign in as" also ends that state.
  function reset() { state.preview = null; state.demoAs = null; window.HFA_IMPERSONATED_BY = null; document.getElementById('access-banner')?.remove(); }

  window.PortalAccess = { preview, confirmSignInAs, signInAs, returnToAdmin, renderPage, renderBanner, active, reset };
})();
