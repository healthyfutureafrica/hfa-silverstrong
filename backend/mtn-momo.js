// Copied from services/payment-service/src/mtnClient.js so the main server can take MTN Mobile Money payments.
// Client for the MTN Mobile Money Collections API (https://momodeveloper.mtn.com).
//   1. POST /collection/token/                 -> OAuth access token (Basic auth: API user + API key)
//   2. POST /collection/v1_0/requesttopay      -> asks the payer to approve on their phone (202)
//   3. GET  /collection/v1_0/requesttopay/{id} -> PENDING | SUCCESSFUL | FAILED
// Sandbox: target environment "sandbox", currency EUR. Cameroon production: "mtncameroon", XAF.

class ProviderError extends Error {
  constructor(message, { status = null, retriable = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.retriable = retriable;
  }
}

class MtnMomoClient {
  constructor({ baseUrl, subscriptionKey, apiUser, apiKey, targetEnvironment, callbackUrl, fetchImpl = fetch, timeoutMs = 15000 }) {
    Object.assign(this, { baseUrl: baseUrl.replace(/\/$/, ''), subscriptionKey, apiUser, apiKey, targetEnvironment, callbackUrl, fetchImpl, timeoutMs });
    this.cachedToken = null;
  }

  async send(path, { method = 'GET', headers = {}, body } = {}) {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Ocp-Apim-Subscription-Key': this.subscriptionKey, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error) {
      // Timeouts and network errors: the request may or may not have reached MTN.
      throw new ProviderError('MTN MoMo could not be reached', { retriable: true });
    }
  }

  // Access tokens are cached until one minute before they expire.
  async accessToken(forceRefresh = false) {
    if (!forceRefresh && this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) return this.cachedToken.value;
    const response = await this.send('/collection/token/', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64')}` }
    });
    if (!response.ok) throw new ProviderError('MTN MoMo authentication failed', { status: response.status, retriable: response.status >= 500 });
    const data = await response.json();
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
    return this.cachedToken.value;
  }

  async authorised(path, options = {}) {
    const attempt = async refresh => this.send(path, {
      ...options,
      headers: { Authorization: `Bearer ${await this.accessToken(refresh)}`, 'X-Target-Environment': this.targetEnvironment, ...options.headers }
    });
    const response = await attempt(false);
    return response.status === 401 ? attempt(true) : response; // token revoked early: refresh once
  }

  // Returns normally when MTN accepted the request (202), or when the reference id was already
  // used (409), which means a previous attempt with the same reference reached MTN.
  async requestToPay({ referenceId, amount, currency, externalId, msisdn, payerMessage, payeeNote }) {
    const response = await this.authorised('/collection/v1_0/requesttopay', {
      method: 'POST',
      headers: { 'X-Reference-Id': referenceId, 'Content-Type': 'application/json', ...(this.callbackUrl ? { 'X-Callback-Url': this.callbackUrl } : {}) },
      body: { amount: String(amount), currency, externalId, payer: { partyIdType: 'MSISDN', partyId: msisdn }, payerMessage, payeeNote }
    });
    if (response.status === 202 || response.status === 409) return;
    throw new ProviderError(`MTN MoMo rejected the payment request (HTTP ${response.status})`, { status: response.status, retriable: response.status >= 500 || response.status === 429 });
  }

  async getStatus(referenceId) {
    const response = await this.authorised(`/collection/v1_0/requesttopay/${referenceId}`);
    if (response.status === 404) return { status: 'NOT_FOUND' };
    if (!response.ok) throw new ProviderError(`MTN MoMo status check failed (HTTP ${response.status})`, { status: response.status, retriable: true });
    const data = await response.json();
    return {
      status: data.status, financialTransactionId: data.financialTransactionId || null,
      reason: typeof data.reason === 'string' ? data.reason : data.reason?.code || null,
      amount: data.amount, currency: data.currency, externalId: data.externalId
    };
  }
}

module.exports = { MtnMomoClient, ProviderError };
