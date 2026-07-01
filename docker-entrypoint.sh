#!/bin/sh
set -e

mkdir -p /data/storage /data/backups

if [ ! -f /data/database.json ]; then
  echo "No database found — seeding..."
  npm run db:seed
fi

exec npm start
