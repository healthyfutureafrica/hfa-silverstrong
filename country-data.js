(function (root, factory) {
  const countries = factory();
  if (typeof module === 'object' && module.exports) module.exports = countries;
  else root.HFACountryData = countries;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const countries = {
    CM: {
      code: 'CM',
      name: { en: 'Cameroon', fr: 'Cameroun' },
      callingCode: '237',
      currency: 'XAF',
      languages: ['en', 'fr'],
      emergencyNumber: '1515',
      emergencyNumberReview: 'required',
      legalInstrument: 'Cameroon Law No. 2024/017 of 23 December 2024 on personal data protection',
      legalReview: 'required',
      registrationIdentityDocumentRequired: true,
      healthInsuranceOptions: [
        { code: 'none', label: { en: 'None', fr: 'Aucune' } },
        { code: 'public_scheme', label: { en: 'Public or social health scheme', fr: 'Régime public ou social' } },
        { code: 'cnps', label: { en: 'CNPS (previously recorded)', fr: 'CNPS (déjà enregistré)' } },
        { code: 'private', label: { en: 'Private', fr: 'Privée' } },
        { code: 'mutual', label: { en: 'Mutual (mutuelle)', fr: 'Mutuelle' } },
        { code: 'other', label: { en: 'Other', fr: 'Autre' } }
      ],
      incomeBands: [
        { code: 'lt_50k', min: 0, max: 50000 },
        { code: '50k_150k', min: 50000, max: 150000 },
        { code: '150k_500k', min: 150000, max: 500000 },
        { code: 'gt_500k', min: 500000 }
      ],
      location: {
        regionLabel: { en: 'Region', fr: 'Région' },
        subregionLabel: { en: 'Division (department)', fr: 'Département' },
        localityLabel: { en: 'Town / village', fr: 'Ville / village' },
        regions: [
          { code: 'adamawa', name: { en: 'Adamawa', fr: 'Adamaoua' } },
          { code: 'centre', name: { en: 'Centre', fr: 'Centre' } },
          { code: 'east', name: { en: 'East', fr: 'Est' } },
          { code: 'far_north', name: { en: 'Far North', fr: 'Extrême-Nord' } },
          { code: 'littoral', name: { en: 'Littoral', fr: 'Littoral' } },
          { code: 'north', name: { en: 'North', fr: 'Nord' } },
          { code: 'north_west', name: { en: 'North-West', fr: 'Nord-Ouest' } },
          { code: 'west', name: { en: 'West', fr: 'Ouest' } },
          { code: 'south', name: { en: 'South', fr: 'Sud' } },
          { code: 'south_west', name: { en: 'South-West', fr: 'Sud-Ouest' } }
        ]
      },
      professionalRegulators: {
        doctor: 'Ordre National des Médecins du Cameroun',
        nurse: 'Nursing and Midwifery Council of Cameroon',
        pharmacist: 'Ordre National des Pharmaciens du Cameroun'
      }
    },
    NG: {
      code: 'NG',
      name: { en: 'Nigeria', fr: 'Nigéria' },
      callingCode: '234',
      currency: 'NGN',
      languages: ['en'],
      emergencyNumber: null,
      emergencyNumberReview: 'required',
      legalInstrument: 'Nigeria Data Protection Act 2023',
      legalReview: 'required',
      registrationIdentityDocumentRequired: false,
      healthInsuranceOptions: [
        { code: 'none', label: { en: 'None' } },
        { code: 'public_scheme', label: { en: 'NHIA / state health insurance scheme' } },
        { code: 'private', label: { en: 'Private' } },
        { code: 'mutual', label: { en: 'Community-based scheme' } },
        { code: 'other', label: { en: 'Other' } }
      ],
      incomeBands: null,
      location: {
        regionLabel: { en: 'State / FCT', fr: 'État / Territoire de la capitale fédérale' },
        subregionLabel: { en: 'Local Government Area (LGA)', fr: 'Zone de gouvernement local (LGA)' },
        localityLabel: { en: 'Town / community', fr: 'Ville / communauté' },
        regions: [
          { code: 'NG-AB', name: { en: 'Abia', fr: 'Abia' } },
          { code: 'NG-AD', name: { en: 'Adamawa', fr: 'Adamawa' } },
          { code: 'NG-AK', name: { en: 'Akwa Ibom', fr: 'Akwa Ibom' } },
          { code: 'NG-AN', name: { en: 'Anambra', fr: 'Anambra' } },
          { code: 'NG-BA', name: { en: 'Bauchi', fr: 'Bauchi' } },
          { code: 'NG-BY', name: { en: 'Bayelsa', fr: 'Bayelsa' } },
          { code: 'NG-BE', name: { en: 'Benue', fr: 'Benue' } },
          { code: 'NG-BO', name: { en: 'Borno', fr: 'Borno' } },
          { code: 'NG-CR', name: { en: 'Cross River', fr: 'Cross River' } },
          { code: 'NG-DE', name: { en: 'Delta', fr: 'Delta' } },
          { code: 'NG-EB', name: { en: 'Ebonyi', fr: 'Ebonyi' } },
          { code: 'NG-ED', name: { en: 'Edo', fr: 'Edo' } },
          { code: 'NG-EK', name: { en: 'Ekiti', fr: 'Ekiti' } },
          { code: 'NG-EN', name: { en: 'Enugu', fr: 'Enugu' } },
          { code: 'NG-FC', name: { en: 'Federal Capital Territory', fr: 'Territoire de la capitale fédérale' } },
          { code: 'NG-GO', name: { en: 'Gombe', fr: 'Gombe' } },
          { code: 'NG-IM', name: { en: 'Imo', fr: 'Imo' } },
          { code: 'NG-JI', name: { en: 'Jigawa', fr: 'Jigawa' } },
          { code: 'NG-KD', name: { en: 'Kaduna', fr: 'Kaduna' } },
          { code: 'NG-KN', name: { en: 'Kano', fr: 'Kano' } },
          { code: 'NG-KT', name: { en: 'Katsina', fr: 'Katsina' } },
          { code: 'NG-KE', name: { en: 'Kebbi', fr: 'Kebbi' } },
          { code: 'NG-KO', name: { en: 'Kogi', fr: 'Kogi' } },
          { code: 'NG-KW', name: { en: 'Kwara', fr: 'Kwara' } },
          { code: 'NG-LA', name: { en: 'Lagos', fr: 'Lagos' } },
          { code: 'NG-NA', name: { en: 'Nasarawa', fr: 'Nasarawa' } },
          { code: 'NG-NI', name: { en: 'Niger', fr: 'Niger' } },
          { code: 'NG-OG', name: { en: 'Ogun', fr: 'Ogun' } },
          { code: 'NG-ON', name: { en: 'Ondo', fr: 'Ondo' } },
          { code: 'NG-OS', name: { en: 'Osun', fr: 'Osun' } },
          { code: 'NG-OY', name: { en: 'Oyo', fr: 'Oyo' } },
          { code: 'NG-PL', name: { en: 'Plateau', fr: 'Plateau' } },
          { code: 'NG-RI', name: { en: 'Rivers', fr: 'Rivers' } },
          { code: 'NG-SO', name: { en: 'Sokoto', fr: 'Sokoto' } },
          { code: 'NG-TA', name: { en: 'Taraba', fr: 'Taraba' } },
          { code: 'NG-YO', name: { en: 'Yobe', fr: 'Yobe' } },
          { code: 'NG-ZA', name: { en: 'Zamfara', fr: 'Zamfara' } }
        ]
      },
      professionalRegulators: {
        doctor: 'Medical and Dental Council of Nigeria',
        nurse: 'Nursing and Midwifery Council of Nigeria',
        pharmacist: 'Pharmacists Council of Nigeria'
      }
    }
  };

  const africanCountryBaselines = [
    ['DZ', 'Algeria', '213', 'DZD', ['en']],
    ['AO', 'Angola', '244', 'AOA', ['en']],
    ['BJ', 'Benin', '229', 'XOF', ['en', 'fr']],
    ['BW', 'Botswana', '267', 'BWP', ['en']],
    ['BF', 'Burkina Faso', '226', 'XOF', ['en', 'fr']],
    ['BI', 'Burundi', '257', 'BIF', ['en', 'fr']],
    ['CV', 'Cabo Verde', '238', 'CVE', ['en']],
    ['CF', 'Central African Republic', '236', 'XAF', ['en', 'fr']],
    ['TD', 'Chad', '235', 'XAF', ['en', 'fr']],
    ['KM', 'Comoros', '269', 'KMF', ['en', 'fr']],
    ['CG', 'Congo', '242', 'XAF', ['en', 'fr']],
    ['CD', 'Democratic Republic of the Congo', '243', 'CDF', ['en', 'fr']],
    ['CI', 'Côte d’Ivoire', '225', 'XOF', ['en', 'fr']],
    ['DJ', 'Djibouti', '253', 'DJF', ['en', 'fr']],
    ['EG', 'Egypt', '20', 'EGP', ['en']],
    ['GQ', 'Equatorial Guinea', '240', 'XAF', ['en', 'fr']],
    ['ER', 'Eritrea', '291', 'ERN', ['en']],
    ['SZ', 'Eswatini', '268', 'SZL', ['en']],
    ['ET', 'Ethiopia', '251', 'ETB', ['en']],
    ['GA', 'Gabon', '241', 'XAF', ['en', 'fr']],
    ['GM', 'Gambia', '220', 'GMD', ['en']],
    ['GH', 'Ghana', '233', 'GHS', ['en']],
    ['GN', 'Guinea', '224', 'GNF', ['en', 'fr']],
    ['GW', 'Guinea-Bissau', '245', 'XOF', ['en', 'fr']],
    ['KE', 'Kenya', '254', 'KES', ['en']],
    ['LS', 'Lesotho', '266', 'LSL', ['en']],
    ['LR', 'Liberia', '231', 'LRD', ['en']],
    ['LY', 'Libya', '218', 'LYD', ['en']],
    ['MG', 'Madagascar', '261', 'MGA', ['en', 'fr']],
    ['MW', 'Malawi', '265', 'MWK', ['en']],
    ['ML', 'Mali', '223', 'XOF', ['en', 'fr']],
    ['MR', 'Mauritania', '222', 'MRU', ['en', 'fr']],
    ['MU', 'Mauritius', '230', 'MUR', ['en', 'fr']],
    ['MA', 'Morocco', '212', 'MAD', ['en', 'fr']],
    ['MZ', 'Mozambique', '258', 'MZN', ['en']],
    ['NA', 'Namibia', '264', 'NAD', ['en']],
    ['NE', 'Niger', '227', 'XOF', ['en', 'fr']],
    ['RW', 'Rwanda', '250', 'RWF', ['en', 'fr']],
    ['ST', 'São Tomé and Príncipe', '239', 'STN', ['en', 'fr']],
    ['SN', 'Senegal', '221', 'XOF', ['en', 'fr']],
    ['SC', 'Seychelles', '248', 'SCR', ['en', 'fr']],
    ['SL', 'Sierra Leone', '232', 'SLE', ['en']],
    ['SO', 'Somalia', '252', 'SOS', ['en']],
    ['ZA', 'South Africa', '27', 'ZAR', ['en']],
    ['SS', 'South Sudan', '211', 'SSP', ['en']],
    ['SD', 'Sudan', '249', 'SDG', ['en']],
    ['TZ', 'Tanzania', '255', 'TZS', ['en']],
    ['TG', 'Togo', '228', 'XOF', ['en', 'fr']],
    ['TN', 'Tunisia', '216', 'TND', ['en', 'fr']],
    ['UG', 'Uganda', '256', 'UGX', ['en']],
    ['ZM', 'Zambia', '260', 'ZMW', ['en']],
    ['ZW', 'Zimbabwe', '263', 'ZWG', ['en']]
  ];

  for (const [code, name, callingCode, currency, languages] of africanCountryBaselines) {
    if (countries[code]) continue;
    countries[code] = {
      code,
      name: { en: name },
      callingCode,
      currency,
      languages,
      emergencyNumber: null,
      emergencyNumberReview: 'required',
      legalInstrument: null,
      legalReview: 'required',
      registrationIdentityDocumentRequired: false,
      healthInsuranceOptions: [
        { code: 'none', label: { en: 'None', fr: 'Aucune' } },
        { code: 'public_scheme', label: { en: 'Public health scheme', fr: 'Régime public de santé' } },
        { code: 'private', label: { en: 'Private', fr: 'Privée' } },
        { code: 'mutual', label: { en: 'Community-based scheme', fr: 'Mutuelle' } },
        { code: 'other', label: { en: 'Other', fr: 'Autre' } }
      ],
      incomeBands: null,
      location: {
        regionLabel: { en: 'Region / province / state', fr: 'Région / province / État' },
        subregionLabel: { en: 'District / local area', fr: 'District / localité' },
        localityLabel: { en: 'Town / community', fr: 'Ville / communauté' },
        regions: null
      },
      professionalRegulators: null
    };
  }

  const get = code => countries[code] || null;
  const regionCodes = code => {
    const regions = get(code)?.location.regions;
    return Array.isArray(regions) ? regions.map(region => region.code) : null;
  };
  const all = () => Object.values(countries).sort((a, b) => a.name.en.localeCompare(b.name.en));
  return Object.freeze({ get, regionCodes, all });
});
