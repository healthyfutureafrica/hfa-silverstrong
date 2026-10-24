# Deploying HFA SilverStrong to the internet

This puts the **real** HFA system (app + server + encrypted database) online at an address such as
`https://app.healthyfutureafrica.org`. The public website `www.healthyfutureafrica.org` on Cloudflare
stays the public information site (Free Health Hub and the anonymous symptom check); it holds no accounts.

Time needed: about one hour. You need a cloud account (Google Cloud or Oracle Cloud), access to the
Cloudflare account that manages `healthyfutureafrica.org`, and this repository.

> **Legal check first.** Cameroon's Law No. 2024/017 on personal data protection requires prior
> authorisation for processing and restricts transfers of personal data abroad (Article 32). Until a
> lawyer confirms the hosting location, use a server outside Cameroon only for testing and a pilot with
> test data or users who have explicitly consented.

---

## 1. Create the server

**Google Cloud (recommended first, $300 free trial for 90 days)**
1. Sign in at https://console.cloud.google.com with `healthyfutureafrica@gmail.com` and start the free trial.
2. *Compute Engine → VM instances → Create instance*
   - Name `hfa-app`, region close to Cameroon with low latency (e.g. `europe-west1` Belgium or `europe-west9` Paris)
   - Machine type **e2-small** (2 GB) or **e2-medium** (4 GB)
   - Boot disk **Ubuntu 24.04 LTS**, **30 GB**
   - Firewall: tick **Allow HTTP traffic** and **Allow HTTPS traffic**
3. Note the **External IP** and open an SSH window with the *SSH* button.

**Oracle Cloud Always Free (fallback, no time limit)**
1. Create an *Always Free* instance: image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (ARM), 2 OCPU / 12 GB.
2. In the instance's *Virtual Cloud Network → Security List*, add ingress rules for TCP **80** and **443** (and UDP 443).
3. Note the public IP and connect with SSH.

## 2. Point your domain at the server (Cloudflare)

In Cloudflare → `healthyfutureafrica.org` → **DNS → Add record**:
- Type **A**, Name **app**, IPv4 address **the server's IP**
- Proxy status: **DNS only (grey cloud)** for the first start, so the server can get its certificate.
  You can switch it to *Proxied* later; then set *SSL/TLS → Full (strict)*.

## 3. Prepare the server

```sh
sudo git clone https://github.com/healthyfutureafrica/hfa-silverstrong.git /opt/hfa-silverstrong
cd /opt/hfa-silverstrong
sudo sh deploy/setup-ubuntu.sh        # updates, Docker, firewall, swap
```

## 4. Settings and secrets

```sh
cd /opt/hfa-silverstrong
sudo cp deploy/production.env.example .env
openssl rand -hex 32                   # copy the result into FILE_ENCRYPTION_KEY
sudo nano .env                         # fill APP_DOMAIN, URLs, FILE_ENCRYPTION_KEY, BOOTSTRAP_ADMIN_*
sudo chmod 600 .env
```

- **Write the encryption key on paper or in a password manager.** Without it, encrypted health
  records, photos and documents can never be read again.
- **Moving the current database from the office computer?** Use the *same* `FILE_ENCRYPTION_KEY` as the
  office `.env`, then follow *Moving existing data* below.

## 5. Start

```sh
cd /opt/hfa-silverstrong
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml ps
```

All three services (`caddy`, `web`, `backend`) should show *running / healthy* after a minute.
Open `https://app.healthyfutureafrica.org`: the padlock should show, and `/api/config` should report
`"requireAdminMfa":true`.

## 6. First sign-in

1. Sign in with `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`.
2. The app opens **Account security**: turn on two-step sign-in with your phone, save the recovery codes
   offline, then change the password to a long passphrase.
3. Remove `BOOTSTRAP_ADMIN_PASSWORD` from `.env` afterwards (it is only used to create the first account).

## 7. Daily backups

```sh
cd /opt/hfa-silverstrong
sudo sh deploy/backup.sh               # test once; files appear in backups/
sudo crontab -e                        # add the line below
15 2 * * * cd /opt/hfa-silverstrong && sh deploy/backup.sh >> /var/log/hfa-backup.log 2>&1
```

Keep a copy away from the server: create a Cloud Storage bucket and set `BACKUP_BUCKET=gs://your-bucket`
in the crontab line, or download `backups/` regularly. Test a restore at least once a month.

## Updating to a new version

```sh
cd /opt/hfa-silverstrong
sudo sh deploy/backup.sh
sudo git pull
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```

To go back: `sudo git checkout <previous-commit>` and run the same `up -d --build` command.

## Moving existing data

On the office computer (where the app runs today):

```sh
docker compose exec -T backend node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/app/data/hfa.sqlite').exec(\"VACUUM INTO '/app/data/export.sqlite'\")"
docker compose cp backend:/app/data/export.sqlite ./hfa-export.sqlite
```

Copy `hfa-export.sqlite` to the server (e.g. `scp`), then on the server, **before step 5** or with the
app stopped:

```sh
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d backend
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml cp hfa-export.sqlite backend:/app/data/hfa.sqlite
sudo docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml restart backend
```

The `FILE_ENCRYPTION_KEY` must be identical on both machines.

## Checklist before real patients

- [ ] Legal opinion on hosting location and Law No. 2024/017 authorisation
- [ ] `REQUIRE_ADMIN_MFA=true` (`/api/config` shows it)
- [ ] Encryption key stored offline in two safe places
- [ ] Backups running and one restore tested
- [ ] Clinical records moved to the server (see the platform audit: *Server-backed clinical records*)
- [ ] Independent security test
