const _charts = {};
export function destroyChart(id) {
  if (_charts[id]) { try { _charts[id].destroy(); } catch(e){} delete _charts[id]; }
}
export function destroyAll() { Object.keys(_charts).forEach(destroyChart); }

export function createRadar(elId, labels, values) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return;
  const chart = new ApexCharts(el, {
    series: [{ name: 'مؤشر الأداء', data: values }],
    chart: { type: 'radar', height: 320, background: 'transparent', toolbar: { show: false } },
    labels,
    colors: ['#0ea5e9'],
    stroke: { width: 2 },
    fill: { opacity: 0.15 },
    markers: { size: 4, colors: ['#6366f1'], strokeColors: '#fff', strokeWidth: 2 },
    yaxis: { show: false, max: 100, min: 0 },
    xaxis: { labels: { style: { fontSize: '11px', fontWeight: 800, colors: '#94a3b8' } } },
    plotOptions: { radar: { polygons: { strokeColors: 'rgba(148,163,184,0.15)', connectorColors: 'rgba(148,163,184,0.15)' } } },
    dataLabels: { enabled: true, background: { enabled: false }, style: { fontSize: '10px', fontWeight: 900, colors: ['#fff'] } }
  });
  chart.render();
  _charts[elId] = chart;
}

export function createDonut(elId, labels, values, colors) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return;
  const chart = new ApexCharts(el, {
    series: values,
    labels,
    chart: { type: 'donut', height: 320, background: 'transparent' },
    colors: colors || ['#10b981', '#34d399', '#f59e0b', '#ef4444'],
    dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: 900 } },
    legend: { position: 'bottom', labels: { colors: '#94a3b8' }, fontSize: '12px', fontWeight: 700 },
    stroke: { width: 2, colors: ['#04070f'] },
    plotOptions: { pie: { donut: { size: '68%' } } }
  });
  chart.render();
  _charts[elId] = chart;
}

export function createHorizontalBar(elId, labels, values) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return;
  const chart = new ApexCharts(el, {
    series: [{ name: 'التقييمات', data: values }],
    chart: { type: 'bar', height: 340, background: 'transparent', toolbar: { show: false } },
    plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 6, barHeight: '65%' } },
    colors: ['#0ea5e9','#6366f1','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899','#f43f5e'],
    dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: 900, colors: ['#fff'] } },
    xaxis: { categories: labels, labels: { style: { fontSize: '10px', fontWeight: 700, colors: '#94a3b8' } } },
    yaxis: { labels: { style: { fontSize: '11px', fontWeight: 700, colors: '#94a3b8' } } },
    legend: { show: false },
    grid: { borderColor: 'rgba(148,163,184,0.1)' }
  });
  chart.render();
  _charts[elId] = chart;
}

export function createAreaChart(elId, categories, series) {
  destroyChart(elId);
  const el = document.querySelector(elId);
  if (!el) return;
  const chart = new ApexCharts(el, {
    series,
    chart: { type: 'area', height: 260, background: 'transparent', toolbar: { show: false } },
    colors: ['#0ea5e9', '#10b981', '#8b5cf6'],
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { shadeIntensity: 0.4, opacityFrom: 0.4, opacityTo: 0.05 } },
    xaxis: { categories, labels: { style: { fontWeight: 700, colors: '#94a3b8' } } },
    yaxis: { labels: { style: { fontWeight: 700, colors: '#94a3b8' } } },
    legend: { position: 'top', labels: { colors: '#94a3b8' }, fontWeight: 700 },
    grid: { borderColor: 'rgba(148,163,184,0.1)' }
  });
  chart.render();
  _charts[elId] = chart;
}

/* Inline SVG sparkline */
export function drawSparkline(svgId, data, color) {
  const svg = document.getElementById(svgId);
  if (!svg || !data || data.length < 2) return;
  const w = 100, h = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });
  const area = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  const line = `M${pts.join(' L')}`;
  svg.innerHTML = `
    <defs><linearGradient id="g_${svgId}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#g_${svgId})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}