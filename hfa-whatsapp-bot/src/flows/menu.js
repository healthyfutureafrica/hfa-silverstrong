/**
 * Main menu flow (Phase 1: hardcoded, no AI).
 *
 * Responsibilities:
 *  - greet new and returning users in their language,
 *  - show the numbered main menu,
 *  - handle language switching (EN / FR),
 *  - route a menu choice to the right flow.
 *
 * Language: Phase 1 uses a simple keyword check on the first message. Step 8 replaces
 * `detectLanguage` with GPT-4o detection; everything else stays the same.
 */
const en = require('../i18n/en');
const fr = require('../i18n/fr');

const STRINGS = { en, fr };
const SAMU_NUMBER = '1515';
const PLATFORM_URL = 'https://www.healthyfutureafrica.org';

/** Menu number -> session step for the flow it starts. */
const MENU_ROUTES = {
  1: 'triage',
  2: 'booking',
  3: 'pharmacy',
  4: 'lab',
  5: 'provider',
  6: 'emergency',
  7: 'human_handoff'
};

const MENU_COMMANDS = ['0', 'menu', 'menú', 'start', 'restart', 'hi', 'hello', 'hey', 'bonjour', 'bonsoir', 'salut', 'allo', 'accueil'];
const FRENCH_HINTS = ['bonjour', 'bonsoir', 'salut', 'merci', 'svp', 'stp', 'je ', "j'", 'j’', 'suis', 'malade', 'mal ', 'aide', 'médecin', 'medecin', 'pharmacie', 'oui', 'non', 'besoin', 'enfant', 'fièvre', 'fievre', 'douleur'];

/**
 * Checks at load time that every English key also exists in French (and vice versa).
 *
 * @throws {Error} When a translation key is missing.
 */
function assertTranslationParity() {
  const enKeys = Object.keys(en).sort().join(',');
  const frKeys = Object.keys(fr).sort().join(',');
  if (enKeys !== frKeys) throw new Error('i18n/en.js and i18n/fr.js must define exactly the same keys');
  if (en.menuOptions.length !== fr.menuOptions.length) throw new Error('Menu options must have the same count in English and French');
}
assertTranslationParity();

/**
 * Returns the string table for a language (English when unknown).
 *
 * @param {string|null} language - 'en' or 'fr'.
 * @returns {object} Strings for that language.
 */
function strings(language) {
  return STRINGS[language] || STRINGS.en;
}

/**
 * Replaces {placeholders} in a template.
 *
 * @param {string} template - Text with {name} placeholders.
 * @param {object} values - Replacement values.
 * @returns {string} The filled-in text.
 */
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

/**
 * Guesses the language of a message with simple French keyword hints (Phase 1 only).
 *
 * @param {string|null} text - The user's message.
 * @returns {'en'|'fr'} The detected language.
 */
function detectLanguage(text) {
  const normalised = ` ${String(text || '').toLowerCase()} `;
  if (/^\s*(fr|français|francais)\s*$/.test(normalised)) return 'fr';
  return FRENCH_HINTS.some(hint => normalised.includes(hint)) ? 'fr' : 'en';
}

/**
 * Builds the full main menu text.
 *
 * @param {string} language - 'en' or 'fr'.
 * @returns {string} The menu message.
 */
function getMenuText(language) {
  const t = strings(language);
  return `${t.menuTitle}\n\n${t.menuOptions.join('\n')}\n\n${t.menuFooter}`;
}

/**
 * Builds the first message of a session: greeting + menu.
 *
 * @param {string} language - 'en' or 'fr'.
 * @param {boolean} returning - True if this user has used the bot before.
 * @returns {string} The greeting message.
 */
function getGreetingText(language, returning) {
  const t = strings(language);
  return `${returning ? t.returningGreeting : t.greeting}\n\n${getMenuText(language)}`;
}

/**
 * Handles one text message while the user is at the main menu.
 *
 * @param {object} session - Current session (from services/session.js).
 * @param {string|null} text - The user's message text (null for non-text messages).
 * @returns {{session: object, replies: string[]}} The updated session and the messages to send.
 */
function handleMenuInput(session, text) {
  const next = { ...session, collected_data: { ...session.collected_data } };
  const input = String(text || '').trim().toLowerCase();

  if (text === null) return { session: next, replies: [strings(next.language).unsupportedMessageType] };

  // Language switch: "EN" / "FR" at any time.
  if (['en', 'english', 'anglais'].includes(input) || ['fr', 'français', 'francais', 'french'].includes(input)) {
    next.language = ['en', 'english', 'anglais'].includes(input) ? 'en' : 'fr';
    next.current_step = 'menu';
    return { session: next, replies: [`${strings(next.language).languageSwitched}\n\n${getMenuText(next.language)}`] };
  }

  if (MENU_COMMANDS.includes(input)) {
    next.current_step = 'menu';
    return { session: next, replies: [getMenuText(next.language)] };
  }

  const choice = Number(input.replace(/[^\d]/g, ''));
  const route = /^\s*\d\s*[.)]?\s*$/.test(input) ? MENU_ROUTES[choice] : undefined;
  if (!route) return { session: next, replies: [strings(next.language).invalidOption] };

  const t = strings(next.language);
  next.collected_data.menu_choice = choice;

  // Emergency is answered immediately and never waits for any other step.
  if (route === 'emergency') {
    next.current_step = 'menu';
    next.triage_result = 'EMERGENCY_SELF_REPORTED';
    return { session: next, replies: [fill(t.emergency, { samuNumber: SAMU_NUMBER })] };
  }

  // Phase 1: the other flows are not built yet; the session remembers the choice for later steps.
  next.current_step = 'menu';
  return { session: next, replies: [`${t.optionSelected[choice]}\n\n${fill(t.comingSoon, { platformUrl: PLATFORM_URL })}`] };
}

module.exports = { handleMenuInput, getMenuText, getGreetingText, detectLanguage, strings, fill, MENU_ROUTES, SAMU_NUMBER, PLATFORM_URL };
