// Offline queue of field consultations, stored in AsyncStorage (one key per record).
// Each record = sync metadata (plain) + the consultation itself (AES-256-GCM encrypted).
// After the server confirms a record, its encrypted content is deleted from the phone.

const PREFIX = 'hfa.chw.consultation.';
const MAX_RECORDS = 500; // keeps well under Android's default AsyncStorage size limit

function createConsultationQueue({ storage, cipher, now = () => Date.now(), randomId }) {
  const keyFor = localId => `${PREFIX}${localId}`;
  const aad = localId => `chw-consultation:${localId}`;

  async function readAll() {
    const keys = (await storage.getAllKeys()).filter(key => key.startsWith(PREFIX));
    if (!keys.length) return [];
    const pairs = await storage.multiGet(keys);
    return pairs.map(([, value]) => JSON.parse(value)).sort((a, b) => a.savedAt - b.savedAt);
  }

  async function write(record) {
    await storage.setItem(keyFor(record.localId), JSON.stringify(record));
  }

  // Saves a completed form. Works with no network at all.
  async function save(consultation) {
    const unsynced = (await readAll()).filter(record => record.status !== 'synced');
    if (unsynced.length >= MAX_RECORDS) throw new Error('Offline storage is full. Connect to the internet to sync before adding more consultations.');
    const localId = randomId();
    const record = {
      localId,
      status: 'pending',               // pending -> synced | needs_review
      priority: consultation.triage?.level === 'emergency' || consultation.escalationRequested ? 0 : 1,
      savedAt: now(),
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
      serverId: null,
      payload: await cipher.encrypt(consultation, aad(localId))
    };
    await write(record);
    return { localId, status: record.status };
  }

  async function get(localId) {
    const raw = await storage.getItem(keyFor(localId));
    return raw ? JSON.parse(raw) : null;
  }

  const open = record => cipher.decrypt(record.payload, aad(record.localId));

  // Records ready to send: escalations and emergencies first, then oldest first.
  async function due() {
    return (await readAll())
      .filter(record => record.status === 'pending' && record.nextAttemptAt <= now())
      .sort((a, b) => a.priority - b.priority || a.savedAt - b.savedAt);
  }

  async function markSynced(localId, serverId) {
    const record = await get(localId);
    if (!record) return;
    await write({ ...record, status: 'synced', serverId, payload: null, lastError: null, syncedAt: now() });
  }

  // Network or server problem: try again later, waiting longer each time (max 30 minutes).
  async function markRetry(localId, error) {
    const record = await get(localId);
    if (!record) return;
    const attempts = record.attempts + 1;
    await write({ ...record, attempts, lastError: String(error).slice(0, 200), nextAttemptAt: now() + Math.min(30 * 60000, 15000 * 2 ** Math.min(attempts, 7)) });
  }

  // The server refused the record (e.g. validation): keep it for the CHW / supervisor to fix.
  async function markNeedsReview(localId, error) {
    const record = await get(localId);
    if (!record) return;
    await write({ ...record, status: 'needs_review', attempts: record.attempts + 1, lastError: String(error).slice(0, 200) });
  }

  async function counts() {
    const records = await readAll();
    return {
      pending: records.filter(record => record.status === 'pending').length,
      needsReview: records.filter(record => record.status === 'needs_review').length,
      synced: records.filter(record => record.status === 'synced').length
    };
  }

  // Housekeeping: forget synced entries after 7 days (they hold no clinical data anyway).
  async function pruneSynced(olderThanMs = 7 * 86400000) {
    const stale = (await readAll()).filter(record => record.status === 'synced' && now() - (record.syncedAt || 0) > olderThanMs);
    await Promise.all(stale.map(record => storage.removeItem(keyFor(record.localId))));
    return stale.length;
  }

  return { save, get, open, due, markSynced, markRetry, markNeedsReview, counts, pruneSynced, readAll };
}

module.exports = { createConsultationQueue, PREFIX };
