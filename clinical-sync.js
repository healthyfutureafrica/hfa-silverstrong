// Keeps the clinical records in this browser (DB.appointments, DB.messages, …) in step with the server, so
// every device of the patient and of their care team shows the same record.
//
// - After sign-in (and after the offline copy is restored) it downloads everything this person may see.
// - Every few seconds it compares each record with the last version the server confirmed and sends what
//   changed, naming that version. The server decides who may do what; a refused change is undone here and
//   explained, and a change someone else made first is replaced by the latest copy.
// - Changes made offline stay in the encrypted offline copy (with the versions below) and are sent on reconnect.
// - New records from others (messages, bookings, results) arrive every few seconds.
(function () {
  const COLLECTIONS = ['appointments', 'messages', 'careNotes', 'doctorReports', 'medicalDocuments', 'labResults', 'specialistReferrals', 'homeVisits', 'reviews', 'carePlans'];
  const PUSH_MS = 3000, PULL_MS = 10000, FAST_PULL_MS = 5000;

  Object.assign(T.en, {
    sync_conflict: 'Someone else changed this record first. The latest version is now shown.', sync_refused: 'A change was not saved: {reason}',
    sync_removed: 'A record you no longer have access to was removed from this device.'
  });
  Object.assign(T.fr, {
    sync_conflict: 'Quelqu’un d’autre a modifié ce dossier avant vous. La dernière version est maintenant affichée.', sync_refused: 'Une modification n’a pas été enregistrée : {reason}',
    sync_removed: 'Un dossier auquel vous n’avez plus accès a été retiré de cet appareil.'
  });

  // known[collection][id] = { version, hash } — the server's last confirmed copy of each record.
  let known = {}, serverTime = '', pushing = false, pulling = false, started = false, lastPull = 0;
  const reset = () => { known = Object.fromEntries(COLLECTIONS.map(name => [name, {}])); serverTime = ''; started = false; };
  reset();

  // An administrator signed in as a staff member for support may read but never change clinical records.
  const online = () => ApiState.enabled && ApiState.authenticated && !ApiState.offline && typeof CU !== 'undefined' && !!CU;
  const active = () => online() && !window.HFA_IMPERSONATED_BY;
  // Files never change after upload, so they are left out of the comparison (keeps it fast on phones).
  const hash = record => JSON.stringify(record, (key, value) => key === 'fileData' ? (value ? `len:${String(value).length}` : value) : value);
  const notice = text => window.dispatchEvent(new CustomEvent('hfa-offline-notice', { detail: text }));
  const list = name => (Array.isArray(DB[name]) ? DB[name] : (DB[name] = []));

  function put(name, data) {
    const items = list(name), index = items.findIndex(item => item.id === data.id);
    if (index >= 0) items[index] = { ...items[index], ...data }; else items.push(data);
  }
  function remove(name, id) { DB[name] = list(name).filter(item => item.id !== id); }
  function confirm(name, record) { known[name][record.id] = { version: record.version, hash: hash(list(name).find(item => item.id === record.id) || record.data) }; }

  async function pull() {
    if (!online() || pulling) return false;
    pulling = true;
    let changed = false;
    try {
      const response = await apiRequest(`/api/v1/clinical${serverTime ? `?since=${encodeURIComponent(serverTime)}` : ''}`);
      for (const record of response.data.records) {
        if (!COLLECTIONS.includes(record.collection)) continue;
        const local = list(record.collection).find(item => item.id === record.id), seen = known[record.collection][record.id];
        // A local edit not yet sent wins here; sending it will meet the newer version and show the latest copy.
        if (local && seen && hash(local) !== seen.hash) continue;
        put(record.collection, record.data);
        confirm(record.collection, record);
        changed = true;
      }
      serverTime = response.data.serverTime;
      lastPull = Date.now();
    } catch (error) { /* offline or signed out: try again later */ }
    finally { pulling = false; }
    return changed;
  }

  async function push() {
    if (!active() || pushing || !started) return;
    pushing = true;
    let changed = false;
    try {
      for (const name of COLLECTIONS) {
        for (const record of [...list(name)]) {
          if (!record?.id) continue;
          const seen = known[name][record.id], current = hash(record);
          if (seen && seen.hash === current) continue;
          try {
            const response = await apiRequest(`/api/v1/clinical/${name}/${encodeURIComponent(record.id)}`, 'PUT', { data: record, baseVersion: seen?.version || 0 }, 60000);
            known[name][record.id] = { version: response.data.version, hash: current };
          } catch (error) {
            if (!error.status || error.status === 401 || error.status === 429 || error.status >= 500) return; // try again later, in order
            changed = true;
            if (error.status === 409) {
              const body = error.body || {};
              if (body.current) { put(name, body.current.data); confirm(name, body.current); } else { remove(name, record.id); delete known[name][record.id]; }
              notice(t('sync_conflict'));
            } else if (error.status === 404) {
              remove(name, record.id); delete known[name][record.id]; notice(t('sync_removed'));
            } else {
              // Refused (403, 400, 413): undo here. A record never accepted disappears; an edit returns to the server copy.
              if (seen) { serverTime = ''; delete known[name][record.id]; remove(name, record.id); } else remove(name, record.id);
              notice(tf('sync_refused', { reason: error.message }));
            }
          }
        }
      }
    } finally {
      pushing = false;
      if (changed) { if (!serverTime) await pull(); refresh(); }
      if (typeof HFAOffline !== 'undefined') HFAOffline.saveSoon();
    }
  }

  // Re-draw the current page when others' changes arrive, unless the person is typing or in a dialog.
  function refresh() {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (!CU || typing || !$('movr')?.classList.contains('hid') || typeof CP === 'undefined') return;
    try { renderPage(CP); } catch (error) { return; }
    const chat = document.getElementById('chatmsgs'); if (chat) chat.scrollTop = chat.scrollHeight;
  }

  async function start() {
    if (!online()) return;
    started = true;
    const changed = await pull();
    await push();
    if (changed) refresh();
  }

  setInterval(() => { push().catch(() => {}); }, PUSH_MS);
  setInterval(async () => {
    if (!online() || !started) return;
    const wait = typeof CP !== 'undefined' && CP === 'messages' ? FAST_PULL_MS : PULL_MS;
    if (Date.now() - lastPull < wait - 500) return;
    if (await pull()) { refresh(); if (typeof HFAOffline !== 'undefined') HFAOffline.saveSoon(); }
  }, 2500);

  // Start once the offline copy (if any) is back in place, so offline edits are sent rather than overwritten.
  if (typeof HFAOffline !== 'undefined') {
    HFAOffline.register('clinicalSync', {
      save: () => ({ known, serverTime }),
      load: value => { if (value?.known) { known = { ...Object.fromEntries(COLLECTIONS.map(name => [name, {}])), ...value.known }; serverTime = value.serverTime || ''; } },
      clear: reset
    });
    for (const name of ['afterOnlineLogin', 'afterSessionRestore']) {
      const original = HFAOffline[name];
      HFAOffline[name] = async (...args) => { const result = await original(...args); await start(); return result; };
    }
  }

  window.HFAClinicalSync = { start, pull, push, COLLECTIONS, state: () => ({ known, serverTime, started }) };
})();
