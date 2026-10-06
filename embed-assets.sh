#!/bin/bash
# Regenerates assets/defaults.js (the built-in logo + background, embedded as data URIs)
# from assets/antikode-logo.png and assets/bg-default.jpg.
# Embedding means nothing can break from wrong paths, CORS or missing files after deploy.
# Run this again after replacing either image.
set -e
cd "$(dirname "$0")/.."
{
  printf 'window.DEFAULT_BG="data:image/jpeg;base64,'; base64 -i assets/bg-default.jpg | tr -d '\n'; printf '";\n'
  printf 'window.DEFAULT_LOGO="data:image/png;base64,'; base64 -i assets/antikode-logo.png | tr -d '\n'; printf '";\n'
} > assets/defaults.js
echo "assets/defaults.js written ($(wc -c < assets/defaults.js) bytes)"
