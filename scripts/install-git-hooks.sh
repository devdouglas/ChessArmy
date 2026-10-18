#!/bin/sh
set -e
cd "$(dirname "$0")/.."
if [ ! -d .git/hooks ]; then
  exit 0
fi
cp scripts/git-pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
