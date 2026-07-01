#!/bin/bash
# One-command deploy on Ubuntu (Oracle Cloud free VM, etc.)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/RFQEG}"
REPO="${REPO:-https://github.com/marcominvexal/RFQEG.git}"

echo "==> Installing Docker (if needed)..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
  echo "Docker installed. You may need to log out and back in, then re-run this script."
fi

echo "==> Cloning or updating app..."
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

if [ ! -f .env ]; then
  echo ""
  echo "ERROR: .env is missing."
  echo "Create $APP_DIR/.env with your secrets (copy from .env.example), then run:"
  echo "  cd $APP_DIR && bash scripts/deploy.sh"
  exit 1
fi

echo "==> Building and starting..."
sudo docker compose down 2>/dev/null || true
sudo docker compose up -d --build

echo ""
echo "Deployed. App is running on port 3000."
echo "Open: http://$(curl -fsSL ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):3000"
echo ""
echo "Optional — expose port 80 with nginx:"
echo "  sudo apt install -y nginx"
echo "  sudo tee /etc/nginx/sites-available/rfq <<'EOF'"
echo "server {"
echo "  listen 80;"
echo "  server_name _;"
echo "  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host \$host; }"
echo "}"
echo "EOF"
echo "  sudo ln -sf /etc/nginx/sites-available/rfq /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
