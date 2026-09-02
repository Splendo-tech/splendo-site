#!/bin/bash
# Splendo — installs the pre-push hook into this local clone's .git/hooks.
# Git doesn't track .git/hooks, so this has to be run once per machine:
#   npm run hooks:install

set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cp "$DIR/scripts/pre-push" "$DIR/.git/hooks/pre-push"
chmod +x "$DIR/.git/hooks/pre-push"
echo "Installed pre-push hook — 'npm test' now runs automatically before every 'git push'."
