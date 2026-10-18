const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const { encryptJson, decryptJson, hmacHex, sha256Hex, canonicalJson, safeEqual, AppError, forbidden, notFound, conflict, badRequest } = require('@hfa/shared');
const { createPrescriptionCredential, openPrescriptionToken, normaliseShortCode, shortCodeDigest, patientReference } = require('./prescriptionCode');
const { appendEvent, verifyChain } = require('./auditChain');

const tooManyAttempts = () => new AppError(429, 'Too many failed verification attempts; please wait and contact support if this continues');

function createPrescriptionService({ sequelize, models, config, userClient, logger }) {
  const { Prescription, PrescriptionEvent, VerificationAttempt } = models;
  const keys = { tokenKey: config.tokenKey, codeKey: config.codeKey };
  const itemsAad = id => `prescriptions.items:${id}`;

  // HMAC over every immutable field: if anyone edits a row directly in the database (bypassing
  // the trigger with superuser rights), verification fails.
  const integrityMac = rx => hmacHex(config.integrityKey, canonicalJson({
    id: rx.id, patientId: rx.patientId, doctorId: rx.doctorId, consultationId: rx.consultationId || null,
    doctorCredentialHash: rx.doctorCredentialHash, itemsDigest: rx.itemsDigest, itemCount: rx.itemCount,
    codeDigest: rx.codeDigest, issuedAt: new Date(rx.issuedAt).toISOString(), expiresAt: new Date(rx.expiresAt).toISOString()
  }));

  const summaryFor = (rx, items) => ({
    doctorId: rx.doctorId, status: rx.status, issuedAt: new Date(rx.issuedAt).toISOString(), expiresAt: new Date(rx.expiresAt).toISOString(),
    ...(rx.dispensedAt ? { dispensedAt: new Date(rx.dispensedAt).toISOString() } : {}),
    medications: items.map(item => `${item.drugName} ${item.strength}`.slice(0, 160))
  });

  // Keeps the patient's prescription history in the User Service up to date. Failures are logged
  // and do not undo the prescription (production: deliver through an outbox/queue for retries).
  async function syncHistory(rx, items) {
    try { await userClient.syncPrescription(rx.patientId, rx.id, summaryFor(rx, items)); }
    catch (error) { logger.warn('prescription_history_sync_failed', { prescriptionId: rx.id, message: error.message }); }
  }

  // The prescriber's credential must be verified in the User Service and match their token.
  async function currentCredential(doctorId) {
    try { return await userClient.getCredential(doctorId); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }

  async function issue(actor, input) {
    if (actor.role !== 'doctor') throw forbidden('Only doctors can issue prescriptions');
    if (!actor.credentialHash) throw forbidden('Your professional credential has not been verified');
    const credential = await currentCredential(actor.id);
    if (!credential || credential.status !== 'verified' || !safeEqual(credential.credentialHash, actor.credentialHash)) {
      throw forbidden('Your professional credential is not currently valid');
    }

    // Clinical safety: warn about recorded drug allergies unless the prescriber acknowledges them.
    const safety = await userClient.getSafetyProfile(input.patientId);
    const warnings = [];
    for (const allergy of safety.drugAllergies) {
      const allergen = allergy.allergenName.toLowerCase();
      for (const item of input.items) {
        if (item.drugName.toLowerCase().includes(allergen) || allergen.includes(item.drugName.toLowerCase())) {
          warnings.push({ drugName: item.drugName, allergenName: allergy.allergenName, severity: allergy.severity });
        }
      }
    }
    if (warnings.length && !input.acknowledgeAllergyWarnings) throw conflict('The patient has a recorded allergy that matches this prescription', { allergyWarnings: warnings });

    const id = randomUUID();
    const issuedAt = new Date();
    issuedAt.setMilliseconds(0);
    const expiresAt = new Date(issuedAt.getTime() + input.validDays * 86400000);
    const itemsDigest = sha256Hex(canonicalJson(input.items));
    const credentialPayload = {
      v: 1, rx: id, dr: actor.id, ch: actor.credentialHash, pt: patientReference(keys, input.patientId),
      iat: Math.floor(issuedAt.getTime() / 1000), exp: Math.floor(expiresAt.getTime() / 1000), it: itemsDigest
    };
    const { token, shortCode, codeDigest } = createPrescriptionCredential(keys, credentialPayload);
    const record = {
      id, patientId: input.patientId, doctorId: actor.id, consultationId: input.consultationId || null,
      doctorCredentialHash: actor.credentialHash, itemsEnc: encryptJson(config.dataKey, input.items, itemsAad(id)),
      itemsDigest, itemCount: input.items.length, codeDigest, issuedAt, expiresAt, status: 'issued'
    };
    record.integrityMac = integrityMac(record);
    const rx = await sequelize.transaction(async transaction => {
      const created = await Prescription.create(record, { transaction });
      await Prescription.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      await appendEvent(models, transaction, { prescriptionId: id, eventType: 'issued', actor, details: { itemCount: record.itemCount, validDays: input.validDays, allergyWarningsAcknowledged: warnings.length > 0 } });
      return created;
    });
    await syncHistory(rx, input.items);
    logger.info('prescription_issued', { prescriptionId: id, doctorId: actor.id });
    // The code and token are returned once, to the prescriber, for the patient (SMS / printout / QR).
    return { prescriptionId: id, verificationCode: shortCode, token, issuedAt, expiresAt, allergyWarnings: warnings };
  }

  // Finds the prescription a code or token refers to. A token is also cross-checked against the
  // stored record, so a validly sealed but mismatching token is rejected.
  async function resolve({ code, token }, transaction, lock = false) {
    const options = { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) };
    if (token) {
      const payload = openPrescriptionToken(keys, token);
      if (!payload || payload.v !== 1) return { reason: 'invalid_token' };
      const rx = await Prescription.findByPk(payload.rx, options);
      if (!rx) return { reason: 'not_found' };
      const matches = payload.dr === rx.doctorId && payload.ch === rx.doctorCredentialHash && payload.it === rx.itemsDigest
        && payload.pt === patientReference(keys, rx.patientId) && payload.exp === Math.floor(rx.expiresAt.getTime() / 1000);
      return matches ? { rx } : { rx, reason: 'token_mismatch' };
    }
    const normalised = normaliseShortCode(code);
    if (!normalised) return { reason: 'malformed_code' };
    const rx = await Prescription.findOne({ where: { codeDigest: shortCodeDigest(keys, normalised) }, ...options });
    return rx ? { rx } : { reason: 'not_found' };
  }

  // Every check a pharmacist relies on, in one place.
  async function assess(rx) {
    const reasons = [];
    if (!safeEqual(integrityMac(rx), rx.integrityMac)) reasons.push('integrity_check_failed');
    let items = null;
    try {
      items = decryptJson(config.dataKey, rx.itemsEnc, itemsAad(rx.id));
      if (sha256Hex(canonicalJson(items)) !== rx.itemsDigest) reasons.push('integrity_check_failed');
    } catch (error) {
      reasons.push('integrity_check_failed');
    }
    if (rx.status === 'dispensed') reasons.push('already_dispensed');
    if (rx.status === 'revoked') reasons.push('revoked');
    if (rx.expiresAt <= new Date()) reasons.push('expired');
    const credential = await currentCredential(rx.doctorId);
    if (!credential || credential.status !== 'verified' || !safeEqual(credential.credentialHash, rx.doctorCredentialHash)) reasons.push('prescriber_credential_invalid');
    return { reasons: [...new Set(reasons)], items };
  }

  async function guardAgainstGuessing(actor) {
    const since = new Date(Date.now() - config.failureWindowSeconds * 1000);
    const failures = await VerificationAttempt.count({ where: { actorId: actor.id, succeeded: false, createdAt: { [Op.gte]: since } } });
    if (failures >= config.maxFailedVerifications) throw tooManyAttempts();
  }

  async function verify(actor, input) {
    if (actor.role !== 'pharmacist') throw forbidden('Only pharmacists can verify prescriptions');
    await guardAgainstGuessing(actor);
    const result = await sequelize.transaction(async transaction => {
      const { rx, reason } = await resolve(input, transaction, true);
      if (!rx || reason) {
        await VerificationAttempt.create({ actorId: actor.id, actorRole: actor.role, succeeded: false, reason, prescriptionId: rx ? rx.id : null }, { transaction });
        return { valid: false, reasons: [reason] };
      }
      const { reasons, items } = await assess(rx);
      const valid = reasons.length === 0;
      await VerificationAttempt.create({ actorId: actor.id, actorRole: actor.role, succeeded: true, reason: valid ? null : reasons[0], prescriptionId: rx.id }, { transaction });
      await appendEvent(models, transaction, { prescriptionId: rx.id, eventType: 'verified', actor, details: { valid, reasons } });
      return { valid, reasons, rx, items };
    });
    if (!result.rx) return { valid: false, reasons: result.reasons, prescription: null };
    // Show the pharmacist what they need to dispense safely and confirm the patient's identity
    // (patient number, birth year, sex and drug allergies) — no names or contact details.
    const safety = await userClient.getSafetyProfile(result.rx.patientId);
    return {
      valid: result.valid,
      reasons: result.reasons,
      prescription: {
        id: result.rx.id, status: result.rx.status, issuedAt: result.rx.issuedAt, expiresAt: result.rx.expiresAt,
        doctorId: result.rx.doctorId, items: result.items,
        patient: { hfaNumber: safety.hfaNumber, birthYear: safety.birthYear, sex: safety.sex, drugAllergies: safety.drugAllergies }
      }
    };
  }

  async function dispense(actor, prescriptionId, input) {
    if (actor.role !== 'pharmacist') throw forbidden('Only pharmacists can dispense prescriptions');
    await guardAgainstGuessing(actor);
    const outcome = await sequelize.transaction(async transaction => {
      const { rx, reason } = await resolve(input, transaction, true);
      if (!rx || reason || rx.id !== prescriptionId) {
        await VerificationAttempt.create({ actorId: actor.id, actorRole: actor.role, succeeded: false, reason: reason || 'code_mismatch', prescriptionId }, { transaction });
        return { error: reason === 'not_found' || !rx ? 'not_found' : 'code_mismatch' };
      }
      const { reasons, items } = await assess(rx);
      if (reasons.length) {
        await appendEvent(models, transaction, { prescriptionId: rx.id, eventType: 'dispense_rejected', actor, details: { reasons } });
        return { error: 'invalid', reasons };
      }
      await rx.update({ status: 'dispensed', dispensedAt: new Date(), dispensedBy: actor.id, pharmacyId: input.pharmacyId || null }, { transaction });
      await appendEvent(models, transaction, { prescriptionId: rx.id, eventType: 'dispensed', actor, details: { pharmacyId: input.pharmacyId || null } });
      return { rx, items };
    });
    if (outcome.error === 'not_found' || outcome.error === 'code_mismatch') throw badRequest('The verification code does not match this prescription');
    if (outcome.error) throw conflict('This prescription cannot be dispensed', { reasons: outcome.reasons });
    await syncHistory(outcome.rx, outcome.items);
    logger.info('prescription_dispensed', { prescriptionId, pharmacistId: actor.id });
    return { prescriptionId, status: 'dispensed', dispensedAt: outcome.rx.dispensedAt };
  }

  async function revoke(actor, prescriptionId, reason) {
    const outcome = await sequelize.transaction(async transaction => {
      const rx = await Prescription.findByPk(prescriptionId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!rx) throw notFound('Prescription not found');
      if (!(actor.role === 'admin' || (actor.role === 'doctor' && rx.doctorId === actor.id))) throw forbidden('Only the prescribing doctor or an administrator can revoke this prescription');
      if (rx.status !== 'issued') throw conflict(`This prescription is already ${rx.status}`);
      await rx.update({ status: 'revoked', revokedAt: new Date(), revokedBy: actor.id, revokeReason: reason }, { transaction });
      await appendEvent(models, transaction, { prescriptionId, eventType: 'revoked', actor, details: { reason } });
      return rx;
    });
    await syncHistory(outcome, decryptJson(config.dataKey, outcome.itemsEnc, itemsAad(outcome.id)));
    return { prescriptionId, status: 'revoked' };
  }

  async function get(actor, prescriptionId) {
    const rx = await Prescription.findByPk(prescriptionId);
    if (!rx) throw notFound('Prescription not found');
    if (!(actor.role === 'admin' || (actor.role === 'doctor' && rx.doctorId === actor.id))) throw forbidden();
    return {
      id: rx.id, patientId: rx.patientId, doctorId: rx.doctorId, consultationId: rx.consultationId, status: rx.status,
      issuedAt: rx.issuedAt, expiresAt: rx.expiresAt, dispensedAt: rx.dispensedAt, revokedAt: rx.revokedAt,
      items: decryptJson(config.dataKey, rx.itemsEnc, itemsAad(rx.id))
    };
  }

  async function auditTrail(actor, prescriptionId) {
    if (actor.role !== 'admin') throw forbidden();
    const rx = await Prescription.findByPk(prescriptionId);
    if (!rx) throw notFound('Prescription not found');
    const events = await PrescriptionEvent.findAll({ where: { prescriptionId }, order: [['sequence', 'ASC']] });
    return {
      prescriptionId, status: rx.status,
      integrityValid: safeEqual(integrityMac(rx), rx.integrityMac),
      chain: verifyChain(events.map(event => event.get({ plain: true }))),
      events: events.map(event => ({ sequence: event.sequence, eventType: event.eventType, actorId: event.actorId, actorRole: event.actorRole, details: event.details, createdAt: event.createdAt, hash: event.hash }))
    };
  }

  return { issue, verify, dispense, revoke, get, auditTrail };
}

module.exports = { createPrescriptionService };
