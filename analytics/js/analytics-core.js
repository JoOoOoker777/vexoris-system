import { supabase } from '../../supabase-client.js';
import { createDonutChart, createAreaChart, destroyAllCharts } from './analytics-charts.js';
import { exportToExcel, exportToPDF, exportModalToPDF } from './analytics-export.js';

// ===== STATE =====
let analyticsData = null;
let currentTab = 'departments';
let searchTerm = '';
let currentDoctorGroup = 'الكل';
let currentSortBy = 'percentage';
let currentDateFilter = { start: null, end: null, dateType: 'discharge', label: 'الكل' };
let currentModalItem = null;

// ===== INIT =====
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = '../login.html'; return; }

  await loadAnalytics();
  document.getElementById('loadingScreen').classList.add('hide');
})();

// ===== HELPERS =====
function kpiMeta(pct) {
  if (pct >= 96) return { cls: 'var(--success)', icon: 'fa-star', label: 'ممتاز', glow: true };
  if (pct >= 90) return { cls: '#059669', icon: 'fa-arrow-trend-up', label: 'جيد جداً' };
  if (pct >= 81) return { cls: '#34d399', icon: 'fa-arrow-right', label: 'جيد' };
  if (pct >= 75) return { cls: 'var(--warning)', icon: 'fa-minus', label: 'مقبول' };
  return { cls: 'var(--danger)', icon: 'fa-arrow-trend-down', label: 'ضعيف' };
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}

// ===== LOAD =====
async function loadAnalytics() {
  const loadText = document.querySelector('#loadingScreen p');
  if (loadText) loadText.textContent = 'جاري تحميل التحليلات...';
  document.getElementById('loadingScreen').classList.remove('hide');

  const { data, error } = await supabase.rpc('get_analytics', {
    p_start_date: currentDateFilter.start || null,
    p_end_date: currentDateFilter.end || null,
    p_date_type: currentDateFilter.dateType
  });

  if (error) {
    console.error('Analytics error:', error);
    document.getElementById('loadingScreen').classList.add('hide');
    if (window.showNotification) showNotification('فشل تحميل التحليلات: ' + error.message, 'error');
    return;
  }

  analyticsData = data || { doctors: [], nurses: [], clerks: [], departments: [], forms: [] };
  updateActiveFilterDisplay();
  renderCurrentTab();
  populateThreeMonthsLists();
  document.getElementById('loadingScreen').classList.add('hide');
}

// ===== FILTERS =====
window.applyDateFilter = function() {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const dateType = document.getElementById('dateFilterType').value;
  if (!start && !end) {
    if (window.showNotification) showNotification('يرجى اختيار تواريخ', 'warning');
    return;
  }
  if (start && end && new Date(start) > new Date(end)) {
    if (window.showNotification) showNotification('تاريخ البداية يجب أن يكون قبل النهاية', 'warning');
    return;
  }
  const typeLabel = dateType === 'discharge' ? 'تاريخ الخروج' : 'تاريخ التقييم';
  const startTxt = start || 'البداية';
  const endTxt = end || 'اليوم';
  currentDateFilter = { start: start || null, end: end || null, dateType, label: `من ${startTxt} إلى ${endTxt} (${typeLabel})` };
  loadAnalytics();
};

window.clearDateFilter = function() {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('dateFilterType').value = 'discharge';
  currentDateFilter = { start: null, end: null, dateType: 'discharge', label: 'الكل' };
  loadAnalytics();
};

function updateActiveFilterDisplay() {
  const div = document.getElementById('activeFilter');
  const txt = document.getElementById('activeFilterText');
  if (currentDateFilter.label !== 'الكل') {
    txt.textContent = currentDateFilter.label;
    div.classList.remove('hidden');
  } else {
    div.classList.add('hidden');
  }
}

window.filterCards = function() {
  searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
  renderCurrentTab();
};

window.applySorting = function() {
  currentSortBy = document.getElementById('sortBy').value;
  renderCurrentTab();
};

// ===== TABS =====
window.switchTab = function(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'doctors') currentDoctorGroup = 'الكل';
  renderCurrentTab();
};

window.filterDoctorsByGroup = function(group) {
  currentDoctorGroup = group;
  renderCurrentTab();
};

// ===== RENDER =====
function sortItems(items) {
  if (!items) return [];
  if (currentSortBy === 'percentage') return [...items].sort((a,b) => b.percentage - a.percentage);
  return [...items].sort((a,b) => b.count - a.count);
}

function renderCurrentTab() {
  if (!analyticsData) return;
  const container = document.getElementById('cardsContainer');
  const subTabs = document.getElementById('doctorsSubTabs');
  let items = [];

  if (currentTab === 'doctors') {
    const docs = analyticsData.doctors || [];
    const groups = Array.from(new Set(docs.map(d => d.general_department || 'غير محدد'))).sort();
    subTabs.classList.remove('hidden');
    subTabs.innerHTML = '';
    const makeSub = (txt) => {
      const b = document.createElement('button');
      b.className = 'sub-tab' + (currentDoctorGroup === txt ? ' active' : '');
      b.textContent = txt;
      b.onclick = () => filterDoctorsByGroup(txt);
      return b;
    };
    subTabs.appendChild(makeSub('الكل'));
    groups.forEach(g => subTabs.appendChild(makeSub(g)));
    let filtered = docs;
    if (currentDoctorGroup !== 'الكل') filtered = docs.filter(d => (d.general_department || 'غير محدد') === currentDoctorGroup);
    items = sortItems(filtered);
  } else {
    subTabs.classList.add('hidden');
    if (currentTab === 'nurses') items = sortItems(analyticsData.nurses || []);
    else if (currentTab === 'clerks') items = sortItems(analyticsData.clerks || []);
    else if (currentTab === 'departments') items = sortItems(analyticsData.departments || []);
    else if (currentTab === 'forms') items = sortItems(analyticsData.forms || []);
  }

  if (searchTerm) {
    items = items.filter(i => (i.name || '').toLowerCase().includes(searchTerm));
  }

  if (!items.length) {
    container.innerHTML = `<div class="empty-cards"><i class="fa-solid fa-ghost"></i><h3>لا توجد بيانات مطابقة</h3></div>`;
    return;
  }

  const itemType = currentTab.slice(0, -1);
  container.innerHTML = items.map(item => {
    const meta = kpiMeta(item.percentage || 0);
    const glow = meta.glow ? `text-shadow: 0 0 12px ${meta.cls};` : '';
    const spec = item.specialty ? `<div class="kpi-spec"><i class="fa-solid fa-tag"></i> ${escapeHtml(item.specialty)}</div>` : '';
    return `
      <div class="kpi-card" style="--border-clr:${meta.cls};--clr:${meta.cls};${glow}"
           onclick="showCardDetails('${itemType}', '${(item.normalized || item.name).replace(/'/g,"\\'")}')">
        <div class="kpi-head">
          <div style="flex:1;">
            <div class="kpi-name">${escapeHtml(item.name)}</div>
            ${spec}
          </div>
          <div class="kpi-count">${item.count} تقييم</div>
        </div>
        <div class="kpi-body">
          <div class="kpi-pct">${item.percentage}%</div>
          <div class="kpi-desc"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</div>
        </div>
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${item.percentage}%"></div></div>
        <div class="kpi-foot"><span>${item.total_score} / ${item.count * 2}</span><span>نقاط / إجمالي</span></div>
      </div>
    `;
  }).join('');
}

// ===== DETAILS MODAL =====
window.showCardDetails = function(type, key) {
  if (!analyticsData) return;
  const listMap = { doctor: 'doctors', nurse: 'nurses', clerk: 'clerks', department: 'departments', form: 'forms' };
  const list = analyticsData[listMap[type]] || [];
  const item = list.find(x => (x.normalized || x.name) === key);
  if (!item) return;
  currentModalItem = { type, item };
  renderDetailsModal(type, item);
};

function renderDetailsModal(type, item) {
  document.querySelector('#modalItemName span').textContent =
    item.name + (item.specialty ? ` (${item.specialty})` : '');
  const meta = kpiMeta(item.percentage || 0);

  let html = `
    <div class="modal-stats">
      <div class="modal-stat"><div class="val">${item.count}</div><div class="lbl">التقييمات</div></div>
      <div class="modal-stat"><div class="val">${item.total_score} / ${item.count * 2}</div><div class="lbl">النقاط / الإجمالي</div></div>
      <div class="modal-stat"><div class="val" style="color:${meta.cls}">${item.percentage}%</div><div class="lbl">${meta.label}</div></div>
    </div>
  `;

  const errors = item.top_errors || [];
  if (errors.length) {
    html += `<div class="modal-section">
      <h4 style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> أبرز الأخطاء</h4>
      ${errors.slice(0, 10).map(e => `<div class="error-row"><span>${escapeHtml(e.error)}</span><span class="err-badge">${e.count}</span></div>`).join('')}
    </div>`;
  } else {
    html += `<div class="modal-section"><h4 style="color:var(--success)"><i class="fa-solid fa-check"></i> أداء مثالي</h4></div>`;
  }

  if ((type === 'doctor' || type === 'nurse' || type === 'clerk') && errors.length) {
    html += `<div class="modal-section" style="height:280px;"><h4><i class="fa-solid fa-chart-pie"></i> تحليل الأداء</h4><div id="chart-donut" style="height:240px;"></div></div>`;
  }

  if (type === 'form' && item.department_performance && item.department_performance.length) {
    html += `<div class="modal-section"><h4><i class="fa-solid fa-building-user"></i> أداء الأقسام</h4>`;
    item.department_performance.forEach(d => {
      const m = kpiMeta(d.percentage);
      html += `<div class="error-row"><span>${escapeHtml(d.department)}</span>
        <span><span style="color:${m.cls};font-weight:900;">${d.percentage}%</span>
        <span style="color:var(--text-muted);font-size:0.7rem;"> (${d.count})</span></span></div>`;
    });
    html += `</div>`;
  }

  document.getElementById('modalItemDetails').innerHTML = html;
  document.getElementById('detailsModal').classList.remove('hidden');

  if ((type === 'doctor' || type === 'nurse' || type === 'clerk') && errors.length) {
    setTimeout(() => {
      const totalErrors = errors.reduce((a,b) => a + b.count, 0);
      const success = Math.max(item.count - totalErrors, 0);
      createDonutChart('#chart-donut', success, totalErrors);
    }, 100);
  }
}

window.closeModal = function() {
  document.getElementById('detailsModal').classList.add('hidden');
};

// ===== COMPARISON =====
window.toggleComparisonSection = function() {
  const s = document.getElementById('comparisonSection');
  const b = document.getElementById('compareToggleBtn');
  s.classList.toggle('hidden');
  b.classList.toggle('active', !s.classList.contains('hidden'));
};

function populateThreeMonthsLists() {
  if (!analyticsData) return;
  updateThreeMonthsDropdowns();
}

window.updateThreeMonthsDropdowns = function() {
  const type = document.getElementById('compareType3').value;
  const map = { doctors: 'doctors', departments: 'departments', forms: 'forms' };
  const list = analyticsData[map[type]] || [];
  const sel = document.getElementById('compareItem3');
  sel.innerHTML = '';
  list.forEach(i => {
    const o = document.createElement('option');
    o.value = i.normalized || i.name;
    o.textContent = i.name;
    sel.appendChild(o);
  });
};

window.performThreeMonthsComparison = async function() {
  const type = document.getElementById('compareType3').value;
  const itemId = document.getElementById('compareItem3').value;
  const m1 = document.getElementById('compareMonth1_3').value;
  const m2 = document.getElementById('compareMonth2_3').value;
  const m3 = document.getElementById('compareMonth3_3').value;
  const dateType = document.getElementById('compareDateType3').value;
  if (!itemId || !m1 || !m2 || !m3) {
    if (window.showNotification) showNotification('يرجى تحديد العنصر والأشهر الثلاثة', 'warning');
    return;
  }

  destroyAllCharts();
  const fetchMonth = async (monthStr) => {
    const [y, m] = monthStr.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2,'0')}-01`;
    const end = new Date(y, m, 0).toISOString().slice(0,10);
    const { data } = await supabase.rpc('get_analytics', {
      p_start_date: start, p_end_date: end, p_date_type: dateType
    });
    return data;
  };

  const [d1, d2, d3] = await Promise.all([fetchMonth(m1), fetchMonth(m2), fetchMonth(m3)]);
  const map = { doctors: 'doctors', departments: 'departments', forms: 'forms' };
  const find = (data) => (data[map[type]] || []).find(x => (x.normalized || x.name) === itemId) || { count: 0, total_score: 0, percentage: 0 };

  const p1 = find(d1), p2 = find(d2), p3 = find(d3);
  const months = [m1, m2, m3];
  const counts = [p1.count, p2.count, p3.count];
  const percentages = [p1.percentage, p2.percentage, p3.percentage];
  const scores = [p1.total_score, p2.total_score, p3.total_score];
  const labels = months.map(m => m.slice(5,7) + '/' + m.slice(2,4));

  let html = `<div class="month-cards">`;
  [p1, p2, p3].forEach((p, i) => {
    const m = kpiMeta(p.percentage);
    html += `<div class="month-card">
      <h4>${months[i]}</h4>
      <div class="stat-val">${p.count}</div><div class="stat-lbl">تقييمات</div>
      <div class="stat-val">${p.total_score}</div><div class="stat-lbl">نقاط</div>
      <div class="stat-val" style="color:${m.cls}">${p.percentage}%</div><div class="stat-lbl">${m.label}</div>
    </div>`;
  });
  html += `</div><div class="month-charts">
    <div id="cmp-chart-count" style="height:240px;"></div>
    <div id="cmp-chart-pct" style="height:240px;"></div>
    <div id="cmp-chart-score" style="height:240px;"></div>
  </div>`;

  const res = document.getElementById('threeMonthsResult');
  res.innerHTML = html;
  res.classList.remove('hidden');

  setTimeout(() => {
    createAreaChart('#cmp-chart-count', 'إجمالي التقييمات', labels, counts, '#3b82f6');
    createAreaChart('#cmp-chart-pct', 'مؤشر الأداء %', labels, percentages, '#10b981');
    createAreaChart('#cmp-chart-score', 'إجمالي النقاط', labels, scores, '#8b5cf6');
  }, 100);
};

// ===== EXPORTS =====
window.exportToExcel = function() {
  const items = getCurrentItems();
  if (!items.length) { if (window.showNotification) showNotification('لا توجد بيانات للتصدير', 'warning'); return; }
  exportToExcel(items, currentTab);
};

window.exportToPDF = function() {
  const items = getCurrentItems();
  if (!items.length) { if (window.showNotification) showNotification('لا توجد بيانات للتصدير', 'warning'); return; }
  exportToPDF(items, currentTab);
};

window.exportModalToPDF = function() {
  if (!currentModalItem) return;
  exportModalToPDF(currentModalItem.item, { top_errors: currentModalItem.item.top_errors }, currentModalItem.type);
};

function getCurrentItems() {
  if (!analyticsData) return [];
  let items = [];
  if (currentTab === 'doctors') {
    let d = analyticsData.doctors || [];
    if (currentDoctorGroup !== 'الكل') d = d.filter(x => (x.general_department || 'غير محدد') === currentDoctorGroup);
    items = d;
  } else if (currentTab === 'nurses') items = analyticsData.nurses || [];
  else if (currentTab === 'clerks') items = analyticsData.clerks || [];
  else if (currentTab === 'departments') items = analyticsData.departments || [];
  else if (currentTab === 'forms') items = analyticsData.forms || [];
  if (searchTerm) items = items.filter(i => (i.name || '').toLowerCase().includes(searchTerm));
  return sortItems(items);
}

// ===== THEME =====
window.toggleTheme = function() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
};