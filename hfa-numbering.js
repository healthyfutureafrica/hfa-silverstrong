// HFA stakeholder numbering — shared by the server (require) and the site (window.HFANumbering).
//
//   Doctor      HFA-DR-<hospital>-0001-<check>        e.g. HFA-DR-HCH-0001-4
//   Nurse       HFA-NS-<hospital>-0001-<check>
//   Patient     HFA-PT-<hospital>-000001-<check>      hospital the patient is registered under ("HFA" = none yet)
//   Pharmacy    HFA-PH-<region>-<town>-0001-<check>   e.g. HFA-PH-LT-DLA-0001-5
//   Laboratory  HFA-LB-<region>-<town>-0001-<check>
//   Admin       HFA-AD-0001-<check>
//
// Region codes are the official ISO 3166-2:CM codes. The final digit is a Luhn check digit over the
// letters and numbers, so a mistyped number is detected. Numbers never change once issued.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFANumbering = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const PORTAL = { doctor: 'DR', nurse: 'NS', patient: 'PT', pharmacist: 'PH', labtech: 'LB', admin: 'AD' };
  const SEQUENCE_WIDTH = { PT: 6 };
  const NO_HOSPITAL = 'HFA';
  const UNKNOWN_REGION = 'XX', UNKNOWN_TOWN = 'XXX';

  // ISO 3166-2:CM region codes, keyed by the region codes used in forms.
  const REGIONS = {
    adamawa: 'AD', centre: 'CE', east: 'ES', far_north: 'EN', littoral: 'LT',
    north: 'NO', north_west: 'NW', west: 'OU', south: 'SU', south_west: 'SW'
  };
  // Names (English/French) recognised in free-text locations such as "Douala, Littoral, Cameroon".
  const REGION_NAMES = {
    adamawa: ['adamawa', 'adamaoua'], centre: ['centre', 'center'], east: ['east', 'est'], far_north: ['far north', 'extreme nord', 'extreme-nord'],
    littoral: ['littoral'], north: ['north', 'nord'], north_west: ['north west', 'northwest', 'north-west', 'nord ouest', 'nord-ouest'],
    west: ['west', 'ouest'], south: ['south', 'sud'], south_west: ['south west', 'southwest', 'south-west', 'sud ouest', 'sud-ouest']
  };
  // Usual codes for the main towns; other towns get a generated code (see townCode).
  const TOWNS = {
    douala: 'DLA', yaounde: 'YDE', bamenda: 'BDA', bafoussam: 'BFS', garoua: 'GOU', maroua: 'MVR', ngaoundere: 'NGE',
    bertoua: 'BTA', ebolowa: 'EBW', buea: 'BEA', limbe: 'LBE', kribi: 'KBI', kumba: 'KBA', edea: 'EDE', nkongsamba: 'NKS',
    dschang: 'DSC', foumban: 'FBN', kousseri: 'KSR', mbalmayo: 'MBY', kumbo: 'KBO', tiko: 'TKO', loum: 'LOM', mbouda: 'MBD',
    sangmelima: 'SGM', batouri: 'BTR', meiganga: 'MGG', guider: 'GDR', mokolo: 'MKL', yagoua: 'YGA', wum: 'WUM', ndop: 'NDP'
  };
  const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'of', 'the', 'and', 'et', 'a', 'au', 'en']);

  const plain = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
  const words = value => plain(value).toLowerCase().split(/[^a-z0-9]+/).filter(word => word && !STOP_WORDS.has(word));
  /** Comparison key: "Hôpital Général de Douala" and "Hopital General Douala" are the same facility. */
  const nameKey = value => words(value).join(' ');

  /** Luhn check digit over letters (A=10 … Z=35) and digits. */
  function checkDigit(body) {
    const digits = plain(body).toUpperCase().replace(/[^A-Z0-9]/g, '').split('').map(ch => (/[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55))).join('');
    let sum = 0, double = true;
    for (let index = digits.length - 1; index >= 0; index--) {
      let digit = Number(digits[index]);
      if (double) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit; double = !double;
    }
    return (10 - (sum % 10)) % 10;
  }

  // Makes a code unique against those already taken: HCH → HC2 → HC3 … → HCH10.
  function unique(code, taken) {
    const used = new Set([...taken].map(value => String(value).toUpperCase()));
    if (!used.has(code)) return code;
    for (let digit = 2; digit <= 9; digit++) { const candidate = code.slice(0, -1) + digit; if (!used.has(candidate)) return candidate; }
    for (let suffix = 10; ; suffix++) { const candidate = code + suffix; if (!used.has(candidate)) return candidate; }
  }

  /** 3-letter code from a hospital's name: "HFA Central Hospital" → HCH, "Hôpital Laquintinie" → HLA. */
  function facilityCode(name, taken = []) {
    const parts = words(name).map(word => word.toUpperCase());
    let code;
    if (!parts.length) code = 'FAC';
    else if (parts.length >= 3) code = parts.slice(0, 3).map(word => word[0]).join('');
    else if (parts.length === 2) code = parts[0][0] + parts[1].slice(0, 2);
    else code = parts[0].slice(0, 3);
    code = code.padEnd(3, 'X');
    if (code === NO_HOSPITAL) code = 'HFX';
    return unique(code, [...taken, NO_HOSPITAL]);
  }

  /** Town code: known codes for main towns, otherwise first letter + following consonants ("Bambui" → BMB). */
  function townCode(town, taken = []) {
    const key = words(town).join('');
    if (!key) return UNKNOWN_TOWN;
    let code = TOWNS[key];
    if (!code) {
      const letters = key.toUpperCase().replace(/[^A-Z]/g, '') || 'TWN';
      const consonants = letters.slice(1).replace(/[AEIOUY]/g, '');
      code = (letters[0] + consonants + letters.slice(1)).slice(0, 3).padEnd(3, 'X');
    }
    return unique(code, taken);
  }

  function regionFromText(text) {
    const value = ` ${plain(text).toLowerCase().replace(/[^a-z]+/g, ' ')} `;
    // Longest names first so "north west" wins over "north" and "west".
    const entries = Object.entries(REGION_NAMES).flatMap(([region, names]) => names.map(name => [region, name.replace(/-/g, ' ')])).sort((a, b) => b[1].length - a[1].length);
    for (const [region, name] of entries) if (value.includes(` ${name} `)) return region;
    return '';
  }

  /** Region and town for a pharmacy or laboratory, from structured fields or a free-text location. */
  function locationOf(user) {
    const region = user.pharmacyRegion || user.labRegion || user.region || regionFromText(user.pharmacyLocation || user.labLocation || user.address || '');
    const town = user.pharmacyTown || user.labTown || user.town || String(user.pharmacyLocation || user.labLocation || '').split(',')[0].trim();
    return { region: REGIONS[region] ? region : '', town };
  }

  /** The prefix that a user's sequence number counts within, e.g. "DR-HCH" or "PH-LT-DLA". */
  function scope(role, { facilityCode: hospital, regionCode, townCode: town } = {}) {
    const portal = PORTAL[role] || 'US';
    if (portal === 'DR' || portal === 'NS') return `${portal}-${hospital || NO_HOSPITAL}`;
    if (portal === 'PT') return `${portal}-${hospital || NO_HOSPITAL}`;
    if (portal === 'PH' || portal === 'LB') return `${portal}-${regionCode || UNKNOWN_REGION}-${town || UNKNOWN_TOWN}`;
    return portal;
  }

  function format(scopeValue, sequence) {
    const portal = scopeValue.split('-')[0];
    const body = `${scopeValue}-${String(sequence).padStart(SEQUENCE_WIDTH[portal] || 4, '0')}`;
    return `HFA-${body}-${checkDigit(body)}`;
  }

  const PATTERN = /^HFA-((?:DR|NS|PT)-[A-Z0-9]{3,6}|(?:PH|LB)-[A-Z]{2}-[A-Z0-9]{3,6}|AD)-(\d{4,})-(\d)$/;
  function parse(number) {
    const match = PATTERN.exec(String(number || '').trim().toUpperCase());
    if (!match) return null;
    const body = `${match[1]}-${match[2]}`;
    if (checkDigit(body) !== Number(match[3])) return null;
    const [portal, a, b] = match[1].split('-');
    return { portal, facilityCode: portal === 'DR' || portal === 'NS' || portal === 'PT' ? a : null, regionCode: portal === 'PH' || portal === 'LB' ? a : null, townCode: portal === 'PH' || portal === 'LB' ? b : null, sequence: Number(match[2]) };
  }
  const isValid = number => parse(number) !== null;

  return { PORTAL, REGIONS, NO_HOSPITAL, UNKNOWN_REGION, UNKNOWN_TOWN, nameKey, checkDigit, facilityCode, townCode, regionFromText, locationOf, scope, format, parse, isValid };
});
