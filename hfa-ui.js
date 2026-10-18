// HFA design system on the live site: dark mode, profile pictures (upload, crop to circle,
// compression, progress, retry, remove) and the profile completion ring used by every portal.
// Loaded after the main script in index.html; uses its globals (T, t, LANG, CU, ApiState, openMo…).
(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const tf = (key, values = {}) => t(key).replace(/\{(\w+)\}/g, (match, name) => (name in values ? values[name] : match));

  Object.assign(T.en, {
    theme_use_dark: 'Switch to dark mode', theme_use_light: 'Switch to light mode',
    avatar_title: 'Profile picture', avatar_alt: 'Profile picture of {name}', avatar_none: 'No profile picture for {name}',
    avatar_change: 'Change profile picture', avatar_add: 'Add profile picture',
    avatar_drop: 'Drag a photo here, or click to choose one', avatar_drop_active: 'Drop the photo to use it',
    avatar_rules: 'JPG, PNG or WebP · at least 200×200 pixels · up to {mb} MB',
    avatar_take: 'Take photo', avatar_choose: 'Choose photo', avatar_remove: 'Remove photo',
    avatar_crop_title: 'Adjust your photo', avatar_crop_help: 'Drag the photo to place your face in the circle. Use the slider to zoom.',
    avatar_zoom: 'Zoom', avatar_use: 'Use this photo', avatar_processing: 'Preparing your photo…',
    avatar_uploading: 'Uploading… {percent}%', avatar_uploaded: 'Profile picture updated', avatar_removed: 'Profile picture removed',
    avatar_selected: 'Photo ready — it will be saved when your account is created',
    avatar_err_size: 'This photo is too large. The maximum size is {mb} MB.',
    avatar_err_type: 'This file type is not supported. Please choose a JPG, PNG or WebP photo.',
    avatar_err_small: 'This photo is too small. It must be at least 200×200 pixels.',
    avatar_err_read: 'This photo could not be opened. Please try another one.',
    avatar_err_upload: 'The upload failed. Check your connection and try again.',
    avatar_err_remove: 'The photo could not be removed. Please try again.',
    try_again: 'Try again', close: 'Close',
    pc_title: 'Profile completion', pc_percent: 'Profile {percent}% complete',
    pc_good: 'Your profile is complete', pc_fair: 'Your profile is almost complete', pc_low: 'Please complete your profile',
    pc_missing: 'Still missing:', pc_blocked: 'Your profile must be at least {min}% complete before you can {action}. It is {percent}% complete now.',
    pc_action_book: 'book a consultation', pc_complete_now: 'Complete my profile',
    pc_name: 'Full name', pc_photo: 'Profile picture', pc_date_of_birth: 'Date of birth', pc_gender: 'Gender', pc_phone: 'Phone number',
    pc_location: 'Region and town', pc_blood_group: 'Blood group', pc_genotype: 'Genotype', pc_allergies: 'Allergies',
    pc_emergency_contact: 'Emergency contact', pc_identity_document: 'ID document', pc_consents: 'Consent choices',
    pc_specialty: 'Specialty', pc_license: 'Licence number', pc_hospital: 'Hospital or clinic', pc_fee: 'Consultation fee',
    pc_department: 'Department', pc_nurse_id: 'Nurse ID', pc_qualifications: 'Qualifications', pc_email: 'Email',
    pc_pharmacy: 'Pharmacy name', pc_pharmacy_address: 'Pharmacy address', pc_pharmacy_license: 'Pharmacy licence',
    pc_minsante: 'MINSANTE authorisation', pc_owner: 'Owner details', pc_pharmacy_documents: 'Pharmacy documents'
  });
  Object.assign(T.fr, {
    theme_use_dark: 'Passer au mode sombre', theme_use_light: 'Passer au mode clair',
    avatar_title: 'Photo de profil', avatar_alt: 'Photo de profil de {name}', avatar_none: 'Pas de photo de profil pour {name}',
    avatar_change: 'Changer la photo de profil', avatar_add: 'Ajouter une photo de profil',
    avatar_drop: 'Glissez une photo ici ou cliquez pour en choisir une', avatar_drop_active: 'Déposez la photo pour l’utiliser',
    avatar_rules: 'JPG, PNG ou WebP · au moins 200×200 pixels · jusqu’à {mb} Mo',
    avatar_take: 'Prendre une photo', avatar_choose: 'Choisir une photo', avatar_remove: 'Retirer la photo',
    avatar_crop_title: 'Ajustez votre photo', avatar_crop_help: 'Faites glisser la photo pour placer votre visage dans le cercle. Utilisez le curseur pour zoomer.',
    avatar_zoom: 'Zoom', avatar_use: 'Utiliser cette photo', avatar_processing: 'Préparation de votre photo…',
    avatar_uploading: 'Téléversement… {percent} %', avatar_uploaded: 'Photo de profil mise à jour', avatar_removed: 'Photo de profil retirée',
    avatar_selected: 'Photo prête — elle sera enregistrée à la création de votre compte',
    avatar_err_size: 'Cette photo est trop lourde. La taille maximale est de {mb} Mo.',
    avatar_err_type: 'Ce type de fichier n’est pas pris en charge. Choisissez une photo JPG, PNG ou WebP.',
    avatar_err_small: 'Cette photo est trop petite. Elle doit faire au moins 200×200 pixels.',
    avatar_err_read: 'Cette photo n’a pas pu être ouverte. Veuillez en essayer une autre.',
    avatar_err_upload: 'Le téléversement a échoué. Vérifiez votre connexion et réessayez.',
    avatar_err_remove: 'La photo n’a pas pu être retirée. Veuillez réessayer.',
    try_again: 'Réessayer', close: 'Fermer',
    pc_title: 'Complétion du profil', pc_percent: 'Profil complété à {percent} %',
    pc_good: 'Votre profil est complet', pc_fair: 'Votre profil est presque complet', pc_low: 'Veuillez compléter votre profil',
    pc_missing: 'Il manque encore :', pc_blocked: 'Votre profil doit être complété à au moins {min} % avant de pouvoir {action}. Il est complété à {percent} %.',
    pc_action_book: 'réserver une consultation', pc_complete_now: 'Compléter mon profil',
    pc_name: 'Nom complet', pc_photo: 'Photo de profil', pc_date_of_birth: 'Date de naissance', pc_gender: 'Sexe', pc_phone: 'Numéro de téléphone',
    pc_location: 'Région et ville', pc_blood_group: 'Groupe sanguin', pc_genotype: 'Génotype', pc_allergies: 'Allergies',
    pc_emergency_contact: 'Contact d’urgence', pc_identity_document: 'Pièce d’identité', pc_consents: 'Choix de consentement',
    pc_specialty: 'Spécialité', pc_license: 'Numéro d’inscription', pc_hospital: 'Hôpital ou clinique', pc_fee: 'Frais de consultation',
    pc_department: 'Service', pc_nurse_id: 'Matricule infirmier', pc_qualifications: 'Qualifications', pc_email: 'E-mail',
    pc_pharmacy: 'Nom de la pharmacie', pc_pharmacy_address: 'Adresse de la pharmacie', pc_pharmacy_license: 'Licence de la pharmacie',
    pc_minsante: 'Autorisation MINSANTE', pc_owner: 'Informations du propriétaire', pc_pharmacy_documents: 'Documents de la pharmacie'
  });

  // ─────────────── Theme (dark mode) ───────────────
  const THEME_KEY = 'hfa-theme';
  const MOON = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const SUN = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  const HFATheme = {
    current() { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch (error) { return 'light'; } },
    apply(theme = HFATheme.current()) {
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        const label = t(theme === 'dark' ? 'theme_use_light' : 'theme_use_dark');
        button.setAttribute('aria-pressed', String(theme === 'dark'));
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = theme === 'dark' ? SUN : MOON;
      });
    },
    toggle() {
      const next = HFATheme.current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* private mode: still switch for this visit */ }
      HFATheme.apply(next);
    },
    button() {
      const dark = HFATheme.current() === 'dark', label = t(dark ? 'theme_use_light' : 'theme_use_dark');
      return `<button type="button" class="btn bgh bsm theme-toggle" data-theme-toggle onclick="HFATheme.toggle()" aria-pressed="${dark}" aria-label="${esc(label)}" title="${esc(label)}">${dark ? SUN : MOON}</button>`;
    }
  };

  // ─────────────── Profile completion ───────────────
  const COMPLETION = { good: 80, fair: 50, minimumToAct: 60 };
  const hasPhoto = user => !!(user.avatarPreview || user.avatarUrl || user.avatarData);
  const CHECKS = {
    patient: user => {
      const health = user.healthProfile || {}, identity = health.identity || {}, location = health.location || {}, medical = health.medical || {}, lifestyle = health.lifestyle || {};
      return [
        ['name', !!user.name], ['photo', hasPhoto(user)],
        ['date_of_birth', !!(identity.dateOfBirth || user.dateOfBirth)], ['gender', !!(identity.gender || user.gender)],
        ['phone', !!(user.phone || user.whatsappNumber)], ['location', !!((location.region && location.town) || user.address)],
        ['blood_group', !!((medical.bloodGroup && medical.bloodGroup !== 'unknown') || user.bloodType)],
        ['genotype', !!(medical.genotype && medical.genotype !== 'unknown')],
        ['allergies', !!(health.medical || user.allergies)],
        ['emergency_contact', !!(lifestyle.emergencyContact?.phone || user.emergencyContact)],
        ['identity_document', !!(user.idDocument || user.idDocumentName || user.idDocumentData)],
        ['consents', !!health.consents]
      ];
    },
    doctor: user => [['name', !!user.name], ['photo', hasPhoto(user)], ['phone', !!user.phone], ['specialty', !!user.specialty], ['license', !!user.licenseNo],
      ['hospital', !!user.hospital], ['fee', !!user.consultationFee], ['identity_document', !!(user.idDocument || user.idDocumentName || user.idDocumentData)]],
    nurse: user => [['name', !!user.name], ['photo', hasPhoto(user)], ['phone', !!user.phone], ['department', !!user.department], ['specialty', !!user.specialty],
      ['nurse_id', !!user.nurseId], ['hospital', !!user.hospital], ['qualifications', !!user.qualifications], ['identity_document', !!(user.idDocument || user.idDocumentName || user.idDocumentData)]],
    pharmacist: user => [['name', !!user.name], ['photo', hasPhoto(user)], ['phone', !!user.phone], ['pharmacy', !!user.pharmacyName], ['pharmacy_address', !!user.pharmacyAddress],
      ['pharmacy_license', !!user.pharmacyLicense], ['minsante', !!user.minsanteAuthorization], ['owner', !!(user.ownerName && user.ownerIdNumber)],
      ['pharmacy_documents', !!(user.pharmacyDocuments && Object.keys(user.pharmacyDocuments).length >= 4)]],
    default: user => [['name', !!user.name], ['email', !!user.email], ['phone', !!user.phone], ['photo', hasPhoto(user)]]
  };
  const HFACompletion = {
    ...COMPLETION,
    compute(user) {
      if (!user) return { percent: 0, missing: [] };
      const checks = (CHECKS[user.role] || CHECKS.default)(user);
      const done = checks.filter(([, ok]) => ok).length;
      return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, ok]) => !ok).map(([key]) => key) };
    },
    tone: percent => (percent >= COMPLETION.good ? 'good' : percent >= COMPLETION.fair ? 'fair' : 'low'),
    color: percent => (percent >= COMPLETION.good ? 'var(--em)' : percent >= COMPLETION.fair ? 'var(--wn)' : 'var(--dg)'),
    // Returns true when the user may act; otherwise explains why in a dialog.
    require(action) {
      const { percent } = HFACompletion.compute(CU);
      if (percent >= COMPLETION.minimumToAct) return true;
      const canComplete = CU.role === 'patient' && typeof HFAPatientRegistration !== 'undefined';
      openMo(`<div class="mh"><div class="mt2">${esc(t('pc_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
        <div class="pc-block">${HFAAvatar.html(CU, { size: 'lg', ring: true })}<p>${esc(tf('pc_blocked', { min: COMPLETION.minimumToAct, action: t('pc_action_' + action), percent }))}</p></div>
        ${HFACompletion.missingList(CU)}
        <div class="mf"><button class="btn bs" onclick="closeMo()">${esc(t('cancel'))}</button>${canComplete ? `<button class="btn bp" onclick="closeMo();HFAPatientRegistration.openCompletion()">${esc(t('pc_complete_now'))}</button>` : `<button class="btn bp" onclick="closeMo();HFAAvatar.openEditor()">${esc(t('avatar_add'))}</button>`}</div>`);
      return false;
    },
    missingList(user) {
      const { missing } = HFACompletion.compute(user);
      if (!missing.length) return '';
      return `<div class="pc-missing"><span>${esc(t('pc_missing'))}</span> ${missing.map(key => `<span class="badge bpa">${esc(t('pc_' + key))}</span>`).join(' ')}</div>`;
    },
    // Dashboard card shown at the top of every portal's dashboard.
    card(user = CU) {
      const { percent } = HFACompletion.compute(user), tone = HFACompletion.tone(percent);
      const canComplete = user.role === 'patient' && typeof HFAPatientRegistration !== 'undefined' && percent < 100;
      return `<div class="card mb18 pc-card" id="pc-card">
        ${HFAAvatar.html(user, { size: 'xl', ring: true, editable: true })}
        <div class="pc-body">
          <div class="ct">${esc(user.name)}</div>
          ${user.hfaId ? `<div class="pc-id"><code class="code-chip" title="${esc(t('hfa_number'))}">${esc(user.hfaId)}</code>${user.facilityName ? ` <span class="mu sm">${esc(user.facilityName)}</span>` : ''}</div>` : ''}
          <div class="pc-percent" style="color:${HFACompletion.color(percent)}">${esc(tf('pc_percent', { percent }))}</div>
          <div class="pc-bar" role="progressbar" aria-label="${esc(t('pc_title'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%;background:${HFACompletion.color(percent)}"></span></div>
          <div class="mu sm">${esc(t(tone === 'good' ? 'pc_good' : tone === 'fair' ? 'pc_fair' : 'pc_low'))}</div>
          ${HFACompletion.missingList(user)}
          <div class="pc-actions">
            <button type="button" class="btn bs bsm" onclick="HFAAvatar.openEditor()">${esc(t(hasPhoto(user) ? 'avatar_change' : 'avatar_add'))}</button>
            ${canComplete ? `<button type="button" class="btn bp bsm" onclick="HFAPatientRegistration.openCompletion()">${esc(t('pc_complete_now'))}</button>` : ''}
          </div>
        </div>
      </div>`;
    }
  };

  // ─────────────── Avatar ───────────────
  const AVATAR = { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, minDimension: 200, output: 800, quality: 0.85, viewport: 280 };
  const SIZES = { sm: 34, md: 48, lg: 72, xl: 96 };
  const RING = { sm: [2.5, 2], md: [3, 2], lg: [4, 3], xl: [5, 3] };
  const toMb = bytes => Math.round((bytes / 1048576) * 10) / 10;
  const isTouch = () => !!window.matchMedia?.('(pointer: coarse)').matches;

  function avatarSrc(user) { return user?.avatarPreview || user?.avatarUrl || user?.avatarData || null; }

  function avatarHtml(user, { size = 'md', ring = false, editable = false } = {}) {
    const px = SIZES[size] || SIZES.md, [stroke, gap] = RING[size] || RING.md;
    const completion = ring ? HFACompletion.compute(user) : null;
    const outer = ring ? Math.round(px + 2 * (stroke + gap)) : px;
    const src = avatarSrc(user), name = user?.name || '';
    const label = src ? tf('avatar_alt', { name }) : tf('avatar_none', { name });
    const r = (outer - stroke) / 2, circumference = 2 * Math.PI * r;
    const ringSvg = ring ? `<svg class="hav-ring" data-tone="${HFACompletion.tone(completion.percent)}" width="${outer}" height="${outer}" viewBox="0 0 ${outer} ${outer}" aria-hidden="true">
        <circle cx="${outer / 2}" cy="${outer / 2}" r="${r}" fill="none" stroke="var(--bd)" stroke-width="${stroke}"/>
        <circle cx="${outer / 2}" cy="${outer / 2}" r="${r}" fill="none" stroke="${HFACompletion.color(completion.percent)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${(circumference * (1 - completion.percent / 100)).toFixed(2)}" transform="rotate(-90 ${outer / 2} ${outer / 2})"/></svg>` : '';
    const face = `<span class="hav-face" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.36)}px"><span class="hav-ini" aria-hidden="true">${esc(ini(name))}</span>${src ? `<img src="${esc(src)}" alt="" draggable="false" onerror="this.remove()">` : ''}</span>`;
    const badge = editable && size !== 'sm' ? `<span class="hav-badge" aria-hidden="true"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>` : '';
    const fullLabel = ring ? `${label} — ${tf('pc_percent', { percent: completion.percent })}` : label;
    const style = `width:${outer}px;height:${outer}px`;
    return editable
      ? `<button type="button" class="hav hav-edit" style="${style}" onclick="HFAAvatar.openEditor()" aria-label="${esc(`${t(src ? 'avatar_change' : 'avatar_add')} — ${fullLabel}`)}">${ringSvg}${face}${badge}</button>`
      : `<span class="hav" style="${style}" role="img" aria-label="${esc(fullLabel)}">${ringSvg}${face}</span>`;
  }

  // Reads pixel size; createImageBitmap also applies the photo's EXIF orientation.
  async function decodeImage(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (error) { /* fall back to <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  const imageWidth = image => image.naturalWidth || image.width;
  const imageHeight = image => image.naturalHeight || image.height;

  async function validate(file, maxBytes) {
    if (!file || !AVATAR.types.includes(file.type)) return { error: t('avatar_err_type') };
    if (file.size > maxBytes) return { error: tf('avatar_err_size', { mb: toMb(maxBytes) }) };
    let image;
    try { image = await decodeImage(file); } catch (error) { return { error: t('avatar_err_read') }; }
    if (imageWidth(image) < AVATAR.minDimension || imageHeight(image) < AVATAR.minDimension) return { error: t('avatar_err_small') };
    return { image };
  }

  function canvasBlob(canvas, type, quality) { return new Promise(resolve => canvas.toBlob(resolve, type, quality)); }

  // Crops the visible circle and compresses it: at most 800×800, WebP quality 0.85 (PNG where WebP is unsupported).
  async function exportCrop(state) {
    const size = Math.max(AVATAR.minDimension, Math.min(AVATAR.output, Math.round(AVATAR.viewport / state.scale)));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.closePath(); context.clip();
    context.drawImage(state.image, -state.x / state.scale, -state.y / state.scale, AVATAR.viewport / state.scale, AVATAR.viewport / state.scale, 0, 0, size, size);
    let blob = await canvasBlob(canvas, 'image/webp', AVATAR.quality);
    if (!blob || blob.type !== 'image/webp') blob = await canvasBlob(canvas, 'image/png');
    if (!blob) throw new Error('export failed');
    return new File([blob], blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.png', { type: blob.type });
  }

  // Sends the photo to the User service with real upload progress (fetch cannot report it).
  function uploadToServer(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/v1/users/${encodeURIComponent(CU.id)}/avatar`);
      xhr.setRequestHeader('X-HFA-Request', '1');
      xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => {
        let body = null;
        try { body = JSON.parse(xhr.responseText); } catch (error) { body = null; }
        if (xhr.status >= 200 && xhr.status < 300 && body?.success) resolve(body.data);
        else reject(Object.assign(new Error(body?.message || 'upload failed'), { status: xhr.status }));
      };
      xhr.onerror = () => reject(new Error('network'));
      const form = new FormData();
      form.append('avatar', file, file.name);
      xhr.send(form);
    });
  }

  // Static demo (no server): the photo stays in this browser session only.
  function keepLocally(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = event => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
      reader.onload = () => resolve({ avatarData: reader.result });
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    });
  }

  let ED = null; // editor state

  function refreshEverywhere() {
    const sidebar = document.getElementById('sav');
    if (sidebar && CU) { sidebar.className = 'av-slot'; sidebar.innerHTML = avatarHtml(CU, { size: 'sm', ring: true, editable: true }); }
    const card = document.getElementById('pc-card');
    if (card && CU) card.outerHTML = HFACompletion.card(CU);
  }

  function editorShell(body) {
    return `<div class="mh"><div class="mt2" id="hav-title">${esc(t('avatar_title'))}</div><button class="mc" onclick="HFAAvatar.close()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <div class="hav-editor" role="group" aria-labelledby="hav-title">${body}</div><p class="sr-only" aria-live="polite" id="hav-live"></p>`;
  }

  function errorBox() {
    if (!ED.error) return '';
    return `<div class="alt ae hav-error" role="alert"><span>${esc(ED.error)}</span>${ED.retry ? ` <button type="button" class="btn bs bsm" onclick="HFAAvatar.retry()">${esc(t('try_again'))}</button>` : ''}</div>`;
  }

  function renderChoose() {
    const user = ED.mode === 'select' ? ED.user : CU;
    const src = ED.mode === 'select' ? ED.previewUrl : avatarSrc(CU);
    openMo(editorShell(`
      <div class="hav-current">${avatarHtml({ ...user, avatarPreview: src }, { size: 'xl', ring: ED.mode !== 'select' })}</div>
      ${errorBox()}
      <div class="hav-drop" id="hav-drop" tabindex="0" role="button" aria-describedby="hav-rules" onclick="HFAAvatar.pick()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();HFAAvatar.pick()}">
        <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        <span id="hav-drop-text">${esc(t('avatar_drop'))}</span>
      </div>
      <p class="mu sm hav-rules" id="hav-rules">${esc(tf('avatar_rules', { mb: toMb(ED.maxBytes) }))}</p>
      <div class="hav-buttons">
        ${isTouch() ? `<button type="button" class="btn bs" onclick="HFAAvatar.pick(true)">${esc(t('avatar_take'))}</button>` : ''}
        <button type="button" class="btn bp" onclick="HFAAvatar.pick()">${esc(t('avatar_choose'))}</button>
        ${src ? `<button type="button" class="btn bgh hav-remove" onclick="HFAAvatar.remove()">${esc(t('avatar_remove'))}</button>` : ''}
      </div>
      <input type="file" id="hav-file" accept="image/jpeg,image/png,image/webp" hidden onchange="HFAAvatar.fromInput(this)">
      <input type="file" id="hav-camera" accept="image/*" capture="user" hidden onchange="HFAAvatar.fromInput(this)">`));
    const drop = document.getElementById('hav-drop');
    const setActive = active => { drop.classList.toggle('active', active); document.getElementById('hav-drop-text').textContent = t(active ? 'avatar_drop_active' : 'avatar_drop'); };
    drop.addEventListener('dragover', event => { event.preventDefault(); setActive(true); });
    drop.addEventListener('dragleave', () => setActive(false));
    drop.addEventListener('drop', event => { event.preventDefault(); setActive(false); const file = event.dataTransfer?.files?.[0]; if (file) HFAAvatar.useFile(file); });
  }

  function drawCrop() {
    const canvas = document.getElementById('hav-canvas');
    if (!canvas || !ED.crop) return;
    const { image, scale, x, y } = ED.crop, ratio = window.devicePixelRatio || 1, view = AVATAR.viewport;
    canvas.width = view * ratio; canvas.height = view * ratio;
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#111827'; context.fillRect(0, 0, view, view);
    context.drawImage(image, x, y, imageWidth(image) * scale, imageHeight(image) * scale);
  }

  // Keeps the photo covering the whole circle.
  function clampCrop() {
    const crop = ED.crop, view = AVATAR.viewport;
    crop.x = Math.min(0, Math.max(view - imageWidth(crop.image) * crop.scale, crop.x));
    crop.y = Math.min(0, Math.max(view - imageHeight(crop.image) * crop.scale, crop.y));
  }

  function setZoom(zoom) {
    const crop = ED.crop, view = AVATAR.viewport, previous = crop.scale;
    crop.zoom = Math.min(3, Math.max(1, zoom));
    crop.scale = crop.baseScale * crop.zoom;
    // Zoom around the centre of the circle.
    const cx = (view / 2 - crop.x) / previous, cy = (view / 2 - crop.y) / previous;
    crop.x = view / 2 - cx * crop.scale; crop.y = view / 2 - cy * crop.scale;
    clampCrop(); drawCrop();
    const slider = document.getElementById('hav-zoom'); if (slider) slider.value = String(crop.zoom);
  }

  function renderCrop() {
    openMo(editorShell(`
      <p class="mu sm" id="hav-crop-help">${esc(t('avatar_crop_help'))}</p>
      <div class="hav-crop"><canvas id="hav-canvas" width="${AVATAR.viewport}" height="${AVATAR.viewport}" tabindex="0" aria-label="${esc(t('avatar_crop_title'))}" aria-describedby="hav-crop-help"></canvas><span class="hav-mask" aria-hidden="true"></span></div>
      <label class="fl" for="hav-zoom">${esc(t('avatar_zoom'))}</label>
      <input type="range" id="hav-zoom" class="hav-zoom" min="1" max="3" step="0.01" value="${ED.crop.zoom}" oninput="HFAAvatar.zoom(this.value)">
      ${errorBox()}
      <div class="mf"><button type="button" class="btn bs" onclick="HFAAvatar.back()">${esc(t('cancel'))}</button><button type="button" class="btn bp" id="hav-use" onclick="HFAAvatar.confirm()">${esc(t('avatar_use'))}</button></div>`));
    const canvas = document.getElementById('hav-canvas');
    let drag = null;
    canvas.addEventListener('pointerdown', event => { drag = { x: event.clientX, y: event.clientY }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!drag) return;
      ED.crop.x += event.clientX - drag.x; ED.crop.y += event.clientY - drag.y; drag = { x: event.clientX, y: event.clientY };
      clampCrop(); drawCrop();
    });
    const stop = () => { drag = null; };
    canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('wheel', event => { event.preventDefault(); setZoom(ED.crop.zoom - event.deltaY * 0.002); }, { passive: false });
    canvas.addEventListener('keydown', event => {
      const step = 10, moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (moves[event.key]) { event.preventDefault(); ED.crop.x += moves[event.key][0]; ED.crop.y += moves[event.key][1]; clampCrop(); drawCrop(); }
      if (event.key === '+' || event.key === '=') setZoom(ED.crop.zoom + 0.1);
      if (event.key === '-') setZoom(ED.crop.zoom - 0.1);
    });
    drawCrop();
    canvas.focus();
  }

  function renderProgress(percent, text, first = false) {
    // The person may close the dialog while the upload continues; never re-open it on them.
    if (!first && !document.querySelector('#mbox .hav-editor')) return;
    const previewUser = { ...CU, avatarPreview: ED.previewUrl };
    openMo(editorShell(`
      <div class="hav-current">${avatarHtml(previewUser, { size: 'xl' })}</div>
      ${ED.error ? errorBox() : `<div class="hav-progress" role="progressbar" aria-label="${esc(t('avatar_title'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
      <p class="mu sm hav-status">${esc(text)}</p>`}
      <div class="mf"><button type="button" class="btn bs" onclick="HFAAvatar.close()">${esc(t('close'))}</button></div>`));
  }

  function announce(text) { const live = document.getElementById('hav-live'); if (live) live.textContent = text; }

  async function runUpload(file) {
    ED.error = null; ED.retry = null; ED.pendingFile = file;
    if (ED.previewUrl) URL.revokeObjectURL(ED.previewUrl);
    ED.previewUrl = URL.createObjectURL(file);
    const previous = { avatarUrl: CU.avatarUrl, avatarData: CU.avatarData };
    CU.avatarPreview = ED.previewUrl; // optimistic: the new face appears everywhere at once
    refreshEverywhere();
    renderProgress(0, tf('avatar_uploading', { percent: 0 }), true);
    const onProgress = percent => {
      const bar = document.querySelector('.hav-progress'), status = document.querySelector('.hav-status');
      if (bar) { bar.setAttribute('aria-valuenow', String(percent)); bar.firstElementChild.style.width = percent + '%'; }
      if (status) status.textContent = tf('avatar_uploading', { percent });
    };
    try {
      const data = ApiState.enabled ? await uploadToServer(file, onProgress) : await keepLocally(file, onProgress);
      if (data.user) Object.assign(CU, { avatarUrl: data.user.avatarUrl, avatarKey: data.user.avatarKey, avatarUploadedAt: data.user.avatarUploadedAt });
      if (data.avatarData) CU.avatarData = data.avatarData;
      delete CU.avatarPreview;
      ED.pendingFile = null;
      refreshEverywhere();
      if (typeof log === 'function') log('UPDATE_PROFILE_PICTURE', 'Account');
      renderProgress(100, t('avatar_uploaded'));
      announce(t('avatar_uploaded'));
    } catch (error) {
      Object.assign(CU, previous); delete CU.avatarPreview; // roll back
      refreshEverywhere();
      ED.error = t('avatar_err_upload'); ED.retry = 'upload';
      renderProgress(0, '');
    }
  }

  const HFAAvatar = {
    html: avatarHtml,
    src: avatarSrc,
    // mode 'upload' (signed-in user) or 'select' (registration: returns the processed file without uploading).
    openEditor(options = {}) {
      ED = { mode: options.mode || 'upload', onSelect: options.onSelect, user: options.user || CU || {}, previewUrl: options.previewUrl || null,
        maxBytes: options.maxBytes || AVATAR.maxBytes, error: null, retry: null, crop: null, pendingFile: null };
      renderChoose();
    },
    close() { closeMo(); },
    pick(camera = false) { document.getElementById(camera ? 'hav-camera' : 'hav-file')?.click(); },
    fromInput(input) { const file = input.files?.[0]; input.value = ''; if (file) HFAAvatar.useFile(file); },
    async useFile(file) {
      ED.error = null; ED.retry = null;
      const result = await validate(file, ED.maxBytes);
      if (result.error) { ED.error = result.error; renderChoose(); return; }
      const image = result.image, view = AVATAR.viewport;
      const baseScale = view / Math.min(imageWidth(image), imageHeight(image));
      ED.crop = { image, baseScale, scale: baseScale, zoom: 1, x: (view - imageWidth(image) * baseScale) / 2, y: (view - imageHeight(image) * baseScale) / 2 };
      renderCrop();
    },
    zoom(value) { setZoom(Number(value)); },
    back() { ED.crop = null; renderChoose(); },
    async confirm() {
      const button = document.getElementById('hav-use');
      if (button) { button.disabled = true; button.textContent = t('avatar_processing'); }
      let file;
      try { file = await exportCrop(ED.crop); }
      catch (error) { ED.error = t('avatar_err_read'); ED.crop = null; renderChoose(); return; }
      if (ED.mode === 'select') {
        if (ED.previewUrl) URL.revokeObjectURL(ED.previewUrl);
        const previewUrl = URL.createObjectURL(file);
        closeMo();
        ED.onSelect?.(file, previewUrl);
        return;
      }
      runUpload(file);
    },
    retry() {
      if (ED.retry === 'upload' && ED.pendingFile) runUpload(ED.pendingFile);
      else if (ED.retry === 'remove') HFAAvatar.remove();
    },
    async remove() {
      if (ED.mode === 'select') { closeMo(); ED.onSelect?.(null, null); return; }
      const previous = { avatarUrl: CU.avatarUrl, avatarData: CU.avatarData, avatarKey: CU.avatarKey };
      CU.avatarUrl = null; CU.avatarData = null; CU.avatarKey = null; // optimistic
      refreshEverywhere();
      ED.error = null; ED.retry = null;
      try {
        if (ApiState.enabled) await apiRequest(`/api/v1/users/${encodeURIComponent(CU.id)}/avatar`, 'DELETE');
        if (typeof log === 'function') log('REMOVE_PROFILE_PICTURE', 'Account');
        renderChoose();
        announce(t('avatar_removed'));
      } catch (error) {
        Object.assign(CU, previous);
        refreshEverywhere();
        ED.error = t('avatar_err_remove'); ED.retry = 'remove';
        renderChoose();
      }
    },
    refresh: refreshEverywhere,
    // Used after registration: sends the photo chosen during sign-up once the account exists.
    upload(file) { return (ApiState.enabled ? uploadToServer(file, () => {}) : keepLocally(file, () => {})).then(data => {
      if (data.user) Object.assign(CU, { avatarUrl: data.user.avatarUrl, avatarKey: data.user.avatarKey, avatarUploadedAt: data.user.avatarUploadedAt });
      if (data.avatarData) CU.avatarData = data.avatarData;
      return data;
    }); },
    validate, exportCrop, AVATAR
  };

  // ─────────────── Facilities: hospital patient lists and the stakeholder register ───────────────
  Object.assign(T.en, {
    hfa_number: 'HFA number', hospital_patients_nav: 'Hospital patients', facilities_nav: 'Facilities & numbers',
    hp_title: 'Patients registered under {hospital}', hp_none_hospital: 'Your account is not linked to a hospital. Ask an administrator to add your hospital.',
    hp_intro: 'Every patient who registers under your hospital gets a number starting with {prefix}. Health records stay visible only to each patient\'s assigned care team.',
    hp_search: 'Search by name or number', hp_empty: 'No patients are registered under this hospital yet.', hp_count: '{count} patients',
    hp_number: 'HFA number', hp_name: 'Name', hp_registered: 'Registered', hp_status: 'Status',
    fr_title: 'Facilities & stakeholder numbers', fr_intro: 'Numbers are issued automatically and never change.',
    fr_formats: 'Doctors HFA-DR-<hospital>-0001 · Nurses HFA-NS-<hospital>-0001 · Patients HFA-PT-<hospital>-000001 · Pharmacies HFA-PH-<region>-<town>-0001 · Laboratories HFA-LB-<region>-<town>-0001. The last digit is a check digit.',
    fr_hospitals: 'Hospitals', fr_code: 'Code', fr_hospital: 'Hospital', fr_doctors: 'Doctors', fr_nurses: 'Nurses', fr_patients: 'Patients',
    fr_locations: 'Pharmacy & laboratory locations', fr_location: 'Region / town', fr_pharmacies: 'Pharmacies', fr_labs: 'Laboratories',
    fr_no_hospital: '{count} patients are not registered under a hospital yet (numbers HFA-PT-HFA-…).', fr_empty: 'Nothing registered yet.',
    wz_hospital: 'Hospital you are registered with', wz_hospital_hint: 'Your patient number shows this hospital so it can find your records quickly.',
    wz_hospital_none: 'I am not registered with a hospital yet', wz_hospital_other: 'My hospital is not in the list', wz_hospital_other_name: 'Name of your hospital',
    wz_hospital_number: 'Your patient number will start with {prefix}', wz_hospital_loading: 'Loading hospitals…'
  });
  Object.assign(T.fr, {
    hfa_number: 'Numéro HFA', hospital_patients_nav: 'Patients de l’hôpital', facilities_nav: 'Structures et numéros',
    hp_title: 'Patients inscrits à {hospital}', hp_none_hospital: 'Votre compte n’est lié à aucun hôpital. Demandez à un administrateur d’ajouter votre hôpital.',
    hp_intro: 'Chaque patient inscrit dans votre hôpital reçoit un numéro commençant par {prefix}. Les dossiers médicaux restent visibles uniquement par l’équipe soignante de chaque patient.',
    hp_search: 'Rechercher par nom ou numéro', hp_empty: 'Aucun patient n’est encore inscrit dans cet hôpital.', hp_count: '{count} patients',
    hp_number: 'Numéro HFA', hp_name: 'Nom', hp_registered: 'Inscrit le', hp_status: 'Statut',
    fr_title: 'Structures et numéros des intervenants', fr_intro: 'Les numéros sont attribués automatiquement et ne changent jamais.',
    fr_formats: 'Médecins HFA-DR-<hôpital>-0001 · Infirmiers HFA-NS-<hôpital>-0001 · Patients HFA-PT-<hôpital>-000001 · Pharmacies HFA-PH-<région>-<ville>-0001 · Laboratoires HFA-LB-<région>-<ville>-0001. Le dernier chiffre est un chiffre de contrôle.',
    fr_hospitals: 'Hôpitaux', fr_code: 'Code', fr_hospital: 'Hôpital', fr_doctors: 'Médecins', fr_nurses: 'Infirmiers', fr_patients: 'Patients',
    fr_locations: 'Localisation des pharmacies et laboratoires', fr_location: 'Région / ville', fr_pharmacies: 'Pharmacies', fr_labs: 'Laboratoires',
    fr_no_hospital: '{count} patients ne sont encore inscrits dans aucun hôpital (numéros HFA-PT-HFA-…).', fr_empty: 'Rien d’enregistré pour l’instant.',
    wz_hospital: 'Hôpital où vous êtes inscrit', wz_hospital_hint: 'Votre numéro de patient indique cet hôpital pour qu’il retrouve vite votre dossier.',
    wz_hospital_none: 'Je ne suis encore inscrit dans aucun hôpital', wz_hospital_other: 'Mon hôpital n’est pas dans la liste', wz_hospital_other_name: 'Nom de votre hôpital',
    wz_hospital_number: 'Votre numéro de patient commencera par {prefix}', wz_hospital_loading: 'Chargement des hôpitaux…'
  });

  const REGION_LABELS = { adamawa: ['Adamawa', 'Adamaoua'], centre: ['Centre', 'Centre'], east: ['East', 'Est'], far_north: ['Far North', 'Extrême-Nord'], littoral: ['Littoral', 'Littoral'],
    north: ['North', 'Nord'], north_west: ['North West', 'Nord-Ouest'], west: ['West', 'Ouest'], south: ['South', 'Sud'], south_west: ['South West', 'Sud-Ouest'] };
  const regionLabel = code => (REGION_LABELS[code] || ['', ''])[LANG === 'fr' ? 1 : 0];
  const dateText = value => (value ? String(value).slice(0, 10) : '—');
  let hospitalCache = null;

  const HFAFacilities = {
    /** Hospitals a patient can register under (with at least one active doctor or nurse). */
    async hospitals(refresh = false) {
      if (hospitalCache && !refresh) return hospitalCache;
      try {
        if (typeof ApiState !== 'undefined' && ApiState.loading) await ApiState.ready;
        if (ApiState.enabled && !ApiState.offline) {
          const response = await fetch('/api/v1/facilities', { credentials: 'same-origin' });
          hospitalCache = response.ok ? (await response.json()).data.hospitals : [];
        } else hospitalCache = typeof listedHospitals === 'function' ? listedHospitals() : [];
      } catch (error) { hospitalCache = typeof listedHospitals === 'function' ? listedHospitals() : []; }
      return hospitalCache;
    },
    // Suggests existing hospital names to registering doctors and nurses, so one hospital is not entered twice.
    async fillDatalist() {
      const list = document.getElementById('hfa-hospitals');
      if (!list) return;
      const hospitals = await HFAFacilities.hospitals(true);
      list.innerHTML = hospitals.map(hospital => `<option value="${esc(hospital.name)}"></option>`).join('');
    },

    async renderHospitalPatients(pc) {
      $('tbt').textContent = t('hospital_patients_nav');
      pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('hospital_patients_nav'))}</h2></div><p role="status" class="mu">…</p></div>`;
      let facility = null, patients = [];
      try {
        if (ApiState.enabled) {
          const data = await apiRequest('/api/v1/facilities/mine/patients');
          facility = data.data.facility; patients = data.data.patients;
        } else if (CU.facilityId) {
          facility = { id: CU.facilityId, name: CU.facilityName, code: CU.facilityCode };
          patients = DB.users.filter(user => user.role === 'patient' && user.facilityId === CU.facilityId && user.status !== 'deleted')
            .map(({ id, name, hfaId, status, createdAt }) => ({ id, name, hfaId, status, createdAt })).sort((a, b) => String(a.hfaId).localeCompare(String(b.hfaId)));
        }
      } catch (error) {
        pc.innerHTML = `<div class="page"><div class="alt ae" role="alert">${esc(error.message)}</div></div>`; return;
      }
      if (CP !== 'hospital-patients') return;
      if (!facility) { pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('hospital_patients_nav'))}</h2></div><div class="alt ai">${esc(t('hp_none_hospital'))}</div></div>`; return; }
      const rows = list => list.length ? list.map(patient => `<tr><td><code class="code-chip">${esc(patient.hfaId)}</code></td><td>${esc(patient.name)}</td><td>${esc(dateText(patient.createdAt))}</td><td>${esc(tv(patient.status))}</td></tr>`).join('')
        : `<tr><td colspan="4" class="mu">${esc(t('hp_empty'))}</td></tr>`;
      pc.innerHTML = `<div class="page">
        <div class="ph"><h2>${esc(tf('hp_title', { hospital: facility.name }))}</h2><p>${esc(tf('hp_intro', { prefix: `HFA-PT-${facility.code}-` }))}</p></div>
        <div class="card">
          <div class="ch fac-head"><div class="ct">${esc(tf('hp_count', { count: patients.length }))}</div>
            <input class="fc fac-search" type="search" id="hp-search" placeholder="${esc(t('hp_search'))}" aria-label="${esc(t('hp_search'))}"></div>
          <div class="fac-table-wrap"><table class="fac-table"><thead><tr><th scope="col">${esc(t('hp_number'))}</th><th scope="col">${esc(t('hp_name'))}</th><th scope="col">${esc(t('hp_registered'))}</th><th scope="col">${esc(t('hp_status'))}</th></tr></thead>
          <tbody id="hp-rows">${rows(patients)}</tbody></table></div>
        </div></div>`;
      document.getElementById('hp-search').addEventListener('input', event => {
        const query = event.target.value.trim().toLowerCase();
        document.getElementById('hp-rows').innerHTML = rows(patients.filter(patient => !query || patient.name.toLowerCase().includes(query) || String(patient.hfaId).toLowerCase().includes(query)));
      });
    },

    async renderRegister(pc) {
      $('tbt').textContent = t('facilities_nav');
      pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('fr_title'))}</h2></div><p role="status" class="mu">…</p></div>`;
      let register;
      try {
        if (ApiState.enabled) register = (await apiRequest('/api/v1/admin/facilities')).data;
        else {
          const active = DB.users.filter(user => user.status !== 'deleted');
          const count = (id, role) => active.filter(user => user.facilityId === id && user.role === role).length;
          const locations = new Map();
          for (const user of active.filter(item => item.role === 'pharmacist' || item.role === 'labtech')) {
            const parsed = HFANumbering.parse(user.hfaId); if (!parsed) continue;
            const key = `${parsed.regionCode}-${parsed.townCode}`, where = HFANumbering.locationOf(user);
            const entry = locations.get(key) || { code: key, region: where.region, town: where.town, pharmacies: 0, laboratories: 0 };
            entry[user.role === 'pharmacist' ? 'pharmacies' : 'laboratories']++; locations.set(key, entry);
          }
          register = { hospitals: STATIC_FACILITIES.map(facility => ({ ...facility, doctors: count(facility.id, 'doctor'), nurses: count(facility.id, 'nurse'), patients: count(facility.id, 'patient') })).sort((a, b) => a.code.localeCompare(b.code)),
            locations: [...locations.values()], patientsWithoutHospital: active.filter(user => user.role === 'patient' && !user.facilityId).length };
        }
      } catch (error) { pc.innerHTML = `<div class="page"><div class="alt ae" role="alert">${esc(error.message)}</div></div>`; return; }
      if (CP !== 'facilities') return;
      const empty = columns => `<tr><td colspan="${columns}" class="mu">${esc(t('fr_empty'))}</td></tr>`;
      pc.innerHTML = `<div class="page">
        <div class="ph"><h2>${esc(t('fr_title'))}</h2><p>${esc(t('fr_intro'))}</p></div>
        <div class="alt ai">${esc(t('fr_formats'))}</div>
        ${register.patientsWithoutHospital ? `<div class="alt ai">${esc(tf('fr_no_hospital', { count: register.patientsWithoutHospital }))}</div>` : ''}
        <div class="card mb18"><div class="ch"><div class="ct">${esc(t('fr_hospitals'))}</div></div><div class="fac-table-wrap"><table class="fac-table">
          <thead><tr><th scope="col">${esc(t('fr_code'))}</th><th scope="col">${esc(t('fr_hospital'))}</th><th scope="col">${esc(t('fr_doctors'))}</th><th scope="col">${esc(t('fr_nurses'))}</th><th scope="col">${esc(t('fr_patients'))}</th></tr></thead>
          <tbody>${register.hospitals.length ? register.hospitals.map(hospital => `<tr><td><code class="code-chip">${esc(hospital.code)}</code></td><td>${esc(hospital.name)}</td><td>${hospital.doctors}</td><td>${hospital.nurses}</td><td>${hospital.patients}</td></tr>`).join('') : empty(5)}</tbody></table></div></div>
        <div class="card"><div class="ch"><div class="ct">${esc(t('fr_locations'))}</div></div><div class="fac-table-wrap"><table class="fac-table">
          <thead><tr><th scope="col">${esc(t('fr_code'))}</th><th scope="col">${esc(t('fr_location'))}</th><th scope="col">${esc(t('fr_pharmacies'))}</th><th scope="col">${esc(t('fr_labs'))}</th></tr></thead>
          <tbody>${register.locations.length ? register.locations.map(place => `<tr><td><code class="code-chip">${esc(place.code)}</code></td><td>${esc([regionLabel(place.region), place.town].filter(Boolean).join(' · ') || '—')}</td><td>${place.pharmacies}</td><td>${place.laboratories}</td></tr>`).join('') : empty(4)}</tbody></table></div></div>
      </div>`;
    }
  };
  window.HFAFacilities = HFAFacilities;

  window.HFATheme = HFATheme;
  window.HFACompletion = HFACompletion;
  window.HFAAvatar = HFAAvatar;
  window.hfaEscape = esc;
  window.hfaFormat = tf;
  HFATheme.apply();
})();
