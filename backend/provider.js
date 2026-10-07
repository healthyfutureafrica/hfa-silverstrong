const { createHmac, timingSafeEqual, randomBytes } = require('node:crypto');
const { digest } = require('./store');

function configuration(env = process.env) {
  const config = {
    port: Number(env.PORT || 3000), origin: env.PUBLIC_APP_URL || 'http://localhost:8080',
    loginUrl: env.PUBLIC_LOGIN_URL || env.PUBLIC_APP_URL || 'http://localhost:8080',
    database: env.DATABASE_PATH || './backend/data/hfa.sqlite',
    enabled: env.WHATSAPP_ENABLED === 'true', token: env.META_ACCESS_TOKEN || '',
    appSecret: env.META_APP_SECRET || '', verifyToken: env.META_WEBHOOK_VERIFY_TOKEN || '',
    phoneId: env.META_PHONE_NUMBER_ID || '', businessNumber: env.WHATSAPP_BUSINESS_NUMBER || '',
    graphVersion: env.META_GRAPH_VERSION || 'v24.0', template: env.WHATSAPP_ACTIVITY_TEMPLATE || '',
    language: env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
    dailyRecipientLimit: Number(env.WHATSAPP_DAILY_RECIPIENT_LIMIT || 20), dailyTotalLimit: Number(env.WHATSAPP_DAILY_TOTAL_LIMIT || 1000),
    urlParameter: env.WHATSAPP_TEMPLATE_LOGIN_URL_PARAMETER === 'true',
    adminEmail: env.BOOTSTRAP_ADMIN_EMAIL || '', adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD || ''
  };
  if (!/^https?:\/\//.test(config.origin) || new URL(config.origin).origin !== config.origin ||
      !/^https?:\/\//.test(config.loginUrl) || !/^v\d+\.\d+$/.test(config.graphVersion) ||
      !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(config.language)) throw new Error('Invalid backend URL or provider configuration');
  config.ready = config.enabled && !!(config.token && config.appSecret && config.verifyToken &&
    /^\d+$/.test(config.phoneId) && /^\+?[1-9]\d{7,14}$/.test(config.businessNumber) && /^[a-z0-9_]+$/.test(config.template));
  if (!Number.isInteger(config.dailyRecipientLimit)||config.dailyRecipientLimit<1||!Number.isInteger(config.dailyTotalLimit)||config.dailyTotalLimit<1) throw new Error('Invalid WhatsApp delivery limits');
  if (config.ready && (!config.origin.startsWith('https://') || new URL(config.loginUrl).origin!==config.origin)) throw new Error('Live WhatsApp delivery requires the same public HTTPS app and login origin');
  return config;
}

function validSignature(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || '')) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}

class MetaProvider {
  constructor(config, store, fetcher = fetch) {
    this.config = config;
    this.store = store;
    this.fetcher = fetcher;
    this.busy = false;
  }

  async deliverNext() {
    if (!this.config.ready || this.busy) return;
    const job = this.store.db.prepare("SELECT * FROM deliveries WHERE status IN ('queued','retry','blocked_configuration') AND next_attempt<=? ORDER BY updated_at LIMIT 1").get(Date.now());
    if (!job) return;
    const patient = this.store.user(job.patient_id);
    const blocked = !patient || patient.status === 'deleted' ? 'blocked_recipient' :
      !patient.whatsappNotificationsConsent ? 'blocked_consent' : !patient.whatsappVerifiedAt ? 'blocked_verification' : null;
    if (blocked) { this.setStatus(job.id, blocked); return; }
    const today=new Date().toISOString().slice(0,10);
    const total=this.store.db.prepare('SELECT COALESCE(SUM(attempts),0) AS count FROM deliveries WHERE updated_at>=?').get(today).count;
    const recipient=this.store.db.prepare('SELECT COALESCE(SUM(attempts),0) AS count FROM deliveries WHERE recipient_phone=? AND updated_at>=?').get(patient.whatsappNumber,today).count;
    if (total>=(this.config.dailyTotalLimit||1000)||recipient>=(this.config.dailyRecipientLimit||20)) { this.setStatus(job.id,'blocked_daily_limit');return; }
    this.busy = true;
    this.store.db.prepare("UPDATE deliveries SET status='sending',attempts=attempts+1,recipient_phone=? WHERE id=?").run(patient.whatsappNumber,job.id);
    try {
      const template = { name: this.config.template, language: { code: this.config.language } };
      if (this.config.urlParameter) template.components = [{ type: 'body', parameters: [{ type: 'text', text: this.config.loginUrl }] }];
      const response = await this.fetcher(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneId}/messages`, {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: patient.whatsappNumber.replace('+', ''),
          type: 'template', template, biz_opaque_callback_data: job.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retry = response.status === 429 && job.attempts < 4;
        this.store.db.prepare('UPDATE deliveries SET status=?,error_code=?,next_attempt=?,updated_at=? WHERE id=?')
          .run(retry ? 'retry' : response.status>=500?'delivery_unknown':'failed', String(data.error?.code || response.status),
            Date.now() + Math.min(300000, 5000 * 2 ** job.attempts), new Date().toISOString(), job.id);
      } else if (!data.messages?.[0]?.id) {
        this.setStatus(job.id, 'delivery_unknown');
      } else {
        this.store.db.prepare("UPDATE deliveries SET provider_id=?,status=CASE WHEN status='sending' THEN 'accepted' ELSE status END,updated_at=? WHERE id=?")
          .run(data.messages[0].id, new Date().toISOString(), job.id);
      }
    } catch (error) {
      this.store.db.prepare("UPDATE deliveries SET status='delivery_unknown',error_code='transport_unknown',updated_at=? WHERE id=? AND status='sending'")
        .run(new Date().toISOString(), job.id);
    } finally { this.busy = false; }
  }

  setStatus(id, status) {
    this.store.db.prepare('UPDATE deliveries SET status=?,updated_at=? WHERE id=?').run(status, new Date().toISOString(), id);
  }

  verification(patient) {
    if (!this.config.ready) throw new Error('Provider not configured');
    if (!patient.whatsappNotificationsConsent) throw new Error('Consent required');
    const token = randomBytes(24).toString('hex');
    this.store.db.prepare('DELETE FROM verifications WHERE patient_id=?').run(patient.id);
    this.store.db.prepare('INSERT INTO verifications VALUES (?,?,?)').run(digest(token), patient.id, Date.now() + 15 * 60000);
    return { url: `https://wa.me/${this.config.businessNumber.replace('+', '')}?text=${encodeURIComponent(`START ${token}`)}`, expiresIn: 900 };
  }

  webhook(payload) {
    if (payload.object !== 'whatsapp_business_account') return;
    for (const entry of payload.entry || []) for (const change of entry.changes || []) {
      const value = change.value;
      if (change.field !== 'messages' || value?.metadata?.phone_number_id !== this.config.phoneId) continue;
      for (const message of value.messages || []) {
        if (!message.id || this.store.db.prepare('SELECT id FROM webhook_events WHERE id=?').get(message.id)) continue;
        this.store.db.prepare('INSERT INTO webhook_events VALUES (?,?)').run(message.id, new Date().toISOString());
        const phone = `+${message.from}`, text = message.text?.body?.trim() || '';
        if (/^(STOP|STOPALL|UNSUBSCRIBE)$/i.test(text)) {
          this.store.db.prepare('UPDATE users SET whatsapp_consent=0,whatsapp_consent_at=? WHERE whatsapp_number=?').run(new Date().toISOString(),phone);
          this.store.db.prepare("UPDATE deliveries SET status='blocked_consent' WHERE patient_id IN (SELECT id FROM users WHERE whatsapp_number=?) AND status IN ('queued','retry','blocked_configuration')").run(phone);
        } else if (/^START [a-f0-9]{48}$/.test(text)) {
          const challenge = this.store.db.prepare('SELECT patient_id FROM verifications WHERE token_hash=? AND expires_at>?').get(digest(text.slice(6)), Date.now());
          const patient = challenge && this.store.user(challenge.patient_id);
          if (patient?.whatsappNumber === phone && patient.whatsappNotificationsConsent) {
            this.store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(), patient.id);
            this.store.db.prepare('DELETE FROM verifications WHERE patient_id=?').run(patient.id);
          }
        }
      }
      for (const status of value.statuses || []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const job = this.store.db.prepare('SELECT * FROM deliveries WHERE provider_id=? OR id=?').get(status.id, status.biz_opaque_callback_data || '');
        if (!job || job.recipient_phone !== `+${status.recipient_id}`) continue;
        const rank = { sending: 0, accepted: 0, delivery_unknown: 0, sent: 1, delivered: 2, read: 3, failed: -1 };
        if (status.status === 'failed' ? !['delivered', 'read'].includes(job.status) : (rank[status.status] > (rank[job.status] ?? 0))) {
          this.store.db.prepare('UPDATE deliveries SET status=?,provider_id=?,error_code=?,updated_at=? WHERE id=?')
            .run(status.status, status.id, status.errors?.[0]?.code ? String(status.errors[0].code) : null, new Date().toISOString(), job.id);
        }
      }
    }
  }
}

module.exports = { configuration, validSignature, MetaProvider };