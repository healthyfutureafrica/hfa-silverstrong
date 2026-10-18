-- Payment Service schema: mobile-money payments for consultations, with an outbox for reliable
-- notification of the Consultation Service.

CREATE TYPE payment_status AS ENUM ('pending', 'successful', 'failed', 'expired');

CREATE TABLE payments (
  id                       uuid PRIMARY KEY,
  consultation_id          uuid NOT NULL,
  payer_user_id            uuid NOT NULL,                 -- Auth Service id of the paying patient
  provider                 varchar(20) NOT NULL CHECK (provider IN ('mtn_momo', 'orange_money')),
  amount                   numeric(12, 0) NOT NULL CHECK (amount > 0), -- XAF has no minor unit
  currency                 char(3) NOT NULL,
  msisdn_enc               bytea NOT NULL,                -- payer phone number, AES-256-GCM
  msisdn_hash              char(64) NOT NULL,             -- blind index for support look-ups
  provider_reference       uuid NOT NULL UNIQUE,          -- X-Reference-Id sent to MTN
  idempotency_key          varchar(64) NOT NULL,
  status                   payment_status NOT NULL DEFAULT 'pending',
  provider_status          varchar(30),
  financial_transaction_id varchar(64),
  failure_reason           varchar(120),
  poll_attempts            integer NOT NULL DEFAULT 0,
  not_found_count          integer NOT NULL DEFAULT 0,
  next_poll_at             timestamptz,
  last_checked_at          timestamptz,
  expires_at               timestamptz NOT NULL,
  completed_at             timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payer_user_id, idempotency_key),
  CHECK ((status = 'pending') = (completed_at IS NULL))
);
-- At most one payment in progress, and at most one success, per consultation.
CREATE UNIQUE INDEX payments_one_pending_per_consultation ON payments (consultation_id) WHERE status = 'pending';
CREATE UNIQUE INDEX payments_one_success_per_consultation ON payments (consultation_id) WHERE status = 'successful';
CREATE INDEX payments_due_for_polling ON payments (next_poll_at) WHERE status = 'pending';

-- A final status (successful / failed / expired) can never be changed.
CREATE FUNCTION payments_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'payment % is final (%) and cannot change', OLD.id, OLD.status;
  END IF;
  IF NEW.amount <> OLD.amount OR NEW.currency <> OLD.currency OR NEW.provider_reference <> OLD.provider_reference OR NEW.consultation_id <> OLD.consultation_id THEN
    RAISE EXCEPTION 'payment amount, currency, reference and consultation are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER payments_immutable BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION payments_guard();

-- Transactional outbox: written in the same transaction as the payment status change, then
-- delivered to the Consultation Service with retries, so a confirmed payment is never lost.
CREATE TABLE payment_outbox (
  id              bigserial PRIMARY KEY,
  payment_id      uuid NOT NULL REFERENCES payments (id),
  event_type      varchar(50) NOT NULL,
  payload         jsonb NOT NULL,
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at    timestamptz,
  last_error      varchar(200),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, event_type)
);
CREATE INDEX payment_outbox_due ON payment_outbox (next_attempt_at) WHERE delivered_at IS NULL;

-- Record of provider callbacks (claims only; the status is always re-checked with the provider).
CREATE TABLE payment_callbacks (
  id             bigserial PRIMARY KEY,
  provider       varchar(20) NOT NULL,
  payment_id     uuid,
  claimed_status varchar(30),
  received_at    timestamptz NOT NULL DEFAULT now()
);
