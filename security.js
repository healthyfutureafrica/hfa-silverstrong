// Account security for every user: change password and two-step sign-in (authenticator app codes).
// Administrators are taken to this page until two-step sign-in is on; the server enforces the same rule.
(function () {
  const esc = window.hfaEscape, tf = window.hfaFormat;

  Object.assign(T.en, {
    sec_nav: 'Account security', sec_title: 'Account security', sec_intro: 'Protect your account: use a strong password and turn on two-step sign-in.',
    sec_pw_title: 'Change password', sec_pw_current: 'Current password', sec_pw_new: 'New password', sec_pw_confirm: 'Repeat the new password',
    sec_pw_rules: 'At least 12 characters. Three or four unrelated words work well, e.g. “mango river lantern 47”. Avoid your name, email and common passwords.',
    sec_pw_save: 'Change password', sec_pw_saving: 'Saving…', sec_pw_done: 'Password changed. Your other devices have been signed out.',
    sec_pw_short: 'Use at least 12 characters', sec_pw_mismatch: 'The two new passwords do not match', sec_pw_same: 'Choose a password different from your current one',
    sec_mfa_title: 'Two-step sign-in', sec_mfa_on: 'On since {date}. Signing in needs your password and a code from your authenticator app.',
    sec_mfa_off: 'Off. Turn it on so that a stolen password alone cannot open your account.',
    sec_mfa_admin_required: 'Administrators must turn on two-step sign-in before using admin tools.',
    sec_mfa_start: 'Turn on two-step sign-in',
    sec_mfa_step1: '1. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or similar).',
    sec_mfa_step2: '2. In the app, add an account and scan this code:', sec_mfa_manual: 'Can’t scan? Enter this key in the app instead:',
    sec_mfa_step3: '3. Type the 6-digit code the app shows:', sec_mfa_code: '6-digit code', sec_mfa_confirm: 'Confirm and turn on',
    sec_mfa_recovery_title: 'Save your recovery codes', sec_mfa_recovery_body: 'If you lose your phone, each of these codes lets you sign in once. Write them down or store them somewhere safe. They will not be shown again.',
    sec_mfa_copy: 'Copy codes', sec_mfa_copied: 'Copied', sec_mfa_saved: 'I have saved my codes',
    sec_mfa_disable: 'Turn off', sec_mfa_disable_title: 'Turn off two-step sign-in', sec_mfa_disable_body: 'Enter your password and a current code to turn it off.',
    sec_mfa_demo: 'Two-step sign-in works when the app is connected to the HFA server.',
    sec_login_code_title: 'Enter your sign-in code', sec_login_code_body: 'Open your authenticator app and type the 6-digit code for HFA SilverStrong.',
    sec_login_recovery: 'Lost your phone? Type one of your recovery codes instead.', sec_login_verify: 'Verify', sec_login_back: 'Back',
    sec_login_email: 'Phone unavailable? Send a code to {email}', sec_login_email_sent: 'We sent a 6-digit code to {email}. Type it below; it works once, for 10 minutes. Check your spam folder if it has not arrived.',
    sec_login_email_wait: 'Send another code in {seconds} s', sec_login_email_again: 'Send another code by email',
    sec_mfa_email_ready: 'Backup if your phone is unavailable: a sign-in code by email to {email}.',
    sec_mfa_email_off: 'Backup by email: not set up yet. The server needs an email service (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM in .env).'
  });
  Object.assign(T.fr, {
    sec_nav: 'Sécurité du compte', sec_title: 'Sécurité du compte', sec_intro: 'Protégez votre compte : utilisez un mot de passe solide et activez la connexion en deux étapes.',
    sec_pw_title: 'Changer le mot de passe', sec_pw_current: 'Mot de passe actuel', sec_pw_new: 'Nouveau mot de passe', sec_pw_confirm: 'Répétez le nouveau mot de passe',
    sec_pw_rules: 'Au moins 12 caractères. Trois ou quatre mots sans lien fonctionnent bien, par ex. « mangue rivière lanterne 47 ». Évitez votre nom, votre e-mail et les mots de passe courants.',
    sec_pw_save: 'Changer le mot de passe', sec_pw_saving: 'Enregistrement…', sec_pw_done: 'Mot de passe changé. Vos autres appareils ont été déconnectés.',
    sec_pw_short: 'Utilisez au moins 12 caractères', sec_pw_mismatch: 'Les deux nouveaux mots de passe ne correspondent pas', sec_pw_same: 'Choisissez un mot de passe différent de l’actuel',
    sec_mfa_title: 'Connexion en deux étapes', sec_mfa_on: 'Activée depuis le {date}. La connexion demande votre mot de passe et un code de votre application d’authentification.',
    sec_mfa_off: 'Désactivée. Activez-la pour qu’un mot de passe volé ne suffise pas à ouvrir votre compte.',
    sec_mfa_admin_required: 'Les administrateurs doivent activer la connexion en deux étapes avant d’utiliser les outils d’administration.',
    sec_mfa_start: 'Activer la connexion en deux étapes',
    sec_mfa_step1: '1. Installez une application d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator ou similaire).',
    sec_mfa_step2: '2. Dans l’application, ajoutez un compte et scannez ce code :', sec_mfa_manual: 'Impossible de scanner ? Saisissez plutôt cette clé dans l’application :',
    sec_mfa_step3: '3. Saisissez le code à 6 chiffres affiché par l’application :', sec_mfa_code: 'Code à 6 chiffres', sec_mfa_confirm: 'Confirmer et activer',
    sec_mfa_recovery_title: 'Conservez vos codes de secours', sec_mfa_recovery_body: 'Si vous perdez votre téléphone, chacun de ces codes permet de vous connecter une fois. Notez-les ou rangez-les en lieu sûr. Ils ne seront plus affichés.',
    sec_mfa_copy: 'Copier les codes', sec_mfa_copied: 'Copiés', sec_mfa_saved: 'J’ai conservé mes codes',
    sec_mfa_disable: 'Désactiver', sec_mfa_disable_title: 'Désactiver la connexion en deux étapes', sec_mfa_disable_body: 'Saisissez votre mot de passe et un code actuel pour la désactiver.',
    sec_mfa_demo: 'La connexion en deux étapes fonctionne lorsque l’application est connectée au serveur HFA.',
    sec_login_code_title: 'Saisissez votre code de connexion', sec_login_code_body: 'Ouvrez votre application d’authentification et saisissez le code à 6 chiffres pour HFA SilverStrong.',
    sec_login_recovery: 'Téléphone perdu ? Saisissez plutôt un de vos codes de secours.', sec_login_verify: 'Vérifier', sec_login_back: 'Retour',
    sec_login_email: 'Téléphone indisponible ? Envoyer un code à {email}', sec_login_email_sent: 'Nous avons envoyé un code à 6 chiffres à {email}. Saisissez-le ci-dessous ; il est valable une fois, pendant 10 minutes. Vérifiez vos courriers indésirables s’il n’est pas arrivé.',
    sec_login_email_wait: 'Nouveau code possible dans {seconds} s', sec_login_email_again: 'Envoyer un autre code par e-mail',
    sec_mfa_email_ready: 'Secours si votre téléphone est indisponible : un code de connexion par e-mail à {email}.',
    sec_mfa_email_off: 'Secours par e-mail : pas encore configuré. Le serveur a besoin d’un service e-mail (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM dans .env).'
  });

  const needsMfa = () => ApiState.enabled && ApiState.requireAdminMfa && CU?.role === 'admin' && !CU.mfaEnabled && !window.HFA_IMPERSONATED_BY;
  const field = (id, label, type = 'password', attrs = '') => `<div class="fg"><label class="fl" for="${id}">${esc(label)}</label><input class="fc" id="${id}" type="${type}" ${attrs}></div>`;
  const message = (id, text, kind = 'ae') => { const box = document.getElementById(id); if (box) box.innerHTML = text ? `<div class="alt ${kind}" role="${kind === 'ae' ? 'alert' : 'status'}">${esc(text)}</div>` : ''; };

  // Browser-only demo: the new password is kept as a PBKDF2 hash, like the built-in demo accounts.
  async function demoHash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iterations = 210000;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
    const b64 = bytes => btoa(String.fromCharCode(...bytes));
    return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(bits)}`;
  }

  function mfaCard() {
    if (!ApiState.enabled) return `<p class="mu">${esc(t('sec_mfa_demo'))}</p>`;
    if (CU.mfaEnabled) {
      const canDisable = !(CU.role === 'admin' && ApiState.requireAdminMfa);
      return `<p>✅ ${esc(tf('sec_mfa_on', { date: String(CU.mfaEnabledAt || '').slice(0, 10) || '—' }))}</p>${canDisable ? `<button type="button" class="btn bs bsm mt8" onclick="HFASecurity.showDisable()">${esc(t('sec_mfa_disable'))}</button>` : ''}`;
    }
    return `${needsMfa() ? `<div class="alt ae">${esc(t('sec_mfa_admin_required'))}</div>` : ''}<p class="mu">${esc(t('sec_mfa_off'))}</p>
      <div id="sec-mfa-flow"><button type="button" class="btn bp mt8" onclick="HFASecurity.startSetup()">${esc(t('sec_mfa_start'))}</button></div>`;
  }

  function renderPage(pc) {
    $('tbt').textContent = t('sec_title');
    pc.innerHTML = `<div class="page sec-page">
      <div class="ph"><h2>${esc(t('sec_title'))}</h2><p>${esc(t('sec_intro'))}</p></div>
      <div class="card mb18" id="sec-mfa-card"><div class="ch"><div class="ct">🔐 ${esc(t('sec_mfa_title'))}</div></div>${mfaCard()}</div>
      <div class="card"><div class="ch"><div class="ct">🔑 ${esc(t('sec_pw_title'))}</div></div>
        <form id="sec-pw-form" novalidate>
          ${field('sec-pw-current', t('sec_pw_current'), 'password', 'autocomplete="current-password" required')}
          ${field('sec-pw-new', t('sec_pw_new'), 'password', 'autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="sec-pw-rules"')}
          <p class="mu sm" id="sec-pw-rules">${esc(t('sec_pw_rules'))}</p>
          ${field('sec-pw-confirm', t('sec_pw_confirm'), 'password', 'autocomplete="new-password" required')}
          <div id="sec-pw-msg"></div>
          <button type="submit" class="btn bp" id="sec-pw-save">${esc(t('sec_pw_save'))}</button>
        </form>
      </div>
    </div>`;
    document.getElementById('sec-pw-form').addEventListener('submit', changePassword);
    if (ApiState.enabled && CU.role === 'admin' && !window.HFA_IMPERSONATED_BY) {
      apiRequest('/api/v1/account/mfa/email-backup').then(status => {
        document.getElementById('sec-mfa-card')?.insertAdjacentHTML('beforeend', `<p class="mu sm mt8" id="sec-mfa-email">✉️ ${esc(status.sentTo ? tf('sec_mfa_email_ready', { email: status.sentTo }) : t('sec_mfa_email_off'))}</p>`);
      }).catch(() => {});
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    const current = $('sec-pw-current').value, next = $('sec-pw-new').value, confirmation = $('sec-pw-confirm').value;
    if (next.length < 12) return message('sec-pw-msg', t('sec_pw_short'));
    if (next !== confirmation) return message('sec-pw-msg', t('sec_pw_mismatch'));
    if (next === current) return message('sec-pw-msg', t('sec_pw_same'));
    const button = $('sec-pw-save'); button.disabled = true; button.textContent = t('sec_pw_saving');
    try {
      if (ApiState.enabled) {
        const result = await apiRequest('/api/v1/account/password', 'POST', { currentPassword: current, newPassword: next });
        Object.assign(CU, result.data.user);
        if (typeof HFAOffline !== 'undefined') await HFAOffline.afterOnlineLogin(CU, next); // offline sign-in uses the new password too
      } else {
        if (!(await demoPasswordMatches(CU, current))) throw new Error(t('invalid_creds'));
        CU.passwordHash = await demoHash(next); delete CU.password;
        log('PASSWORD_CHANGED', 'Account');
      }
      $('sec-pw-form').reset();
      message('sec-pw-msg', t('sec_pw_done'), 'ao');
    } catch (error) { message('sec-pw-msg', error.message); }
    finally { button.disabled = false; button.textContent = t('sec_pw_save'); }
  }

  async function startSetup() {
    const flow = document.getElementById('sec-mfa-flow');
    try {
      const setup = await apiRequest('/api/v1/account/mfa/setup', 'POST', {});
      flow.innerHTML = `<ol class="sec-steps">
        <li>${esc(t('sec_mfa_step1'))}</li>
        <li>${esc(t('sec_mfa_step2'))}<div class="sec-qr">${setup.qrSvg}</div><p class="mu sm">${esc(t('sec_mfa_manual'))}</p><code class="code-chip sec-key">${esc(setup.secret)}</code></li>
        <li>${esc(t('sec_mfa_step3'))}${field('sec-mfa-code', t('sec_mfa_code'), 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*"')}</li>
      </ol><div id="sec-mfa-msg"></div><button type="button" class="btn bp" onclick="HFASecurity.confirmSetup()">${esc(t('sec_mfa_confirm'))}</button>`;
      document.getElementById('sec-mfa-code').focus();
    } catch (error) { flow.insertAdjacentHTML('beforeend', `<div class="alt ae">${esc(error.message)}</div>`); }
  }

  async function confirmSetup() {
    try {
      const result = await apiRequest('/api/v1/account/mfa/enable', 'POST', { code: $('sec-mfa-code').value });
      Object.assign(CU, result.user);
      const codes = result.recoveryCodes;
      document.getElementById('sec-mfa-flow').innerHTML = `<div class="sec-recovery"><h3>${esc(t('sec_mfa_recovery_title'))}</h3><p>${esc(t('sec_mfa_recovery_body'))}</p>
        <ul class="sec-codes">${codes.map(code => `<li><code>${esc(code)}</code></li>`).join('')}</ul>
        <div class="pc-actions"><button type="button" class="btn bs" id="sec-copy">${esc(t('sec_mfa_copy'))}</button><button type="button" class="btn bp" onclick="buildSidebar();navigate('security')">${esc(t('sec_mfa_saved'))}</button></div></div>`;
      document.getElementById('sec-copy').addEventListener('click', event => {
        navigator.clipboard?.writeText(codes.join('\n')).then(() => { event.target.textContent = t('sec_mfa_copied'); }).catch(() => {});
      });
    } catch (error) { message('sec-mfa-msg', error.message); }
  }

  function showDisable() {
    openMo(`<div class="mh"><div class="mt2">${esc(t('sec_mfa_disable_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <p class="mu sm mb12">${esc(t('sec_mfa_disable_body'))}</p>
      ${field('sec-off-pw', t('sec_pw_current'), 'password', 'autocomplete="current-password"')}
      ${field('sec-off-code', t('sec_mfa_code'), 'text', 'inputmode="numeric" autocomplete="one-time-code"')}
      <div id="sec-off-msg"></div>
      <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button><button class="btn bd2" onclick="HFASecurity.disable()">${esc(t('sec_mfa_disable'))}</button></div>`);
  }
  async function disable() {
    try {
      const result = await apiRequest('/api/v1/account/mfa/disable', 'POST', { password: $('sec-off-pw').value, code: $('sec-off-code').value });
      Object.assign(CU, result.user); closeMo(); navigate('security');
    } catch (error) { message('sec-off-msg', error.message); }
  }

  // Sign-in step 2 (shown in the sign-in form when the server asks for a code).
  let pending = null;
  // emailCode: the masked address the server can send a backup code to (Super Admin), or null.
  function askCode(challenge, email, password, emailCode = null) {
    pending = { challenge, email, password };
    $('amsg').innerHTML = '';
    const form = $('fl');
    form.dataset.mfa = '1';
    [...form.children].forEach(child => { if (!child.classList.contains('sec-login-step')) child.hidden = true; });
    form.insertAdjacentHTML('beforeend', `<div class="sec-login-step">
      <h3>${esc(t('sec_login_code_title'))}</h3><p class="mu sm" id="sec-login-body">${esc(t('sec_login_code_body'))}</p>
      ${field('sec-login-code', t('sec_mfa_code'), 'text', 'inputmode="numeric" autocomplete="one-time-code" maxlength="12"')}
      <p class="mu sm">${esc(t('sec_login_recovery'))}</p>
      <button type="button" class="btn bp w100 mt8" id="sec-login-verify">${esc(t('sec_login_verify'))}</button>
      ${emailCode ? `<button type="button" class="btn bs w100 mt8" id="sec-login-email">✉️ ${esc(tf('sec_login_email', { email: emailCode }))}</button>` : ''}
      <button type="button" class="btn bgh w100 mt8" id="sec-login-back">${esc(t('sec_login_back'))}</button></div>`);
    const input = $('sec-login-code');
    input.focus();
    input.addEventListener('keydown', event => { if (event.key === 'Enter') verify(); });
    $('sec-login-verify').addEventListener('click', verify);
    $('sec-login-back').addEventListener('click', resetLogin);
    $('sec-login-email')?.addEventListener('click', sendEmailCode);
  }
  // Phone unavailable: the server emails a one-time code (10 minutes); another can be asked for after a minute.
  async function sendEmailCode() {
    if (!pending) return;
    const button = $('sec-login-email'); button.disabled = true;
    try {
      const result = await apiRequest('/api/auth/mfa/email', 'POST', { challenge: pending.challenge });
      $('sec-login-body').textContent = tf('sec_login_email_sent', { email: result.sentTo });
      $('amsg').innerHTML = '';
      $('sec-login-code').value = ''; $('sec-login-code').focus();
      let wait = 60;
      const tick = () => {
        const current = document.getElementById('sec-login-email'); if (!current) return;
        if (wait <= 0) { current.disabled = false; current.textContent = `✉️ ${t('sec_login_email_again')}`; return; }
        current.textContent = `✉️ ${tf('sec_login_email_wait', { seconds: wait-- })}`; setTimeout(tick, 1000);
      };
      tick();
    } catch (error) {
      amsg(error.message);
      if (/expired|Sign in again/i.test(error.message)) resetLogin(); else button.disabled = false;
    }
  }
  function resetLogin() {
    pending = null;
    const form = $('fl'); if (!form) return;
    form.querySelector('.sec-login-step')?.remove();
    [...form.children].forEach(child => { child.hidden = false; });
    delete form.dataset.mfa;
  }
  async function verify() {
    if (!pending) return;
    const button = $('sec-login-verify'); button.disabled = true;
    try {
      const data = await apiRequest('/api/auth/mfa', 'POST', { challenge: pending.challenge, code: $('sec-login-code').value });
      const password = pending.password;
      resetLogin();
      installBackendSession(data); $('lp').value = '';
      await HFAOffline.afterOnlineLogin(data.user, password);
      goApp();
    } catch (error) {
      amsg(error.message);
      if (error.status === 429 || /expired|again/i.test(error.message)) resetLogin();
    } finally { if (document.getElementById('sec-login-verify')) button.disabled = false; }
  }

  window.HFASecurity = { renderPage, startSetup, confirmSetup, showDisable, disable, askCode, resetLogin, needsMfa };
})();
