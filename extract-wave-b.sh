#!/bin/bash
FILES=(
  "apps/medical-audit.html"
  "apps/medical-audit-report.html"
  "apps/medical-analytics.html"
  "apps/workflow.html"
  "admin/audit-log.html"
)
OUT="extracted-wave-b"
mkdir -p "$OUT"

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then echo "❌ MISSING: $FILE"; continue; fi
  SAFE=$(echo "$FILE" | tr '/' '_')
  OUT_FILE="$OUT/${SAFE}.txt"
  {
    echo "═══ FILE: $FILE ($(wc -l < "$FILE") lines) ═══"
    echo ""
    echo "─── [PDF EXPORT sections: jsPDF / autoTable / .save() ───"
    grep -nE "jsPDF|autoTable|\.save\(|exportReviewersPDF|export.*PDF|new jsPDF" "$FILE" | head -30
    echo ""
    echo "─── [EXPORT Excel sections: XLSX / .writeFile ───"
    grep -nE "XLSX|\.writeFile|exportExcel|export.*Excel" "$FILE" | head -20
    echo ""
    echo "─── [Compare section: runCompare / renderCompare / get_quality_compare ───"
    grep -nB2 -A30 "runCompare\|renderCompare\|get_quality_compare" "$FILE" | head -80
    echo ""
    echo "─── [TABS BAR in analytics/workflow ───"
    grep -nB1 -A25 'class="tabs-bar"' "$FILE" | head -40
    echo ""
    echo "─── [CARD COMPACT / content-narrow in medical-audit ───"
    grep -nE "cards-compact|content-narrow|floating-save|question-card" "$FILE" | head -20
    echo ""
    echo "─── [REPORT sections in medical-audit-report ───"
    grep -nE "report-glass|cover-page|report-section|summary-circle|@media print" "$FILE" | head -30
    echo ""
    echo "─── [HEAD: mobile-app-shell refs ───"
    grep -nB1 -A5 "mobile-app-shell" "$FILE" | head -15
    echo ""
  } > "$OUT_FILE"
  echo "✅ $OUT_FILE ($(wc -l < "$OUT_FILE") lines)"
done

echo ""
echo "📤 Send these files:"
for FILE in "${FILES[@]}"; do
  [ -f "$FILE" ] && echo "  → $OUT/${FILE//\//_}.txt"
done
