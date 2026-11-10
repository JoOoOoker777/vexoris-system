export function exportToExcel(items, tab) {
  if (!items?.length) return;
  const rows = items.map(i => ({
    'الاسم': i.name,
    'التخصص': i.specialty || '',
    'القسم': i.general_department || '',
    'التقييمات': i.count,
    'النقاط': i.total_score,
    'مؤشر الأداء %': i.percentage + '%'
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, tab);
  XLSX.writeFile(wb, `VEXORIS_${tab}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

export function exportToPDF(items, tab) {
  if (!items?.length) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(16);
  doc.text(`VEXORIS Analytics - ${tab}`, 40, 45);
  doc.setFontSize(9); doc.setFont('Helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, 62);
  doc.autoTable({
    head: [['Name', 'Specialty', 'Department', 'Evals', 'Score', 'KPI']],
    body: items.map(i => [i.name, i.specialty || '—', i.general_department || '—', String(i.count), String(i.total_score), i.percentage + '%']),
    startY: 80, theme: 'striped',
    styles: { font: 'Helvetica', fontSize: 9 },
    headStyles: { fillColor: [14, 165, 233] }
  });
  doc.save(`VEXORIS_${tab}_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function exportModalToPDF(item, type) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'pt', 'a4');
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(18);
  doc.text(`VEXORIS - ${item.name}`, 40, 50);
  doc.setFontSize(10); doc.setFont('Helvetica', 'normal');
  doc.text(`Type: ${type} | ${new Date().toLocaleString('en-GB')}`, 40, 68);
  doc.setFontSize(11); doc.setFont('Helvetica', 'bold');
  doc.text('KPIs', 40, 100); doc.setFont('Helvetica', 'normal');
  doc.text(`Evaluations: ${item.count}   |   Score: ${item.total_score} / ${item.count*2}   |   KPI: ${item.percentage}%`, 40, 118);
  if (item.top_errors?.length) {
    doc.setFont('Helvetica', 'bold'); doc.text('Top Errors', 40, 150);
    doc.autoTable({
      head: [['Error', 'Count']], body: item.top_errors.map(e => [e.error, String(e.count)]),
      startY: 160, theme: 'striped', styles: { fontSize: 9 }, headStyles: { fillColor: [239, 68, 68] }
    });
  }
  doc.save(`VEXORIS_${item.name.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
}