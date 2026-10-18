-- Pharmacy Service schema: cryptographic prescriptions with an immutable, hash-chained audit trail.

CREATE TYPE prescription_status AS ENUM ('issued', 'dispensed', 'revoked'); -- "expired" is derived from expires_at

CREATE TABLE prescriptions (
  id                     uuid PRIMARY KEY,
  patient_id             uuid NOT NULL,                  -- User Service patient id
  doctor_id              uuid NOT NULL,
  consultation_id        uuid,
  doctor_credential_hash char(64) NOT NULL,              -- prescriber credential at the time of issue
  items_enc              bytea NOT NULL,                 -- AES-256-GCM encrypted medication list
  items_digest           char(64) NOT NULL,              -- SHA-256 of the canonical medication list
  item_count             smallint NOT NULL CHECK (item_count BETWEEN 1 AND 20),
  code_digest            char(64) NOT NULL UNIQUE,       -- HMAC of the 16-character verification code (the code itself is never stored)
  integrity_mac          char(64) NOT NULL,              -- HMAC over all immutable fields; detects direct database tampering
  issued_at              timestamptz NOT NULL,
  expires_at             timestamptz NOT NULL,
  status                 prescription_status NOT NULL DEFAULT 'issued',
  dispensed_at           timestamptz,
  dispensed_by           uuid,
  pharmacy_id            varchar(40),
  revoked_at             timestamptz,
  revoked_by             uuid,
  revoke_reason          varchar(200),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at),
  CHECK ((status = 'dispensed') = (dispensed_at IS NOT NULL AND dispensed_by IS NOT NULL)),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL AND revoked_by IS NOT NULL))
);
CREATE INDEX prescriptions_by_patient ON prescriptions (patient_id, issued_at DESC);
CREATE INDEX prescriptions_by_doctor ON prescriptions (doctor_id, issued_at DESC);

-- Immutability enforced by the database itself, not just the application:
--   * rows can never be deleted;
--   * clinical content can never change;
--   * status changes exactly once, from 'issued' to 'dispensed' or 'revoked'.
CREATE FUNCTION prescriptions_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'prescriptions are immutable and cannot be deleted';
  END IF;
  IF NEW.id <> OLD.id OR NEW.patient_id <> OLD.patient_id OR NEW.doctor_id <> OLD.doctor_id
     OR NEW.consultation_id IS DISTINCT FROM OLD.consultation_id OR NEW.doctor_credential_hash <> OLD.doctor_credential_hash
     OR NEW.items_enc <> OLD.items_enc OR NEW.items_digest <> OLD.items_digest OR NEW.item_count <> OLD.item_count
     OR NEW.code_digest <> OLD.code_digest OR NEW.integrity_mac <> OLD.integrity_mac
     OR NEW.issued_at <> OLD.issued_at OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'prescription clinical content is immutable';
  END IF;
  IF OLD.status <> 'issued' THEN
    RAISE EXCEPTION 'prescription is already % and cannot change', OLD.status;
  END IF;
  IF NEW.status = 'issued' THEN
    RAISE EXCEPTION 'only a status change from issued is allowed';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER prescriptions_immutable BEFORE UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION prescriptions_guard();

-- Append-only audit trail. Each event stores the hash of the previous event of the same
-- prescription, so altering or removing any event breaks the chain and is detected.
CREATE TABLE prescription_events (
  id              bigserial PRIMARY KEY,
  prescription_id uuid NOT NULL REFERENCES prescriptions (id),
  sequence        integer NOT NULL CHECK (sequence >= 1),
  event_type      varchar(30) NOT NULL CHECK (event_type IN ('issued', 'verified', 'dispensed', 'dispense_rejected', 'revoked')),
  actor_id        uuid NOT NULL,
  actor_role      varchar(20) NOT NULL,
  details         jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash       char(64) NOT NULL,
  hash            char(64) NOT NULL,
  created_at      timestamptz NOT NULL,
  UNIQUE (prescription_id, sequence)
);

CREATE FUNCTION append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER prescription_events_append_only BEFORE UPDATE OR DELETE ON prescription_events FOR EACH ROW EXECUTE FUNCTION append_only_guard();

-- Every verification attempt, successful or not, for fraud monitoring and brute-force lockout.
CREATE TABLE verification_attempts (
  id              bigserial PRIMARY KEY,
  actor_id        uuid NOT NULL,
  actor_role      varchar(20) NOT NULL,
  succeeded       boolean NOT NULL,
  reason          varchar(40),
  prescription_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_attempts_failures ON verification_attempts (actor_id, created_at DESC) WHERE NOT succeeded;
CREATE TRIGGER verification_attempts_append_only BEFORE UPDATE OR DELETE ON verification_attempts FOR EACH ROW EXECUTE FUNCTION append_only_guard();
