#!/usr/bin/env bash
set -euo pipefail

DEPLOY_USER="${1:-ubuntu}"
DEPLOY_ROOT="/opt/jungle-ai-board"

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates \
  curl \
  docker.io \
  docker-compose-v2 \
  jq \
  rsync

sudo systemctl enable --now docker
sudo usermod -aG docker "$DEPLOY_USER"

if ! sudo swapon --show=NAME --noheadings | grep -q '^/swapfile$'; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_ROOT"
if [[ ! -f "$DEPLOY_ROOT/.env.production" ]]; then
  sudo install -m 600 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /dev/null \
    "$DEPLOY_ROOT/.env.production"
fi

sudo install -d /etc/docker
docker_config_source="$(mktemp)"
if [[ -f /etc/docker/daemon.json ]]; then
  sudo cat /etc/docker/daemon.json > "$docker_config_source"
else
  printf '{}\n' > "$docker_config_source"
fi
jq \
  '. + {
    "log-driver": "json-file",
    "log-opts": ((."log-opts" // {}) + {"max-size": "10m", "max-file": "3"})
  }' \
  "$docker_config_source" | sudo tee /etc/docker/daemon.json >/dev/null
rm -f "$docker_config_source"
sudo systemctl restart docker

echo "Provisioning complete. Sign out and reconnect before running Docker as ${DEPLOY_USER}."
