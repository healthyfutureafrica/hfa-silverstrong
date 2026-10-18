-- User Service schema: patient profiles and provider credentials (PostgreSQL 14+).
--
-- Encryption strategy
--   *_enc  columns: AES-256-GCM ciphertext written by the application (direct identifiers and
--                   clinical free text). Each value is bound to its row and column.
--   *_hash columns: HMAC-SHA256 "blind indexes" so a phone number or national ID can be found by
--                   exact match without being stored in clear.
--   Coded clinical data (ICD-10, allergen codes, severity) stays queryable for safety checks and
--   public-health reporting; it is protected by RDS storage encryption (KMS), TLS and access control.

CREATE TYPE patient_sex AS ENUM ('female', 'male', 'intersex', 'unknown');

-- Keeps updated_at current on every UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE patients (
  id                    uuid PRIMARY KEY,
  auth_user_id          uuid UNIQUE,                     -- Auth Service account; NULL until the patient has a login (e.g. registered by a CHW)
  hfa_number            varchar(20) NOT NULL UNIQUE,     -- printed on patient cards, e.g. HFA-PT-7KQ2M9XA
  first_name_enc        bytea NOT NULL,
  last_name_enc         bytea NOT NULL,
  date_of_birth_enc     bytea,
  birth_year            smallint CHECK (birth_year BETWEEN 1900 AND 2100), -- coarse age for clinical and statistical use
  sex                   patient_sex NOT NULL DEFAULT 'unknown',
  phone_enc             bytea,
  phone_hash            char(64),
  national_id_enc       bytea,
  national_id_hash      char(64),
  address_enc           bytea,
  region_code           varchar(10) NOT NULL,            -- Cameroon region, e.g. CM-LT (Littoral)
  district_code         varchar(20) NOT NULL,            -- health district, used for surveillance
  preferred_language    char(2) NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('en', 'fr')),
  blood_group           varchar(3) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  emergency_contact_enc bytea,
  registered_by         uuid NOT NULL,                   -- user who created the record (patient, CHW or clinician)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz                      -- soft delete; purge per the retention policy
);
CREATE UNIQUE INDEX patients_phone_hash_key ON patients (phone_hash) WHERE phone_hash IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX patients_national_id_hash_key ON patients (national_id_hash) WHERE national_id_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX patients_location ON patients (region_code, district_code) WHERE deleted_at IS NULL;
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Consent history (append-only): the latest row per type is the current decision.
CREATE TABLE patient_consents (
  id             uuid PRIMARY KEY,
  patient_id     uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  consent_type   varchar(40) NOT NULL CHECK (consent_type IN ('terms_of_service', 'teleconsultation', 'session_recording', 'data_sharing_research', 'sms_notifications')),
  granted        boolean NOT NULL,
  policy_version varchar(20) NOT NULL,
  recorded_by    uuid NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_consents_current ON patient_consents (patient_id, consent_type, recorded_at DESC);

CREATE TABLE patient_allergies (
  id            uuid PRIMARY KEY,
  patient_id    uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  category      varchar(20) NOT NULL CHECK (category IN ('drug', 'food', 'environmental', 'other')),
  allergen_code varchar(40),                              -- RxNorm / SNOMED CT code where known
  allergen_name varchar(120) NOT NULL,
  severity      varchar(20) NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe', 'life_threatening')),
  reaction_enc  bytea,
  status        varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'entered_in_error')),
  verification  varchar(20) NOT NULL DEFAULT 'unconfirmed' CHECK (verification IN ('unconfirmed', 'confirmed', 'refuted')),
  recorded_by   uuid NOT NULL,
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_allergies_active ON patient_allergies (patient_id) WHERE status = 'active';
CREATE INDEX patient_allergies_drug_code ON patient_allergies (allergen_code) WHERE category = 'drug' AND status = 'active';
CREATE TRIGGER patient_allergies_updated_at BEFORE UPDATE ON patient_allergies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE patient_chronic_conditions (
  id           uuid PRIMARY KEY,
  patient_id   uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  icd10_code   varchar(8) NOT NULL CHECK (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$'),
  name         varchar(160) NOT NULL,
  status       varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'remission', 'resolved', 'entered_in_error')),
  onset_date   date,
  notes_enc    bytea,
  recorded_by  uuid NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_conditions_active ON patient_chronic_conditions (patient_id) WHERE status = 'active';
CREATE INDEX patient_conditions_code ON patient_chronic_conditions (icd10_code) WHERE status = 'active';
CREATE TRIGGER patient_conditions_updated_at BEFORE UPDATE ON patient_chronic_conditions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE medical_history_entries (
  id           uuid PRIMARY KEY,
  patient_id   uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  entry_type   varchar(30) NOT NULL CHECK (entry_type IN ('past_illness', 'surgery', 'hospitalisation', 'immunisation', 'family_history', 'social_history', 'obstetric', 'medication_history')),
  code_system  varchar(20) CHECK (code_system IN ('ICD-10', 'SNOMED-CT', 'CVX', 'RxNorm', 'LOCAL')),
  code         varchar(40),
  summary_enc  bytea NOT NULL,
  occurred_on  date,
  source       varchar(20) NOT NULL DEFAULT 'clinician' CHECK (source IN ('patient_reported', 'clinician', 'chw', 'imported')),
  recorded_by  uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((code IS NULL) = (code_system IS NULL))
);
CREATE INDEX medical_history_patient ON medical_history_entries (patient_id, occurred_on DESC NULLS LAST);
CREATE TRIGGER medical_history_updated_at BEFORE UPDATE ON medical_history_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Read models: copies of summary data owned by the Consultation and Pharmacy services, kept up
-- to date by their events, so the profile can be shown without cross-service joins.
CREATE TABLE patient_consultation_history (
  consultation_id uuid PRIMARY KEY,
  patient_id      uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  doctor_id       uuid,
  chw_id          uuid,
  mode            varchar(10) NOT NULL CHECK (mode IN ('video', 'voice', 'chat', 'field')),
  status          varchar(20) NOT NULL CHECK (status IN ('scheduled', 'awaiting_payment', 'in_progress', 'completed', 'cancelled', 'no_show')),
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  primary_icd10   varchar(8) CHECK (primary_icd10 ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$'),
  summary_enc     bytea,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_consultations_by_patient ON patient_consultation_history (patient_id, scheduled_at DESC NULLS LAST);
CREATE INDEX patient_consultations_by_doctor ON patient_consultation_history (doctor_id, patient_id) WHERE doctor_id IS NOT NULL;
CREATE INDEX patient_consultations_by_chw ON patient_consultation_history (chw_id, patient_id) WHERE chw_id IS NOT NULL;

CREATE TABLE patient_prescription_history (
  prescription_id uuid PRIMARY KEY,
  patient_id      uuid NOT NULL REFERENCES patients (id) ON DELETE CASCADE,
  doctor_id       uuid NOT NULL,
  status          varchar(20) NOT NULL CHECK (status IN ('issued', 'dispensed', 'revoked', 'expired')),
  issued_at       timestamptz NOT NULL,
  expires_at      timestamptz NOT NULL,
  dispensed_at    timestamptz,
  item_count      smallint NOT NULL CHECK (item_count > 0),
  medications_enc bytea,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_prescriptions_by_patient ON patient_prescription_history (patient_id, issued_at DESC);

-- Every time someone other than the patient opens or changes a record, it is logged here.
CREATE TABLE patient_access_log (
  id            bigserial PRIMARY KEY,
  patient_id    uuid NOT NULL,
  accessed_by   uuid NOT NULL,
  accessor_role varchar(20) NOT NULL,
  action        varchar(30) NOT NULL,
  purpose       varchar(120),
  request_id    uuid,
  accessed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_access_log_by_patient ON patient_access_log (patient_id, accessed_at DESC);

-- Verified professional credentials of providers. credential_hash binds prescriptions and
-- signed records to the credential, without exposing the licence number.
CREATE TABLE providers (
  id                 uuid PRIMARY KEY,                  -- same id as the Auth Service account
  role               varchar(20) NOT NULL CHECK (role IN ('doctor', 'pharmacist', 'lab', 'chw')),
  full_name_enc      bytea NOT NULL,
  licensing_body     varchar(60) NOT NULL,              -- e.g. ONMC (doctors), ONPC (pharmacists)
  licence_number_enc bytea NOT NULL,
  credential_hash    char(64) NOT NULL UNIQUE,
  specialty          varchar(80),
  facility           varchar(120),
  status             varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'suspended', 'revoked')),
  verified_by        uuid,
  verified_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Safety flags at a glance for prescribers and pharmacists.
CREATE VIEW patient_clinical_flags AS
SELECT p.id AS patient_id,
       EXISTS (SELECT 1 FROM patient_allergies a WHERE a.patient_id = p.id AND a.status = 'active') AS has_allergies,
       EXISTS (SELECT 1 FROM patient_allergies a WHERE a.patient_id = p.id AND a.status = 'active' AND a.category = 'drug') AS has_drug_allergy,
       EXISTS (SELECT 1 FROM patient_allergies a WHERE a.patient_id = p.id AND a.status = 'active' AND a.severity = 'life_threatening') AS has_life_threatening_allergy,
       COALESCE((SELECT array_agg(DISTINCT c.icd10_code ORDER BY c.icd10_code) FROM patient_chronic_conditions c WHERE c.patient_id = p.id AND c.status = 'active'), '{}'::varchar[]) AS active_chronic_conditions
FROM patients p
WHERE p.deleted_at IS NULL;
