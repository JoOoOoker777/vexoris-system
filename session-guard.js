// session-guard.js — Session validation, grace flow, single-device, realtime kill
import { supabase } from './supabase-client.js';

const TOKEN_KEY = 'vexoris_session_token';
const DEVICE_KEY = 'vexoris_device_id';

let heartbeatTimer = null;
let expiryTimer = null;
let realtimeChannel = null;
let currentToken = null;
let currentExpiresAt = null;
let graceUsed = false;
let shuttingDown = false;

// ============================================
// STYLES (injected once)
// ============================================
function injectStyles() {
  if (document.getElementById('vex-sg-styles')) return;
  const s = document.createElement('style');
  s.id = 'vex-sg-styles';
  s.textContent = `
    .vex-sg-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(4,7,15,0.8);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; opacity: 0; transition: opacity .3s;
      font-family: 'Tajawal', sans-serif; direction: rtl;
    }
    .vex-sg-overlay.open { opacity: 1; }
    .vex-sg-box {
      background: linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92));
      border: 1px solid rgba(14,165,233,0.35);
      border-radius: 22px; padding: 28px 24px;
      max-width: 440px; width: 100%;
      box-shadow: 0 30px 60px -30px rgba(0,0,0,0.6);
      text-align: center;
    }
    .vex-sg-icon {
      width: 64px; height: 64px; border-radius: 18px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 18px; font-size: 1.7rem;
    }
    .vex-sg-title {
      font-size: 1.18rem; font-weight: 900; color: #f1f5f9; margin: 0 0 10px;
    }
    .vex-sg-text {
      font-size: .84rem; color: #94a3b8; line-height: 1.75; margin: 0 0 20px;
    }
    .vex-sg-list {
      padding: 0; margin: 0 0 18px; max-height: 140px; overflow-y: auto;
    }
    .vex-sg-list li {
      font-size: .76rem; color: #94a3b8; margin: 4px 0;
      padding: 7px 11px; background: rgba(148,163,184,0.06);
      border-radius: 8px; list-style: none; text-align: right;
    }
    .vex-sg-btns { display: flex; gap: 10px; flex-wrap: wrap; }
    .vex-sg-btn {
      flex: 1; min-width: 130px; padding: 13px 16px;
      border-radius: 11px; font-weight: 800; font-size: .86rem;
      cursor: pointer; font-family: inherit; border: none;
      transition: transform .15s, box-shadow .2s;
    }
    .vex-sg-btn:active { transform: scale(0.97); }
    .vex-sg-btn.primary {
      background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff;
      box-shadow: 0 6px 18px -6px rgba(239,68,68,0.6);
    }
    .vex-sg-btn.warn {
      background: linear-gradient(135deg, #f59e0b, #f97316); color: #fff;
      box-shadow: 0 6px 18px -6px rgba(245,158,11,0.6);
    }
    .vex-sg-btn.ghost {
      background: transparent; color: #94a3b8;
      border: 1px solid rgba(148,163,184,0.3);
    }
    .vex-sg-banner {
      position: fixed; top: 84px; left: 50%; transform: translateX(-50%);
      z-index: 9998; padding: 11px 20px; border-radius: 12px;
      font-family: 'Tajawal', sans-serif; font-weight: 800; font-size: .82rem;
      box-shadow: 0 6px 20px -6px rgba(0,0,0,0.4);
      backdrop-filter: blur(20px); direction: rtl; color: #fff;
      white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis;
    }
    .vex-sg-banner.warn { background: rgba(245,158,11,0.95); color: #0b1220; }
    .vex-sg-banner.danger { background: linear-gradient(135deg, #f59e0b, #f97316); }
  `;
  document.head.appendChild(s);
}

// ============================================
// DEVICE ID
// ============================================
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screen: screen.width + 'x' + screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// ============================================
// TOKEN
// ============================================
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

// ============================================
// MODAL: Other device conflict
// ============================================
function showConflictModal(otherSessions) {
  return new Promise((resolve) => {
    const items = otherSessions.map(s => {
      const ua = s.user_agent || 'جهاز غير معروف';
      const short = ua.length > 60 ? ua.slice(0, 60) + '…' : ua;
      const when = s.started_at ? new Date(s.started_at).toLocaleString('ar-EG') : '';
      return `<li>🖥️ ${short}${when ? ' — ' + when : ''}</li>`;
    }).join('');

    const ov = document.createElement('div');
    ov.className = 'vex-sg-overlay';
    ov.innerHTML = `
      <div class="vex-sg-box">
        <div class="vex-sg-icon" style="background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.15));border:1px solid rgba(245,158,11,0.4);color:#f59e0b;">⚠️</div>
        <h3 class="vex-sg-title">أنت مسجل على جهاز آخر</h3>
        <p class="vex-sg-text">
          لا يمكن فتح جلستين في نفس الوقت.<br>
          للمتابعة، سيتم <strong style="color:#ef4444;">إقصاء الجلسة السابقة</strong> فوراً.
        </p>
        <ul class="vex-sg-list">${items}</ul>
        <div class="vex-sg-btns">
          <button class="vex-sg-btn primary" data-act="kill">إقصاء الجلسة والمتابعة</button>
          <button class="vex-sg-btn ghost" data-act="cancel">إلغاء</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('open'));

    ov.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      ov.classList.remove('open');
      setTimeout(() => ov.remove(), 300);
      resolve(btn.dataset.act === 'kill');
    });
  });
}

// ============================================
// MODAL: Expiry first stage
// ============================================
function showExpiryFirstModal() {
  if (document.getElementById('vex-sg-expiry')) return;
  injectStyles();

  const ov = document.createElement('div');
  ov.className = 'vex-sg-overlay open';
  ov.id = 'vex-sg-expiry';
  ov.innerHTML = `
    <div class="vex-sg-box">
      <div class="vex-sg-icon" style="background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(239,68,68,0.15));border:1px solid rgba(245,158,11,0.4);color:#f59e0b;">⏰</div>
      <h3 class="vex-sg-title">انتهت مدة الجلسة (15 ساعة)</h3>
      <p class="vex-sg-text">
        لأسباب أمنية، يجب تجديد جلسة الدخول.<br>
        هل تحتاج وقتاً إضافياً لحفظ البيانات؟
      </p>
      <div class="vex-sg-btns">
        <button class="vex-sg-btn warn" data-act="grace">انتظار 5 دقائق للحفظ</button>
        <button class="vex-sg-btn ghost" data-act="logout">خروج فوري</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'grace') {
      btn.disabled = true;
      btn.textContent = 'جاري التجديد...';
      const ok = await useGrace();
      if (ok) {
        ov.remove();
        startGraceBanner();
      } else {
        btn.disabled = false;
        btn.textContent = 'فشل — حاول مرة أخرى';
      }
    } else {
      forcedLogout('expired');
    }
  });
}

// ============================================
// MODAL: Expiry final stage
// ============================================
function showExpiryFinalModal() {
  if (document.getElementById('vex-sg-final')) return;
  injectStyles();

  const ov = document.createElement('div');
  ov.className = 'vex-sg-overlay open';
  ov.id = 'vex-sg-final';
  ov.innerHTML = `
    <div class="vex-sg-box">
      <div class="vex-sg-icon" style="background:linear-gradient(135deg,rgba(239,68,68,0.25),rgba(220,38,38,0.2));border:1px solid rgba(239,68,68,0.5);color:#ef4444;">🚫</div>
      <h3 class="vex-sg-title">انتهت المهلة الإضافية</h3>
      <p class="vex-sg-text">
        سيتم تسجيل خروجك تلقائياً بعد <strong id="vex-sg-cd" style="color:#ef4444;">5</strong> ثوانٍ.<br>
        سيتم توجيهك لصفحة الدخول.
      </p>
      <button class="vex-sg-btn primary" style="width:100%;" data-act="logout">تسجيل الخروج الآن</button>
    </div>
  `;
  document.body.appendChild(ov);

  let cd = 5;
  const cdEl = ov.querySelector('#vex-sg-cd');
  const int = setInterval(() => {
    cd--;
    if (cdEl) cdEl.textContent = cd;
    if (cd <= 0) {
      clearInterval(int);
      forcedLogout('grace_expired');
    }
  }, 1000);

  ov.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="logout"]')) {
      clearInterval(int);
      forcedLogout('grace_expired');
    }
  });
}

// ============================================
// BANNERS
// ============================================
function showWarnBanner(mins) {
  injectStyles();
  let b = document.getElementById('vex-sg-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'vex-sg-banner';
    b.className = 'vex-sg-banner warn';
    document.body.appendChild(b);
  }
  b.textContent = `⚠️ تنتهي الجلسة بعد ${mins} دقيقة`;
}

function removeBanner() {
  const b = document.getElementById('vex-sg-banner');
  if (b) b.remove();
}

function startGraceBanner() {
  injectStyles();
  let b = document.getElementById('vex-sg-banner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'vex-sg-banner';
    b.className = 'vex-sg-banner danger';
    document.body.appendChild(b);
  }
  const update = () => {
    if (!currentExpiresAt || shuttingDown) return;
    const rem = Math.max(0, currentExpiresAt.getTime() - Date.now());
    const secs = Math.ceil(rem / 1000);
    if (secs <= 0) {
      b.textContent = '🚫 انتهت المهلة — جاري تسجيل الخروج...';
    } else {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      b.textContent = `⏳ متبقي ${m}:${String(s).padStart(2, '0')} — احفظ بياناتك الآن`;
    }
  };
  update();
  const int = setInterval(() => {
    if (shuttingDown) { clearInterval(int); return; }
    update();
    if (currentExpiresAt && Date.now() >= currentExpiresAt.getTime()) {
      clearInterval(int);
      b.remove();
      showExpiryFinalModal();
    }
  }, 1000);
}

// ============================================
// RPC: create / validate / kill / grace / end
// ============================================
async function rpcCreateSession() {
  const { data, error } = await supabase.rpc('create_session', {
    p_device_id: getDeviceId(),
    p_device_info: getDeviceInfo(),
    p_duration_hours: 15,
    p_user_agent: navigator.userAgent,
    p_ip: null,
  });
  if (error || !data?.success) return null;
  return data;
}

async function rpcValidate(token) {
  try {
    const { data, error } = await supabase.rpc('validate_session', { p_session_token: token });
    if (error || !data) return { valid: false, reason: 'rpc_error' };
    return data;
  } catch (e) {
    return { valid: false, reason: 'exception' };
  }
}

async function useGrace() {
  const { data, error } = await supabase.rpc('use_grace', { p_session_token: currentToken });
  if (error || !data?.success) return false;
  graceUsed = true;
  currentExpiresAt = new Date(data.expires_at);
  return true;
}

async function rpcEndSession(reason) {
  try {
    if (!currentToken) return;
    await supabase.rpc('end_session', { p_session_token: currentToken, p_reason: reason });
  } catch (e) {}
}

async function rpcGetActiveSessions() {
  const { data, error } = await supabase.rpc('get_active_sessions');
  if (error || !Array.isArray(data)) return [];
  return data;
}

async function rpcKillSession(token) {
  try {
    await supabase.rpc('kill_session', { p_session_token: token, p_reason: 'new_login_elsewhere' });
  } catch (e) {}
}

// ============================================
// FORCED LOGOUT
// ============================================
async function forcedLogout(reason, msg) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAll();
  await rpcEndSession(reason);
  clearToken();
  if (msg && window.showNotification) {
    try { window.showNotification(msg, 'warning', '', 4000); } catch (e) {}
  }
  setTimeout(async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
    const p = window.location.pathname;
    const login = (p.includes('/apps/') || p.includes('/admin/')) ? '../login.html' : './login.html';
    window.location.href = login;
  }, 300);
}

// ============================================
// REALTIME KILL LISTENER
// ============================================
function startRealtime() {
  stopRealtime();
  realtimeChannel = supabase.channel('vex_session_watch_' + currentToken)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'user_sessions',
      filter: `session_token=eq.${currentToken}`,
    }, (payload) => {
      const row = payload.new;
      if (row && row.is_active === false && row.session_token === currentToken) {
        const r = row.ended_reason;
        let m = 'تم إنهاء جلستك.';
        if (r === 'new_login_elsewhere') m = 'تم تسجيل الدخول من جهاز آخر، وانتهت جلستك هنا.';
        else if (r === 'manual') m = 'تم إنهاء جلستك من إدارة الجلسات.';
        forcedLogout('killed', m);
      }
    })
    .subscribe();
}

function stopRealtime() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

// ============================================
// HEARTBEAT + EXPIRY TIMER
// ============================================
async function beat() {
  if (!currentToken || shuttingDown) return;
  const r = await rpcValidate(currentToken);
  if (!r.valid) {
    const reason = r.reason;
    let m = 'انتهت صلاحية الجلسة.';
    if (reason === 'ended') {
      const er = r.ended_reason;
      if (er === 'new_login_elsewhere') m = 'تم تسجيل الدخول من جهاز آخر، وانتهت جلستك هنا.';
      else if (er === 'manual') m = 'تم إنهاء جلستك.';
      else if (er === 'logout') m = 'تم تسجيل خروجك.';
    } else if (reason === 'not_found') {
      m = 'جلسة غير موجودة. يرجى إعادة الدخول.';
    }
    forcedLogout('invalid', m);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  beat();
  heartbeatTimer = setInterval(beat, 60 * 1000);
  startRealtime();
  expiryTimer = setInterval(checkExpiry, 30 * 1000);
  checkExpiry();
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }
}

function checkExpiry() {
  if (!currentExpiresAt || shuttingDown) return;
  const rem = currentExpiresAt.getTime() - Date.now();
  if (rem <= 0) {
    removeBanner();
    if (!graceUsed) showExpiryFirstModal();
    else showExpiryFinalModal();
  } else if (rem <= 2 * 60 * 1000) {
    showWarnBanner(Math.ceil(rem / 60000));
  }
}

function stopAll() {
  stopHeartbeat();
  stopRealtime();
  removeBanner();
}

// ============================================
// ENSURE SESSION (main entry)
// ============================================
export async function ensureSession(auth) {
  injectStyles();
  const existing = getToken();

  if (existing) {
    const r = await rpcValidate(existing);
    if (r.valid) {
      currentToken = existing;
      currentExpiresAt = r.expires_at ? new Date(r.expires_at) : null;
      graceUsed = r.grace_used || false;
      startHeartbeat();
      return { ok: true, token: existing };
    }
    clearToken();
  }

  // No valid token — check if fresh login
  const lastSignIn = auth?.session?.user?.last_sign_in_at;
  const fresh = lastSignIn && (Date.now() - new Date(lastSignIn).getTime()) < 5 * 60 * 1000;

  if (!fresh) {
    return { ok: false, reason: 'session_missing' };
  }

  // Single-device check
  const deviceId = getDeviceId();
  const actives = await rpcGetActiveSessions();
  const others = actives.filter(s => s.device_id !== deviceId);

  if (others.length > 0) {
    const agreed = await showConflictModal(others);
    if (!agreed) {
      await supabase.auth.signOut();
      return { ok: false, reason: 'declined_single_device' };
    }
    for (const s of others) await rpcKillSession(s.session_token);
  }

  const created = await rpcCreateSession();
  if (!created) return { ok: false, reason: 'create_failed' };

  currentToken = created.session_token;
  currentExpiresAt = new Date(created.expires_at);
  graceUsed = false;
  setToken(currentToken);
  startHeartbeat();
  return { ok: true, token: currentToken, killed: others.length };
}

// ============================================
// LOGOUT (called before supabase signOut)
// ============================================
export async function endCurrentSession(reason = 'logout') {
  shuttingDown = true;
  stopAll();
  await rpcEndSession(reason);
  clearToken();
}

// Cleanup on unload — DO NOT end session (user may navigate)
window.addEventListener('beforeunload', () => {
  stopAll();
});