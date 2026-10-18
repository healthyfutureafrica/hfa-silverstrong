const { sha256Hex, canonicalJson } = require('@hfa/shared');

const GENESIS = '0'.repeat(64);

// Hash of one audit event: covers its content and the previous event's hash.
function eventHash(prevHash, event) {
  return sha256Hex(prevHash + canonicalJson({
    prescriptionId: event.prescriptionId, sequence: event.sequence, eventType: event.eventType,
    actorId: event.actorId, actorRole: event.actorRole, details: event.details, createdAt: new Date(event.createdAt).toISOString()
  }));
}

// Appends an event inside the caller's transaction. The caller must already hold a row lock on
// the prescription (SELECT ... FOR UPDATE) so sequences and hashes cannot interleave.
async function appendEvent(models, transaction, { prescriptionId, eventType, actor, details = {} }) {
  const last = await models.PrescriptionEvent.findOne({ where: { prescriptionId }, order: [['sequence', 'DESC']], transaction });
  const event = {
    prescriptionId, sequence: last ? last.sequence + 1 : 1, eventType,
    actorId: actor.id, actorRole: actor.role, details, createdAt: new Date(), prevHash: last ? last.hash : GENESIS
  };
  event.hash = eventHash(event.prevHash, event);
  return models.PrescriptionEvent.create(event, { transaction });
}

// Re-computes the whole chain; any edited, removed or re-ordered event makes it invalid.
function verifyChain(events) {
  let prevHash = GENESIS;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || event.prevHash !== prevHash || eventHash(prevHash, event) !== event.hash) {
      return { valid: false, brokenAtSequence: index + 1 };
    }
    prevHash = event.hash;
  }
  return { valid: true, brokenAtSequence: null };
}

module.exports = { appendEvent, verifyChain, eventHash, GENESIS };
