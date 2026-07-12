#!/usr/bin/env bash
set -euo pipefail

git config user.name "Kicoba.com"
git config user.email "agentic-workspace@kicoba.com"
git config core.hooksPath .githooks

echo "Configured Kicoba public status page git identity and hooks."
