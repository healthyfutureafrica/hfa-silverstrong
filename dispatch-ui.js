// HFA ambulance dispatch screens (server: backend/dispatch.js).
//  • Patients: an SOS button on every page sends their GPS location to HFA dispatch, which offers the job to the
//    nearest on-duty ambulance crew; the patient follows each real step and sees an ETA once a crew is moving.
//    The country's emergency number and the verified hospital contacts stay one tap away throughout.
//  • Ambulance crews: their current job, the patient's live location and short emergency summary, navigation and
//    status buttons; while on duty the app reports the ambulance position so the nearest unit can be chosen.
//  • Administrators: the SOS console (manual assignment, closing) and the ambulance fleet register.
(function () {
  const esc = window.hfaEscape;
  Object.assign(T.en, {
    ambulance: 'Ambulance crew',
    ds_sos: 'SOS', ds_sos_title: 'Emergency — request an ambulance',
    ds_sos_body: 'HFA will send your location to the nearest on-duty ambulance crew. Your doctor and nurse are told. If anyone may be in immediate danger, call the emergency number now as well.',
    ds_send: 'Request an ambulance now', ds_call: 'Call', ds_locating: 'Getting your location…',
    ds_need_gps: 'Your location is needed to send an ambulance. Allow location access, or call the emergency number now.',
    ds_offline: 'You are offline, so HFA cannot reach an ambulance crew. Call the emergency number now, or use a saved hospital ambulance contact below.',
    ds_no_server: 'Ambulance requests need the HFA account server. Call the emergency number now, or find a hospital ambulance contact below.',
    ds_s_received: 'Request received', ds_s_offered: 'Asking the nearest ambulance crew…', ds_s_accepted: 'A crew accepted — preparing to leave',
    ds_s_en_route: 'Ambulance on the way', ds_s_on_scene: 'Ambulance has arrived', ds_s_transporting: 'Taking you to hospital',
    ds_s_completed: 'Handed over at hospital', ds_s_cancelled: 'Request cancelled', ds_s_closed: 'Closed by HFA dispatch',
    ds_s_no_unit: 'No HFA partner ambulance is free nearby. Call the emergency number now, or contact a hospital ambulance below. HFA dispatch has been alerted.',
    ds_eta: 'about {minutes} min · {km} km', ds_eta_wait: 'Time of arrival is shown once a crew accepts.',
    ds_call_crew: 'Call the crew', ds_cancel: 'Cancel request', ds_cancel_confirm: 'Cancel the ambulance request?', ds_on_map: 'Ambulance on map',
    ds_live: 'Your location is shared live with the crew until the request ends.', ds_find_contacts: 'Find hospital ambulance contacts',
    // Crew
    ds_crew_nav: 'Ambulance', ds_crew_job: 'Current job', ds_crew_title: 'Ambulance crew', ds_unlinked: 'Your account is not linked to an ambulance yet. Ask HFA dispatch to link it.',
    ds_on_duty: 'On duty', ds_off_duty: 'Off duty', ds_u_available: 'Available', ds_u_off_duty: 'Off duty', ds_u_offered: 'Job offered', ds_u_busy: 'On a job',
    ds_duty_note: 'While on duty this device shares the ambulance position with HFA dispatch so the nearest unit can be sent. Keep location on.',
    ds_no_job: 'No job right now. Offers appear here and you are notified.', ds_offer: 'Emergency job offered — answer before {time}',
    ds_patient_location: 'Patient location', ds_navigate: 'Navigate', ds_call_patient: 'Call patient', ds_summary: 'Emergency summary',
    ds_blood: 'Blood group', ds_genotype: 'Genotype', ds_conditions: 'Conditions', ds_allergies: 'Drug allergies', ds_meds: 'Current medicines', ds_none: 'None recorded',
    ds_a_accept: 'Accept job', ds_a_decline: 'Decline', ds_a_en_route: 'Leaving now — en route', ds_a_on_scene: 'Arrived on scene', ds_a_transporting: 'Transporting to hospital', ds_a_handover: 'Handed over',
    ds_destination: 'Destination hospital', ds_hidden_until_accept: 'Patient details appear when you accept the job.',
    // Admin
    ds_admin_section: 'Emergency dispatch', ds_console: 'SOS console', ds_fleet: 'Ambulance fleet',
    ds_console_intro: 'Every SOS request with the patient’s location, the ambulance offered and each step. Offers move to the next nearest crew after 60 seconds without an answer.',
    ds_assign: 'Assign', ds_close: 'Close request', ds_close_note: 'Reason for closing (for the record)', ds_open_map: 'Open map', ds_no_requests: 'No SOS requests yet.',
    ds_fleet_intro: 'Partner ambulances and their crews. A unit is offered jobs only when its crew is on duty and has reported its position in the last 30 minutes.',
    ds_add_unit: 'Add ambulance', ds_call_sign: 'Call sign', ds_kind: 'Type', ds_operator: 'Operator', ds_crew_phone: 'Crew phone (international format)', ds_base_lat: 'Base latitude', ds_base_lng: 'Base longitude',
    ds_country: 'Country code', ds_crew: 'Crew', ds_add_crew: 'Add crew account', ds_crew_name: 'Crew member name', ds_crew_email: 'Email', ds_crew_password: 'Temporary password (12+ characters)',
    ds_position: 'Last position', ds_never: 'never', ds_set_off: 'Set off duty', ds_set_on: 'Set available', ds_needs_server: 'This page needs the HFA account server.'
  });
  Object.assign(T.fr, {
    ambulance: 'Équipage d’ambulance',
    ds_sos: 'SOS', ds_sos_title: 'Urgence — demander une ambulance',
    ds_sos_body: 'HFA envoie votre position à l’équipage d’ambulance en service le plus proche. Votre médecin et votre infirmier sont prévenus. En cas de danger immédiat, appelez aussi le numéro d’urgence maintenant.',
    ds_send: 'Demander une ambulance maintenant', ds_call: 'Appeler', ds_locating: 'Localisation en cours…',
    ds_need_gps: 'Votre position est nécessaire pour envoyer une ambulance. Autorisez la localisation ou appelez le numéro d’urgence maintenant.',
    ds_offline: 'Vous êtes hors ligne : HFA ne peut pas joindre d’équipage. Appelez le numéro d’urgence ou utilisez un contact d’ambulance hospitalière enregistré ci-dessous.',
    ds_no_server: 'Les demandes d’ambulance nécessitent le serveur HFA. Appelez le numéro d’urgence ou trouvez un contact d’ambulance hospitalière ci-dessous.',
    ds_s_received: 'Demande reçue', ds_s_offered: 'Recherche de l’équipage le plus proche…', ds_s_accepted: 'Un équipage a accepté — départ imminent',
    ds_s_en_route: 'Ambulance en route', ds_s_on_scene: 'L’ambulance est arrivée', ds_s_transporting: 'Transport vers l’hôpital',
    ds_s_completed: 'Remis à l’hôpital', ds_s_cancelled: 'Demande annulée', ds_s_closed: 'Clôturée par la régulation HFA',
    ds_s_no_unit: 'Aucune ambulance partenaire HFA n’est libre à proximité. Appelez le numéro d’urgence ou une ambulance hospitalière ci-dessous. La régulation HFA est alertée.',
    ds_eta: 'environ {minutes} min · {km} km', ds_eta_wait: 'L’heure d’arrivée s’affiche dès qu’un équipage accepte.',
    ds_call_crew: 'Appeler l’équipage', ds_cancel: 'Annuler la demande', ds_cancel_confirm: 'Annuler la demande d’ambulance ?', ds_on_map: 'Ambulance sur la carte',
    ds_live: 'Votre position est partagée en direct avec l’équipage jusqu’à la fin de la demande.', ds_find_contacts: 'Trouver des contacts d’ambulance hospitalière',
    ds_crew_nav: 'Ambulance', ds_crew_job: 'Mission en cours', ds_crew_title: 'Équipage d’ambulance', ds_unlinked: 'Votre compte n’est pas encore lié à une ambulance. Demandez à la régulation HFA de le lier.',
    ds_on_duty: 'En service', ds_off_duty: 'Hors service', ds_u_available: 'Disponible', ds_u_off_duty: 'Hors service', ds_u_offered: 'Mission proposée', ds_u_busy: 'En mission',
    ds_duty_note: 'En service, cet appareil partage la position de l’ambulance avec la régulation HFA pour envoyer l’unité la plus proche. Gardez la localisation activée.',
    ds_no_job: 'Aucune mission pour le moment. Les propositions apparaissent ici et vous êtes notifié.', ds_offer: 'Mission d’urgence proposée — répondez avant {time}',
    ds_patient_location: 'Position du patient', ds_navigate: 'Itinéraire', ds_call_patient: 'Appeler le patient', ds_summary: 'Résumé d’urgence',
    ds_blood: 'Groupe sanguin', ds_genotype: 'Génotype', ds_conditions: 'Pathologies', ds_allergies: 'Allergies médicamenteuses', ds_meds: 'Traitements en cours', ds_none: 'Rien d’enregistré',
    ds_a_accept: 'Accepter', ds_a_decline: 'Refuser', ds_a_en_route: 'Départ — en route', ds_a_on_scene: 'Arrivé sur place', ds_a_transporting: 'Transport vers l’hôpital', ds_a_handover: 'Remis à l’hôpital',
    ds_destination: 'Hôpital de destination', ds_hidden_until_accept: 'Les informations du patient s’affichent après acceptation.',
    ds_admin_section: 'Régulation des urgences', ds_console: 'Console SOS', ds_fleet: 'Flotte d’ambulances',
    ds_console_intro: 'Chaque demande SOS avec la position du patient, l’ambulance sollicitée et chaque étape. Sans réponse en 60 secondes, la mission passe à l’équipage suivant.',
    ds_assign: 'Affecter', ds_close: 'Clôturer', ds_close_note: 'Motif de clôture (pour le dossier)', ds_open_map: 'Ouvrir la carte', ds_no_requests: 'Aucune demande SOS.',
    ds_fleet_intro: 'Ambulances partenaires et équipages. Une unité ne reçoit des missions que si son équipage est en service et a transmis sa position dans les 30 dernières minutes.',
    ds_add_unit: 'Ajouter une ambulance', ds_call_sign: 'Indicatif', ds_kind: 'Type', ds_operator: 'Opérateur', ds_crew_phone: 'Téléphone de l’équipage (format international)', ds_base_lat: 'Latitude de la base', ds_base_lng: 'Longitude de la base',
    ds_country: 'Code pays', ds_crew: 'Équipage', ds_add_crew: 'Ajouter un compte équipage', ds_crew_name: 'Nom du membre d’équipage', ds_crew_email: 'E-mail', ds_crew_password: 'Mot de passe temporaire (12 caractères ou plus)',
    ds_position: 'Dernière position', ds_never: 'jamais', ds_set_off: 'Mettre hors service', ds_set_on: 'Mettre disponible', ds_needs_server: 'Cette page nécessite le serveur HFA.'
  });

  const ACTIVE = ['received', 'offered', 'accepted', 'en_route', 'on_scene', 'transporting'];
  const online = () => typeof ApiState !== 'undefined' && ApiState.enabled && ApiState.authenticated && !ApiState.offline;
  const fmt = (key, values) => window.hfaFormat ? window.hfaFormat(key, values) : t(key);
  const countryCode = () => String((CU && (CU.countryCode || CU.healthProfile?.location?.countryCode)) || (typeof priceCountry === 'function' ? priceCountry() : 'CM')).toUpperCase();
  const emergencyNumber = () => window.HFACountryData?.get(countryCode())?.emergencyNumber || null;
  const callButton = () => { const number = emergencyNumber(); return number ? `<a class="btn bd2" href="tel:${esc(number)}">📞 ${esc(t('ds_call'))} ${esc(number)}</a>` : `<p class="mu sm">${esc(t('ab_emergency_unavailable'))}</p>`; };
  const contactsBlock = () => `<div class="mt8"><button type="button" class="btn bs bsm" onclick="HFAAmbulance.findNearest()">${esc(t('ds_find_contacts'))}</button><section id="st-ambulance-panel" class="st-ambulance-panel" aria-live="polite"></section></div>`;
  const mapLink = (lat, lng, label) => `<a class="btn bs bsm" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=16/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}">${esc(label)}</a>`;
  const steps = timeline => `<ol class="ds-steps">${(timeline || []).slice(-6).reverse().map(step => `<li><strong>${esc(String(step.at).slice(11, 16))}</strong> ${esc(t('ds_s_' + step.status) === 'ds_s_' + step.status ? step.status : t('ds_s_' + step.status))}${step.note ? ` — ${esc(step.note)}` : ''}</li>`).join('')}</ol>`;

  // ───────────── Patient SOS ─────────────
  let current = null, pollTimer = null, geoWatch = null, lastLocationSent = 0;
  function stopTracking() { clearInterval(pollTimer); pollTimer = null; if (geoWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoWatch); geoWatch = null; }
  function trackerHTML(r) {
    const eta = r.eta ? fmt('ds_eta', { minutes: String(r.eta.minutes), km: String(r.eta.km) }) : null;
    const progress = r.eta && r.startKm ? Math.max(5, Math.min(95, Math.round(100 - r.eta.km / r.startKm * 100))) : r.status === 'on_scene' || r.status === 'transporting' ? 100 : 8;
    return `<div id="ds-tracker" class="ds-tracker ${r.status === 'no_unit' ? 'ds-bad' : ''}" role="status" aria-live="polite">
      <div class="ds-head"><span class="ds-icon">🚑</span><div><div class="bo">${esc(t('ds_s_' + r.status))}</div>
        <div class="mu sm">${r.unit ? `${esc(r.unit.callSign)} · ${esc(r.unit.kind)} · ${esc(r.unit.operator)}` : ''}</div></div>
        ${eta ? `<div class="ds-eta">${esc(eta)}</div>` : ''}</div>
      ${ACTIVE.includes(r.status) ? `<div class="ds-bar"><span style="width:${progress}%"></span></div><p class="mu sm">${esc(r.eta ? t('ds_live') : t('ds_eta_wait'))}</p>` : ''}
      <div class="pc-actions">${callButton()}${r.unit?.crewPhone ? `<a class="btn bp" href="tel:${esc(r.unit.crewPhone)}">📞 ${esc(t('ds_call_crew'))}</a>` : ''}${r.unit?.lat != null ? mapLink(r.unit.lat, r.unit.lng, t('ds_on_map')) : ''}
        ${ACTIVE.includes(r.status) || r.status === 'no_unit' ? `<button type="button" class="btn bs bsm" onclick="HFADispatch.cancel()">${esc(t('ds_cancel'))}</button>` : ''}</div>
      ${r.status === 'no_unit' ? contactsBlock() : ''}
      ${steps(r.timeline)}</div>`;
  }
  function paint(r) {
    current = r;
    const box = document.getElementById('ds-tracker');
    if (box) box.outerHTML = trackerHTML(r);
    const fabButton = document.getElementById('hfa-sos-fab');
    if (fabButton) fabButton.classList.toggle('ds-live', !!r && ACTIVE.includes(r.status));
    if (!r || !ACTIVE.includes(r.status)) stopTracking();
  }
  async function refresh() {
    if (!online()) return;
    try { paint((await apiRequest('/api/v1/sos/mine')).data.request); } catch (error) { /* keep the last state; retried */ }
  }
  function track(r) {
    paint(r);
    if (!ACTIVE.includes(r.status)) return;
    clearInterval(pollTimer); pollTimer = setInterval(refresh, 5000);
    if (navigator.geolocation && geoWatch === null) geoWatch = navigator.geolocation.watchPosition(position => {
      if (!current || !ACTIVE.includes(current.status) || Date.now() - lastLocationSent < 20000) return;
      lastLocationSent = Date.now();
      apiRequest(`/api/v1/sos/${encodeURIComponent(current.id)}/location`, 'POST', { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0) }).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  function locate() {
    // A recent fix answers in under a second; otherwise ask for a precise one.
    const ask = options => new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
    if (!navigator.geolocation) return Promise.reject(new Error('no-gps'));
    return ask({ maximumAge: 300000, timeout: 3000, enableHighAccuracy: false }).catch(() => ask({ maximumAge: 0, timeout: 15000, enableHighAccuracy: true }));
  }
  async function openSOS() {
    const reason = !(typeof ApiState !== 'undefined' && ApiState.enabled) ? 'ds_no_server' : (ApiState.offline || navigator.onLine === false) ? 'ds_offline' : null;
    openMo(`<div class="mh"><div class="mt2">🚨 ${esc(t('ds_sos_title'))}</div><button class="mc" onclick="closeMo()" aria-label="${esc(t('close'))}">${IC.x}</button></div>
      <div class="st-emergency" role="alert"><span>${esc(reason ? t(reason) : t('ds_sos_body'))}</span>${callButton()}</div>
      ${reason ? contactsBlock() : current && ACTIVE.includes(current.status) ? trackerHTML(current) : `<div id="ds-send-area"><button type="button" class="btn bd2 w100" id="ds-send">🚑 ${esc(t('ds_send'))}</button><div id="ds-send-msg" class="mt8" aria-live="polite"></div></div>`}`);
    if (!reason && !(current && ACTIVE.includes(current.status))) document.getElementById('ds-send').addEventListener('click', send);
    if (!reason) refresh();
  }
  async function send() {
    const button = document.getElementById('ds-send'), message = document.getElementById('ds-send-msg');
    button.disabled = true; message.innerHTML = `<div class="alt ai">${esc(t('ds_locating'))}</div>`;
    let position;
    try { position = await locate(); }
    catch (error) { button.disabled = false; message.innerHTML = `<div class="alt ae">${esc(t('ds_need_gps'))}</div>${contactsBlock()}`; return; }
    try {
      const { data } = await apiRequest('/api/v1/sos', 'POST', { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: Math.round(position.coords.accuracy || 0), countryCode: countryCode() });
      document.getElementById('ds-send-area').outerHTML = trackerHTML(data.request);
      lastLocationSent = Date.now(); track(data.request);
    } catch (error) {
      button.disabled = false;
      message.innerHTML = `<div class="alt ae">${esc(error.message)}</div>${contactsBlock()}`;
    }
  }
  async function cancel() {
    if (!current || !confirm(t('ds_cancel_confirm'))) return;
    try { paint((await apiRequest(`/api/v1/sos/${encodeURIComponent(current.id)}/cancel`, 'POST', {})).data.request); } catch (error) { alert(error.message); }
  }
  // The SOS button is always on screen for signed-in patients.
  function syncFab() {
    let button = document.getElementById('hfa-sos-fab');
    // Shown on every screen once a patient is signed in (the landing page included), never to anyone else.
    const show = typeof CU !== 'undefined' && !!CU && CU.role === 'patient';
    if (!show) { if (button) button.classList.add('hid'); return; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button'; button.id = 'hfa-sos-fab'; button.className = 'hfa-sos-fab';
      button.addEventListener('click', openSOS); document.body.appendChild(button);
      if (online()) refresh().then(() => { if (current && ACTIVE.includes(current.status)) track(current); });
    }
    button.textContent = t('ds_sos'); button.setAttribute('aria-label', t('ds_sos_title')); button.classList.remove('hid');
  }
  setInterval(syncFab, 1000);

  // Signed-in patients can also request an ambulance from the Emergency page.
  if (window.HFATriageUI?.openEmergency) {
    const original = HFATriageUI.openEmergency;
    HFATriageUI.openEmergency = (...args) => {
      original(...args);
      if (typeof CU !== 'undefined' && CU?.role === 'patient' && online()) document.querySelector('#public-triage-body .st-emergency')?.insertAdjacentHTML('afterend',
        `<div class="card mb18"><p class="sm">${esc(t('ds_sos_body'))}</p><button type="button" class="btn bd2" onclick="HFADispatch.openSOS()">🚑 ${esc(t('ds_send'))}</button></div>`);
    };
  }

  // ───────────── Ambulance crew ─────────────
  NAV.ambulance = [
    { s: () => t('ds_crew_nav'), items: [{ id: 'dashboard', l: () => t('ds_crew_job'), i: 'pulse' }] },
    { s: () => t('communications'), items: [{ id: 'messages', l: () => t('messages'), i: 'msg' }] },
    { s: () => t('legal_privacy'), items: [{ id: 'privacy', l: () => t('privacy_nav'), i: 'file' }, { id: 'confidentiality', l: () => t('confidentiality_nav'), i: 'clip' }] }
  ];
  let crewTimer = null, crewWatch = null, crewLastPosition = 0, crewDuty = null;
  function stopCrew() { clearInterval(crewTimer); crewTimer = null; if (crewWatch !== null && navigator.geolocation) navigator.geolocation.clearWatch(crewWatch); crewWatch = null; }
  function reportPosition(coords, duty) {
    crewLastPosition = Date.now();
    return apiRequest('/api/v1/crew/position', 'POST', { lat: coords.latitude, lng: coords.longitude, accuracy: Math.round(coords.accuracy || 0), ...(duty ? { duty } : {}) });
  }
  function watchCrew() {
    if (!navigator.geolocation || crewWatch !== null) return;
    crewWatch = navigator.geolocation.watchPosition(position => {
      if (Date.now() - crewLastPosition > 20000) reportPosition(position.coords).catch(() => {});
    }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  async function setDuty(duty) {
    try {
      const position = await locate();
      crewDuty = duty; await reportPosition(position.coords, duty);
      if (duty === 'off_duty') stopCrew();
      renderCrew($('pgc'));
    } catch (error) { alert(error.message === 'no-gps' || error.code ? t('ds_need_gps') : error.message); }
  }
  async function crewAction(id, action) {
    const body = { action };
    if (action === 'transporting') { const destination = prompt(t('ds_destination'), ''); if (destination === null) return; if (destination.trim()) body.destination = destination.trim().slice(0, 160); }
    try { await apiRequest(`/api/v1/crew/job/${encodeURIComponent(id)}`, 'POST', body); } catch (error) { alert(error.message); }
    renderCrew($('pgc'));
  }
  async function renderCrew(pc) {
    $('tbt').textContent = t('ds_crew_title');
    if (!online()) { pc.innerHTML = `<div class="page"><div class="card"><p class="mu sm">${esc(t('ds_needs_server'))}</p></div></div>`; return; }
    let data;
    try { data = (await apiRequest('/api/v1/crew/job')).data; } catch (error) { pc.innerHTML = `<div class="page"><div class="alt ae">${esc(error.message)}</div></div>`; return; }
    if (CP !== 'dashboard' || CU?.role !== 'ambulance') return;
    const { unit, job } = data;
    if (!unit) { pc.innerHTML = `<div class="page"><div class="card"><p>${esc(t('ds_unlinked'))}</p></div></div>`; return; }
    if (unit.status !== 'off_duty') watchCrew();
    const summary = job?.patient?.summary, list = items => items && items.length ? items.map(esc).join(', ') : esc(t('ds_none'));
    pc.innerHTML = `<div class="page"><div class="ph"><h2>🚑 ${esc(unit.callSign)} · ${esc(unit.kind)}</h2><p>${esc(unit.operator)}</p></div>
      <div class="card mb18"><div class="ch"><div class="ct">${esc(t('ds_u_' + unit.status))}</div>
        ${!job ? `<div class="pc-actions" style="margin:0"><button type="button" class="btn ${unit.status === 'available' ? 'bs' : 'bp'} bsm" onclick="HFADispatch.setDuty('available')">${esc(t('ds_on_duty'))}</button><button type="button" class="btn bs bsm" onclick="HFADispatch.setDuty('off_duty')">${esc(t('ds_off_duty'))}</button></div>` : ''}</div>
        <p class="mu sm">${esc(t('ds_duty_note'))} ${esc(t('ds_position'))}: ${unit.positionAt ? esc(new Date(unit.positionAt).toLocaleTimeString()) : esc(t('ds_never'))}</p></div>
      ${job ? `<div class="card mb18 ds-job"><div class="ch"><div class="ct">🚨 ${esc(job.status === 'offered' ? fmt('ds_offer', { time: new Date(job.offerExpiresAt).toLocaleTimeString() }) : t('ds_s_' + job.status))}</div>${job.distance ? `<span class="badge bwa">${esc(fmt('ds_eta', { minutes: String(job.distance.minutes), km: String(job.distance.km) }))}</span>` : ''}</div>
        <p class="sm"><strong>${esc(t('ds_patient_location'))}:</strong> ${esc(job.location.lat.toFixed(5))}, ${esc(job.location.lng.toFixed(5))} ${job.location.accuracy ? `(±${esc(String(Math.round(job.location.accuracy)))} m)` : ''} · ${esc(new Date(job.location.at).toLocaleTimeString())}</p>
        <div class="pc-actions"><a class="btn bp" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.location.lat + ',' + job.location.lng)}&travelmode=driving">🧭 ${esc(t('ds_navigate'))}</a>
          ${job.patient?.phone ? `<a class="btn bs" href="tel:${esc(job.patient.phone)}">📞 ${esc(t('ds_call_patient'))}</a>` : ''}
          ${job.actions.map(action => `<button type="button" class="btn ${action === 'decline' ? 'bs' : 'bd2'}" onclick="HFADispatch.crewAction('${esc(job.id)}','${action}')">${esc(t('ds_a_' + action))}</button>`).join('')}</div>
        ${job.patient ? `<h3 class="ct mt18">${esc(job.patient.name)} — ${esc(t('ds_summary'))}</h3>
          <div class="ds-summary"><div><span>${esc(t('ds_blood'))}</span><strong>${esc(summary.bloodGroup || '—')}</strong></div><div><span>${esc(t('ds_genotype'))}</span><strong>${esc(summary.genotype || '—')}</strong></div>
          <div class="ds-wide"><span>${esc(t('ds_allergies'))}</span><strong>${list(summary.drugAllergies)}</strong></div><div class="ds-wide"><span>${esc(t('ds_conditions'))}</span>${list(summary.conditions)}</div><div class="ds-wide"><span>${esc(t('ds_meds'))}</span>${list(summary.medicines)}</div></div>`
          : `<p class="mu sm">${esc(t('ds_hidden_until_accept'))}</p>`}
        ${steps(job.timeline)}</div>` : `<div class="card"><p class="mu sm">${esc(t('ds_no_job'))}</p></div>`}</div>`;
    clearInterval(crewTimer); crewTimer = setInterval(() => { if (CP === 'dashboard' && CU?.role === 'ambulance' && !document.querySelector('#movr:not(.hid)')) renderCrew($('pgc')); else clearInterval(crewTimer); }, 5000);
  }

  // ───────────── Administrators ─────────────
  if (Array.isArray(NAV.admin)) NAV.admin.push({ s: () => t('ds_admin_section'), items: [{ id: 'sos-console', l: () => t('ds_console'), i: 'pulse' }, { id: 'fleet', l: () => t('ds_fleet'), i: 'shield' }] });
  async function renderConsole(pc) {
    $('tbt').textContent = t('ds_console');
    if (!online()) { pc.innerHTML = `<div class="page"><div class="card"><p class="mu sm">${esc(t('ds_needs_server'))}</p></div></div>`; return; }
    const [{ data: { requests } }, { data: { units } }] = await Promise.all([apiRequest('/api/v1/admin/sos'), apiRequest('/api/v1/admin/ambulance/units')]);
    const free = units.filter(unit => unit.status === 'available' && unit.crew.some(member => member.status === 'active'));
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ds_console'))}</h2><p>${esc(t('ds_console_intro'))}</p></div>
      ${requests.length ? requests.map(r => `<div class="card mb12 ${r.open ? 'ds-open' : ''}"><div class="ch"><div><div class="ct">🚨 ${esc(r.patient.name || '')}</div><div class="mu sm">${esc(r.createdAt.slice(0, 16).replace('T', ' '))} · ${esc(r.patient.phone || '')}</div></div><span class="badge ${r.open ? 'bda' : 'bsu'}">${esc(t('ds_s_' + r.status))}</span></div>
        <p class="sm">${esc(r.location.lat.toFixed(5))}, ${esc(r.location.lng.toFixed(5))} ${r.location.accuracy ? `(±${esc(String(Math.round(r.location.accuracy)))} m)` : ''} ${mapLink(r.location.lat, r.location.lng, t('ds_open_map'))} ${r.unit ? `· <strong>${esc(r.unit.callSign)}</strong>` : ''} ${r.eta ? `· ${esc(fmt('ds_eta', { minutes: String(r.eta.minutes), km: String(r.eta.km) }))}` : ''}</p>
        ${steps(r.timeline)}
        ${r.open ? `<div class="pc-actions">${r.patient.phone ? `<a class="btn bs bsm" href="tel:${esc(r.patient.phone)}">📞</a>` : ''}
          ${['offered', 'no_unit', 'received'].includes(r.status) && free.length ? `<select class="fc" id="ds-as-${esc(r.id)}" style="width:auto" aria-label="${esc(t('ds_assign'))}">${free.map(unit => `<option value="${esc(unit.id)}">${esc(unit.callSign)}</option>`).join('')}</select><button type="button" class="btn bp bsm" onclick="HFADispatch.assign('${esc(r.id)}')">${esc(t('ds_assign'))}</button>` : ''}
          <button type="button" class="btn bs bsm" onclick="HFADispatch.closeRequest('${esc(r.id)}')">${esc(t('ds_close'))}</button></div>` : ''}</div>`).join('') : `<div class="card"><p class="mu sm">${esc(t('ds_no_requests'))}</p></div>`}</div>`;
  }
  async function renderFleet(pc) {
    $('tbt').textContent = t('ds_fleet');
    if (!online()) { pc.innerHTML = `<div class="page"><div class="card"><p class="mu sm">${esc(t('ds_needs_server'))}</p></div></div>`; return; }
    const { data: { units } } = await apiRequest('/api/v1/admin/ambulance/units');
    const field = (id, label, type = 'text', extra = '') => `<div class="fg"><label class="fl" for="${id}">${esc(t(label))}</label><input class="fc" id="${id}" type="${type}" ${extra}></div>`;
    pc.innerHTML = `<div class="page"><div class="ph"><h2>${esc(t('ds_fleet'))}</h2><p>${esc(t('ds_fleet_intro'))}</p></div>
      <div class="card mb18"><div class="tw"><table><thead><tr><th>${esc(t('ds_call_sign'))}</th><th>${esc(t('ds_operator'))}</th><th>${esc(t('status'))}</th><th>${esc(t('ds_position'))}</th><th>${esc(t('ds_crew'))}</th><th></th></tr></thead><tbody>
      ${units.map(unit => `<tr><td class="bo sm">${esc(unit.callSign)} <span class="badge bse">${esc(unit.kind)}</span></td><td class="sm">${esc(unit.operator)}<div class="mu sm">${esc(unit.crewPhone)}</div></td>
        <td class="sm">${esc(t('ds_u_' + unit.status))}</td><td class="mu sm">${unit.lat != null ? mapLink(unit.lat, unit.lng, `${unit.lat.toFixed(4)}, ${unit.lng.toFixed(4)}`) : ''}<div>${unit.positionAt ? esc(unit.positionAt.slice(0, 16).replace('T', ' ')) : esc(t('ds_never'))}</div></td>
        <td class="sm">${unit.crew.map(member => esc(member.name)).join('<br>') || '—'}</td>
        <td>${['available', 'off_duty'].includes(unit.status) ? `<button type="button" class="btn bs bsm" onclick="HFADispatch.setUnit('${esc(unit.id)}','${unit.status === 'available' ? 'off_duty' : 'available'}')">${esc(t(unit.status === 'available' ? 'ds_set_off' : 'ds_set_on'))}</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="6" class="mu sm">—</td></tr>`}
      </tbody></table></div></div>
      <div class="g2"><form class="card" id="ds-unit-form" novalidate><div class="ct mb12">${esc(t('ds_add_unit'))}</div>
        <div class="fr">${field('ds-cs', 'ds_call_sign', 'text', 'maxlength="40" placeholder="AMB-LMB-01"')}<div class="fg"><label class="fl" for="ds-kind">${esc(t('ds_kind'))}</label><select class="fc" id="ds-kind"><option>BLS</option><option>ALS</option></select></div></div>
        ${field('ds-op', 'ds_operator', 'text', 'maxlength="160"')}<div class="fr">${field('ds-phone', 'ds_crew_phone', 'tel', 'placeholder="+2376…"')}${field('ds-cc', 'ds_country', 'text', `maxlength="2" value="${esc(countryCode())}"`)}</div>
        <div class="fr">${field('ds-lat', 'ds_base_lat', 'number', 'step="any"')}${field('ds-lng', 'ds_base_lng', 'number', 'step="any"')}</div>
        <div id="ds-unit-msg"></div><button type="submit" class="btn bp">${esc(t('ds_add_unit'))}</button></form>
      <form class="card" id="ds-crew-form" novalidate><div class="ct mb12">${esc(t('ds_add_crew'))}</div>
        <div class="fg"><label class="fl" for="ds-crew-unit">${esc(t('ds_call_sign'))}</label><select class="fc" id="ds-crew-unit">${units.map(unit => `<option value="${esc(unit.id)}">${esc(unit.callSign)}</option>`).join('')}</select></div>
        ${field('ds-crew-name', 'ds_crew_name', 'text', 'maxlength="120"')}${field('ds-crew-email', 'ds_crew_email', 'email', 'maxlength="254"')}${field('ds-crew-phone', 'ds_crew_phone', 'tel')}${field('ds-crew-pw', 'ds_crew_password', 'password', 'minlength="12" autocomplete="new-password"')}
        <div id="ds-crew-msg"></div><button type="submit" class="btn bp" ${units.length ? '' : 'disabled'}>${esc(t('ds_add_crew'))}</button></form></div></div>`;
    const message = (id, text, kind) => { document.getElementById(id).innerHTML = `<div class="alt ${kind}">${esc(text)}</div>`; };
    document.getElementById('ds-unit-form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        await apiRequest('/api/v1/admin/ambulance/units', 'POST', { callSign: $('ds-cs').value.trim(), kind: $('ds-kind').value, operator: $('ds-op').value.trim(), crewPhone: $('ds-phone').value.replace(/[\s()-]/g, ''),
          countryCode: $('ds-cc').value.trim().toUpperCase(), lat: Number($('ds-lat').value), lng: Number($('ds-lng').value) });
        renderFleet(pc);
      } catch (error) { message('ds-unit-msg', error.message, 'ae'); }
    });
    document.getElementById('ds-crew-form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const phone = $('ds-crew-phone').value.replace(/[\s()-]/g, '');
        const created = await apiRequest('/api/admin/users', 'POST', { name: $('ds-crew-name').value.trim(), role: 'ambulance', password: $('ds-crew-pw').value,
          ...($('ds-crew-email').value.trim() ? { email: $('ds-crew-email').value.trim() } : {}), ...(phone ? { phone } : {}) });
        await apiRequest(`/api/v1/admin/ambulance/units/${encodeURIComponent($('ds-crew-unit').value)}/crew`, 'POST', { userId: created.user.id });
        renderFleet(pc);
      } catch (error) { message('ds-crew-msg', error.message, 'ae'); }
    });
  }
  async function assign(id) {
    try { await apiRequest(`/api/v1/admin/sos/${encodeURIComponent(id)}/assign`, 'POST', { unitId: document.getElementById('ds-as-' + id).value }); } catch (error) { alert(error.message); }
    renderConsole($('pgc'));
  }
  async function closeRequest(id) {
    const note = prompt(t('ds_close_note'), ''); if (!note || note.trim().length < 3) return;
    try { await apiRequest(`/api/v1/admin/sos/${encodeURIComponent(id)}/close`, 'POST', { note: note.trim().slice(0, 300) }); } catch (error) { alert(error.message); }
    renderConsole($('pgc'));
  }
  async function setUnit(id, status) {
    try { await apiRequest(`/api/v1/admin/ambulance/units/${encodeURIComponent(id)}`, 'PATCH', { status }); } catch (error) { alert(error.message); }
    renderFleet($('pgc'));
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .hfa-sos-fab{position:fixed;right:18px;bottom:84px;z-index:900;width:68px;height:68px;border-radius:50%;border:4px solid #fff;background:radial-gradient(circle at 35% 30%,#ef5350,#b71c1c);color:#fff;font-weight:800;font-size:1.05rem;letter-spacing:.04em;cursor:pointer;box-shadow:0 6px 18px rgba(183,28,28,.45)}
    .hfa-sos-fab:focus-visible{outline:3px solid #ffd54f;outline-offset:3px}
    .hfa-sos-fab.ds-live{animation:dsPulse 1.6s infinite}
    @keyframes dsPulse{0%,100%{box-shadow:0 0 0 0 rgba(198,40,40,.55)}50%{box-shadow:0 0 0 14px rgba(198,40,40,0)}}
    @media (prefers-reduced-motion:reduce){.hfa-sos-fab.ds-live{animation:none}}
    .ds-tracker{border:2px solid #c62828;border-radius:10px;padding:14px;margin-top:12px}
    .ds-tracker.ds-bad{border-color:#e65100;background:#fff8f0}
    .ds-head{display:flex;align-items:center;gap:12px}.ds-icon{font-size:1.7rem}.ds-head>div{flex:1}
    .ds-eta{font-weight:700;color:#c62828;text-align:right}
    .ds-bar{height:8px;background:#f8d7d3;border-radius:4px;overflow:hidden;margin:12px 0 6px}.ds-bar span{display:block;height:100%;background:#c62828;transition:width .8s}
    .ds-steps{margin:10px 0 0 18px;font-size:.8rem}.ds-steps li{padding:2px 0}
    .ds-open{border-left:4px solid #c62828}
    .ds-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.ds-summary>div{border:1px solid var(--bd);border-radius:6px;padding:8px 10px;font-size:.85rem}
    .ds-summary span{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:var(--t3)}.ds-wide{grid-column:span 2}
  </style>`);

  window.HFADispatch = {
    handles: (page, role) => (role === 'ambulance' && page === 'dashboard') || (role === 'admin' && ['sos-console', 'fleet'].includes(page)),
    renderPage: (page, pc) => {
      const render = page === 'sos-console' ? renderConsole : page === 'fleet' ? renderFleet : renderCrew;
      return render(pc).catch(error => { pc.innerHTML = `<div class="page"><div class="alt ae">${esc(error.message)}</div></div>`; });
    },
    openSOS, cancel, setDuty, crewAction, assign, closeRequest, setUnit, trackerHTML
  };
})();
