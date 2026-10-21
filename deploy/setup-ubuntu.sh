#!/bin/sh
# One-time preparation of a fresh Ubuntu 22.04/24.04 server (Google Cloud, Oracle Cloud or any VPS).
# Usage:  sudo sh deploy/setup-ubuntu.sh
set -eu
if [ "$(id -u)" -ne 0 ]; then echo "Run with sudo"; exit 1; fi

echo "1/4 Updating the system"
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades   # automatic security updates

echo "2/4 Installing Docker"
if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; fi
systemctl enable --now docker

echo "3/4 Firewall: only SSH, HTTP and HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "4/4 Swap file (helps small servers build the app)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo "Server ready. Next: follow DEPLOY.md step 4."
