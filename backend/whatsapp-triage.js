// SLY Triage on WhatsApp, inside this server (no separate bot service, database or AI cost).
//
// Someone writes to the HFA WhatsApp number; SLY asks the same WHO-based questions as the app, one at a time,
// with numbered answers that work on any phone, and replies with the result from hfa-triage.js.
// - Cost: only free-form replies to a person who wrote first, inside WhatsApp's free 24-hour customer-service
//   window. No paid template messages and no AI calls are made from here. A daily reply cap per number stops abuse.
// - People whose WhatsApp number is verified on their HFA patient account get a case in their care team's
//   Triage queue. Anyone else gets the advice and is invited to register; nothing about them is kept as a case.
// - Conversation state is encrypted, keyed by a hash of the phone number, and forgotten after 2 hours.
const { join } = require('node:path');
const { digest } = require('./store');
const { filesConfigured } = require('./files');
const { seal, unseal, ensureRecordTables } = require('./records');
const { submitCase, ensureTriageTable } = require('./triage');
const Triage = require(join(__dirname, '..', 'hfa-triage.js'));
const COUNTRY_DATA = require('../country-data.js');

const SESSION_MS = 2 * 60 * 60 * 1000;
const DAILY_REPLY_LIMIT = 60;
const RESTART = ['0', 'menu', 'restart', 'start', 'hi', 'hello', 'hey', 'bonjour', 'bonsoir', 'salut', 'allo', 'sly', 'triage', 'help', 'aide'];
const FRENCH_HINTS = ['bonjour', 'bonsoir', 'salut', 'merci', 'svp', 'je ', "j'", 'j’', 'suis', 'malade', 'mal ', 'aide', 'médecin', 'medecin', 'enfant', 'fièvre', 'fievre', 'douleur', 'oui', 'non'];

const W = {
  en: {
    hello: '👋 Hello, I am *SLY*, the HFA SilverStrong health assistant. I will ask a few questions and tell you how soon to get care. I do not diagnose.\n_Répondez FR pour le français._',
    emergency_line: '🚨 If someone is in danger, contact local emergency services or go to the nearest hospital.',
    emergency_line_numbered: '🚨 If someone is in danger, call *{number}* or go to the nearest hospital.',
    q_age: '*Who is unwell?* Reply with one number:', q_sex: '*Sex?* Reply 1 or 2:\n1. Female\n2. Male', q_maternal: '*Pregnancy?* Reply with one number:',
    q_complaints: '*What is the problem?* Reply with the numbers that match, for example *1 3*.\nYou can also describe it in your own words first.',
    words_saved: 'Thank you, I noted your words for your care team. Now reply with the numbers that match.',
    q_signs: '*Is any of this happening now?* Reply with every number that is true, or *0* if none.', q_duration: '*How long has it lasted?* Reply with one number:',
    q_severity: '*How bad is it?* Reply with one number:', not_understood: 'Sorry, I did not understand. Please reply with a number from the list.',
    result: '*Result: {level}*\n{advice}', why: '*Why:*', sent: '✅ Sent to your HFA care team. A nurse or doctor will check it and reply in the HFA app.',
    register: 'To have a nurse or doctor check this, register or sign in at {url} and verify this WhatsApp number in your profile.',
    not_sent: '⚠️ I could not send this to your care team right now. Follow the advice above, and open the HFA app to send it again.',
    again: 'Reply *0* to start a new check.', not_diagnosis: 'SLY does not diagnose. If you are worried, see a health worker.',
    unavailable: 'Sorry, the symptom check is not available right now. If someone is in danger, contact local emergency services or go to the nearest hospital.'
  },
  fr: {
    hello: '👋 Bonjour, je suis *SLY*, l’assistant santé de HFA SilverStrong. Je vais poser quelques questions et vous dire dans quel délai consulter. Je ne pose pas de diagnostic.\n_Reply EN for English._',
    emergency_line: '🚨 Si une personne est en danger, contactez les services d’urgence locaux ou rendez-vous à l’hôpital le plus proche.',
    emergency_line_numbered: '🚨 Si une personne est en danger, appelez le *{number}* ou allez à l’hôpital le plus proche.',
    q_age: '*Qui est malade ?* Répondez avec un numéro :', q_sex: '*Sexe ?* Répondez 1 ou 2 :\n1. Femme\n2. Homme', q_maternal: '*Grossesse ?* Répondez avec un numéro :',
    q_complaints: '*Quel est le problème ?* Répondez avec les numéros qui correspondent, par exemple *1 3*.\nVous pouvez aussi d’abord l’expliquer avec vos mots.',
    words_saved: 'Merci, j’ai noté vos mots pour votre équipe de soins. Répondez maintenant avec les numéros qui correspondent.',
    q_signs: '*L’un de ces signes est-il présent maintenant ?* Répondez avec chaque numéro vrai, ou *0* si aucun.', q_duration: '*Depuis combien de temps ?* Répondez avec un numéro :',
    q_severity: '*Quelle intensité ?* Répondez avec un numéro :', not_understood: 'Désolé, je n’ai pas compris. Répondez avec un numéro de la liste.',
    result: '*Résultat : {level}*\n{advice}', why: '*Pourquoi :*', sent: '✅ Envoyé à votre équipe de soins HFA. Un infirmier ou un médecin va vérifier et vous répondra dans l’application HFA.',
    register: 'Pour qu’un infirmier ou un médecin vérifie, inscrivez-vous ou connectez-vous sur {url} et vérifiez ce numéro WhatsApp dans votre profil.',
    not_sent: '⚠️ Je n’ai pas pu transmettre ceci à votre équipe de soins pour le moment. Suivez le conseil ci-dessus et ouvrez l’application HFA pour le renvoyer.',
    again: 'Répondez *0* pour une nouvelle vérification.', not_diagnosis: 'SLY ne pose pas de diagnostic. En cas d’inquiétude, consultez un agent de santé.',
    unavailable: 'Désolé, la vérification des symptômes n’est pas disponible pour le moment. Si une personne est en danger, contactez les services d’urgence locaux ou rendez-vous à l’hôpital le plus proche.'
  }
};
const fill = (text, values) => text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
const countryForPhone = phone => {
  const matches = COUNTRY_DATA.all().filter(country => phone.startsWith(`+${country.callingCode}`));
  return matches.length === 1 ? matches[0].code : null;
};
const emergencyLine = (countryCode, language) => {
  const t = W[language], number = COUNTRY_DATA.get(countryCode)?.emergencyNumber;
  return number ? fill(t.emergency_line_numbered, { number }) : t.emergency_line;
};
const numbered = (values, labelKey) => values.map((value, index) => `${index + 1}. ${labelKey(value)}`).join('\n');
/** "1, 3 5" → [1, 3, 5]; returns null when the reply contains no numbers. */
function numbers(text) {
  const found = String(text).match(/\d+/g);
  return found ? [...new Set(found.map(Number))] : null;
}
const onlyNumbers = text => /^[\d\s,;.+-]+$/.test(String(text).trim());

function ensureTables(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS wa_triage_sessions (phone_hash TEXT PRIMARY KEY, nonce BLOB NOT NULL, encrypted BLOB NOT NULL, tag BLOB NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wa_reply_counts (phone_hash TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(phone_hash, day));
  `);
}

class WhatsAppTriage {
  constructor(config, store, fetcher = fetch) {
    this.config = config; this.store = store; this.fetcher = fetcher;
    ensureTables(store); ensureRecordTables(store); ensureTriageTable(store);
  }

  canReply() { return !!(this.config.enabled && this.config.token && /^\d+$/.test(this.config.phoneId || '')); }

  // ───── State ─────
  load(hash) {
    const row = this.store.db.prepare('SELECT * FROM wa_triage_sessions WHERE phone_hash=?').get(hash);
    if (!row || Date.now() - row.updated_at > SESSION_MS) return null;
    try { return JSON.parse(unseal(this.config, `wa-triage:${hash}`, row).toString()); } catch (error) { return null; }
  }
  save(hash, state) {
    const sealed = seal(this.config, `wa-triage:${hash}`, Buffer.from(JSON.stringify(state)));
    this.store.db.prepare('INSERT INTO wa_triage_sessions VALUES (?,?,?,?,?) ON CONFLICT(phone_hash) DO UPDATE SET nonce=excluded.nonce,encrypted=excluded.encrypted,tag=excluded.tag,updated_at=excluded.updated_at')
      .run(hash, sealed.nonce, sealed.encrypted, sealed.tag, Date.now());
  }
  forget(hash) { this.store.db.prepare('DELETE FROM wa_triage_sessions WHERE phone_hash=?').run(hash); }
  sweep() { this.store.db.prepare('DELETE FROM wa_triage_sessions WHERE updated_at<?').run(Date.now() - SESSION_MS); }

  /** The verified patient account for this WhatsApp number, if any. */
  patientFor(phone) {
    const row = this.store.db.prepare("SELECT id FROM users WHERE role='patient' AND status='active' AND whatsapp_verified_at IS NOT NULL AND REPLACE(whatsapp_number,' ','')=? ORDER BY created_at LIMIT 1").get(phone);
    return row ? this.store.user(row.id) : null;
  }

  // ───── Sending (free replies only) ─────
  async send(phone, hash, text) {
    if (!this.canReply()) return false;
    const day = new Date().toISOString().slice(0, 10);
    const { count } = this.store.db.prepare('INSERT INTO wa_reply_counts VALUES (?,?,1) ON CONFLICT(phone_hash,day) DO UPDATE SET count=count+1 RETURNING count').get(hash, day);
    if (count > DAILY_REPLY_LIMIT) return false;
    const response = await this.fetcher(`https://graph.facebook.com/${this.config.graphVersion}/${this.config.phoneId}/messages`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${this.config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.replace('+', ''), type: 'text', text: { body: text.slice(0, 4000), preview_url: false } })
    }).catch(() => null);
    return !!response?.ok;
  }

  // ───── Conversation ─────
  /** Handles one incoming text message; returns the reply text (also sent when WhatsApp is configured). */
  async handle(phone, text) {
    const hash = digest(`wa:${phone}`), input = String(text || '').trim(), lower = input.toLowerCase();
    if (!filesConfigured(this.config)) { const reply = W.en.unavailable; await this.send(phone, hash, reply); return reply; }
    let state = this.load(hash);
    // "0" means "none of these" on the danger-sign question and "start again" everywhere else.
    const restart = RESTART.includes(lower) && !(lower === '0' && state?.step === 'signs');
    const linked = this.patientFor(phone);
    const language = ['fr', 'français', 'francais', 'french'].includes(lower) ? 'fr' : ['en', 'english', 'anglais'].includes(lower) ? 'en'
      : state?.language || linked?.preferredLanguage || (FRENCH_HINTS.some(hint => lower.includes(hint)) ? 'fr' : 'en');
    if (!state || restart || ['en', 'fr', 'english', 'french', 'français', 'francais', 'anglais'].includes(lower)) state = { step: 'age', language, countryCode: linked?.countryCode || countryForPhone(phone), answers: { complaints: [], dangerSigns: [] }, words: '', started: Date.now() };
    state.language = language;
    if (linked?.countryCode) state.countryCode = linked.countryCode;
    const reply = this.step(state, input, !restart && state.prompted);
    const lines = typeof reply === 'string' ? reply : await this.finish(state, linked);
    if (state.step === 'done') this.forget(hash); else this.save(hash, state);
    await this.send(phone, hash, lines);
    return lines;
  }

  question(state) {
    const t = W[state.language], L = key => Triage.label(key, state.language), a = state.answers;
    state.prompted = true;
    if (state.step === 'age') return `${t.hello}\n\n${emergencyLine(state.countryCode, state.language)}\n\n${t.q_age}\n${numbered(Triage.AGE_GROUPS, value => L('age_' + value))}`;
    if (state.step === 'sex') return t.q_sex;
    if (state.step === 'maternal') return `${t.q_maternal}\n${numbered(Triage.MATERNAL, value => L('maternal_' + value))}`;
    if (state.step === 'complaints') return `${t.q_complaints}\n${numbered(Triage.COMPLAINTS, value => L('c_' + value))}`;
    if (state.step === 'signs') return `${t.q_signs}\n0. ${state.language === 'fr' ? 'Aucun' : 'None'}\n${numbered(Triage.signsFor(a), value => L('sign_' + value))}`;
    if (state.step === 'duration') return `${t.q_duration}\n${numbered(Triage.DURATIONS, value => L('d_' + value))}`;
    return `${t.q_severity}\n${numbered(Triage.SEVERITIES, value => L('s_' + value))}`;
  }

  /** Applies the answer to the current question; returns the next question, or null when the result is ready. */
  step(state, input, answering) {
    const t = W[state.language], a = state.answers;
    if (!answering) return this.question(state);
    const picked = numbers(input), one = picked?.length === 1 ? picked[0] : null;
    const choose = list => one >= 1 && one <= list.length ? list[one - 1] : null;
    const retry = () => `${t.not_understood}\n\n${this.question(state)}`;
    if (state.step === 'age') {
      const age = choose(Triage.AGE_GROUPS); if (!age) return retry();
      a.ageGroup = age; state.step = ['infant', 'child'].includes(age) ? 'complaints' : 'sex';
      return this.question(state);
    }
    if (state.step === 'sex') {
      const sex = choose(['female', 'male']); if (!sex) return retry();
      a.sex = sex; state.step = Triage.asksMaternal(a) && sex === 'female' ? 'maternal' : 'complaints';
      return this.question(state);
    }
    if (state.step === 'maternal') {
      const maternal = choose(Triage.MATERNAL); if (!maternal) return retry();
      a.maternal = maternal; state.step = 'complaints';
      return this.question(state);
    }
    if (state.step === 'complaints') {
      if (!onlyNumbers(input)) {
        state.words = `${state.words} ${input.replace(/[<>]/g, '')}`.trim().slice(0, 2000);
        return `${t.words_saved}\n\n${this.question(state)}`;
      }
      const list = (picked || []).filter(n => n >= 1 && n <= Triage.COMPLAINTS.length).map(n => Triage.COMPLAINTS[n - 1]);
      if (!list.length) return retry();
      a.complaints = list; state.step = 'signs';
      return this.question(state);
    }
    if (state.step === 'signs') {
      const asked = Triage.signsFor(a);
      if (!picked || !onlyNumbers(input) || picked.some(n => n < 0 || n > asked.length) || (picked.includes(0) && picked.length > 1)) return retry();
      a.dangerSigns = picked.includes(0) ? [] : picked.map(n => asked[n - 1]);
      // An emergency sign ends the questions at once.
      if (a.dangerSigns.some(sign => !Triage.URGENT_SIGNS.includes(sign))) return null;
      state.step = 'duration';
      return this.question(state);
    }
    if (state.step === 'duration') {
      const duration = choose(Triage.DURATIONS); if (!duration) return retry();
      a.duration = duration; state.step = 'severity';
      return this.question(state);
    }
    const severity = choose(Triage.SEVERITIES); if (!severity) return retry();
    a.severity = severity;
    return null;
  }

  async finish(state, linked) {
    const t = W[state.language], language = state.language;
    let result = Triage.assess(state.answers, state.countryCode || null), saved = false, failed = false;
    if (linked) {
      try {
        const case_ = await submitCase(this.config, this.store, linked, { requestId: crypto.randomUUID(), answers: { ...state.answers, forSomeoneElse: false }, text: state.words, aiConsent: false }, { source: 'whatsapp' });
        result = case_.result || result; saved = true;
      } catch (error) { failed = true; }
    }
    state.step = 'done';
    const crisis = result.answers.dangerSigns.includes('suicidal') ? `\n\n${Triage.label('crisis', language)}` : '';
    return [
      fill(t.result, { level: Triage.label('level_' + result.level, language).toUpperCase(), advice: result.level === 'emergency' ? Triage.emergencyAdvice(result, language) : Triage.label('advice_' + result.level, language) }) + crisis,
      `${t.why}\n${result.reasons.map(reason => `• ${Triage.reasonText(reason, language)}`).join('\n')}`,
      saved ? t.sent : failed ? t.not_sent : fill(t.register, { url: this.config.loginUrl || this.config.origin }),
      `${emergencyLine(state.countryCode, language)}\n${t.not_diagnosis}\n${t.again}`
    ].join('\n\n');
  }
}

module.exports = { WhatsAppTriage, numbers, DAILY_REPLY_LIMIT, SESSION_MS };
