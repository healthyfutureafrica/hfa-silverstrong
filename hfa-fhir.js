// HL7 FHIR R4 export of a patient's record — shared by the server (require) and the site (window.HFAFhir).
//
// Builds a "collection" Bundle a patient can take to any hospital or app that reads FHIR:
//   Patient, AllergyIntolerance, Condition, MedicationStatement, Procedure, Observation (blood group,
//   genotype, smoking), FamilyMemberHistory, Consent, Appointment, DiagnosticReport (released lab
//   results only), ServiceRequest (referrals), DocumentReference (reports, care notes, files), Practitioner.
//
// Codes are used only where they are certain (ICD-11 MMS, LOINC, SNOMED CT, HL7 terminology); everything
// else is carried as text. Conditions, allergies and medicines typed by the patient are marked as
// patient-reported ("unconfirmed"), never as a clinician's diagnosis.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HFAFhir = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const SYSTEM_HFA_ID = 'https://www.healthyfutureafrica.org/fhir/sid/hfa-number';
  const SYSTEM_CNI = 'https://www.healthyfutureafrica.org/fhir/sid/cm-cni';
  const ICD11 = 'http://id.who.int/icd/release/11/mms';
  const LOINC = 'http://loinc.org';
  const SNOMED = 'http://snomed.info/sct';
  const CAMEROON_OFFSET = '+01:00'; // West Africa Time, used when a stored time has no zone

  // Only codes we are sure of; the rest are exported as text.
  const ICD11_CONDITIONS = {
    hypertension: ['BA00', 'Essential hypertension'],
    diabetes_type1: ['5A10', 'Type 1 diabetes mellitus'],
    diabetes_type2: ['5A11', 'Type 2 diabetes mellitus'],
    asthma: ['CA23', 'Asthma'],
    sickle_cell: ['3A51', 'Sickle cell disorders or other haemoglobinopathies'],
    epilepsy: ['8A60', 'Epilepsy or seizures'],
    chronic_kidney_disease: ['GB61', 'Chronic kidney disease']
  };
  const CONDITION_TEXT = {
    hypertension: 'Hypertension', diabetes_type1: 'Type 1 diabetes', diabetes_type2: 'Type 2 diabetes', asthma: 'Asthma',
    hiv_aids: 'HIV', tuberculosis: 'Tuberculosis', sickle_cell: 'Sickle cell disease', epilepsy: 'Epilepsy', cancer: 'Cancer',
    chronic_kidney_disease: 'Chronic kidney disease', heart_disease: 'Heart disease', malaria_recurrent: 'Recurrent malaria',
    mental_health: 'Mental health condition', other: 'Other condition'
  };
  const FAMILY_TEXT = { hypertension: 'Hypertension', diabetes: 'Diabetes', cancer: 'Cancer', heart_disease: 'Heart disease', stroke: 'Stroke', mental_health: 'Mental health condition', sickle_cell: 'Sickle cell disease', other: 'Other condition' };
  const SMOKING = { never: ['266919005', 'Never smoked tobacco'], former: ['8517006', 'Ex-smoker'], current: ['77176002', 'Smoker'] };
  // Consent purposes held in the health profile.
  const CONSENT_PURPOSES = {
    dataSharing: { text: 'Share my health data with my care team', reason: ['TREAT', 'treatment'] },
    research: { text: 'Anonymised use for health research', reason: ['HRESCH', 'healthcare research'] },
    ministry: { text: 'Anonymised statistics for the Ministry of Public Health', reason: ['PUBHLTH', 'public health'] },
    sms: { text: 'SMS reminders' },
    whatsapp: { text: 'WhatsApp notifications' }
  };

  const fhirId = value => String(value || 'unknown').replace(/[^A-Za-z0-9.-]/g, '-').slice(0, 64);
  const ref = (type, id, display) => ({ reference: `${type}/${fhirId(id)}`, ...(display ? { display: String(display) } : {}) });
  const text = value => ({ text: String(value) });
  const coded = (system, code, display) => ({ coding: [{ system, code, display }], text: display });

  /**
   * FHIR dateTime from the app's formats: ISO, 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS' (the app's UTC timestamps)
   * and 'YYYY-MM-DD HH:MM' / 'HH:MM AM' (wall-clock times typed or shown in Cameroon).
   */
  function dateTime(value, offset) {
    const input = String(value || '').trim();
    if (!input) return undefined;
    if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(input)) return input;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(input)) return input;
    const match = input.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return undefined;
    let hour = Number(match[2]);
    if (match[5]) hour = (hour % 12) + (match[5].toUpperCase() === 'PM' ? 12 : 0);
    const zone = offset || (match[4] && !match[5] ? 'Z' : CAMEROON_OFFSET);
    return `${match[1]}T${String(hour).padStart(2, '0')}:${match[3]}:${match[4] || '00'}${zone}`;
  }

  /** FHIR instant (date and time with zone); a bare date becomes midnight Cameroon time. */
  function instant(value) {
    const result = dateTime(value);
    return result && result.length === 10 ? `${result}T00:00:00${CAMEROON_OFFSET}` : result && result.length > 10 ? result : undefined;
  }

  function base64(value) {
    const string = String(value);
    if (typeof Buffer !== 'undefined') return Buffer.from(string, 'utf8').toString('base64');
    return btoa(String.fromCharCode(...new TextEncoder().encode(string)));
  }

  function gender(value) {
    const lower = String(value || '').toLowerCase();
    return lower === 'male' || lower === 'female' ? lower : 'unknown';
  }

  function patientResource(user, health) {
    const identity = health?.identity || {}, location = health?.location || {}, emergency = health?.lifestyle?.emergencyContact;
    const words = String(user.name || '').trim().split(/\s+/).filter(Boolean);
    const telecom = [
      user.phone && { system: 'phone', value: user.phone, use: 'mobile', rank: 1 },
      location.secondaryPhone && { system: 'phone', value: location.secondaryPhone, use: 'mobile', rank: 2 },
      user.whatsappNumber && user.whatsappNumber !== user.phone && { system: 'phone', value: user.whatsappNumber, use: 'mobile' },
      user.email && { system: 'email', value: user.email }
    ].filter(Boolean);
    const address = location.region || location.town
      ? [{ use: 'home', type: 'physical', city: location.town, district: location.division, state: location.region, country: 'CM', ...(location.healthDistrict ? { text: `${location.town || ''}${location.town ? ', ' : ''}health district ${location.healthDistrict}` } : {}) }]
      : user.address ? [{ use: 'home', text: user.address }] : [];
    const contact = emergency?.name || emergency?.phone
      ? [{ relationship: [text(emergency.relationship || 'Emergency contact')], name: { text: emergency.name || '' }, telecom: emergency.phone ? [{ system: 'phone', value: emergency.phone }] : [] }]
      : user.emergencyContact ? [{ relationship: [text('Emergency contact')], name: { text: String(user.emergencyContact) } }] : [];
    const language = health?.preferredLanguage || user.preferredLanguage;
    return {
      resourceType: 'Patient', id: fhirId(user.id), active: user.status ? user.status === 'active' : true,
      identifier: [
        user.hfaId && { use: 'official', system: SYSTEM_HFA_ID, value: user.hfaId },
        identity.cniNumber && { use: 'secondary', system: SYSTEM_CNI, value: identity.cniNumber, type: text('Cameroon national identity card (CNI)') }
      ].filter(Boolean),
      name: [{ use: 'official', text: user.name, ...(words.length > 1 ? { family: words[words.length - 1], given: words.slice(0, -1) } : {}) }],
      telecom, gender: gender(identity.gender || user.gender),
      ...(identity.dateOfBirth || user.dateOfBirth ? { birthDate: identity.dateOfBirth || user.dateOfBirth } : {}),
      address, contact,
      ...(language ? { communication: [{ language: coded('urn:ietf:bcp:47', language, language === 'fr' ? 'French' : 'English'), preferred: true }] } : {}),
      ...(user.facilityName ? { managingOrganization: { display: user.facilityName } } : {})
    };
  }

  const patientReported = patient => ({ verificationStatus: coded('http://terminology.hl7.org/CodeSystem/condition-ver-status', 'unconfirmed', 'Unconfirmed'), recorder: patient, asserter: patient });

  function allergyResources(patient, user, health) {
    const medical = health?.medical, out = [];
    const allergy = (substance, category, severity, note) => ({
      resourceType: 'AllergyIntolerance', clinicalStatus: coded('http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', 'active', 'Active'),
      verificationStatus: coded('http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', 'unconfirmed', 'Unconfirmed'),
      category: [category], ...(severity ? { criticality: severity === 'severe' || severity === 'anaphylaxis' ? 'high' : 'low' } : {}),
      code: text(substance), patient, asserter: patient,
      ...(severity ? { reaction: [{ manifestation: [text(severity === 'anaphylaxis' ? 'Anaphylaxis' : `${severity[0].toUpperCase()}${severity.slice(1)} reaction`)], severity: severity === 'anaphylaxis' ? 'severe' : severity }] } : {}),
      ...(note ? { note: [{ text: note }] } : {})
    });
    if (medical) {
      for (const entry of medical.drugAllergies || []) out.push(allergy(entry.name, 'medication', entry.severity));
      if (medical.foodAllergies) out.push(allergy(medical.foodAllergies, 'food'));
      if (medical.environmentalAllergies) out.push(allergy(medical.environmentalAllergies, 'environment'));
    } else if (user.allergies && !/^(none|no|nil|n\/a)$/i.test(String(user.allergies).trim())) {
      for (const name of String(user.allergies).split(/[,;]/).map(item => item.trim()).filter(Boolean)) out.push(allergy(name, 'medication'));
    }
    return out;
  }

  function conditionResources(patient, health) {
    const medical = health?.medical;
    if (!medical) return [];
    return (medical.conditions || []).map(key => {
      const icd = ICD11_CONDITIONS[key];
      const label = key === 'other' && medical.otherCondition ? medical.otherCondition : CONDITION_TEXT[key] || key;
      return {
        resourceType: 'Condition', clinicalStatus: coded('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active', 'Active'),
        ...patientReported(patient), category: [coded('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item', 'Problem List Item')],
        code: icd ? { coding: [{ system: ICD11, code: icd[0], display: icd[1] }], text: label } : text(label), subject: patient,
        note: [{ text: 'Reported by the patient at registration; to be confirmed by a clinician.' }]
      };
    }).concat(medical.disability && medical.disability !== 'none' ? [{
      resourceType: 'Condition', clinicalStatus: coded('http://terminology.hl7.org/CodeSystem/condition-clinical', 'active', 'Active'), ...patientReported(patient),
      category: [coded('http://terminology.hl7.org/CodeSystem/condition-category', 'problem-list-item', 'Problem List Item')],
      code: text(medical.disability === 'other' && medical.disabilityOther ? medical.disabilityOther : `${medical.disability[0].toUpperCase()}${medical.disability.slice(1)} disability`), subject: patient
    }] : []);
  }

  function medicationResources(patient, health) {
    return (health?.medical?.medications || []).map(entry => ({
      resourceType: 'MedicationStatement', status: 'active', medicationCodeableConcept: text(entry.name), subject: patient, informationSource: patient,
      ...(entry.since ? { effectivePeriod: { start: entry.since } } : {}),
      ...(entry.dose || entry.frequency ? { dosage: [{ text: [entry.dose, entry.frequency].filter(Boolean).join(', ') }] } : {}),
      ...(entry.prescriber ? { note: [{ text: `Prescribed by ${entry.prescriber}` }] } : {})
    }));
  }

  function procedureResources(patient, health) {
    return (health?.medical?.surgeries || []).map(entry => ({
      resourceType: 'Procedure', status: 'completed', code: text(entry.procedure), subject: patient, recorder: patient,
      ...(entry.year ? { performedDateTime: String(entry.year) } : {}), ...(entry.hospital ? { location: { display: entry.hospital } } : {})
    }));
  }

  function observationResources(patient, user, health) {
    const out = [], medical = health?.medical || {}, smoking = health?.lifestyle?.smoking;
    const observation = (category, code, value, extra = {}) => ({
      resourceType: 'Observation', status: 'final', category: [coded('http://terminology.hl7.org/CodeSystem/observation-category', category, category === 'laboratory' ? 'Laboratory' : 'Social History')],
      code, subject: patient, performer: [patient], valueCodeableConcept: value, note: [{ text: 'Reported by the patient.' }], ...extra
    });
    const bloodGroup = medical.bloodGroup && medical.bloodGroup !== 'unknown' ? medical.bloodGroup : !health && user.bloodType;
    if (bloodGroup) out.push(observation('laboratory', coded(LOINC, '882-1', 'ABO and Rh group [Type] in Blood'), text(bloodGroup)));
    if (medical.genotype && medical.genotype !== 'unknown') out.push(observation('laboratory', text('Haemoglobin genotype'), text(medical.genotype)));
    if (SMOKING[smoking]) {
      const perDay = health.lifestyle.cigarettesPerDay;
      out.push(observation('social-history', coded(LOINC, '72166-2', 'Tobacco smoking status'), coded(SNOMED, SMOKING[smoking][0], SMOKING[smoking][1]),
        perDay ? { component: [{ code: text('Cigarettes per day'), valueQuantity: { value: perDay, unit: '/d', system: 'http://unitsofmeasure.org', code: '/d' } }] } : {}));
    }
    return out;
  }

  function familyHistoryResources(patient, health) {
    const medical = health?.medical;
    if (!medical?.familyHistory?.length) return [];
    return [{
      resourceType: 'FamilyMemberHistory', status: 'completed', patient,
      relationship: coded('http://terminology.hl7.org/CodeSystem/v3-RoleCode', 'FAMMEMB', 'family member'),
      condition: medical.familyHistory.map(key => ({ code: text(key === 'other' && medical.familyHistoryOther ? medical.familyHistoryOther : FAMILY_TEXT[key] || key) }))
    }];
  }

  function consentResources(patient, health, history = []) {
    const consents = health?.consents;
    if (!consents) return [];
    return Object.keys(CONSENT_PURPOSES).filter(key => typeof consents[key] === 'boolean').map(key => {
      const purpose = CONSENT_PURPOSES[key];
      const last = history.filter(event => event.purpose === key).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      return {
        resourceType: 'Consent', status: 'active',
        scope: coded('http://terminology.hl7.org/CodeSystem/consentscope', 'patient-privacy', 'Privacy Consent'),
        category: [coded(LOINC, '59284-0', 'Patient Consent')], patient,
        ...(dateTime(last?.createdAt || consents.recordedAt) ? { dateTime: dateTime(last?.createdAt || consents.recordedAt) } : {}),
        policyRule: text(`Cameroon Law No. 2024/017 on personal data protection; HFA consent version ${last?.version || consents.version || 'unknown'}`),
        provision: {
          type: consents[key] ? 'permit' : 'deny', action: [text(purpose.text)],
          ...(purpose.reason ? { purpose: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason', code: purpose.reason[0], display: purpose.reason[1] }] } : {})
        }
      };
    });
  }

  const APPOINTMENT_STATUS = { scheduled: 'booked', confirmed: 'booked', rescheduled: 'booked', completed: 'fulfilled', cancelled: 'cancelled', 'no-show': 'noshow', noshow: 'noshow', pending: 'pending' };
  function appointmentResources(patient, appointments, practitioner) {
    return appointments.map(entry => {
      const start = dateTime(`${entry.date} ${entry.time}`);
      const minutes = Number(entry.durationMinutes) || 30;
      return {
        resourceType: 'Appointment', id: fhirId(entry.id), status: APPOINTMENT_STATUS[entry.status] || 'booked',
        ...(entry.serviceName ? { serviceType: [text(entry.serviceName)] } : {}), appointmentType: text(entry.type || 'consultation'),
        ...(start ? { start, end: new Date(Date.parse(start) + minutes * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'), minutesDuration: minutes } : {}),
        ...(entry.notes ? { description: String(entry.notes) } : {}),
        ...(entry.mode ? { comment: `Consultation by ${entry.mode}` } : {}),
        participant: [{ actor: patient, status: 'accepted' }, ...(entry.doctorId ? [{ actor: practitioner(entry.doctorId), status: 'accepted' }] : []), ...(entry.nurseId ? [{ actor: practitioner(entry.nurseId), status: 'accepted' }] : [])]
      };
    });
  }

  function labResources(patient, labResults, practitioner) {
    // Only results a clinician has released to the patient.
    return labResults.filter(entry => entry.releasedAt || entry.status === 'released').map(entry => ({
      resourceType: 'DiagnosticReport', id: fhirId(entry.id), status: 'final',
      category: [coded('http://terminology.hl7.org/CodeSystem/v2-0074', 'LAB', 'Laboratory')], code: text(entry.testType), subject: patient,
      ...(dateTime(entry.uploadedAt) ? { effectiveDateTime: dateTime(entry.uploadedAt) } : {}), ...(instant(entry.releasedAt) ? { issued: instant(entry.releasedAt) } : {}),
      performer: [entry.labTechId && practitioner(entry.labTechId), entry.specialistDoctorId && practitioner(entry.specialistDoctorId)].filter(Boolean),
      ...(entry.notes ? { conclusion: String(entry.notes) } : {}),
      ...(entry.fileName ? { presentedForm: [{ title: entry.fileName }] } : {})
    }));
  }

  function referralResources(patient, referrals, practitioner) {
    const status = { pending_choice: 'active', assigned: 'active', completed: 'completed', cancelled: 'revoked' };
    return referrals.map(entry => ({
      resourceType: 'ServiceRequest', id: fhirId(entry.id), status: status[entry.status] || 'active', intent: 'order',
      category: [text('Specialist referral')], code: text(entry.specialty), subject: patient,
      ...(dateTime(entry.createdAt) ? { authoredOn: dateTime(entry.createdAt) } : {}),
      ...(entry.generalistId ? { requester: practitioner(entry.generalistId) } : {}),
      reasonCode: [entry.illness, entry.reason].filter(Boolean).map(value => text(value))
    }));
  }

  const noteDocument = (patient, id, title, body, date, author) => ({
    resourceType: 'DocumentReference', id: fhirId(id), status: 'current', type: text(title), subject: patient,
    ...(instant(date) ? { date: instant(date) } : {}),
    ...(author ? { author: [author] } : {}),
    content: [{ attachment: { contentType: 'text/plain; charset=utf-8', language: 'en', data: base64(body), title } }]
  });

  function documentResources(patient, { reports = [], careNotes = [], files = [] }, practitioner) {
    return [
      ...reports.map(entry => noteDocument(patient, entry.id, 'Consultation report', `Summary:\n${entry.summary || ''}\n\nPlan:\n${entry.plan || ''}`, entry.createdAt || entry.consultationDate, entry.doctorId && practitioner(entry.doctorId))),
      ...careNotes.map(entry => noteDocument(patient, entry.id, 'Nursing care note', entry.text || '', `${entry.date || ''} ${entry.time || ''}`.trim(), entry.nurseId && practitioner(entry.nurseId))),
      ...files.map(entry => ({
        resourceType: 'DocumentReference', id: fhirId(entry.id), status: 'current', type: text(entry.category || 'Document'), subject: patient,
        ...(instant(entry.createdAt || entry.uploadedAt) ? { date: instant(entry.createdAt || entry.uploadedAt) } : {}),
        ...(entry.notes ? { description: String(entry.notes) } : {}),
        content: [{ attachment: { ...(entry.mime ? { contentType: entry.mime } : {}), title: entry.fileName, ...(entry.size ? { size: entry.size } : {}), ...(entry.url ? { url: entry.url } : {}) } }]
      }))
    ];
  }

  /**
   * @param {object} input
   *   user, health (the 5-step health profile, or null), consentHistory, appointments, labResults, referrals,
   *   reports, careNotes, files, people (id → user, for clinicians), now, bundleId
   */
  function patientBundle(input) {
    const { user, health = null, consentHistory = [], appointments = [], labResults = [], referrals = [], reports = [], careNotes = [], files = [], people = {} } = input;
    if (!user) throw new Error('A patient is required');
    const now = input.now || new Date().toISOString();
    const patient = ref('Patient', user.id, user.name);
    const practitioners = new Map();
    const practitioner = id => {
      const person = people[id];
      if (!practitioners.has(id)) practitioners.set(id, {
        resourceType: 'Practitioner', id: fhirId(id),
        ...(person?.hfaId ? { identifier: [{ system: SYSTEM_HFA_ID, value: person.hfaId }] } : {}),
        name: [{ text: person?.name || 'Clinician' }],
        ...(person?.specialty || person?.department ? { qualification: [{ code: text(person.specialty || person.department) }] } : {})
      });
      return ref('Practitioner', id, person?.name);
    };
    const resources = [
      patientResource(user, health),
      ...allergyResources(patient, user, health),
      ...conditionResources(patient, health),
      ...medicationResources(patient, health),
      ...procedureResources(patient, health),
      ...observationResources(patient, user, health),
      ...familyHistoryResources(patient, health),
      ...consentResources(patient, health, consentHistory),
      ...appointmentResources(patient, appointments, practitioner),
      ...labResources(patient, labResults, practitioner),
      ...referralResources(patient, referrals, practitioner),
      ...documentResources(patient, { reports, careNotes, files }, practitioner)
    ];
    resources.push(...practitioners.values());
    // Resources without an id get a stable one from their position, so references inside the file stay valid.
    const counters = {};
    for (const resource of resources) {
      if (!resource.id) { counters[resource.resourceType] = (counters[resource.resourceType] || 0) + 1; resource.id = fhirId(`${user.id}-${resource.resourceType.toLowerCase()}-${counters[resource.resourceType]}`); }
      resource.meta = { lastUpdated: now };
    }
    return {
      resourceType: 'Bundle', id: fhirId(input.bundleId || `export-${user.id}`), meta: { lastUpdated: now },
      identifier: { system: 'https://www.healthyfutureafrica.org/fhir/sid/export', value: fhirId(input.bundleId || `${user.id}-${now.replace(/[^0-9]/g, '')}`) },
      type: 'collection', timestamp: now,
      entry: resources.map(resource => ({ fullUrl: `https://www.healthyfutureafrica.org/fhir/${resource.resourceType}/${resource.id}`, resource }))
    };
  }

  /** Light structural check used by tests and before download: every entry is typed, identified and referenced correctly. */
  function validate(bundle) {
    const problems = [];
    if (bundle?.resourceType !== 'Bundle' || bundle.type !== 'collection') problems.push('Not a FHIR collection Bundle');
    const ids = new Set((bundle.entry || []).map(entry => `${entry.resource?.resourceType}/${entry.resource?.id}`));
    for (const entry of bundle.entry || []) {
      const resource = entry.resource;
      if (!resource?.resourceType || !/^[A-Za-z0-9.-]{1,64}$/.test(resource.id || '')) problems.push(`Invalid resource id in ${entry.fullUrl}`);
      if (!entry.fullUrl?.endsWith(`/${resource.resourceType}/${resource.id}`)) problems.push(`fullUrl does not match ${resource.resourceType}/${resource.id}`);
      JSON.stringify(resource, (key, value) => {
        if (key === 'reference' && typeof value === 'string' && !ids.has(value)) problems.push(`Unresolved reference ${value}`);
        return value;
      });
    }
    return problems;
  }

  return { patientBundle, validate, dateTime, ICD11_CONDITIONS, CONSENT_PURPOSES, SYSTEM_HFA_ID };
});
