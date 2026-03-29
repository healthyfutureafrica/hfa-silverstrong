# hfa-silverstrong
A three-in-one application that covers 1. healthcare, 2. fitness & health tips and 3. pharmacy or health products expo sections and sales. An App that brings doctors/nurses and patients on one platform facilitating consultations and exchanges between both sides both through text and video and a secure data management of all interactions.

## Environment notes

- In this repository, CI is configured to run on GitHub-hosted Windows runners (`windows-latest`) because the local sandbox environment in this extension lacks `C:\Windows\System32\cmd.exe`, which causes `npm run ci` to fail with `ENOENT`.
- Local development on a real Windows machine (or GitHub-hosted runner) works correctly.
- Docker workflow and Kubernetes manifests work independently of this limitation.

## Additional CI/CD files

- `.github/workflows/ci.yml`: lint + tests + docker build
- `.github/workflows/release.yml`: build + push container image to GHCR on semantic version tags
- `docker-compose.yml`: local multi-service test environment

