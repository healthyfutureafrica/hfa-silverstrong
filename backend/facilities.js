// Hospital register and stakeholder numbers: lets each hospital see the patients registered under it.
const envelope = data => ({ success: true, data, message: 'OK', timestamp: new Date().toISOString() });
const plainRows = rows => rows.map(row => ({ ...row }));

function installFacilityRoutes(app, store, authenticated, admin) {
  // Public: the hospitals a patient can choose when registering (names and codes only).
  app.get('/api/v1/facilities', (request, response) => response.json(envelope({ hospitals: plainRows(store.listedHospitals()) })));

  // Doctors and nurses: patients registered under their own hospital — names and numbers, never health data.
  app.get('/api/v1/facilities/mine/patients', authenticated, (request, response) => {
    if (!['doctor', 'nurse'].includes(request.user.role)) return response.status(403).json({ success: false, error: 'Only hospital clinicians can list hospital patients', message: 'Forbidden', timestamp: new Date().toISOString() });
    const facility = store.facility(request.user.facilityId);
    if (!facility) return response.json(envelope({ facility: null, patients: [] }));
    response.json(envelope({ facility: { id: facility.id, name: facility.name, code: facility.code }, patients: plainRows(store.facilityPatients(facility.id)) }));
  });

  app.get('/api/v1/admin/facilities', authenticated, admin, (request, response) => response.json(envelope(store.facilityRegister())));
}

module.exports = { installFacilityRoutes };
