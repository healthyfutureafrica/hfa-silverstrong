-- Auth Service schema: credentials and refresh-token sessions only. Profiles live in the User Service.

CREATE TYPE auth_role AS ENUM ('patient', 'doctor', 'pharmacist', 'lab', 'chw', 'admin');
CREATE TYPE auth_user_status AS ENUM ('active', 'pending', 'suspended', 'deleted');

CREATE TABLE auth_users (
  id                  uuid PRIMARY KEY,
  email               varchar(254) NOT NULL CHECK (email = lower(email)),
  password_hash       varchar(255) NOT NULL,
  role                auth_role NOT NULL,
  status              auth_user_status NOT NULL DEFAULT 'active',
  -- HMAC of the provider's professional credential (licence number + council), set by the
  -- User Service after verification. Copied into access tokens so the Pharmacy Service can bind
  -- prescriptions to the prescriber's credential.
  credential_hash     char(64),
  failed_login_count  integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until        timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX auth_users_email_key ON auth_users (email);

-- One row per refresh token. Tokens issued from the same login share a family_id; rotating
-- marks the old row used and links it to its replacement. Only SHA-256 hashes are stored.
CREATE TABLE auth_refresh_tokens (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES auth_users (id) ON DELETE CASCADE,
  family_id         uuid NOT NULL,
  token_hash        char(64) NOT NULL UNIQUE,
  client_type       varchar(10) NOT NULL CHECK (client_type IN ('web', 'mobile')),
  expires_at        timestamptz NOT NULL,
  family_expires_at timestamptz NOT NULL,
  used_at           timestamptz,
  revoked_at        timestamptz,
  revoked_reason    varchar(40),
  replaced_by_id    uuid,
  created_ip        varchar(64),
  user_agent        varchar(255),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at <= family_expires_at)
);
CREATE INDEX auth_refresh_tokens_family_active ON auth_refresh_tokens (family_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_refresh_tokens_user_active ON auth_refresh_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_refresh_tokens_expiry ON auth_refresh_tokens (family_expires_at);
