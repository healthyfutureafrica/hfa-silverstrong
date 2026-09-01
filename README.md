# hfa-silverstrong
A three-in-one application that covers 1. healthcare, 2. fitness & health tips and 3. pharmacy or health products expo sections and sales. An App that brings doctors/nurses and patients on one platform facilitating consultations and exchanges between both sides both through text and video and a secure data management of all interactions.

## Environment notes

- CI runs on GitHub-hosted Ubuntu runners and validates HTML linting, Jest tests, Docker image build, and a container smoke test.
- Local development works with Node.js 24 or newer and Docker Desktop.
- Docker, GitHub Pages, release publishing, Jenkins, and Kubernetes manifests all serve the current static frontend only.

## Additional CI/CD files

- `.github/workflows/ci.yml`: lint + tests + docker build
- `.github/workflows/docker-publish.yml`: smoke-test and publish `latest` plus SHA-tagged images to GHCR on `main`
- `.github/workflows/release.yml`: build and push tagged container images to GHCR on semantic version tags
- `.github/workflows/pages.yml`: publish only `index.html` and `assets/` to GitHub Pages on every push to `main`
- `docker-compose.yml`: local static web container on `http://localhost:8080`

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

