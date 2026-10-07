# hfa-silverstrong
A three-in-one application that covers 1. healthcare, 2. fitness & health tips and 3. pharmacy or health products expo sections and sales. An App that brings doctors/nurses and patients on one platform facilitating consultations and exchanges between both sides both through text and video and a secure data management of all interactions.

## Environment notes

- CI runs on GitHub-hosted Ubuntu runners and validates HTML linting, Jest tests, Node backend security/provider tests, Docker image build, and a frontend container smoke test.
- Local development works with Node.js 24 or newer and Docker Desktop.
- Docker Compose runs the frontend and authenticated notification backend. Main-branch container publishing produces both images. GitHub Pages, tagged releases, Jenkins AWS hosting, and Kubernetes manifests still serve the static frontend only; they do not host the backend.

## Additional CI/CD files

- `.github/workflows/ci.yml`: lint + tests + docker build
- `.github/workflows/docker-publish.yml`: smoke-test and publish frontend and `-backend` images with `latest` plus SHA tags to GHCR on `main`; backend publishing verifies that live provider sending is disabled in its clean image.
- `.github/workflows/release.yml`: build and push tagged container images to GHCR on semantic version tags
- `.github/workflows/pages.yml`: publish only `index.html` and `assets/` to GitHub Pages on every push to `main`
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

This pipeline deploys the current demo frontend only. It does not make the clinical features production-safe: real identity, database, FHIR/terminology services, encryption key management, consent/audit storage, emergency integrations, and regulatory controls must be implemented behind a backend before handling real patient data.

## Shareable free demo

The GitHub Pages workflow publishes the static demo after pushes to `main`. Enable **Settings > Pages > Build and deployment > GitHub Actions** in the repository, then open the URL shown by the `Publish shareable demo` workflow. For this repository it will normally be `https://healthyfutureafrica.github.io/hfa-silverstrong/`.

The landing page includes a one-click **Try Demo** entry for the patient experience. The Admin portal is intentionally excluded from that shortcut; use the provisioned Super Admin account through normal sign-in. This demo stores data in browser memory only, resets on refresh, and must never receive real patient data or production credentials.

## Doctor workflows

- The doctor dashboard and patient list filter by surname initial. An explicit `lastName` is used when available; otherwise the last word of the full name is treated as the surname.
- Consultations require a future date/time and a 30- or 45-minute duration. Doctor/patient overlaps are checked against this browser's appointment records.
- Patients pay USD 5 to reschedule; doctors reschedule for free. The current payment provider is a mock, not a real charge. Failed payments leave the appointment unchanged. Rescheduling records retain the reason, previous slot, requester, and payment reference.
- Doctors upload JPG, PNG, or WebP portraits up to 2 MB from their dashboard. Images are resized and submitted to the admin Pending Approvals screen. Patients see only approved portraits on appointment cards and appointment call screens. A pending or rejected replacement does not replace an already approved photo.
- Conversations are text-only. Voice/video demo screens can be entered only by appointment participants, in the booked mode, during the booked time window; they do not establish real media connections.
- Patient registration requires a dedicated WhatsApp number in international format and saves a separate, optional opt-in for account updates and new-message alerts. The number's format is validated, but ownership and WhatsApp availability are not verified.
- In the disconnected file/GitHub Pages demo, doctor replies and account changes create unsent `DB.whatsappAlerts` records. In Compose backend mode, authenticated activity requests create persistent server notifications and delivery records. Recipients and consent are resolved from the server database; a patient can target only their own account, while doctors/nurses need a server-assigned patient relationship. Browser phone numbers or consent flags cannot authorize a send.
- Patient notifications also cover appointment creation, rescheduling and completion, doctor reports, care notes, specialist referrals, lab-result activity, ID/document uploads, subscription changes, consultation payments, home-visit bookings, and urgent-care submissions. All external alert records carry a generic automated message asking the patient to sign in, the platform login URL, and `replyAllowed: false`. The external body never includes symptoms, results, document names, or clinical notes. Page navigation alone does not generate alerts, and multi-file uploads notify once after the batch finishes.

Clinical charts, appointment contents, mock payments, photo moderation, and call screens remain demo browser state. The optional backend provides persistent accounts, consent, activity notifications, and provider delivery, not a complete clinical-record system. Do not use real patient data or collect money until the remaining clinical workflows are enforced server-side. Appointment times currently use the device's local time zone.

## WhatsApp backend

The Node.js 24 backend persists accounts, password hashes, opaque session records, provider assignments, WhatsApp consent/verification, activity records, and the delivery outbox in SQLite. Authentication uses scrypt, HttpOnly SameSite cookies, origin checks, and rate limits. Admin account updates/approvals go through server authorization. Clinical charts, files, appointments, photo moderation, mock payments, and call demos remain frontend demo workflows: this is not a complete production clinical backend, and they must not receive real patient data.

### Local setup

Private settings live in the ignored `.env` file; `.env.example` lists supported names. Keep secrets out of Git, images, screenshots, and chat. Configure `BOOTSTRAP_ADMIN_EMAIL` and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 16 characters to provision the real backend administrator. Demo passwords in the HTML do not work in backend mode. Other backend accounts require passwords of at least 12 characters. Newly registered doctors/nurses wait for administrator approval; patients register and manage their own WhatsApp opt-in.

Run `docker compose -p hfa-whatsapp up -d --build --wait`. The prepared local settings use `http://localhost:8081`; the API is proxied under `/api/`. The database is in this Compose project's `backend-data` volume. Do not delete that volume when upgrading. `npm run ci` includes frontend and backend tests; `npm run backend` starts only the API outside Docker.

After a successful main-branch publish, deployment images are `ghcr.io/healthyfutureafrica/hfa-silverstrong:latest` and `ghcr.io/healthyfutureafrica/hfa-silverstrong-backend:latest`. Publishing an image does not provision a public server, configure credentials, or activate WhatsApp delivery. Supply runtime secrets only on the deployment host.

### Activate Meta Cloud API

1. Deploy or expose the same app/API under a public HTTPS origin. Localhost and GitHub Pages cannot receive Meta webhooks; GitHub Pages remains a disconnected demo. Set `PUBLIC_APP_URL` and `PUBLIC_LOGIN_URL` to this backend-connected HTTPS origin, and open that public URL for live testing.
2. Enter `META_ACCESS_TOKEN`, `META_APP_SECRET`, and a strong `META_WEBHOOK_VERIFY_TOKEN` directly in `.env` or a secret manager. Use a suitable system-user access token with WhatsApp messaging permission. Set the sender's numeric `META_PHONE_NUMBER_ID`, international `WHATSAPP_BUSINESS_NUMBER`, supported `META_GRAPH_VERSION`, approved `WHATSAPP_ACTIVITY_TEMPLATE`, and its exact `WHATSAPP_TEMPLATE_LANGUAGE`.
3. The approved utility template must contain only a generic automated account-activity notification, the correct secure login link, and "Do not reply." Set `WHATSAPP_TEMPLATE_LOGIN_URL_PARAMETER=true` only if its body has one `{{1}}` parameter for the login URL; otherwise use an approved static link and leave the flag false. No patient name, symptoms, notes, or results are sent as template parameters. Meta sends the configured approved template, not the frontend preview text.
4. Configure Meta's callback URL as `https://YOUR-APP/api/whatsapp/webhook`, use the same verification token, and subscribe to the WhatsApp `messages` field. POST callbacks require an HMAC-SHA256 signature over the raw request body and the configured sender ID. Webhook messages are used only for verification/opt-out; clinical replies are not stored or forwarded.
5. Set `WHATSAPP_ENABLED=true` and restart the Compose stack. Patients must opt in and use **Verify WhatsApp Number** from their dashboard, then send the short-lived START message from the registered WhatsApp number. Only a signed inbound callback from that number establishes ownership. Changing the number resets verification. Patients can withdraw consent from their dashboard or send STOP to the business sender.

### Delivery behavior

Server-accepted activities are idempotent by actor/event ID. Unconfigured, unconsented, unverified, or unauthorized sends are blocked. The worker sends approved templates and stores `queued`, `accepted`, `sent`, `delivered`, `read`, `failed`, and blocked states. `accepted` is not proof of delivery; signed status callbacks determine delivery/read state. Duplicate and out-of-order callbacks do not downgrade a read receipt.

HTTP 429 retries have a bounded backoff. Ambiguous network errors, HTTP 5xx, and interrupted in-flight sends become `delivery_unknown` and are not automatically resent; a correlated webhook can resolve them. Queued sends recheck consent and recipient eligibility. Default daily limits are 20 attempts per WhatsApp number and 1,000 total; adjust the settings and configure Meta spending alerts. Limits are safeguards, not a billing guarantee. Previously blocked verification/consent events are not replayed automatically after opt-in.

Before production use, complete clinical-data migration and authorization, encrypted storage/backups, retention/deletion policy, staff identity verification, monitoring, account recovery/MFA, and privacy/regulatory review. Use HTTPS cookies, a production secret manager, least-privilege provider credentials, and audited patient consent. The local integration has been tested with synthetic accounts and mocked Meta responses; no real message is sent unless live configuration and verified consent are present.

