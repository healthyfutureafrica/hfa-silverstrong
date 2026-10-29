// Location-based ambulance contact handoff. This does not dispatch a vehicle or process a fare.
(function () {
  const CACHE_KEY = 'hfa.verified-ambulance-directory.v1';
  const esc = window.hfaEscape;
  const CACHE_MAX_AGE_MS = 30 * 86400000;
  const DIRECTORY_TIMEOUT_MS = 8000;
  const today = () => new Date().toISOString().slice(0, 10);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

  Object.assign(T.en, {
    ab_find_nearest: 'Find nearby ambulance contact',
    ab_intro: 'Allow location to find the nearest verified hospital ambulance contact. Your location stays on this device unless you choose to share it by SMS.',
    ab_locating: 'Getting your location…',
    ab_location_failed: 'Could not get your location. Allow location access and try again. You can still call emergency services now.',
    ab_location_required: 'Location is required to find a nearby ambulance contact. The emergency call remains available without it.',
    ab_country_unknown: 'Choose your country in the price selector first. Do not rely on a contact for another country.',
    ab_loading: 'Loading verified ambulance contacts…',
    ab_no_contacts: 'No current verified ambulance contacts are listed for this country. Call the emergency number above or go to the nearest hospital.',
    ab_network_failed: 'The provider directory could not be reached and there is no usable saved directory. Call the emergency number above.',
    ab_offline: 'Using the saved provider directory from {date}. Confirm the number, coverage, availability and fare with the hospital.',
    ab_saved: 'Directory last refreshed {date}. A listed contact does not confirm vehicle availability or dispatch.',
    ab_stale: 'The saved directory is old ({date}). Contact details may have changed; call the emergency number above if unsure.',
    ab_nearest: 'Nearest listed contact',
    ab_distance: '{distance} km away',
    ab_coverage: 'Listed service area: {area}',
    ab_call_provider: 'Call hospital ambulance contact',
    ab_send_location: 'Share location by SMS',
    ab_location_text: 'Location to share: {lat}, {lng} (accuracy about ±{accuracy} m).',
    ab_speak_location: 'Read these coordinates to the dispatcher during the call.',
    ab_quote_notice: 'Ask the hospital to confirm coverage, ambulance availability and its fare before agreeing. HFA has not booked a vehicle or processed a payment.',
    ab_no_gps: 'This browser cannot provide GPS location. The direct emergency call above is still available.'
  });
  Object.assign(T.fr, {
    ab_find_nearest: 'Trouver un contact ambulance proche',
    ab_intro: 'Autorisez la localisation pour trouver le contact ambulance vérifié le plus proche. Votre position reste sur cet appareil sauf si vous choisissez de la partager par SMS.',
    ab_locating: 'Obtention de votre position…',
    ab_location_failed: 'Impossible d’obtenir votre position. Autorisez la localisation puis réessayez. Vous pouvez toujours appeler les secours maintenant.',
    ab_location_required: 'La localisation est nécessaire pour trouver un contact ambulance proche. L’appel aux secours reste accessible sans elle.',
    ab_country_unknown: 'Choisissez d’abord votre pays dans le sélecteur de prix. Ne vous fiez pas à un contact d’un autre pays.',
    ab_loading: 'Chargement des contacts ambulance vérifiés…',
    ab_no_contacts: 'Aucun contact ambulance vérifié et à jour n’est répertorié dans ce pays. Appelez le numéro d’urgence ci-dessus ou rendez-vous à l’hôpital le plus proche.',
    ab_network_failed: 'Le répertoire ne répond pas et aucun répertoire enregistré utilisable n’est disponible. Appelez le numéro d’urgence ci-dessus.',
    ab_offline: 'Répertoire enregistré du {date}. Confirmez le numéro, la zone, la disponibilité et le tarif avec l’hôpital.',
    ab_saved: 'Répertoire actualisé le {date}. Un contact répertorié ne confirme ni la disponibilité ni le départ d’un véhicule.',
    ab_stale: 'Le répertoire enregistré est ancien ({date}). Les coordonnées peuvent avoir changé ; en cas de doute, appelez le numéro d’urgence ci-dessus.',
    ab_nearest: 'Contact répertorié le plus proche',
    ab_distance: 'À {distance} km',
    ab_coverage: 'Zone desservie indiquée : {area}',
    ab_call_provider: 'Appeler le contact ambulance de l’hôpital',
    ab_send_location: 'Partager la position par SMS',
    ab_location_text: 'Position à partager : {lat}, {lng} (précision d’environ ±{accuracy} m).',
    ab_speak_location: 'Lisez ces coordonnées au répartiteur pendant l’appel.',
    ab_quote_notice: 'Demandez à l’hôpital de confirmer la zone, la disponibilité de l’ambulance et le tarif avant d’accepter. HFA n’a réservé aucun véhicule et n’a traité aucun paiement.',
    ab_no_gps: 'Ce navigateur ne fournit pas de position GPS. L’appel direct aux secours ci-dessus reste disponible.'
  });

  const format = (key, values) => window.hfaFormat(key, values);
  const cacheDate = value => new Date(value).toLocaleDateString(LANG === 'fr' ? 'fr-FR' : 'en-GB');
  const escapeAttr = value => esc(String(value));

  function countryCode() {
    if (typeof CU !== 'undefined' && CU) {
      const code = CU.countryCode || CU.healthProfile?.location?.countryCode;
      if (code) return String(code).toUpperCase();
    }
    return typeof priceCountry === 'function' ? String(priceCountry()).toUpperCase() : '';
  }

  function validProvider(provider, code) {
    return provider && provider.countryCode === code && typeof provider.id === 'string' &&
      typeof provider.name === 'string' && /^\+[1-9]\d{7,14}$/.test(provider.phone || '') &&
      (!provider.sms || /^\+[1-9]\d{7,14}$/.test(provider.sms)) &&
      Number.isFinite(provider.latitude) && provider.latitude >= -90 && provider.latitude <= 90 &&
      Number.isFinite(provider.longitude) && provider.longitude >= -180 && provider.longitude <= 180 &&
      validDate(provider.expiresOn) && provider.expiresOn >= today();
  }

  function readCache(code) {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!saved || !Array.isArray(saved.providers) || !Number.isFinite(saved.fetchedAt)) return null;
      const providers = saved.providers.filter(provider => validProvider(provider, code));
      if (!providers.length || Date.now() - saved.fetchedAt > CACHE_MAX_AGE_MS) return null;
      return { providers, fetchedAt: saved.fetchedAt };
    } catch (error) {
      return null;
    }
  }

  async function loadDirectory(code) {
    let networkError = null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timer;
    try {
      const request = fetch(`/api/v1/facilities/ambulance?countryCode=${encodeURIComponent(code)}`, {
        credentials: 'omit', cache: 'no-store', ...(controller ? { signal: controller.signal } : {})
      });
      const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller?.abort();
          reject(new Error('Provider directory request timed out'));
        }, DIRECTORY_TIMEOUT_MS);
      });
      const response = await Promise.race([request, timeout]);
      if (!response.ok) throw new Error(`Provider directory request failed (${response.status})`);
      const payload = await response.json();
      const providers = Array.isArray(payload?.data?.providers) ? payload.data.providers.filter(provider => validProvider(provider, code)) : [];
      const fetchedAt = Date.now();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ providers, fetchedAt })); }
      catch (error) { return { providers, fetchedAt, cacheWarning: true }; }
      return { providers, fetchedAt };
    } catch (error) {
      networkError = error;
    } finally {
      clearTimeout(timer);
    }
    const saved = readCache(code);
    if (saved) return { ...saved, offline: true };
    throw new Error(networkError?.message || t('ab_network_failed'));
  }

  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error(t('ab_no_gps'))); return; }
      navigator.geolocation.getCurrentPosition(
        position => resolve({
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 0
        }),
        error => reject(new Error(error.code === 1 ? t('ab_location_required') : t('ab_location_failed'))),
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 12000 }
      );
    });
  }

  function distanceKm(origin, destination) {
    const radians = degrees => degrees * Math.PI / 180;
    const latDelta = radians(destination.latitude - origin.latitude);
    const lngDelta = radians(destination.longitude - origin.longitude);
    const raw = Math.sin(latDelta / 2) ** 2 +
      Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(lngDelta / 2) ** 2;
    const value = Math.min(1, Math.max(0, raw));
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  function providerCard(provider, index, location) {
    const distance = distanceKm(location, provider);
    const lat = location.latitude.toFixed(5), lng = location.longitude.toFixed(5);
    const smsText = `Ambulance request. My location is ${lat}, ${lng} (GPS accuracy ±${Math.round(location.accuracy)} m). Please confirm coverage, availability and fare.`;
    const heading = index === 0 ? `<strong>${esc(t('ab_nearest'))}</strong>` : '';
    const sms = provider.sms ? `<a class="btn bs bsm" href="sms:${escapeAttr(provider.sms)}?body=${encodeURIComponent(smsText)}">${esc(t('ab_send_location'))}</a>` : `<p class="mu sm">${esc(t('ab_speak_location'))}</p>`;
    return `<article class="card mb12">
      <div class="ch"><div class="ct">${esc(provider.name)}</div><span class="badge bwa">${esc(format('ab_distance', { distance: distance.toFixed(1) }))}</span></div>
      ${heading}${provider.coverage ? `<p class="mu sm">${esc(format('ab_coverage', { area: provider.coverage }))}</p>` : ''}
      <p class="sm">${esc(format('ab_location_text', { lat, lng, accuracy: String(Math.round(location.accuracy)) }))}</p>
      <div class="pc-actions"><a class="btn bp" href="tel:${escapeAttr(provider.phone)}">${esc(t('ab_call_provider'))}</a>${sms}</div>
    </article>`;
  }

  async function findNearest() {
    const panel = document.getElementById('st-ambulance-panel');
    if (!panel) return;
    const code = countryCode();
    if (!window.HFACountryData.get(code)) {
      panel.innerHTML = `<div class="alt ai" role="status">${esc(t('ab_country_unknown'))}</div>`;
      return;
    }
    panel.innerHTML = `<div class="alt ai" role="status">${esc(t('ab_locating'))}</div>`;
    let location;
    try { location = await getLocation(); }
    catch (error) {
      panel.innerHTML = `<div class="alt ae" role="alert">${esc(error.message || t('ab_location_failed'))}</div>`;
      return;
    }
    panel.innerHTML = `<div class="alt ai" role="status">${esc(t('ab_loading'))}</div>`;
    try {
      const directory = await loadDirectory(code);
      if (!directory.providers.length) {
        panel.innerHTML = `<div class="alt ai" role="status">${esc(t('ab_no_contacts'))}</div>`;
        return;
      }
      const ranked = directory.providers.map(provider => ({ provider, distance: distanceKm(location, provider) }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 3);
      const age = Math.max(0, Date.now() - directory.fetchedAt);
      const directoryNotice = directory.offline
        ? format(age > 7 * 86400000 ? 'ab_stale' : 'ab_offline', { date: cacheDate(directory.fetchedAt) })
        : format('ab_saved', { date: cacheDate(directory.fetchedAt) });
      panel.innerHTML = `<p class="mu sm" role="status">${esc(directoryNotice)}</p>
        ${ranked.map((item, index) => providerCard(item.provider, index, location)).join('')}
        <div class="alt ai">${esc(t('ab_quote_notice'))}</div>`;
    } catch (error) {
      panel.innerHTML = `<div class="alt ae" role="alert">${esc(t('ab_network_failed'))}</div>`;
    }
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .st-ambulance-panel{margin:8px 0 16px}
    .st-ambulance-panel .pc-actions{margin-top:8px}
  </style>`);
  window.HFAAmbulance = { findNearest, distanceKm, loadDirectory };
})();
