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

  const get = code => countries[code] || null;
  const regionCodes = code => (get(code)?.location.regions || []).map(region => region.code);
  const all = () => Object.values(countries);
  return Object.freeze({ get, regionCodes, all });
});
