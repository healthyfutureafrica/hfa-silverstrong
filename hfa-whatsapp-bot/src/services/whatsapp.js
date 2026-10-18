/**
 * Wrapper around the Meta WhatsApp Business Cloud API.
 *
 * Sending:   POST https://graph.facebook.com/{version}/{phone-number-id}/messages
 * Receiving: Meta POSTs webhook events to /webhook; parseIncoming() turns them into a simple list
 *            of messages the flows can handle.
 *
 * Phase 1 supports text messages only. Interactive buttons/lists come in later steps.
 */

const GRAPH_BASE_URL = 'https://graph.facebook.com';
const MAX_TEXT_LENGTH = 4096; // WhatsApp limit for a text message body

/**
 * Creates a WhatsApp client bound to the bot's configuration.
 *
 * @param {object} options
 * @param {object} options.whatsapp - `config.whatsapp` (phoneNumberId, accessToken, graphApiVersion).
 * @param {number} options.timeoutMs - Timeout for each API call.
 * @param {object} options.logger - Logger from config.
 * @param {Function} [options.fetchImpl=fetch] - fetch implementation (tests inject a fake).
 * @returns {{sendTextMessage: Function, parseIncoming: Function}} WhatsApp client.
 */
function createWhatsAppClient({ whatsapp, timeoutMs, logger, fetchImpl = fetch }) {
  const messagesUrl = `${GRAPH_BASE_URL}/${whatsapp.graphApiVersion}/${whatsapp.phoneNumberId}/messages`;

  /**
   * Sends a plain text message to a WhatsApp user.
   *
   * @param {string} to - Recipient phone number in international format without "+".
   * @param {string} body - Message text (trimmed to WhatsApp's 4096-character limit).
   * @returns {Promise<{ok: boolean, messageId: (string|null), error: (string|null)}>}
   *   Never throws: failures are logged and reported in the result so callers can carry on.
   */
  async function sendTextMessage(to, body) {
    const text = String(body).slice(0, MAX_TEXT_LENGTH);
    try {
      const response = await fetchImpl(messagesUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${whatsapp.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: String(to), type: 'text', text: { preview_url: false, body: text } }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = payload?.error?.message || `HTTP ${response.status}`;
        logger.error('whatsapp_send_failed', { status: response.status, code: payload?.error?.code, error });
        return { ok: false, messageId: null, error };
      }
      return { ok: true, messageId: payload?.messages?.[0]?.id || null, error: null };
    } catch (error) {
      logger.error('whatsapp_send_error', { message: error.name === 'TimeoutError' ? 'timeout' : error.message });
      return { ok: false, messageId: null, error: error.message };
    }
  }

  return { sendTextMessage, parseIncoming };
}

/**
 * Extracts incoming user messages from a Meta webhook request.
 * Status updates (sent/delivered/read) and other events are ignored.
 *
 * @param {import('express').Request|{body: object}} req - The webhook request (only `body` is used).
 * @returns {Array<{from: string, messageId: string, type: string, text: (string|null), name: (string|null), timestamp: (number|null)}>}
 *   One entry per user message; non-text messages have `text: null` so flows can reply with a hint.
 */
function parseIncoming(req) {
  const body = req?.body;
  if (!body || body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) return [];
  const messages = [];
  for (const entry of body.entry) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      if (change?.field !== 'messages' || !value || !Array.isArray(value.messages)) continue;
      const names = new Map((value.contacts || []).map(contact => [contact.wa_id, contact.profile?.name || null]));
      for (const message of value.messages) {
        if (!message?.from || !message?.id) continue;
        let text = null;
        if (message.type === 'text') text = message.text?.body ?? null;
        else if (message.type === 'button') text = message.button?.text ?? null;
        else if (message.type === 'interactive') text = message.interactive?.button_reply?.id ?? message.interactive?.list_reply?.id ?? null;
        messages.push({
          from: String(message.from),
          messageId: String(message.id),
          type: String(message.type || 'unknown'),
          text: typeof text === 'string' ? text.trim() : null,
          name: names.get(message.from) || null,
          timestamp: message.timestamp ? Number(message.timestamp) : null
        });
      }
    }
  }
  return messages;
}

module.exports = { createWhatsAppClient, parseIncoming, MAX_TEXT_LENGTH };
