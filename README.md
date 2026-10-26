# hfa-silverstrong
A three-in-one application that covers 1. healthcare, 2. fitness & health tips and 3. pharmacy or health products expo sections and sales. An App that brings doctors/nurses and patients on one platform facilitating consultations and exchanges between both sides both through text and video and a secure data management of all interactions.

## Production deployment

**To put the real system online (app + server + encrypted database with automatic HTTPS), follow [DEPLOY.md](DEPLOY.md).**
It uses `deploy/docker-compose.prod.yml` (Caddy + Let's Encrypt), `deploy/production.env.example`,
`deploy/setup-ubuntu.sh` and daily backups with `deploy/backup.sh`. Production forces two-step sign-in for
administrators. If the Super Admin's phone is unavailable, the sign-in screen can email a one-time code (valid
10 minutes, at most 3 per sign-in, a minute apart, audited) once `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and
`MAIL_FROM` are set (`backend/mailer.js`; a Gmail app password is free). Recovery codes keep working too.

The public website `www.healthyfutureafrica.org` runs on Cloudflare (`wrangler.jsonc`) without the server, with an
edge script (`worker/index.js`) that forces HTTPS and adds security headers. It offers what works without an
account (the Free Health Hub and the anonymous symptom check); Sign in and Register explain that accounts open
with the HFA service. **There are no demo accounts or built-in example records anywhere**: every person and record
comes from real registrations on the server, and accounts left by earlier demo versions are retired at startup
(`backend/retire-demo-accounts.js`, matched by email and the exact demo password hash).

## Patient rights, privacy and health-data standards

Every portal has **My data & privacy** in the sidebar (under Legal & Privacy). It turns the rights in Cameroon
Law No. 2024/017 on personal data (aligned with GDPR Art. 15–21 and the HIPAA right of access) into buttons:

- **Download my health record** as an **HL7 FHIR R4** collection Bundle (`application/fhir+json`): Patient,
  AllergyIntolerance, Condition, MedicationStatement, Procedure, Observation, FamilyMemberHistory, Consent,
  Appointment, DiagnosticReport (released lab results only), ServiceRequest, DocumentReference and Practitioner.
  Codes are used only where certain (WHO ICD-11 MMS, LOINC, SNOMED CT, HL7 terminology); everything else is text.
  Information typed by the patient is marked `unconfirmed` (patient-reported), never as a diagnosis. The builder
  is `hfa-fhir.js`, shared by the site and the server (`GET /api/v1/me/fhir`). A readable summary can be printed
  or saved as PDF.
- **Consents**: research, Ministry statistics and SMS can be switched on or off at any time
  (`POST /api/v1/me/consents`); every change is kept in `consent_events` and in the encrypted health record.
  Sharing with the care team is required to hold an account; withdrawing it is an erasure request.
- **Who has opened my record**: each time a patient's health profile is sent to someone else (assigned
  clinicians), and each administrator document view, account change, account closure or "sign in as", is in the
  server audit log and shown to the person (`GET /api/v1/me/access-log`, at most one view entry per viewer per hour,
  without IP addresses).
- **Data-rights requests** (access, rectification, erasure, restriction, objection, portability) with a 30-day
  deadline. Administrators answer them under **Data-rights requests** (`/api/v1/admin/privacy-requests`); closing
  a request needs a written answer, and the patient is notified.

Other safeguards: automatic sign-out after 15 minutes without activity with a one-minute warning
(`session-guard.js`, HIPAA §164.312(a)(2)(iii)); text typed by users is HTML-escaped before display (`hx()` in
`index.html`, OWASP ASVS V5.3); a skip link, a `main` landmark, visible keyboard focus, dialog semantics,
Escape to close dialogs and reduced motion (WCAG 2.2 AA). The Compliance Centre lists the frameworks applied.

These features do not replace legal review: data-protection authorisation, the DPO appointment, hosting location
(Art. 32 transfers abroad) and an independent penetration test are still required before real patients.

## SLY Triage (symptom check and clinician handover)

Patients open **Check my symptoms** (sidebar, or the Urgent Help tile). Four short steps: who is unwell and
their age group (and pregnancy), the problems (plus optional own words), the danger signs for that person, and
how long and how bad. An emergency sign ends the questions at once.

- **The rules decide, not the AI.** `hfa-triage.js` (shared by the site, the server and later the WhatsApp bot)
  applies WHO IMCI general danger signs and young-infant signs, WHO danger signs in pregnancy, adult red flags,
  same-day malaria testing for fever, and TB screening for a cough of 2 weeks or more. Levels: emergency, urgent
  (today), routine, self-care (only for healthy, non-pregnant adults with a mild, recent, low-risk problem).
  Every case stores `RULES_VERSION`. **A clinician must review these rules before real patients use them.**
- The result appears on the device immediately (works offline, and without an account on the public website), with a call button for
  the emergency number (`EMERGENCY_NUMBER` in `hfa-triage.js`, currently the WhatsApp assistant's `1515`;
  confirm the national numbers with MINSANTE before launch).
- **Clinician handover.** Cases go to the **Triage queue** of doctors and nurses assigned to the patient or
  working at the hospital the patient is registered under, most urgent first, with a plain summary (answers,
  danger signs asked and answered "no", allergies, conditions and medicines from the health profile). Emergencies
  notify those clinicians immediately. A clinician confirms the level or changes it (lowering it needs a written
  reason); the patient sees the decision and the clinician's message. Administrators see the queue's status, never
  the symptoms, and are warned when no clinician can see a patient. Views and decisions appear in the patient's
  "Who has opened my record".
- **AI help (optional, off by default).** With `AI_TRIAGE_ENABLED=true` and `ANTHROPIC_API_KEY`, and only when
  the patient ticks consent for that check, the server sends Claude (`claude-haiku-5-5`, the lowest-cost
  current model, at low effort, with structured output) the patient's words with names, phone numbers, emails and ID numbers removed,
  plus age group, sex, pregnancy status and condition codes. Claude returns problems and danger signs it reads
  (which can only raise the level) and a draft summary, shown to clinicians as "AI draft". If the AI fails or
  declines, the rules alone complete the check. The AI is skipped when the answers are already an emergency.
  Rough cost: about USD 0.0005 per check (under USD 1 per 1,000 checks). Enable it only after the data-protection authority approves the
  transfer abroad (Law No. 2024/017, Art. 32).
- **WhatsApp, at no extra cost.** People who write to the HFA WhatsApp number get the same questions with
  numbered answers, handled by this server (`backend/whatsapp-triage.js`, through the existing webhook), not a
  separate bot service. Only free-form replies inside WhatsApp's free 24-hour customer-service window are sent,
  never paid templates; no AI is used; replies are capped at 60 per number per day. A patient whose WhatsApp
  number is verified on their account gets a case in their care team's queue; anyone else gets the advice and an
  invitation to register, and nothing about them is kept. Conversation state is encrypted and forgotten after 2
  hours. Needs `WHATSAPP_ENABLED=true`, `META_ACCESS_TOKEN` and `META_PHONE_NUMBER_ID`. An earlier standalone
  bot scaffold was removed; its 7-option menu (symptom check, booking, pharmacy, lab results, find a provider,
  emergency, talk to a person) and English/French wording are in commit `20b56bd` for when those are added here.
- API: `POST /api/v1/triage` (patient, idempotent `requestId`), `GET /api/v1/triage/mine`,
  `GET /api/v1/triage/queue`, `POST /api/v1/triage/:id/review`. Case contents are AES-256-GCM encrypted with
  `FILE_ENCRYPTION_KEY`.

## SLY AI across the care journey

One switch (`AI_ENABLED=true` plus `ANTHROPIC_API_KEY`; the older `AI_TRIAGE_ENABLED` still works) turns on
Claude help everywhere; `AI_DAILY_LIMIT` (default 30) caps requests per person per day. All AI uses Claude Haiku
5.5 at low effort (about USD 0.0005 a request), sends no names, phone numbers or ID numbers, stores nothing, and
returns drafts a person checks. Every feature works without AI.

| Step | Feature | Without AI |
|---|---|---|
| Before care | **SLY Triage** (app and WhatsApp), see above | WHO rules |
| During care | **Clinical scribe** in the doctor's report window: rough notes → SOAP note, up to 3 ICD-11 codes (malformed codes dropped, codes on HFA's verified list marked), safety flags (e.g. allergy conflicts) and missing information. Uses the patient's latest symptom check when there is one. `POST /api/v1/ai/scribe` | SOAP template with the notes |
| After care | **Explain in simple words** on the patient's doctor reports and released lab results, in English or French, with questions to ask the doctor; never changes treatment. `POST /api/v1/ai/explain` | Built-in bilingual medical dictionary |
| Population | **Outbreak early warning** (`hfa-surveillance.js`): WHO IDSR syndromes (suspected cholera, meningitis, measles/mpox, bloody diarrhoea; fever, respiratory and diarrhoea trends) by region and division; alert clusters and Poisson-tested trends (p < 0.01); weekly CSV export in DHIS2 style with counts under 3 hidden. `GET /api/v1/ai/outbreak` | Statistics only: no AI, no cost |

**SLY AI page** (sidebar, every portal): a model card for each feature (what it does, method, data sent, human
check, cost), the **safety evaluation** (`hfa-ai-eval.js`: 43 WHO-based scenarios run live through the rules;
missed urgency must be 0 and is checked in CI), **real-world monitoring** for clinicians and administrators
(agreement between SLY and clinicians, levels raised or lowered by clinicians, AI requests and estimated cost,
`GET /api/v1/ai/metrics`), outbreak signals, the six WHO principles for AI in health and the limits. The scenarios
were written by the team with the rules, so independent clinical review is still required.

## Accounts and everyday operations

- **Forgotten password** (no email or SMS cost): the person calls or visits their clinic; an administrator checks
  who they are and creates a one-time code (Users → edit → *Create password reset code*); the person enters it
  under **Forgot password?** on the sign-in screen with a new password. Codes are hashed, expire after 30 minutes,
  allow 5 attempts, and resetting signs the account out everywhere (`backend/account-recovery.js`).
- **Notifications** reach the other person on their own device (bookings, messages, lab results, referrals…),
  only between people who work together, always with generic text; patients also get them on WhatsApp when they
  opted in (`backend/notify.js`).
- **Identity documents** are uploaded to the server and verified by an administrator on the Pending Approvals
  page (open, mark verified or not valid).
- **Doctor portraits** are shown to patients only after an administrator approves them; a rejected replacement
  keeps the approved photo (`backend/doctor-photos.js`).
- **Free Health Hub statistics** are anonymous counts on the server (topic, type, language, day; never search
  words or identities) (`backend/hub-stats.js`).

## Governance registers (Safety & Consent page)

All three are held on the server (`backend/governance.js`, `governance-ui.js`):

- **Consent register** (administrators / DPO): each patient's current choices (care team, research, Ministry
  statistics, SMS, WhatsApp), consent version, date and number of changes. Viewing it is audited.
- **Clinician licence register** (administrators): the licence number entered at registration (now sent to the
  server for doctors and nurses), verified against the Ordre National des Médecins du Cameroun or the nursing
  council with an expiry date. Unverified, rejected, expired and soon-expiring (60 days) licences are flagged.
- **Medication safety alerts**: each patient's recorded drug allergies are checked against their medicine list,
  doctors' consultation plans and pharmacy orders (penicillins, cephalosporins incl. penicillin cross-reaction,
  sulfonamides incl. cotrimoxazole and sulfadoxine, NSAIDs/aspirin, quinine, artemisinins, chloroquine,
  metronidazole, opioids; English and French names). Only the patient's clinicians see them (Medication safety in
  their sidebar) and resolve them with a written note; administrators see counts only. A clinician should review
  the drug lists before use with real patients.

## Nurses working with HFA

Server: `backend/nurse-workforce.js`; screens: `nurse-workforce.js`; tests: `backend/test/nurse-workforce.test.js`.

- **Validation before work.** A nurse registers with their licence number, qualifications, nursing school,
  graduation year and a supervisor (name, position, institution, phone, optional email). The account stays pending
  (no sign-in) until an administrator, under *Nurse validation* or *Pending approvals*, has contacted the supervisor
  (call, WhatsApp or email links; every contact is logged with what was said) and confirmed six items: identity,
  licence (recorded with its expiry date in the licence register), qualifications, education, workplace and
  supervisor. The supervisor item can be confirmed only after a contact in which the supervisor vouched for the nurse.
  *Validate nurse* then activates the account. Supervisor contact details are seen only by administrators. Nurses
  added by an administrator go through the same validation; nurses active before this existed keep working.
- **3,000 FCFA per home visit.** The pay becomes due when the nurse has filed the visit report (temperature, blood
  pressure, pulse, findings, care given; stored encrypted), the patient has given feedback, and the doctor in charge
  (the visit's doctor or the patient's assigned doctor) has confirmed receiving all the data, or after the nurse has
  completed a report the doctor sent back. Each step is recorded by that person only. Administrators pay outside the
  app (mobile money, bank transfer or cash) and record the reference under *Nurse payments*; the nurse sees it under
  *My earnings*.
- **Weekly timetable.** Each nurse keeps their weekly working hours under *My availability* and confirms or updates
  them at least every 7 days. Until it is current, a reminder shows on every page and the nurse cannot be booked; a
  home visit must fall within the nurse's hours (checked on the server), and patients see those hours when booking.

## Data entry checks

Built around the mistakes people really make. Two layers; the server is the authority.

- **On the server** (`backend/server.js`, `backend/patient-profile.js`, `backend/governance.js`,
  `backend/clinical-rules.js`): every request body has a strict schema; names need letters; birth dates must be real
  and believable; licence expiry dates must be real; clinical records are checked for content (real calendar dates,
  bookings and home visits not in the past or more than 2 years ahead, valid times, a 10–180 minute consultation,
  the right kind of person in each field — a nurse cannot be picked as the doctor —, no empty notes, reports or
  messages, a file attached to lab results and documents, ratings 1–5, care-plan progress 0–100). Each refusal says
  which field to correct (`backend/test/data-entry.test.js`).
- **In the browser** (`validation.js`): fields carry rules (`data-v`, `required`, `minlength`, `maxlength`, file
  `accept` and `data-max-mb`). When a person leaves a field it is tidied (extra spaces, email case, local phone
  numbers to `+237…`) and checked, with an English or French message under it. Unusual but possible values (an
  appointment at 02:00, a patient over 100, `gmial.com`) warn and go through on a second press. A save button is held
  while a field is wrong; a second tap within 1.5 s is ignored, so one tap never makes two records; releasing a lab
  result, closing an urgent case, resolving a safety alert and suspending an account ask for confirmation first.
  The patient registration wizard keeps its own step checks (`__tests__/validation.test.js`).

## Payments (MTN Mobile Money)

Consultation fees, Basic and Premium plans, nurse home visits and patient rescheduling are paid with **MTN Mobile
Money** through the server (`backend/payments.js`, `mobile-money.js`):

- The server sets every amount from its own records (doctor's fee, plan price, nurse's home-visit fee, USD 5
  rescheduling fee), converted at USD 1 = XAF 600; the browser cannot send an amount.
- The patient enters their MTN number (checked: 67x, 68x, 650–654), approves on their phone, and the result is
  taken only from MTN (status checks with back-off, callbacks re-checked, amount and currency must match).
  Idempotency keys stop double charges on weak networks. Phone numbers are encrypted; every step is audited.
- A paid plan is activated by the server only after MTN confirms the payment.
- **Without MTN credentials nothing is charged and nothing is ever marked paid.** Patients see that online payment
  is not available yet: rescheduling and home-visit fees are recorded as due at the facility, and paid plans cannot
  be bought. Set the `MTN_*` values in `.env` (see `.env.example`) once HFA has an MTN MoMo merchant account; test
  with `MTN_TARGET_ENVIRONMENT=sandbox` first. Orange Money is not connected yet.

## Environment notes

- CI runs on GitHub-hosted Ubuntu runners and validates HTML linting, Jest tests, Node backend security/provider tests, Docker image build, and a frontend container smoke test.
- Local development works with Node.js 24 or newer and Docker Desktop.
- Docker Compose runs the frontend and authenticated notification backend. Main-branch container publishing produces both images. GitHub Pages, tagged releases, Jenkins AWS hosting, and Kubernetes manifests still serve the static frontend only; they do not host the backend.

## Additional CI/CD files

- `.github/workflows/ci.yml`: lint + tests + docker build
- `.github/workflows/docker-publish.yml`: smoke-test and publish frontend and `-backend` images with `latest` plus SHA tags to GHCR on `main`; backend publishing verifies that live provider sending is disabled in its clean image.
- `.github/workflows/release.yml`: build and push tagged container images to GHCR on semantic version tags
- `.github/workflows/pages.yml`: publish the public HTML, offline scripts, and `assets/` to GitHub Pages on every push to `main`
- `docker-compose.yml`: same-origin frontend/API stack, persistent backend volume, and no public backend port; `HFA_PORT` selects the localhost web port.

## AWS deployment with Jenkins

This repository includes a cost-conscious AWS deployment path for the current static frontend:

- `Jenkinsfile`: reproducible dependency install, tests, inline JavaScript validation, Docker build, optional Trivy scan, and opt-in AWS deployment.
- `infra/cloudformation.yml`: private, encrypted, versioned S3 bucket behind CloudFront Origin Access Control. Public S3 access is blocked and HTTPS is enforced at CloudFront.
- `.dockerignore`: keeps CI and infrastructure files out of the runtime image.
- `package-lock.json`: pins the npm dependency tree for Jenkins.
- `jenkins/plugins.txt`: minimal Jenkins plugin set for Pipeline, Docker, AWS credentials, Git, and test reporting.
- `infra/deployment-policy.json`: starting IAM policy for the named CloudFormation stack, site bucket, CloudFront invalidation, and identity check.

### Jenkins prerequisites

Install or configure these on the Jenkins agent:

- A Linux Jenkins agent labeled `linux-docker-aws`, with Node.js 20 or newer, npm, and Docker.
- AWS CLI v2.
- Trivy from the official open-source distribution. The pipeline reports when Trivy is unavailable; install it to enforce image scanning.
- Jenkins credentials with ID `hfa-aws-deployer`, using an AWS IAM role or short-lived AWS credentials. Do not store access keys in this repository.

The Jenkins AWS identity needs only the permissions required for the selected stack, S3 sync, CloudFront invalidation, and `sts:GetCallerIdentity`. Prefer a dedicated deployment role with short-lived credentials and a region-specific policy.

### Running the pipeline

Run the pipeline with `DEPLOY=false` first. Set `DEPLOY=true` only after the build and scan pass. Set `AWS_REGION` on the Jenkins agent or job; it defaults to `us-east-1`. `PRICE_CLASS=PriceClass_100` is the lowest-cost CloudFront option and is the default.

The deployment command creates or updates the CloudFormation stack, uploads only the static site, and invalidates CloudFront. The S3 bucket is retained when the stack is deleted to reduce accidental data loss.

### Cost and production boundary

S3 and CloudFront are appropriate for this repository because it has no server-side runtime yet. They avoid always-on compute and the unused local Redis sidecar is not deployed. AWS charges still apply outside applicable free tiers, especially CloudFront requests, data transfer, DNS, logs, and invalidations. Set AWS Budgets and billing alerts before enabling deployment.

This pipeline deploys the static public site only. It does not make the clinical features production-safe: real identity, database, FHIR/terminology services, encryption key management, consent/audit storage, emergency integrations, and regulatory controls must be implemented behind a backend before handling real patient data.

## Public website

The GitHub Pages workflow and Cloudflare publish the public site after pushes to `main` (normally
`https://healthyfutureafrica.github.io/hfa-silverstrong/` and `https://www.healthyfutureafrica.org`). It holds no
accounts and keeps no health data: the Free Health Hub and the anonymous symptom check (rules only; answers stay on
the screen) work there; everything else needs the HFA server (see [DEPLOY.md](DEPLOY.md)).

## Offline Access

### Pages Reachability and Loading

- The canonical static URL is `https://healthyfutureafrica.github.io/hfa-silverstrong/`. GitHub Pages deployment success is separate from a device's ability to reach GitHub's CDN. A TCP connection timeout before TLS, despite correct DNS, cannot be repaired with HTML or JavaScript changes.
- If the URL cannot connect, test the same URL on another trusted network (for example mobile data). Check with the network administrator whether outbound HTTPS to `*.github.io` / GitHub Pages is filtered. Review any configured VPN, proxy or security software with its administrator. Do not disable endpoint protection or TLS validation as a workaround. If the host is unreachable on multiple independent networks, check GitHub Status and the Pages workflow before changing the app.
- Optional Google Fonts load after the page's load event during idle time, so a blocked font provider does not hold up initial rendering. The static GitHub host skips backend API probing because Pages cannot run that API.
- Once prepared offline, public app assets are returned immediately from the service-worker cache. Fresh content is checked in the background on startup/reconnection and applied through the user-controlled Reload notice. Refresh fetches have an eight-second timeout; offline preparation reports failure after twelve seconds rather than staying pending indefinitely. A first visit still requires a working connection to the host.

- Visit the deployed app once online using HTTPS (or localhost). Wait for **Offline Health Hub ready**. The browser caches only the public HTML, offline controls, and HFA logo. Service workers do not work from a directly opened local HTML file.
- Reopen that same URL without internet to browse the Free Health Hub, nutrition and exercise guidance, and use SLY's local topic matching. SLY's disclaimer remains before every response. Fonts may fall back to the device's fonts while offline.
- The English/French connection bar shows offline status, cache failures, and updates. On reconnection the app fetches the latest public content into its offline cache. If content has changed, **Reload** applies it when the user is ready; there is no automatic reload that discards work.
- Existing authenticated sessions refresh account notifications when connectivity returns. The service worker never caches API responses or credentials. Only explicitly saved files enter the separate encrypted upload vault described below; other failed account requests must be retried explicitly.
- Offline account sign-in, registration, appointment confirmation, real consultations, payments, and WhatsApp delivery are not supported. Browser eviction or clearing site data removes offline availability; another successful online visit prepares it again.
- Full clinical offline synchronization requires server-owned records, device encryption and opt-in, account isolation, idempotent writes, version/conflict handling, and explicit pending/confirmed states. These are prerequisites before introducing an offline medical outbox.

### Durable Offline Files

1. On a backend-connected HTTPS deployment (or localhost), sign in online once. Select **Offline files**, choose your account, consent to encrypted device storage, and set a separate device passphrase of at least 12 characters. Remember it: it is not sent to the server, stored, or recoverable. This is not your sign-in password.
2. Select **Save on device** to retain PDF, PNG, JPEG or WebP files, even offline. Each file is limited to 5 MB; the device queue is limited to 50 MB or 100 files. Backend-mode medical-document upload opens this same vault. Identity verification, doctor-photo moderation and lab-release workflows are not implemented by the generic file vault.
3. Files and metadata are AES-GCM encrypted in IndexedDB, not page memory. Closing the app or restarting the device does not intentionally expire them, even after days. Reopen the same URL/browser profile, choose the original account vault, and unlock with its device passphrase. The vault locks on logout, reload, or 15 minutes without interaction.
4. While the app is open and the vault is unlocked, reconnection and periodic checks resume delivery. After a session expires, sign in to the original account again. A different signed-in account cannot receive the files. Uploads use stable IDs and server receipts, so lost acknowledgements and retries do not create duplicates. Local pending files are removed only after the server confirms the correct owner and ID. Rejected/conflicting files remain visible for removal and corrected resubmission.
5. Server-confirmed files are listed and downloadable inside the vault. Server data and metadata are encrypted in the existing persistent SQLite volume with AES-256-GCM. Each account has a 50 MB server limit. Set `FILE_ENCRYPTION_KEY` to a secret 64-character hexadecimal key (32 cryptographically random bytes) in the deployment secret manager/private environment before synchronization; an unconfigured server returns 503 and the device retains pending files. Preserve and back up that key separately from the database. Losing or replacing it makes stored files unreadable; key rotation/migration is not yet implemented.

The app requests persistent browser storage, but browsers may decline it. Clearing site data, private browsing, device loss, uninstalling the browser, or storage eviction can destroy pending files. Keep originals until you see server confirmation. Background synchronization while the app is closed is not promised; reopen, unlock and sign in when needed. GitHub Pages cannot host this file API or provision a backend account.

This owner-only file vault does not automatically release lab results, verify IDs, assign documents to clinicians, scan malware, or synchronize the rest of the clinical chart. Use synthetic files until production retention/deletion, encrypted backups, malware scanning, consent/privacy review, and clinical access controls are complete.

## Pharmacist Portal

- Register through **Pharmacist Portal** or the pharmacist role in registration. Required fields are pharmacy business name, physical address, precise city/region/country location, pharmacist license number, business registration number, and MINSANTE authorization reference. The registration note makes these requirements explicit. References are declarations, not automated proof of regulatory authorization.
- Pharmacists begin in `pending_approval` and receive no authenticated session. Admins review these details under Pending Approvals / Pharmacist profiles, verify original credentials and location outside the app, and explicitly confirm that review before activation. The backend records the validating administrator and timestamp; pending, rejected and suspended pharmacists cannot operate. Supporting-document upload and direct verification with MINSANTE are not implemented by this reference-based review.
- Approved pharmacists manage medication batches, strength/form, pack unit, expiry, prescription requirement, unit price and stock. CEMAC price entry/display uses XAF at USD 1 = XAF 600, with canonical prices stored as USD cents. The inventory and orders are persisted by the backend; GitHub Pages alone cannot process purchases.
- Patients browse stock from active validated pharmacies and submit purchase requests for pickup or delivery, with quantity and address. The server reserves stock atomically and uses a stable request ID to avoid duplicate reservations on retries. Expired batches and insufficient stock cannot be ordered. Cancelling through pharmacist logistics restores reserved stock once.
- Pharmacists track requested, ready, dispatched (delivery), completed and cancelled orders. Prescription-required stock cannot be made ready without the pharmacist affirming review of the original prescription and patient suitability. Only the owning pharmacist can update fulfillment; patients see only their own orders.
- This is a purchase-request and logistics workflow, not automated medication dispensing or live payment processing. Settlement must be arranged with the pharmacy. Inventory imports, prescription-document verification, controlled-drug rules, shipping integrations, tax receipts, refund handling and regulatory/privacy review are required before real medication commerce. Use synthetic data for testing. Pharmacy orders are online-only and are not silently queued offline.

## CEMAC Price Display

The country selector in the status bar controls regional pricing. Cameroon, Central African Republic, Chad, Republic of the Congo, Equatorial Guinea, and Gabon display USD-denominated amounts as XAF at the fixed rate **USD 1 = XAF 600**. A recognized CEMAC device time zone provides the initial setting; users must select their current country when travelling or when their device time zone does not identify it. Language is not used to infer location. The selection persists offline in this browser and can be changed when no dialog is open.

Consultation fees, specialist/booking prices, subscriptions, home visits, rescheduling fees and price-bearing translations use this conversion. Existing XAF values are not multiplied again. Amounts are rounded to whole XAF for display. Stored fee values and mock payment requests retain their original currency; this does not implement live foreign-exchange settlement or geolocation tracking.

## Doctor workflows

- The doctor dashboard and patient list filter by surname initial. An explicit `lastName` is used when available; otherwise the last word of the full name is treated as the surname.
- Consultations require a future date/time and a 30- or 45-minute duration. Doctor/patient overlaps are checked against this browser's appointment records.
- Patients pay USD 5 to reschedule; doctors reschedule for free. The current payment provider is a mock, not a real charge. Failed payments leave the appointment unchanged. Rescheduling records retain the reason, previous slot, requester, and payment reference.
- Doctors upload JPG, PNG, or WebP portraits up to 2 MB from their dashboard. Images are resized and submitted to the admin Pending Approvals screen. Patients see only approved portraits on appointment cards and appointment call screens. A pending or rejected replacement does not replace an already approved photo.
- Voice and video consultations are real WebRTC calls (`calls.js`, `backend/calls.js`): audio and video go directly and encrypted between the two devices; the server only relays connection messages between the patient and the clinician of a scheduled voice or video appointment, from 15 minutes before to 15 minutes after its time, and forgets them after 2 hours. Video is sent at 320×240, 15 fps, about 250 kbit/s for 3G; a refused camera leaves an audio call. A free public STUN server is used by default; on networks that block direct connections, add a TURN relay with `TURN_URLS`, `TURN_USERNAME` and `TURN_CREDENTIAL` (for example a self-hosted coturn).
- Patient registration requires a dedicated WhatsApp number in international format and saves a separate, optional opt-in for account updates and new-message alerts. The number's format is validated, but ownership and WhatsApp availability are not verified.
- On the public site without the server, doctor replies and account changes create unsent `DB.whatsappAlerts` records. In Compose backend mode, authenticated activity requests create persistent server notifications and delivery records. Recipients and consent are resolved from the server database; a patient can target only their own account, while doctors/nurses need a server-assigned patient relationship. Browser phone numbers or consent flags cannot authorize a send.
- Patient notifications also cover appointment creation, rescheduling and completion, doctor reports, care notes, specialist referrals, lab-result activity, ID/document uploads, subscription changes, consultation payments, home-visit bookings, and urgent-care submissions. All external alert records carry a generic automated message asking the patient to sign in, the platform login URL, and `replyAllowed: false`. The external body never includes symptoms, results, document names, or clinical notes. Page navigation alone does not generate alerts, and multi-file uploads notify once after the batch finishes.

Clinical records (appointments, messages, care notes, reports, documents, lab results, referrals, home visits, ratings, care plans) are stored on the server and shared across devices (`backend/clinical.js`, `clinical-sync.js`), with access enforced by the server. Appointment times currently use the device's local time zone.

## WhatsApp backend

The Node.js 24 backend persists accounts, password hashes, opaque session records, provider assignments, WhatsApp consent/verification, activity records, the delivery outbox, and encrypted owner-only file uploads in SQLite. Authentication uses scrypt, HttpOnly SameSite cookies, origin checks, and rate limits. Admin account updates/approvals go through server authorization. Clinical records are server-held (see above); payments and calls are described in their own sections. Before real patients, complete the launch checklist in DEPLOY.md: this applies to real patient data.

### Local setup

Private settings live in the ignored `.env` file; `.env.example` lists supported names. Keep secrets out of Git, images, screenshots, and chat. Configure `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 16 characters to provision the real backend administrator. Other backend accounts require passwords of at least 12 characters. Newly registered doctors/nurses wait for administrator approval; patients register and manage their own WhatsApp opt-in.

Run `docker compose -p hfa-whatsapp up -d --build --wait`. The prepared local settings use `http://localhost:8081`; the API is proxied under `/api/`. The database is in this Compose project's `backend-data` volume. Do not delete that volume when upgrading. `npm run ci` includes frontend and backend tests; `npm run backend` starts only the API outside Docker.

After a successful main-branch publish, deployment images are `ghcr.io/healthyfutureafrica/hfa-silverstrong:latest` and `ghcr.io/healthyfutureafrica/hfa-silverstrong-backend:latest`. Publishing an image does not provision a public server, configure credentials, or activate WhatsApp delivery. Supply runtime secrets only on the deployment host.

### Activate Meta Cloud API

1. Deploy or expose the same app/API under a public HTTPS origin. Localhost and GitHub Pages cannot receive Meta webhooks; GitHub Pages remains the public information site without accounts. Set `PUBLIC_APP_URL` and `PUBLIC_LOGIN_URL` to this backend-connected HTTPS origin, and open that public URL for live testing.
2. Enter `META_ACCESS_TOKEN`, `META_APP_SECRET`, and a strong `META_WEBHOOK_VERIFY_TOKEN` directly in `.env` or a secret manager. Use a suitable system-user access token with WhatsApp messaging permission. Set the sender's numeric `META_PHONE_NUMBER_ID`, international `WHATSAPP_BUSINESS_NUMBER`, supported `META_GRAPH_VERSION`, approved `WHATSAPP_ACTIVITY_TEMPLATE`, and its exact `WHATSAPP_TEMPLATE_LANGUAGE`.
3. The approved utility template must contain only a generic automated account-activity notification, the correct secure login link, and "Do not reply." Set `WHATSAPP_TEMPLATE_LOGIN_URL_PARAMETER=true` only if its body has one `{{1}}` parameter for the login URL; otherwise use an approved static link and leave the flag false. No patient name, symptoms, notes, or results are sent as template parameters. Meta sends the configured approved template, not the frontend preview text.
4. Configure Meta's callback URL as `https://YOUR-APP/api/whatsapp/webhook`, use the same verification token, and subscribe to the WhatsApp `messages` field. POST callbacks require an HMAC-SHA256 signature over the raw request body and the configured sender ID. Webhook messages are used only for verification/opt-out; clinical replies are not stored or forwarded.
5. Set `WHATSAPP_ENABLED=true` and restart the Compose stack. Patients must opt in and use **Verify WhatsApp Number** from their dashboard, then send the short-lived START message from the registered WhatsApp number. Only a signed inbound callback from that number establishes ownership. Changing the number resets verification. Patients can withdraw consent from their dashboard or send STOP to the business sender.

### Delivery behavior

Server-accepted activities are idempotent by actor/event ID. Unconfigured, unconsented, unverified, or unauthorized sends are blocked. The worker sends approved templates and stores `queued`, `accepted`, `sent`, `delivered`, `read`, `failed`, and blocked states. `accepted` is not proof of delivery; signed status callbacks determine delivery/read state. Duplicate and out-of-order callbacks do not downgrade a read receipt.

HTTP 429 retries have a bounded backoff. Ambiguous network errors, HTTP 5xx, and interrupted in-flight sends become `delivery_unknown` and are not automatically resent; a correlated webhook can resolve them. Queued sends recheck consent and recipient eligibility. Default daily limits are 20 attempts per WhatsApp number and 1,000 total; adjust the settings and configure Meta spending alerts. Limits are safeguards, not a billing guarantee. Previously blocked verification/consent events are not replayed automatically after opt-in.

Before production use, complete clinical-data migration and authorization, encrypted storage/backups, retention/deletion policy, staff identity verification, monitoring, account recovery/MFA, and privacy/regulatory review. Use HTTPS cookies, a production secret manager, least-privilege provider credentials, and audited patient consent. The local integration has been tested with synthetic accounts and mocked Meta responses; no real message is sent unless live configuration and verified consent are present.

