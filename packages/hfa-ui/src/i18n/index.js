import { createContext, createElement, useContext, useMemo } from 'react';
import en from './en.js';
import fr from './fr.js';

/** Shared message catalogues, keyed by language code. */
export const messages = { en, fr };
export const SUPPORTED_LANGUAGES = ['en', 'fr'];

/**
 * Looks up a dotted key ("avatar.uploading") in a nested catalogue.
 *
 * @param {object} catalogue - Messages for one language.
 * @param {string} key - Dotted key.
 * @returns {string|undefined} The message, if present.
 */
function lookup(catalogue, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalogue);
}

/**
 * Merges nested catalogues so a portal can add keys inside a shared section (e.g. `common`)
 * without replacing the whole section.
 *
 * @param {object} base - Shared catalogue.
 * @param {object} override - Portal catalogue.
 * @returns {object} A new merged catalogue.
 */
function deepMerge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object'
      ? deepMerge(base[key], value)
      : value;
  }
  return result;
}

/**
 * Creates a translation function for a language. Portals can merge their own strings on top of
 * the shared ones by passing `extra` ({ en: {...}, fr: {...} }).
 * Missing keys fall back to English, then to the key itself, so a gap never breaks the UI.
 *
 * @param {string} language - 'en' or 'fr'.
 * @param {object} [extra] - Additional catalogues keyed by language.
 * @returns {(key: string, values?: object) => string} The t() function.
 */
export function createTranslator(language = 'en', extra = {}) {
  const lang = SUPPORTED_LANGUAGES.includes(language) ? language : 'en';
  const primary = deepMerge(messages[lang], extra[lang]);
  const fallback = deepMerge(messages.en, extra.en);
  return function t(key, values = {}) {
    const template = lookup(primary, key) ?? lookup(fallback, key);
    if (typeof template !== 'string') return key;
    return template.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
  };
}

const I18nContext = createContext({ language: 'en', t: createTranslator('en') });

/**
 * Provides the current language to every @hfa/ui component below it.
 *
 * @param {object} props
 * @param {'en'|'fr'} props.language - Current language.
 * @param {object} [props.extra] - Portal-specific catalogues merged over the shared ones.
 * @param {import('react').ReactNode} props.children - App content.
 * @returns {import('react').ReactElement} Provider element.
 */
export function I18nProvider({ language = 'en', extra, children }) {
  const value = useMemo(() => ({ language, t: createTranslator(language, extra) }), [language, extra]);
  return createElement(I18nContext.Provider, { value }, children);
}

/**
 * Returns `{ t, language }` for the nearest I18nProvider (English if there is none).
 *
 * @returns {{t: (key: string, values?: object) => string, language: string}}
 */
export function useTranslation() {
  return useContext(I18nContext);
}
