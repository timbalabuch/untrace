#!/usr/bin/env bash
set -euo pipefail
SSH_HOST="${SSH_HOST:?set SSH_HOST, e.g. user@server}"
REMOTE_ROOT="${REMOTE_ROOT:?set REMOTE_ROOT, e.g. /var/www/untrace}"
rsync -avz --delete \
  --exclude '.git/' --exclude '.github/' --exclude 'node_modules/' \
  --exclude 'test/' --exclude 'fixtures/' --exclude 'deploy/' \
  --exclude 'package.json' --exclude 'package-lock.json' \
  --exclude 'eslint.config.js' --exclude '.prettier*' --exclude '.gitignore' \
  --exclude '*.md' \
  ./ "$SSH_HOST:$REMOTE_ROOT/"
echo "Deployed to $SSH_HOST:$REMOTE_ROOT"
