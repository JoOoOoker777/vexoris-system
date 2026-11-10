// Charts wrapper for VEXORIS Analytics
let _charts = {};

export function createDonutChart(elId, success, errors) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return null;
  const chart = new ApexCharts(el, {
    series: [Math.max(success, 0), Math.max(errors, 0)],
    labels: ['أداء صحيح', 'أخطاء / ملاحظات'],
    chart: { type: 'donut', height: 250, background: 'transparent' },
    colors: ['#10b981', '#ef4444'],
    dataLabels: { enabled: false },
    legend: { position: 'bottom', labels: { colors: '#94a3b8' }, fontSize: '12px', fontWeight: 700 },
    stroke: { show: false }
  });
  chart.render();
  _charts[elId] = chart;
  return chart;
}

export function createAreaChart(elId, title, categories, data, color) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return null;
  const chart = new ApexCharts(el, {
    series: [{ name: title, data }],
    chart: { type: 'area', height: 220, toolbar: { show: false }, background: 'transparent' },
    colors: [color],
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { shadeIntensity: 0.4, opacityFrom: 0.4, opacityTo: 0.05 } },
    xaxis: { categories, labels: { style: { fontWeight: 700, colors: '#94a3b8' } } },
    yaxis: { labels: { style: { fontWeight: 700, colors: '#94a3b8' } } },
    title: { text: title, align: 'center',
      style: { fontSize: '12px', fontWeight: 900, color: '#94a3b8' } },
    grid: { borderColor: 'rgba(148,163,184,0.15)' }
  });
  chart.render();
  _charts[elId] = chart;
  return chart;
}

export function destroyChart(elId) {
  if (_charts[elId]) { try { _charts[elId].destroy(); } catch(e) {} delete _charts[elId]; }
}

export function destroyAllCharts() {
  Object.keys(_charts).forEach(destroyChart);
  _charts = {};
}