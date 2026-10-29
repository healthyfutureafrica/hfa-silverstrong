// Hospital register and stakeholder numbers: lets each hospital see the patients registered under it.
const { z } = require('zod');
const COUNTRY_DATA = require('../country-data.js');
const envelope = data => ({ success: true, data, message: 'OK', timestamp: new Date().toISOString() });
const plainRows = rows => rows.map(row => ({ ...row }));
const dateToday = () => new Date().toISOString().slice(0, 10);
const realDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const e164 = value => String(value || '').replace(/[\s()-]/g, '');

function installFacilityRoutes(app, store, authenticated, admin) {
  // Public: the hospitals a patient can choose when registering (names and codes only).
  app.get('/api/v1/facilities', (request, response) => response.json(envelope({ hospitals: plainRows(store.listedHospitals()) })));

  app.get('/api/v1/facilities/ambulance', (request, response) => {
    const countryCode = String(request.query.countryCode || '').toUpperCase();
    if (!COUNTRY_DATA.get(countryCode)) return response.status(400).json({ error: 'countryCode: Choose a supported country' });
    const providers = store.db.prepare(`SELECT id, name, ambulance_country_code AS countryCode,
        ambulance_phone AS phone, ambulance_sms AS sms, ambulance_lat AS latitude, ambulance_lng AS longitude,
        ambulance_coverage AS coverage, ambulance_expires_on AS expiresOn, ambulance_reviewed_at AS reviewedAt
      FROM facilities WHERE kind='hospital' AND ambulance_status='approved'
        AND ambulance_country_code=? AND ambulance_expires_on>=?
        AND ambulance_phone IS NOT NULL AND ambulance_lat IS NOT NULL AND ambulance_lng IS NOT NULL
      ORDER BY name`).all(countryCode, dateToday());
    response.set('Cache-Control', 'public, max-age=60').json(envelope({ providers }));
  });

  // Doctors and nurses: patients registered under their own hospital — names and numbers, never health data.
  app.get('/api/v1/facilities/mine/patients', authenticated, (request, response) => {
    if (!['doctor', 'nurse'].includes(request.user.role)) return response.status(403).json({ success: false, error: 'Only hospital clinicians can list hospital patients', message: 'Forbidden', timestamp: new Date().toISOString() });
    const facility = store.facility(request.user.facilityId);
    if (!facility) return response.json(envelope({ facility: null, patients: [] }));
    response.json(envelope({ facility: { id: facility.id, name: facility.name, code: facility.code }, patients: plainRows(store.facilityPatients(facility.id)) }));
  });

  app.get('/api/v1/admin/facilities', authenticated, admin, (request, response) => response.json(envelope(store.facilityRegister())));
  app.put('/api/v1/admin/facilities/:id/ambulance', authenticated, admin, (request, response) => {
    const input = z.object({
      countryCode: z.enum(COUNTRY_DATA.all().map(country => country.code)),
      phone: z.string().trim().max(24).default(''),
      sms: z.string().trim().max(24).default(''),
      latitude: z.number().min(-90).max(90).nullable(),
      longitude: z.number().min(-180).max(180).nullable(),
      coverage: z.string().trim().max(500).default(''),
      status: z.enum(['pending', 'approved', 'rejected']),
      source: z.string().trim().max(240).default(''),
      sourceReference: z.string().trim().max(500).default(''),
      expiresOn: z.string().max(10).default('')
    }).strict().parse(request.body);
    const facility = store.facility(request.params.id);
    if (!facility || facility.kind !== 'hospital') return response.sendStatus(404);
    const phone = e164(input.phone), sms = input.sms ? e164(input.sms) : '';
    if (input.phone && !/^\+[1-9]\d{7,14}$/.test(phone)) return response.status(400).json({ error: 'phone: Enter the hospital ambulance number in international format' });
    if (input.sms && !/^\+[1-9]\d{7,14}$/.test(sms)) return response.status(400).json({ error: 'sms: Enter the hospital SMS number in international format' });
    if ((input.latitude === null) !== (input.longitude === null)) return response.status(400).json({ error: 'latitude and longitude: Enter both coordinates' });
    if (input.status === 'approved') {
      if (!phone) return response.status(400).json({ error: 'phone: An approved ambulance profile needs a verified call number' });
      if (input.latitude === null || input.longitude === null) return response.status(400).json({ error: 'latitude and longitude: An approved ambulance profile needs verified base coordinates' });
      if (input.coverage.length < 3) return response.status(400).json({ error: 'coverage: Record the service area' });
      if (input.source.length < 3 || input.sourceReference.length < 3) return response.status(400).json({ error: 'source and sourceReference: Record the verification source and a non-sensitive reference' });
      if (!realDate(input.expiresOn) || input.expiresOn <= dateToday()) return response.status(400).json({ error: 'expiresOn: Enter a valid future review date' });
    }
    if (input.expiresOn && !realDate(input.expiresOn)) return response.status(400).json({ error: 'expiresOn: Enter a real calendar date' });
    const reviewedAt = input.status === 'approved' ? new Date().toISOString() : null;
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare(`UPDATE facilities SET ambulance_country_code=?,ambulance_phone=?,ambulance_sms=?,
        ambulance_lat=?,ambulance_lng=?,ambulance_coverage=?,ambulance_status=?,ambulance_source=?,
        ambulance_source_reference=?,ambulance_expires_on=?,ambulance_reviewed_by=?,ambulance_reviewed_at=?
        WHERE id=?`).run(input.countryCode, phone || null, sms || null, input.latitude, input.longitude,
        input.coverage || null, input.status, input.source || null, input.sourceReference || null,
        input.expiresOn || null, reviewedAt ? request.user.id : null, reviewedAt, facility.id);
      store.audit(request.user.id, 'AMBULANCE_PROFILE_UPDATED', {
        targetId: facility.id,
        details: { countryCode: input.countryCode, status: input.status, expiresOn: input.expiresOn || null },
        ip: request.ip
      });
      store.db.exec('COMMIT');
    } catch (error) {
      store.db.exec('ROLLBACK');
      throw error;
    }
    response.set('Cache-Control', 'no-store').json(envelope({ saved: true }));
  });
}

module.exports = { installFacilityRoutes };
