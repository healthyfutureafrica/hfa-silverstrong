// Automatic sign-out after 15 minutes without activity, so health data is not left open on a shared or
// lost phone (HIPAA §164.312(a)(2)(iii) automatic logoff; Cameroon Law No. 2024/017 security duty).
// A warning with a countdown appears one minute before. Activity in any tab of the app counts.
// Offline sign-in keeps working afterwards with the same password.
(function () {
  const IDLE_MS = 15 * 60 * 1000, WARN_MS = 60 * 1000, CHECK_MS = 1000, SHARED_KEY = 'hfa-last-activity';

  Object.assign(T.en, {
    sg_title: 'Are you still there?', sg_body: 'To protect your health information, you will be signed out in {seconds} seconds.',
    sg_stay: 'Stay signed in', sg_leave: 'Sign out now', sg_done: 'You were signed out after 15 minutes without activity, to protect your data. Sign in again to continue.'
  });
  Object.assign(T.fr, {
    sg_title: 'Êtes-vous toujours là ?', sg_body: 'Pour protéger vos informations de santé, vous serez déconnecté dans {seconds} secondes.',
    sg_stay: 'Rester connecté', sg_leave: 'Se déconnecter', sg_done: 'Vous avez été déconnecté après 15 minutes d’inactivité, pour protéger vos données. Connectez-vous à nouveau pour continuer.'
  });

  const esc = window.hfaEscape, tf = window.hfaFormat;
  let last = Date.now(), warning = null, timer = null;

  let wasSignedIn = false;
  const signedIn = () => typeof CU !== 'undefined' && !!CU && !!document.getElementById('app-wrap') && !document.getElementById('app-wrap').classList.contains('hid');
  const shared = () => { try { return Number(localStorage.getItem(SHARED_KEY)) || 0; } catch (error) { return 0; } };
  function touch() {
    if (warning) return; // only the buttons in the warning keep the session open
    last = Date.now();
    try { if (last - shared() > 5000) localStorage.setItem(SHARED_KEY, String(last)); } catch (error) { /* private mode */ }
  }

  function showWarning(remaining) {
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'sg-overlay';
      warning.innerHTML = `<div class="sg-box" role="alertdialog" aria-modal="true" aria-labelledby="sg-title" aria-describedby="sg-body">
        <h2 id="sg-title">⏱️ ${esc(t('sg_title'))}</h2><p id="sg-body" aria-live="assertive"></p>
        <div class="sg-actions"><button type="button" class="btn bs" id="sg-leave">${esc(t('sg_leave'))}</button><button type="button" class="btn bp" id="sg-stay">${esc(t('sg_stay'))}</button></div></div>`;
      document.body.appendChild(warning);
      warning.querySelector('#sg-stay').addEventListener('click', stay);
      warning.querySelector('#sg-leave').addEventListener('click', () => signOut(false));
      warning.querySelector('#sg-stay').focus();
    }
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    // Announce every 15 seconds only, so screen readers are not flooded.
    const body = warning.querySelector('#sg-body');
    if (body.dataset.seconds !== String(seconds) && (seconds % 15 === 0 || !body.textContent)) body.textContent = tf('sg_body', { seconds });
    body.dataset.seconds = String(seconds);
  }
  function hideWarning() { warning?.remove(); warning = null; }
  function stay() { hideWarning(); touch(); }

  function signOut(automatic) {
    hideWarning();
    if (typeof closeMo === 'function') closeMo();
    if (typeof doLogout === 'function') doLogout();
    if (!automatic) return;
    const notice = document.createElement('div');
    notice.className = 'sg-notice'; notice.setAttribute('role', 'status');
    notice.textContent = t('sg_done');
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 15000);
    notice.addEventListener('click', () => notice.remove());
  }

  function check() {
    if (!signedIn()) { wasSignedIn = false; hideWarning(); return; }
    if (!wasSignedIn) { wasSignedIn = true; last = Date.now(); try { localStorage.setItem(SHARED_KEY, String(last)); } catch (error) { /* private mode */ } }
    const idle = Date.now() - Math.max(last, shared());
    if (idle >= IDLE_MS) signOut(true);
    else if (idle >= IDLE_MS - WARN_MS) showWarning(IDLE_MS - idle);
    else if (warning) hideWarning(); // activity in another tab
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .sg-overlay{position:fixed;inset:0;z-index:10000;background:rgba(17,24,39,.55);display:flex;align-items:center;justify-content:center;padding:16px}
    .sg-box{background:var(--sf);color:var(--t1);border-radius:var(--rl);box-shadow:var(--shl);max-width:420px;width:100%;padding:24px;border-top:5px solid var(--go-l)}
    .sg-box h2{font-size:1.15rem;margin-bottom:8px}.sg-box p{color:var(--t2)}
    .sg-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;margin-top:18px}
    .sg-notice{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;max-width:min(520px,calc(100% - 32px));background:var(--em-d);color:#fff;padding:14px 18px;border-radius:var(--r);box-shadow:var(--shl);font-size:.88rem;cursor:pointer}
  </style>`);
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(type => document.addEventListener(type, touch, { passive: true, capture: true }));
  window.addEventListener('hfa-session', touch);
  timer = setInterval(check, CHECK_MS);

  window.HFASessionGuard = { IDLE_MS, WARN_MS, check, touch, stop: () => clearInterval(timer) };
})();
