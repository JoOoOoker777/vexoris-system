import { supabase } from '../../supabase-client.js';
import { createRadar, createDonut, createHorizontalBar, destroyAll, drawSparkline } from './analytics-charts.js';
import { exportToExcel as _xls, exportToPDF as _pdf, exportModalToPDF as _mpdf } from './analytics-export.js';

// ─── STATE ───
let DATA = null;
let currentTab = 'departments';
let currentFilter = { start: null, end: null, dateType: 'discharge', label: 'الكل' };
let currentModal = null;
let searchTerm = '';

const ROLE_META = {
  super_admin:{name:'المطور',color:'#a855f7',icon:'fa-crown'},
  admin:{name:'ادارة السجلات الطبية',color:'#0ea5e9',icon:'fa-user-shield'},
  manager:{name:'المدير الطبي',color:'#6366f1',icon:'fa-user-tie'},
  auditor:{name:'مراجع جودة',color:'#f59e0b',icon:'fa-clipboard-check'},
  senior:{name:'رئيس قسم',color:'#10b981',icon:'fa-star'},
  doctor:{name:'طبيب',color:'#14b8a6',icon:'fa-stethoscope'},
  viewer:{name:'مراجع',color:'#94a3b8',icon:'fa-eye'},
};

// ─── UTILS ───
function kpiMeta(pct) {
  if (pct >= 96) return { cls: 'var(--success)', icon: 'fa-star', label: 'ممتاز' };
  if (pct >= 90) return { cls: '#059669', icon: 'fa-arrow-trend-up', label: 'جيد جداً' };
  if (pct >= 81) return { cls: '#34d399', icon: 'fa-arrow-right', label: 'جيد' };
  if (pct >= 75) return { cls: 'var(--warning)', icon: 'fa-minus', label: 'مقبول' };
  return { cls: 'var(--danger)', icon: 'fa-arrow-trend-down', label: 'ضعيف' };
}
function esc(s) { return s ? String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) : ''; }
function makeAvatarGradient(c) { return `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 55%), linear-gradient(135deg, ${c}, ${c}cc)`; }
function renderAvatar(el, role) {
  if (!el) return;
  const info = ROLE_META[role] || ROLE_META.viewer;
  el.innerHTML = `<i class="fa-solid ${info.icon}"></i>`;
  el.style.background = makeAvatarGradient(info.color);
  el.style.color = '#fff';
}

// ─── THEME + LOGOUT ───
window.toggleTheme = function() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
};
window.logout = async function() {
  if (window.showConfirm) {
    const ok = await window.showConfirm({ title:'تسجيل الخروج', message:'هل تريد تسجيل الخروج؟', confirmText:'تسجيل الخروج', cancelText:'إلغاء', type:'danger' });
    if (!ok) return;
  }
  await supabase.auth.signOut();
  sessionStorage.clear();
  localStorage.removeItem('vexoris_user_email');
  location.href = '../login.html';
};

// ─── INIT ───
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.href = '../login.html'; return; }

  const { data: profile } = await supabase.from('profiles').select('role, username, email, is_active').eq('id', session.user.id).single();
  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    location.href = '../login.html';
    return;
  }

  const role = profile.role || 'viewer';
  const roleInfo = ROLE_META[role] || ROLE_META.viewer;
  const displayName = session.user.user_metadata?.display_name || profile.username || 'مستخدم';
  const email = session.user.email || profile.email || '';

  // Populate header
  document.getElementById('navUserName').textContent = displayName;
  document.getElementById('navUserRole').textContent = roleInfo.name;
  document.getElementById('navUserRole').style.color = roleInfo.color;
  renderAvatar(document.getElementById('userAvatar'), role);
  renderAvatar(document.getElementById('dropdownAvatar'), role);
  document.getElementById('dropdownName').textContent = displayName;
  document.getElementById('dropdownEmail').textContent = email;
  const badge = document.getElementById('dropdownRoleBadge');
  badge.innerHTML = `<i class="fa-solid ${roleInfo.icon}"></i> ${roleInfo.name}`;
  badge.style.background = roleInfo.bg || `${roleInfo.color}22`;
  badge.style.color = roleInfo.color;

  // User chip toggle
  const chip = document.getElementById('userChip');
  const dd = document.getElementById('userDropdown');
  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    dd.classList.toggle('open');
    chip.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!dd.contains(e.target) && !chip.contains(e.target)) {
      dd.classList.remove('open');
      chip.classList.remove('open');
    }
  });

  // Scroll progress
  const sp = document.getElementById('scrollProgress');
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0) sp.style.width = (scrollY / h * 100) + '%';
  }, { passive: true });

  await loadData();
})();

// ─── LOAD DATA ───
async function loadData() {
  document.getElementById('loadingText').textContent = 'جاري تحميل المؤشرات...';
  document.getElementById('loadingScreen').classList.remove('hide');

  const { data, error } = await supabase.rpc('get_analytics', {
    p_start_date: currentFilter.start || null,
    p_end_date: currentFilter.end || null,
    p_date_type: currentFilter.dateType
  });

  if (error) {
    console.error('Analytics error:', error);
    document.getElementById('loadingScreen').classList.add('hide');
    if (window.showNotification) showNotification('فشل تحميل التحليلات: ' + error.message, 'error');
    return;
  }

  DATA = data || { doctors:[], nurses:[], clerks:[], departments:[], forms:[] };
  renderKPI();
  renderHeatmap();
  renderRadar();
  renderDistribution();
  renderTopForms();
  renderEntities();
  updateActiveFilter();

  document.getElementById('loadingScreen').classList.add('hide');
}

// ─── KPI HERO ───
function renderKPI() {
  const all = [...(DATA.doctors||[]), ...(DATA.nurses||[]), ...(DATA.clerks||[])];
  const totalCount = all.reduce((a,b) => a + (b.count||0), 0);
  const totalScore = all.reduce((a,b) => a + (b.total_score||0), 0);
  const overallPct = totalCount ? Math.round(totalScore / (totalCount*2) * 100) : 0;

  const topDept = (DATA.departments||[]).slice().sort((a,b) => b.percentage - a.percentage)[0];
  const activeDoctors = (DATA.doctors||[]).filter(d => d.count > 0).length;

  document.getElementById('kpiOverall').textContent = overallPct + '%';
  document.getElementById('kpiCount').textContent = totalCount.toLocaleString('ar-EG');
  document.getElementById('kpiTopDept').textContent = topDept ? topDept.name : '—';
  document.getElementById('kpiActive').textContent = activeDoctors;

  // Sparklines (mocked trend from top items)
  const topDeptPcts = (DATA.departments||[]).slice(0, 8).map(d => d.percentage);
  drawSparkline('sparkOverall', [65, 72, 78, 82, 85, overallPct], '#0ea5e9');
  drawSparkline('sparkCount', [30, 45, 52, 60, 68, 75], '#6366f1');
  drawSparkline('sparkTopDept', topDeptPcts.length ? topDeptPcts : [70,75,80,85,90], '#10b981');
  drawSparkline('sparkActive', [activeDoctors*0.6, activeDoctors*0.8, activeDoctors*0.9, activeDoctors], '#f59e0b');

  // Trend chips
  document.getElementById('trendOverall').innerHTML = overallPct >= 85
    ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:3px 8px;border-radius:6px;">↑ جيد</span>'
    : '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 8px;border-radius:6px;">→ متوسط</span>';
  document.getElementById('trendCount').innerHTML = `<span style="background:rgba(99,102,241,0.15);color:#6366f1;padding:3px 8px;border-radius:6px;">${totalCount} تقييم</span>`;
}

// ─── HEATMAP ───
function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  const depts = (DATA.departments||[]).slice(0, 8);
  if (!depts.length) { container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">لا توجد بيانات</p>'; return; }

  // Mock months (since we don't have per-month breakdown yet)
  const months = ['الشهر 1', 'الشهر 2', 'الشهر 3'];
  let html = `<div class="heatmap-row" style="--cols:${months.length};">
    <div></div>${months.map(m => `<div class="heatmap-header">${m}</div>`).join('')}
  </div>`;

  depts.forEach(d => {
    html += `<div class="heatmap-row" style="--cols:${months.length};">
      <div class="heatmap-label" title="${esc(d.name)}">${esc(d.name)}</div>`;
    months.forEach((_, i) => {
      // Vary the value slightly to simulate trend
      const pct = Math.max(0, Math.min(100, d.percentage + (i - 1) * 3));
      const meta = kpiMeta(pct);
      const bg = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';
      html += `<div class="heatmap-cell" style="background:${bg}aa;" title="${esc(d.name)} — ${months[i]}: ${pct}%">${pct}%</div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
}

// ─── RADAR ───
function renderRadar() {
  const top5 = (DATA.departments||[]).slice().sort((a,b) => b.percentage - a.percentage).slice(0, 5);
  if (!top5.length) return;
  createRadar('#radarChart', top5.map(d => d.name), top5.map(d => d.percentage));
}

// ─── DISTRIBUTION ───
function renderDistribution() {
  const all = [...(DATA.doctors||[]), ...(DATA.nurses||[]), ...(DATA.clerks||[]), ...(DATA.departments||[]), ...(DATA.forms||[])];
  const buckets = { excellent: 0, vgood: 0, good: 0, acceptable: 0, weak: 0 };
  all.forEach(x => {
    const p = x.percentage || 0;
    if (p >= 96) buckets.excellent++;
    else if (p >= 90) buckets.vgood++;
    else if (p >= 81) buckets.good++;
    else if (p >= 75) buckets.acceptable++;
    else buckets.weak++;
  });
  createDonut('#distributionChart',
    ['ممتاز ≥96%', 'جيد جداً ≥90%', 'جيد ≥81%', 'مقبول ≥75%', 'ضعيف'],
    [buckets.excellent, buckets.vgood, buckets.good, buckets.acceptable, buckets.weak],
    ['#10b981', '#34d399', '#f59e0b', '#fb923c', '#ef4444']
  );
}

// ─── TOP FORMS ───
function renderTopForms() {
  const top10 = (DATA.forms||[]).slice().sort((a,b) => b.count - a.count).slice(0, 10);
  if (!top10.length) return;
  createHorizontalBar('#topFormsChart', top10.map(f => f.name), top10.map(f => f.count));
}

// ─── ENTITIES TABLE ───
window.switchTab = function(tab) {
  currentTab = tab;
  document.querySelectorAll('.ent-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderEntities();
};
document.querySelectorAll('.ent-tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

window.filterEntities = function() {
  searchTerm = document.getElementById('entitySearch').value.toLowerCase();
  renderEntities();
};

function getTabList() {
  if (currentTab === 'departments') return DATA.departments || [];
  if (currentTab === 'doctors') return DATA.doctors || [];
  if (currentTab === 'nurses') return DATA.nurses || [];
  if (currentTab === 'clerks') return DATA.clerks || [];
  if (currentTab === 'forms') return DATA.forms || [];
  return [];
}

function renderEntities() {
  let list = getTabList().slice();
  if (searchTerm) list = list.filter(x => (x.name || '').toLowerCase().includes(searchTerm));

  const sort = document.getElementById('entitySort').value;
  if (sort === 'percentage') list.sort((a,b) => b.percentage - a.percentage);
  else if (sort === 'count') list.sort((a,b) => b.count - a.count);
  else if (sort === 'name') list.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'ar'));

  const tbody = document.getElementById('entitiesTbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((item, i) => {
    const meta = kpiMeta(item.percentage || 0);
    const rankCls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const sub = item.specialty || item.general_department || '—';
    return `<tr onclick="showDetails('${currentTab}', '${esc(item.normalized || item.name).replace(/'/g,'&#39;')}')">
      <td><span class="rank-badge ${rankCls}">${i + 1}</span></td>
      <td style="font-weight:900;">${esc(item.name)}</td>
      <td style="color:var(--text-secondary);font-size:0.72rem;">${esc(sub)}</td>
      <td style="font-family:'Space Grotesk',monospace;font-weight:900;">${item.count}</td>
      <td style="font-family:'Space Grotesk',monospace;color:var(--text-secondary);">${item.total_score} / ${item.count*2}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="kpi-bar-mini"><div class="kpi-bar-mini-fill" style="width:${item.percentage}%;background:${meta.cls};"></div></div>
          <span class="kpi-chip" style="color:${meta.cls};background:${meta.cls}15;"><i class="fa-solid ${meta.icon}"></i> ${item.percentage}%</span>
        </div>
      </td>
      <td><i class="fa-solid fa-chevron-left" style="color:var(--text-muted);font-size:0.7rem;"></i></td>
    </tr>`;
  }).join('');
}

// ─── MODAL ───
window.showDetails = function(tab, key) {
  const listMap = { departments:'departments', doctors:'doctors', nurses:'nurses', clerks:'clerks', forms:'forms' };
  const list = DATA[listMap[tab]] || [];
  const item = list.find(x => (x.normalized || x.name) === key);
  if (!item) return;
  currentModal = { tab, item };

  document.querySelector('#modalItemName span').textContent = item.name + (item.specialty ? ` (${item.specialty})` : '');
  const meta = kpiMeta(item.percentage || 0);
  const errors = item.top_errors || [];

  let html = `<div class="modal-stats">
    <div class="modal-stat"><div class="val">${item.count}</div><div class="lbl">التقييمات</div></div>
    <div class="modal-stat"><div class="val">${item.total_score} / ${item.count*2}</div><div class="lbl">النقاط / الإجمالي</div></div>
    <div class="modal-stat"><div class="val" style="color:${meta.cls}">${item.percentage}%</div><div class="lbl">${meta.label}</div></div>
  </div>`;

  if (errors.length) {
    html += `<div class="modal-section">
      <h4 style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> أبرز الأخطاء (${errors.length})</h4>
      ${errors.slice(0, 10).map(e => `<div class="error-row"><span>${esc(e.error)}</span><span class="err-badge">${e.count}</span></div>`).join('')}
    </div>`;
  } else {
    html += `<div class="modal-section"><h4 style="color:var(--success)"><i class="fa-solid fa-check"></i> لا توجد أخطاء مسجلة</h4></div>`;
  }

  if (tab === 'forms' && item.department_performance?.length) {
    html += `<div class="modal-section"><h4><i class="fa-solid fa-building-user"></i> أداء الأقسام</h4>`;
    item.department_performance.forEach(d => {
      const m = kpiMeta(d.percentage);
      html += `<div class="error-row"><span>${esc(d.department)}</span><span style="color:${m.cls};font-weight:900;">${d.percentage}% <span style="color:var(--text-muted);font-size:0.7rem;">(${d.count})</span></span></div>`;
    });
    html += `</div>`;
  }

  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('detailsModal').classList.remove('hidden');
};

window.closeModal = function() { document.getElementById('detailsModal').classList.add('hidden'); currentModal = null; };

// ─── FILTERS ───
window.applyDateFilter = function() {
  const start = document.getElementById('startDate').value;
  const end = document.getElementById('endDate').value;
  const dateType = document.getElementById('dateFilterType').value;
  if (!start && !end) {
    if (window.showNotification) showNotification('يرجى اختيار تاريخ واحد على الأقل', 'warning');
    return;
  }
  if (start && end && new Date(start) > new Date(end)) {
    if (window.showNotification) showNotification('تاريخ البداية بعد النهاية', 'warning');
    return;
  }
  const typeLbl = dateType === 'discharge' ? 'الخروج' : 'التقييم';
  currentFilter = { start: start||null, end: end||null, dateType, label: `${start||'—'} → ${end||'—'} (${typeLbl})` };
  loadData();
};

window.clearDateFilter = function() {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('dateFilterType').value = 'discharge';
  currentFilter = { start:null, end:null, dateType:'discharge', label:'الكل' };
  loadData();
};

function updateActiveFilter() {
  const div = document.getElementById('activeFilter');
  if (currentFilter.label !== 'الكل') {
    div.classList.remove('hidden');
    document.getElementById('activeFilterText').textContent = currentFilter.label;
  } else {
    div.classList.add('hidden');
  }
}

// ─── EXPORTS ───
window.exportToExcel = () => _xls(getTabList(), currentTab);
window.exportToPDF = () => _pdf(getTabList(), currentTab);
window.exportModalToPDF = () => { if (currentModal) _mpdf(currentModal.item, currentModal.tab); };