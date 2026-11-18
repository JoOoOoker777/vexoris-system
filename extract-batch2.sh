#!/bin/bash
# Extract critical blocks from auth + admin pages

FILES=(
  "login.html"
  "change-password.html"
  "setup-account.html"
  "mfa-setup.html"
  "mfa-verify.html"
  "admin/users.html"
  "admin/catalogs.html"
  "admin/audit-log.html"
)

OUTPUT_DIR="extracted-batch2"
mkdir -p "$OUTPUT_DIR"

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ MISSING: $FILE"
    continue
  fi

  SAFE_NAME=$(echo "$FILE" | tr '/' '_')
  OUT="$OUTPUT_DIR/${SAFE_NAME}.txt"

  {
    echo "═══ FILE: $FILE — $(wc -l < "$FILE") lines ═══"
    echo ""

    echo "─── [HEAD: <link theme-overrides> area ───"
    grep -nB1 -A8 'theme-overrides' "$FILE" | head -20
    echo ""

    echo "─── [IMPORTS inside <script type=module> ───"
    grep -nE "^\s*import " "$FILE" | head -15
    echo ""

    echo "─── [ROLE_META if exists ───"
    grep -nA10 "const ROLE_META" "$FILE" | head -15
    echo ""

    echo "─── [toggleTheme local ───"
    grep -nB1 -A6 'window\.toggleTheme' "$FILE" | head -15
    echo ""

    echo "─── [window.logout / showProfile / showChangePassword ───"
    grep -nA8 'window\.logout\s*=\|window\.showProfile\s*=\|window\.showChangePassword\s*=' "$FILE" | head -40
    echo ""

    echo "─── [AUTH GUARD: getSession / initAuthGuard ───"
    grep -nB2 -A20 'supabase\.auth\.getSession\|initAuthGuard' "$FILE" | head -60
    echo ""

    echo "─── [AUTH FLOW: signIn / signOut / password_changed / mfa_method / navigate ───"
    grep -nE 'signInWithPassword|signOut|password_changed|mfa_method|mfa_verified|location\.href|navigateTo' "$FILE" | head -25
    echo ""

    echo "─── [HEADER: nav-shell area ───"
    grep -nA15 'class="nav-shell"' "$FILE" | head -30
    echo ""

    echo "─── [USER CHIP markup ───"
    grep -nB1 -A15 'id="userChip"' "$FILE" | head -25
    echo ""

    echo "─── [FOOTER ───"
    grep -nA10 'class="footer-shell"' "$FILE" | head -15
    echo ""

    echo "─── [END OF BODY scripts ───"
    tail -25 "$FILE"
    echo ""

  } > "$OUT"

  echo "✅ $OUT ($(wc -l < "$OUT") lines)"
done

echo ""
echo "═══ 📤 Send these files: ═══"
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    SAFE_NAME=$(echo "$FILE" | tr '/' '_')
    echo "  → $OUTPUT_DIR/${SAFE_NAME}.txt"
  fi
done
