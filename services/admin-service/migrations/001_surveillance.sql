-- Admin Service schema: anonymised public-health surveillance counts and Ministry access audit.
-- No table here contains a patient, consultation or user identifier.

CREATE TABLE surveillance_counts (
  window_size    varchar(5) NOT NULL CHECK (window_size IN ('hour', 'day', 'week')),
  window_start   timestamptz NOT NULL,                  -- start of the window in Cameroon time (Africa/Douala)
  region_code    varchar(10) NOT NULL CHECK (region_code ~ '^CM-[A-Z]{2}$'),
  district_code  varchar(20) NOT NULL,
  icd10_category char(3) NOT NULL CHECK (icd10_category ~ '^[A-Z][0-9]{2}$'),
  age_band       varchar(7) NOT NULL CHECK (age_band IN ('0-4', '5-14', '15-24', '25-49', '50-64', '65+', 'unknown')),
  sex            varchar(8) NOT NULL CHECK (sex IN ('female', 'male', 'other', 'unknown')),
  case_count     integer NOT NULL CHECK (case_count > 0),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (window_size, window_start, region_code, district_code, icd10_category, age_band, sex)
);
CREATE INDEX surveillance_by_disease ON surveillance_counts (window_size, icd10_category, window_start);
CREATE INDEX surveillance_by_place ON surveillance_counts (window_size, region_code, district_code, window_start);

-- Exactly-once processing: an event id is recorded in the same transaction as its counts.
CREATE TABLE surveillance_processed_events (
  event_id     uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX surveillance_processed_events_age ON surveillance_processed_events (processed_at);

-- Who at the Ministry / Regional Delegations queried what, and when.
CREATE TABLE ministry_access_log (
  id          bigserial PRIMARY KEY,
  client_id   varchar(60) NOT NULL,
  endpoint    varchar(80) NOT NULL,
  query       jsonb NOT NULL,
  row_count   integer NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ministry_access_log_by_client ON ministry_access_log (client_id, accessed_at DESC);
