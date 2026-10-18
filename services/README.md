# HFA Tele Healthcare Platform — microservices

Node.js microservices for the Healthy Future Africa platform, plus the CHW mobile app in
`../mobile/chw-app`. This workspace is **new and runs alongside** the current single-page site and
backend (`../index.html`, `../backend/`); it is not yet wired into www.healthyfutureafrica.org.

| Service | Port | Status | Responsibility |
|---|---|---|---|
| auth-service | 4001 | ✅ built | Login, RS256 access tokens, rotating refresh tokens (HttpOnly cookie for web, Keychain for mobile) |
| user-service | 4002 | ✅ built | Patient profile (PostgreSQL schema), allergies, chronic conditions, history, provider credentials |
| consultation-service | 4003 | ⏳ not built | Teleconsultations; must publish `consultation.completed` and expose the internal contracts below |
| communication-service | 4004 | ⏳ not built | E2E-encrypted messaging |
| payment-service | 4005 | ✅ built | MTN Mobile Money collections (Orange Money to follow) |
| pharmacy-service | 4006 | ✅ built | Cryptographic prescriptions, verification, dispensing, audit chain |
| notification-service | 4007 | ⏳ not built | SMS, email, in-app alerts |
| admin-service | 4008 | ✅ built | Public-health surveillance pipeline and Ministry API |

## Conventions (all services)

* **ORM:** Sequelize 6 for models; **schemas are plain SQL migrations** (`<service>/migrations/NNN_*.sql`)
  applied at start-up (`RUN_MIGRATIONS=true`) or as a one-off task (`npm run migrate -w @hfa/<service>`).
* **Envelope:** every response is `{ success, data, message, timestamp }` (`shared/src/envelope.js`).
* **Versioned REST:** public routes under `/api/v1/…`; service-to-service routes under `/internal/v1/…`,
  which the gateway never exposes and which also require `X-Internal-Token`.
* **Validation:** zod schemas on every endpoint (`validate(schema, 'body' | 'query' | 'params' | 'headers')`).
* **Errors:** throw `badRequest / forbidden / notFound / conflict…` from `@hfa/shared`; never put health data
  in messages or logs. Logs are JSON lines with identifiers only.
* **Encryption:** AES-256-GCM field encryption (`shared/src/crypto.js`) with associated data binding each
  value to its table/column/row; HMAC blind indexes for exact-match look-ups.
* **Auth:** services verify access tokens with the Auth Service **public** key only.

## Run locally

```bash
cd services
npm install
node scripts/generate-dev-env.js        # writes .env with fresh development keys (prints a Ministry API key)
docker compose -p hfa-micro up -d --build
node scripts/smoke-test.js <ministry-api-key>
```

The gateway at http://localhost:8090 is the only published port.

### Tests (Jest)

```bash
npm run db:test:start                   # PostgreSQL in Docker on port 55432
docker run -d --name hfa-services-test-redis -p 56379:6379 redis:7-alpine
TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/postgres TEST_REDIS_URL=redis://localhost:56379 npm test
npm run test:mobile                     # CHW app offline storage, sync and triage
```

## Environment variables

Generate 256-bit keys with `openssl rand -hex 32`. In AWS, store every secret in Secrets Manager and
inject it into the ECS task definition; never commit `.env`.

**Common to every service:** `PORT`, `DATABASE_URL`, `DATABASE_SSL` (`true` on RDS), `RUN_MIGRATIONS`,
`TRUST_PROXY`, `INTERNAL_SERVICE_TOKEN`, `AUTH_PUBLIC_KEY_B64` (base64 PEM), `JWT_ISSUER` (`hfa-auth`),
`JWT_AUDIENCE` (`hfa-api`), `LOG_SILENT`.

| Service | Variables |
|---|---|
| auth | `AUTH_PRIVATE_KEY_B64`, `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_SECONDS` (604800), `SESSION_MAX_SECONDS` (2592000), `COOKIE_SECURE` (true), `COOKIE_DOMAIN`, `ALLOWED_ORIGINS`, `SCRYPT_COST` (131072), `MAX_FAILED_LOGINS` (5), `LOCKOUT_SECONDS` (900), `LOGIN_RATE_LIMIT` (10) |
| user | `USER_DATA_KEY`, `USER_BLIND_INDEX_KEY`, `CREDENTIAL_HASH_KEY`, `CONSENT_POLICY_VERSION`, `AUTH_SERVICE_URL` |
| pharmacy | `PRESCRIPTION_TOKEN_KEY`, `PRESCRIPTION_CODE_KEY`, `PRESCRIPTION_INTEGRITY_KEY`, `PHARMACY_DATA_KEY`, `MAX_FAILED_VERIFICATIONS` (10), `VERIFICATION_FAILURE_WINDOW_SECONDS` (900), `VERIFY_RATE_LIMIT` (30), `USER_SERVICE_URL` |
| payment | `PAYMENT_DATA_KEY`, `PAYMENT_BLIND_INDEX_KEY`, `MTN_BASE_URL`, `MTN_COLLECTION_SUBSCRIPTION_KEY`, `MTN_API_USER`, `MTN_API_KEY`, `MTN_TARGET_ENVIRONMENT` (`sandbox` / `mtncameroon`), `MTN_CURRENCY` (`EUR` sandbox / `XAF`), `MTN_CALLBACK_SECRET` (≥32 chars), `PUBLIC_BASE_URL`, `PAYMENT_TIMEOUT_SECONDS` (600), `PAYMENT_WORKER_ENABLED`, `PAYMENT_WORKER_INTERVAL_MS`, `CONSULTATION_SERVICE_URL` |
| admin | `MINISTRY_API_KEYS` (`client-id:sha256hex,…`), `SMALL_CELL_THRESHOLD` (5), `SURVEILLANCE_TIMEZONE` (`Africa/Douala`), `SURVEILLANCE_STREAM_THROTTLE_SECONDS` (10), `REDIS_URL`, `SURVEILLANCE_STREAM`, `SURVEILLANCE_DEAD_LETTER_STREAM`, `SURVEILLANCE_CONSUMER_GROUP` |

## Contracts the Consultation Service must implement

* Publish to Redis stream `consultations.completed` (field `event`), exactly this shape — extra fields are rejected:
  `{ eventId, type: "consultation.completed", consultationId, completedAt, diagnosisCodes: [ICD-10], patient: { birthYear, sex }, location: { regionCode, districtCode } }`
* `GET /internal/v1/consultations/:id` → `{ id, patientUserId, status, feeXaf }` (Payment Service)
* `PATCH /internal/v1/consultations/:id/payment` → idempotent "mark paid" (Payment Service outbox)
* `PUT` to User Service `/internal/v1/patients/:patientId/consultations/:consultationId` to keep history current
* `POST /api/v1/chw/consultations` with `Idempotency-Key` and `POST /api/v1/chw/escalations` (CHW app)

## AWS resources

ECS Fargate services (one per service, private subnets) · Application Load Balancer (only public entry,
path rules replace `gateway/nginx.conf`, ACM certificate, TLS 1.3 policy `ELBSecurityPolicy-TLS13-1-2-2021-06`)
· RDS PostgreSQL 16 (Multi-AZ, KMS-encrypted, one database and least-privilege login per service, forced SSL)
· ElastiCache Redis (in-transit + at-rest encryption, AUTH) · Secrets Manager (all keys above) · KMS ·
ECR (one repository per service) · CloudWatch Logs (+ metric alarms on `refresh_token_reuse_detected`,
`payment_amount_mismatch`, `surveillance_event_rejected`) · S3 (consultation recordings, SSE-KMS, when built)
· WAF on the ALB. Choose an AWS region and hosting arrangement that satisfy Cameroonian data-residency
requirements; confirm with counsel.
