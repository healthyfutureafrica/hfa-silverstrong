// HTTP client for the CHW app. It never throws for expected failures; it returns a result with a
// `kind` the sync service can act on:
//   ok        -> stored on the server (or already stored: duplicate Idempotency-Key)
//   network   -> no connection / timeout: retry later
//   server    -> 5xx or 429: retry later
//   auth      -> session expired and could not be refreshed: CHW must sign in again
//   rejected  -> 4xx validation error: needs review, retrying will not help
//
// Server contract (Consultation Service, behind the API gateway):
//   POST /api/v1/chw/consultations   Idempotency-Key: <localId>   body: consultation
//     201 { success, data: { consultationId } } | 200 when the key was already used
//   POST /api/v1/chw/escalations     body: { patient, triage, vitals, summary } -> live doctor queue

function createApiClient({ baseUrl, getAccessToken, refreshSession, fetchImpl = fetch, timeoutMs = 20000 }) {
  async function send(path, { method = 'POST', body, headers = {} }, retried = false) {
    let response;
    try {
      const token = await getAccessToken();
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined
      });
    } catch (error) {
      return { ok: false, kind: 'network', message: 'No connection' };
    }
    if (response.status === 401 && !retried) {
      const refreshed = await refreshSession().catch(() => false);
      return refreshed ? send(path, { method, body, headers }, true) : { ok: false, kind: 'auth', message: 'Please sign in again' };
    }
    const payload = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: payload?.data ?? null };
    if (response.status === 401 || response.status === 403) return { ok: false, kind: 'auth', message: payload?.message || 'Not allowed' };
    if (response.status === 429 || response.status >= 500) return { ok: false, kind: 'server', message: payload?.message || `Server error ${response.status}` };
    return { ok: false, kind: 'rejected', message: payload?.message || `Rejected (${response.status})`, details: payload?.data ?? null };
  }

  async function submitConsultation(consultation, idempotencyKey) {
    const result = await send('/api/v1/chw/consultations', { body: consultation, headers: { 'Idempotency-Key': idempotencyKey } });
    return result.ok ? { ok: true, serverId: result.data?.consultationId ?? null } : result;
  }

  // Live escalation needs a connection; the caller falls back to a phone call when offline.
  const escalate = details => send('/api/v1/chw/escalations', { body: details });

  return { submitConsultation, escalate };
}

module.exports = { createApiClient };
