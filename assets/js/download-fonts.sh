#!/bin/bash
# VEXORIS — Download Tajawal fonts for Arabic PDF export

set -e

mkdir -p assets/fonts

echo "📥 Downloading Tajawal-Regular.ttf..."
curl -L "https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Regular.ttf" \
  -o assets/fonts/Tajawal-Regular.ttf

echo "📥 Downloading Tajawal-Bold.ttf..."
curl -L "https://github.com/google/fonts/raw/main/ofl/tajawal/Tajawal-Bold.ttf" \
  -o assets/fonts/Tajawal-Bold.ttf

echo ""
echo "✅ Fonts installed:"
ls -lh assets/fonts/Tajawal-*.ttf