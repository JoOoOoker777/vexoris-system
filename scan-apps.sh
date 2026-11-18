#!/bin/bash
# VEXORIS — Scan pages for unification status

FILES=(
  "dashboard.html"
  "profile.html"
  "admin/rbac.html"
)

echo "════════════════════════════════════════════"
echo "  VEXORIS — Unification Scan Report"
echo "════════════════════════════════════════════"
echo ""

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "❌ MISSING: $FILE"
    echo ""
    continue
  fi

  echo "────────────────────────────────────────────"
  echo "📄 $FILE"
  echo "────────────────────────────────────────────"

  # Size
  echo "   Size: $(wc -l < "$FILE") lines"

  # Session-manager import?
  if grep -q "from.*session-manager" "$FILE"; then
    echo "   ✅ imports session-manager"
  else
    echo "   ❌ does NOT import session-manager"
  fi

  # Duplicate ROLE_META?
  if grep -qE "const ROLE_META|ROLE_META =" "$FILE"; then
    echo "   ⚠️  has local ROLE_META (needs removal)"
  else
    echo "   ✅ no local ROLE_META"
  fi

  # Duplicate toggleTheme?
  if grep -qE "toggleTheme\s*=\s*function|function toggleTheme" "$FILE"; then
    echo "   ⚠️  has local toggleTheme (needs removal)"
  else
    echo "   ✅ no local toggleTheme"
  fi

  # Duplicate syncTabsBarTop?
  if grep -qE "function syncTabsBarTop|syncTabsBarTop\s*=" "$FILE"; then
    echo "   ⚠️  has local syncTabsBarTop (needs removal)"
  else
    echo "   ✅ no local syncTabsBarTop"
  fi

  # Auth guard?
  if grep -qE "initAuthGuard" "$FILE"; then
    echo "   ✅ uses initAuthGuard"
  elif grep -qE "supabase\.auth\.getSession" "$FILE"; then
    echo "   ⚠️  has manual auth guard (needs replacement)"
  fi

  # User chip in HTML?
  if grep -qE 'id="userChip"' "$FILE"; then
    echo "   ✅ has userChip markup"
  else
    echo "   ❌ no userChip markup"
  fi

  # Header structure
  if grep -qE 'class="nav-shell"' "$FILE"; then
    echo "   ✅ has nav-shell"
  fi

  # Mobile shell included?
  if grep -q "mobile-app-shell.css" "$FILE"; then
    echo "   ✅ references mobile-app-shell.css"
  else
    echo "   ❌ does NOT reference mobile-app-shell.css"
  fi

  # Loader buttons?
  if grep -q "loader-buttons.js" "$FILE"; then
    echo "   ✅ includes loader-buttons.js"
  else
    echo "   ❌ missing loader-buttons.js"
  fi

  # Footer?
  if grep -qE 'class="footer-shell"' "$FILE"; then
    echo "   ✅ has footer"
  else
    echo "   ❌ no footer"
  fi

  # Tabs bar?
  if grep -qE 'class="tabs-bar"' "$FILE"; then
    echo "   ✅ has tabs-bar"
  fi

  # window.logout?
  if grep -qE "window\.logout\s*=" "$FILE"; then
    echo "   ⚠️  has local window.logout (needs removal)"
  fi

  # window.showProfile?
  if grep -qE "window\.showProfile\s*=" "$FILE"; then
    echo "   ⚠️  has local window.showProfile (needs removal)"
  fi

  echo ""
done

echo "════════════════════════════════════════════"
echo "  Summary"
echo "════════════════════════════════════════════"
echo ""

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    ISSUES=0
    grep -qE "const ROLE_META|ROLE_META =" "$FILE" && ISSUES=$((ISSUES+1))
    grep -qE "toggleTheme\s*=\s*function|function toggleTheme" "$FILE" && ISSUES=$((ISSUES+1))
    grep -qE "function syncTabsBarTop|syncTabsBarTop\s*=" "$FILE" && ISSUES=$((ISSUES+1))
    grep -qE "window\.logout\s*=" "$FILE" && ISSUES=$((ISSUES+1))
    grep -q "mobile-app-shell.css" "$FILE" || ISSUES=$((ISSUES+1))
    echo "   $FILE → $ISSUES issue(s)"
  fi
done

echo ""
echo "✅ Done. Send these files to the AI agent:"
for FILE in "${FILES[@]}"; do
  [ -f "$FILE" ] && echo "   - $FILE"
done
