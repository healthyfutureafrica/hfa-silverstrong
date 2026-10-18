// Sends queued consultations to the server whenever the phone is online.
// Triggers: the connection coming back (NetInfo), the app returning to the foreground, a timer,
// and the "Sync now" button. Only one sync runs at a time.

const DEFAULT_INTERVAL_MS = 60000;

function createSyncService({ queue, api, netInfo, logger = console, intervalMs = DEFAULT_INTERVAL_MS }) {
  let syncing = null;
  let timer = null;
  let unsubscribe = null;
  const listeners = new Set();

  const isOnline = state => Boolean(state?.isConnected) && state?.isInternetReachable !== false;
  const notify = async () => { const counts = await queue.counts(); listeners.forEach(listener => listener(counts)); };

  async function runSync() {
    const state = await netInfo.fetch();
    if (!isOnline(state)) return { sent: 0, skipped: 'offline' };
    let sent = 0;
    for (const record of await queue.due()) {
      let consultation;
      try {
        consultation = await queue.open(record);
      } catch (error) {
        await queue.markNeedsReview(record.localId, 'Could not decrypt the saved record on this device');
        continue;
      }
      // The local id doubles as the Idempotency-Key, so a retry after a dropped connection can
      // never create the same consultation twice on the server.
      const result = await api.submitConsultation(consultation, record.localId);
      if (result.ok) {
        await queue.markSynced(record.localId, result.serverId);
        sent++;
      } else if (result.kind === 'auth') {
        logger.warn('chw_sync_paused_signin_required');
        return { sent, skipped: 'signin_required' }; // keep everything queued until the CHW signs in again
      } else if (result.kind === 'rejected') {
        await queue.markNeedsReview(record.localId, result.message);
      } else {
        await queue.markRetry(record.localId, result.message);
        if (result.kind === 'network') break; // connection dropped mid-sync: stop and wait
      }
    }
    return { sent };
  }

  async function syncNow() {
    if (!syncing) {
      syncing = runSync().finally(async () => { syncing = null; await notify(); });
    }
    return syncing;
  }

  function start({ appState } = {}) {
    unsubscribe = netInfo.addEventListener(state => { if (isOnline(state)) syncNow().catch(() => {}); });
    const appStateSubscription = appState?.addEventListener('change', status => { if (status === 'active') syncNow().catch(() => {}); });
    timer = setInterval(() => syncNow().catch(() => {}), intervalMs);
    syncNow().catch(() => {});
    return () => {
      unsubscribe?.();
      appStateSubscription?.remove?.();
      clearInterval(timer);
    };
  }

  function onChange(listener) {
    listeners.add(listener);
    notify().catch(() => {});
    return () => listeners.delete(listener);
  }

  return { syncNow, start, onChange, isOnline };
}

module.exports = { createSyncService };
