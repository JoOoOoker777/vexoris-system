#!/bin/bash
# VEXORIS — Extract critical code blocks for unification

FILES=(
  "dashboard.html"
  "profile.html"
  "admin/rbac.html"
)

OUTPUT_DIR="extracted"
mkdir -p "$OUTPUT_DIR"

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ MISSING: $FILE"
    continue
  fi

  SAFE_NAME=$(echo "$FILE" | tr '/' '_')
  OUT="$OUTPUT_DIR/${SAFE_NAME}.txt"

  {
    echo "═══════════════════════════════════════════════════════════"
    echo "  FILE: $FILE"
    echo "  LINES: $(wc -l < "$FILE")"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # ============ 1. SESSION-MANAGER IMPORT AREA ============
    echo "═══ [1] IMPORT AREA (first 30 lines of <script type=\"module\">) ═══"
    echo ""
    grep -nE 'import .* supabase-client|import .* session-manager|import .* audit-log' "$FILE" | head -20
    echo ""

    # ============ 2. ROLE_META ============
    echo "═══ [2] ROLE_META (exact lines) ═══"
    echo ""
    grep -nA 12 'const ROLE_META' "$FILE" | head -25
    echo ""

    # ============ 3. toggleTheme ============
    echo "═══ [3] toggleTheme (exact lines) ═══"
    echo ""
    grep -nB 2 -A 8 'toggleTheme' "$FILE" | head -40
    echo ""

    # ============ 4. AUTH GUARD (getSession block) ═══
    echo "═══ [4] AUTH GUARD — supabase.auth.getSession block ═══"
    echo ""
    grep -nA 25 'supabase\.auth\.getSession' "$FILE" | head -60
    echo ""

    # ============ 5. window.logout / showProfile / showChangePassword ═══
    echo "═══ [5] GLOBAL HANDLERS ═══"
    echo ""
    grep -nA 10 'window\.logout\|window\.showProfile\|window\.showChangePassword' "$FILE" | head -60
    echo ""

    # ============ 6. HEAD section — CSS + Scripts ═══
    echo "═══ [6] HEAD — theme-overrides, loading-logo, loader-buttons (last 20 lines before </head>) ═══"
    echo ""
    grep -nB 2 -A 20 'theme-overrides' "$FILE" | head -40
    echo ""

    # ============ 7. HEADER HTML structure ═══
    echo "═══ [7] HEADER HTML (nav-shell area) ═══"
    echo ""
    grep -nB 1 -A 60 'class="nav-shell"' "$FILE" | head -100
    echo ""

    # ============ 8. User Chip markup ═══
    echo "═══ [8] USER CHIP + DROPDOWN markup (if exists) ═══"
    echo ""
    grep -nB 2 -A 25 'id="userChip"' "$FILE" | head -40
    echo ""

    # ============ 9. FOOTER ═══
    echo "═══ [9] FOOTER markup ═══"
    echo ""
    grep -nB 2 -A 15 'class="footer-shell"' "$FILE" | head -25
    echo ""

    # ============ 10. </body> area — last scripts ═══
    echo "═══ [10] END OF BODY — scripts before </body> ═══"
    echo ""
    tail -30 "$FILE"
    echo ""

  } > "$OUT"

  echo "✅ Extracted: $OUT ($(wc -l < "$OUT") lines)"
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Done. Files in: $OUTPUT_DIR/"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📤 Send these to the AI:"
for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    SAFE_NAME=$(echo "$FILE" | tr '/' '_')
    echo "   → $OUTPUT_DIR/${SAFE_NAME}.txt"
  fi
done
