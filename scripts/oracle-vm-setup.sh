#!/usr/bin/env bash
# ── Oracle Cloud ARM VM initial setup ─────────────────────────────────────────
# Run once on a fresh Ubuntu 22.04+ Ampere A1 instance.
# Usage:  ssh ubuntu@<VM_IP> 'bash -s' < scripts/oracle-vm-setup.sh
set -euo pipefail

echo "── Updating packages ──"
sudo apt-get update && sudo apt-get upgrade -y

echo "── Installing Docker ──"
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "── Adding current user to docker group ──"
sudo usermod -aG docker "$USER"

echo "── Opening firewall ports (iptables — Oracle Cloud uses VCN + OS firewall) ──"
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "── Creating app directory ──"
mkdir -p ~/fhirplace

echo "── Done! ──"
echo "Next steps:"
echo "  1. Log out and back in (so docker group takes effect)"
echo "  2. Clone or copy the project to ~/fhirplace"
echo "  3. Run: cd ~/fhirplace && docker compose up -d --build"
echo ""
echo "Also ensure your OCI VCN security list allows ingress on ports 80 and 443."
