#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/Xcode"

xcrun safari-web-extension-packager "${ROOT}/extension" \
  --project-location "${OUT}" \
  --app-name "SafariAIAdBlocker" \
  --bundle-identifier "com.rakusuki.safari-ai-ad-blocker" \
  --swift \
  --ios-only \
  --copy-resources

echo "Generated Xcode project under: ${OUT}"
