// Data entry checks in the browser, designed around human error. Every form field can carry a rule
// (data-v="…") as well as the usual required / minlength / maxlength / min / max / accept attributes:
// - when a person leaves a field it is tidied (extra spaces, email case, phone numbers to +237…) and checked,
//   and a message under the field says exactly what to correct (English or French);
// - unusual but possible values (an appointment at 02:00, a patient aged 104, "gmial.com") give a warning: the
//   person can continue by pressing the button again, so nothing is blocked that might be right;
// - the save button of a form is blocked while a field is wrong, and the first wrong field is focused;
// - a second tap within a moment is ignored, so one tap never makes two records;
// - buttons with data-confirm ask before an action that cannot be undone.
// The server checks everything again: this layer only helps people get it right first time.
(function () {
  const M = {
    en: {
      required: 'This is required.', choose: 'Choose an option.', tick: 'Tick this box to continue.', min_length: 'Enter at least {n} characters.', max_length: 'Use at most {n} characters.',
      name: 'Enter the full name (letters, at least 2).', email: 'Enter an email address like name@example.com.', email_typo: 'Did you mean {domain}?',
      phone: 'Enter a phone number like +237 6XX XX XX XX.', phone_cm: 'A Cameroon number has 9 digits after +237 and starts with 6 or 2.',
      login: 'Enter your email address or phone number.', password: 'Use at least {n} characters.', password_space: 'The password starts or ends with a space. Is that intended?',
      date: 'Enter a real date.', future: 'Choose today or a later date.', far_future: 'This is more than a year away. Check the year.', past: 'This date cannot be in the future.',
      dob: 'Check the year of birth.', old_age: 'This person would be over 100 years old. Check the year.', time: 'Enter a time like 09:30.', time_past: 'This time today has already passed.',
      odd_hour: 'This time is outside usual hours (06:00–21:00). Check it.', number: 'Enter a number.', min: 'Enter {n} or more.', max: 'Enter {n} or less.', whole: 'Enter a whole number.',
      licence: 'Use letters, numbers, spaces, dots, dashes or slashes (3–60).', file: 'Choose a file.', file_type: 'Choose a PDF, PNG, JPEG or WebP file.', file_size: 'The file is larger than {n} MB.',
      fix: 'Please correct the highlighted fields.', warn: 'Please check the highlighted fields, then press again to continue.', confirm: 'This cannot be undone. Continue?',
      confirm_release: 'Release this result to the patient? They will see it straight away, and this cannot be undone.', confirm_close_case: 'Close this urgent care case? It leaves the queue.',
      confirm_resolve_alert: 'Mark this medication safety alert as resolved? Do this only once the risk has been dealt with.', confirm_suspend: 'Suspend this account? The person will be signed out and cannot sign in until it is reactivated.'
    },
    fr: {
      required: 'Ce champ est obligatoire.', choose: 'Choisissez une option.', tick: 'Cochez cette case pour continuer.', min_length: 'Saisissez au moins {n} caractères.', max_length: 'Utilisez au plus {n} caractères.',
      name: 'Saisissez le nom complet (lettres, au moins 2).', email: 'Saisissez une adresse e-mail comme nom@exemple.com.', email_typo: 'Vouliez-vous dire {domain} ?',
      phone: 'Saisissez un numéro comme +237 6XX XX XX XX.', phone_cm: 'Un numéro camerounais a 9 chiffres après +237 et commence par 6 ou 2.',
      login: 'Saisissez votre adresse e-mail ou votre numéro de téléphone.', password: 'Utilisez au moins {n} caractères.', password_space: 'Le mot de passe commence ou finit par une espace. Est-ce voulu ?',
      date: 'Saisissez une date réelle.', future: 'Choisissez aujourd’hui ou une date ultérieure.', far_future: 'C’est dans plus d’un an. Vérifiez l’année.', past: 'Cette date ne peut pas être dans le futur.',
      dob: 'Vérifiez l’année de naissance.', old_age: 'Cette personne aurait plus de 100 ans. Vérifiez l’année.', time: 'Saisissez une heure comme 09:30.', time_past: 'Cette heure est déjà passée aujourd’hui.',
      odd_hour: 'Cette heure est en dehors des heures habituelles (06:00–21:00). Vérifiez-la.', number: 'Saisissez un nombre.', min: 'Saisissez {n} ou plus.', max: 'Saisissez {n} ou moins.', whole: 'Saisissez un nombre entier.',
      licence: 'Utilisez lettres, chiffres, espaces, points, tirets ou barres obliques (3 à 60).', file: 'Choisissez un fichier.', file_type: 'Choisissez un fichier PDF, PNG, JPEG ou WebP.', file_size: 'Le fichier dépasse {n} Mo.',
      fix: 'Veuillez corriger les champs signalés.', warn: 'Vérifiez les champs signalés, puis appuyez à nouveau pour continuer.', confirm: 'Cette action est irréversible. Continuer ?',
      confirm_release: 'Transmettre ce résultat au patient ? Il le verra immédiatement, et c’est irréversible.', confirm_close_case: 'Clôturer ce cas urgent ? Il quittera la file d’attente.',
      confirm_resolve_alert: 'Marquer cette alerte de sécurité médicamenteuse comme résolue ? Faites-le seulement une fois le risque traité.', confirm_suspend: 'Suspendre ce compte ? La personne sera déconnectée et ne pourra plus se connecter avant sa réactivation.'
    }
  };
  const lang = () => (typeof LANG !== 'undefined' && LANG === 'fr' ? 'fr' : 'en');
  const msg = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), M[lang()][key] || M.en[key] || key);

  // ───── Tidying ─────
  const squash = value => String(value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').trim();
  /** Phone numbers to E.164; Cameroon numbers typed locally (6XX XX XX XX) get +237. */
  function phone(value) {
    let digits = String(value || '').replace(/[\s().-]/g, '');
    if (/^00[1-9]/.test(digits)) digits = '+' + digits.slice(2);
    if (/^237\d{9}$/.test(digits)) digits = '+' + digits;
    if (/^[26]\d{8}$/.test(digits)) digits = '+237' + digits;
    return digits;
  }
  const TYPO_DOMAINS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gnail.com': 'gmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yahoo.fe': 'yahoo.fr', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com' };

  // ───── Rules: return { error } or { warning } or null ─────
  const today = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const realDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString?.().slice(0, 10) === value;
  const addYears = years => { const date = new Date(); date.setFullYear(date.getFullYear() + years); return date.toISOString().slice(0, 10); };
  const RULES = {
    name: value => !value || (value.length >= 2 && /\p{L}/u.test(value) && /^[\p{L}\p{M}\p{N} .'-]+$/u.test(value)) ? null : { error: msg('name') },
    email: value => {
      if (!value) return null;
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/.test(value)) return { error: msg('email') };
      const domain = value.split('@')[1];
      return TYPO_DOMAINS[domain] ? { warning: msg('email_typo', { domain: TYPO_DOMAINS[domain] }) } : null;
    },
    phone: value => {
      if (!value) return null;
      if (!/^\+[1-9]\d{7,14}$/.test(value)) return { error: msg('phone') };
      if (value.startsWith('+237') && !/^\+237[26]\d{8}$/.test(value)) return { error: msg('phone_cm') };
      return null;
    },
    login: value => {
      if (!value) return null;
      if (!value.includes('@')) return RULES.phone(phone(value)) ? { error: msg('login') } : null;
      const result = RULES.email(value);
      return result?.error ? { error: msg('login') } : result;
    },
    password: (value, field) => {
      const min = Number(field.getAttribute('minlength')) || 12;
      if (value && value.length < min) return { error: msg('password', { n: min }) };
      return value && value !== value.trim() ? { warning: msg('password_space') } : null;
    },
    'future-date': value => !value ? null : !realDate(value) ? { error: msg('date') } : value < today() ? { error: msg('future') } : value > addYears(1) ? { warning: msg('far_future') } : null,
    'past-date': value => !value ? null : !realDate(value) ? { error: msg('date') } : value > today() ? { error: msg('past') } : null,
    dob: value => !value ? null : !realDate(value) ? { error: msg('date') } : value > today() || value < addYears(-120) ? { error: msg('dob') } : value < addYears(-100) ? { warning: msg('old_age') } : null,
    time: (value, field) => {
      if (!value) return null;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return { error: msg('time') };
      const date = field.dataset.date && document.getElementById(field.dataset.date)?.value;
      if (date && date === today()) { const now = new Date(); const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; if (value < current) return { error: msg('time_past') }; }
      return value < '06:00' || value > '21:00' ? { warning: msg('odd_hour') } : null;
    },
    licence: value => !value || /^[A-Za-z0-9 ./-]{3,60}$/.test(value) ? null : { error: msg('licence') },
    text: () => null
  };
  const TIDY = {
    name: value => squash(value), email: value => squash(value).toLowerCase(), phone: value => phone(squash(value)), login: value => (value.includes('@') ? squash(value).toLowerCase() : squash(value)),
    licence: value => squash(value).toUpperCase(), text: value => value.trim()
  };

  // ───── Checking one field ─────
  // The patient registration wizard (.wz) checks its own steps.
  const relevant = field => field && !field.disabled && !field.closest('.wz, [data-novalidate]') && field.type !== 'hidden' && field.offsetParent !== null && (field.dataset.v || field.required || field.hasAttribute('minlength') || field.hasAttribute('maxlength') || field.type === 'number' || field.type === 'file' || field.type === 'email' || field.type === 'date' || field.type === 'time');

  function check(field, { tidy = false } = {}) {
    const kinds = (field.dataset.v || (field.type === 'email' ? 'email' : field.type === 'tel' ? 'phone' : '')).split(',').filter(Boolean);
    if (tidy && field.type !== 'file' && field.type !== 'checkbox' && field.type !== 'radio' && field.type !== 'password' && typeof field.value === 'string') {
      for (const kind of kinds.length ? kinds : ['text']) if (TIDY[kind]) { const next = TIDY[kind](field.value); if (next !== field.value) field.value = next; }
    }
    let result = null;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    if (field.required && (field.type === 'checkbox' ? !value : field.type === 'file' ? !field.files?.length : !String(value).trim()))
      result = { error: msg(field.type === 'checkbox' ? 'tick' : field.tagName === 'SELECT' ? 'choose' : field.type === 'file' ? 'file' : 'required') };
    if (!result && typeof value === 'string' && value) {
      const min = Number(field.getAttribute('minlength')), max = Number(field.getAttribute('maxlength'));
      if (min && value.trim().length < min && field.type !== 'password') result = { error: msg('min_length', { n: min }) };
      else if (max && value.length > max) result = { error: msg('max_length', { n: max }) };
    }
    if (!result && field.type === 'number' && field.value !== '') {
      const number = Number(field.value), low = field.getAttribute('min'), high = field.getAttribute('max');
      if (!Number.isFinite(number)) result = { error: msg('number') };
      else if (low !== null && number < Number(low)) result = { error: msg('min', { n: low }) };
      else if (high !== null && number > Number(high)) result = { error: msg('max', { n: high }) };
      else if ((field.getAttribute('step') || '1') === '1' && !Number.isInteger(number)) result = { error: msg('whole') };
    }
    if (!result && field.type === 'file' && field.files?.length) {
      const types = (field.getAttribute('accept') || '').split(',').map(type => type.trim()).filter(Boolean), limit = Number(field.dataset.maxMb || 5);
      for (const file of field.files) {
        if (types.length && !types.some(type => type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : type.startsWith('.') ? file.name.toLowerCase().endsWith(type) : file.type === type)) { result = { error: msg('file_type') }; break; }
        if (file.size > limit * 1024 * 1024) { result = { error: msg('file_size', { n: limit }) }; break; }
      }
    }
    for (const kind of kinds) { if (result?.error) break; const rule = RULES[kind]?.(typeof value === 'string' ? value.trim() : value, field); if (rule && (!result || rule.error)) result = rule; }
    show(field, result);
    return result;
  }

  function show(field, result) {
    const id = (field.id || field.name || 'field') + '-fv';
    let box = document.getElementById(id);
    if (!result) { box?.remove(); field.removeAttribute('aria-invalid'); field.classList.remove('fv-error', 'fv-warn'); return; }
    if (!box) {
      box = document.createElement('div'); box.id = id; box.className = 'fv-msg'; box.setAttribute('role', 'alert');
      (field.type === 'checkbox' || field.type === 'radio' ? field.closest('label') || field : field).insertAdjacentElement('afterend', box);
      field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), id].filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(' '));
    }
    box.textContent = result.error || result.warning;
    box.classList.toggle('fv-msg-warn', !result.error);
    field.classList.toggle('fv-error', !!result.error); field.classList.toggle('fv-warn', !result.error);
    if (result.error) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
  }

  // ───── Whole forms ─────
  const SCOPE = 'form, #mbox, #fl, #fr, #st-card, .card, .page';
  const ACTION = '.btn.bp, .btn.bd2, .btn.bg2, button[type="submit"], [data-validate]';
  // Buttons that open, switch or move between screens save nothing, so they are never checked or held back.
  const NAVIGATION = /^\s*(closeMo\(\);\s*)?(show|go|set|open|close|swt|switch|toggle|tpw|view|navigate|print|download|filter|tab)/i;
  function checkScope(scope) {
    const fields = [...scope.querySelectorAll('input, select, textarea')].filter(relevant);
    const results = fields.map(field => ({ field, result: check(field, { tidy: true }) }));
    return { errors: results.filter(item => item.result?.error), warnings: results.filter(item => item.result?.warning) };
  }
  const fingerprint = scope => [...scope.querySelectorAll('input, select, textarea')].map(field => field.type === 'checkbox' ? field.checked : field.type === 'file' ? [...(field.files || [])].map(file => file.name).join('|') : field.value).join('\u0001');
  function summary(scope, text) {
    let box = scope.querySelector(':scope > .fv-summary');
    if (!text) { box?.remove(); return; }
    if (!box) { box = document.createElement('div'); box.className = 'fv-summary alt ae'; box.setAttribute('role', 'alert'); scope.prepend(box); }
    box.textContent = text;
  }

  /** Runs before the button's own handler; returns false to stop it. */
  function guard(button, event) {
    if (button.disabled) return true;
    if (button.dataset.fvBusy) { stop(event); return false; }
    const navigation = button.dataset.novalidate !== undefined || button.closest('.wz') || NAVIGATION.test(button.getAttribute('onclick') || '');
    const scope = !navigation && button.closest(SCOPE);
    if (scope) {
      const { errors, warnings } = checkScope(scope);
      if (errors.length) { summary(scope, msg('fix')); errors[0].field.focus(); stop(event); return false; }
      const print = fingerprint(scope);
      if (warnings.length && scope.dataset.fvWarned !== print) { scope.dataset.fvWarned = print; summary(scope, msg('warn')); warnings[0].field.focus(); stop(event); return false; }
      summary(scope, '');
    }
    // data-confirm holds a message key (or nothing, for the general message).
    if (button.dataset.confirm !== undefined && !window.confirm(msg(button.dataset.confirm || 'confirm'))) { stop(event); return false; }
    if (navigation) return true;
    button.dataset.fvBusy = '1';
    setTimeout(() => { delete button.dataset.fvBusy; }, 1500);
    return true;
  }
  const stop = event => { event.preventDefault(); event.stopImmediatePropagation(); };

  document.addEventListener('click', event => { const button = event.target.closest?.(ACTION + ', [data-confirm]'); if (button) guard(button, event); }, true);
  document.addEventListener('submit', event => { const button = event.submitter || event.target.querySelector('button[type="submit"], .btn.bp'); if (button && !guard(button, event)) stop(event); }, true);
  // Enter in a field often triggers the action directly (e.g. login): check the field's form first.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
    const scope = event.target.closest(SCOPE); if (!scope) return;
    const { errors } = checkScope(scope);
    if (errors.length) { summary(scope, msg('fix')); errors[0].field.focus(); stop(event); }
  }, true);
  document.addEventListener('focusout', event => { if (relevant(event.target)) check(event.target, { tidy: true }); });
  document.addEventListener('input', event => { if (event.target.classList?.contains('fv-error') || event.target.classList?.contains('fv-warn')) check(event.target); });
  document.addEventListener('change', event => { if (relevant(event.target) && (event.target.tagName === 'SELECT' || ['file', 'date', 'time', 'checkbox'].includes(event.target.type))) check(event.target, { tidy: true }); });

  document.head.insertAdjacentHTML('beforeend', `<style>
    .fv-msg{color:var(--dg);font-size:.78rem;margin-top:4px;font-weight:600}
    .fv-msg.fv-msg-warn{color:#8a5a00}
    .fc.fv-error,input.fv-error,select.fv-error,textarea.fv-error{border-color:var(--dg)!important;box-shadow:0 0 0 2px rgba(206,17,38,.15)}
    .fc.fv-warn,input.fv-warn,select.fv-warn,textarea.fv-warn{border-color:#D97706!important}
    .fv-summary{margin-bottom:12px}
  </style>`);

  window.HFAValidation = { check, checkScope, phone, squash, RULES, TIDY };
})();
