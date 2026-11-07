// session-manager.js
// Shared authentication UI + smart session timeout + page zoom control

import { supabase } from './supabase-client.js';

// ============================================
// ROLE METADATA
// ============================================
const ROLE_META = {
    super_admin: { name: 'المطور', color: '#a855f7', icon: 'fa-crown' },
    admin:       { name: 'ادارة السجلات الطبية', color: '#0ea5e9', icon: 'fa-user-shield' },
    manager:     { name: 'المدير الطبي', color: '#6366f1', icon: 'fa-user-tie' },
    auditor:     { name: 'مراجع جودة', color: '#f59e0b', icon: 'fa-clipboard-check' },
    senior:      { name: 'رئيس قسم', color: '#10b981', icon: 'fa-star' },
    doctor:      { name: 'طبيب', color: '#14b8a6', icon: 'fa-stethoscope' },
    viewer:      { name: 'مراجع', color: '#94a3b8', icon: 'fa-eye' },
};

// ============================================
// CONFIG
// ============================================
const CONFIG = {
    inactivityMs: 30 * 60 * 1000,
    warningMs: 2 * 60 * 1000,
};

const ZOOM_LEVELS = [70, 80, 90, 100, 110, 120, 130, 150];
const DEFAULT_ZOOM = 80;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

// ============================================
// AVATAR HELPERS
// ============================================
function makeAvatarGradient(color) {
    return `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35) 0%, transparent 55%), linear-gradient(135deg, ${color}, ${color}cc)`;
}

function renderRoleAvatar(el, role) {
    if (!el) return;
    const info = ROLE_META[role] || ROLE_META.viewer;
    el.innerHTML = `<i class="fa-solid ${info.icon}"></i>`;
    el.style.background = makeAvatarGradient(info.color);
    el.style.color = '#fff';
}

// ============================================
// ZOOM
// ============================================
function getCurrentZoom() {
    const saved = sessionStorage.getItem('vexoris_zoom');
    return saved ? parseInt(saved) : DEFAULT_ZOOM;
}

function applyZoom(level) {
    if (window.innerWidth < 768) return level;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
    document.body.style.zoom = clamped / 100;
    sessionStorage.setItem('vexoris_zoom', clamped);
    return clamped;
}

// ============================================
// INJECT STYLES
// ============================================
function injectStyles() {
    if (document.getElementById('vexoris-session-styles')) return;
    const style = document.createElement('style');
    style.id = 'vexoris-session-styles';
    style.textContent = `
        .vexoris-user-chip {
            display: inline-flex; align-items: center; gap: 10px;
            padding: 6px 12px 6px 8px;
            background: rgba(148, 163, 184, 0.06);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 12px; cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none; color: inherit; font-family: inherit;
        }
        .vexoris-user-chip:hover {
            border-color: #0ea5e9;
            background: rgba(14, 165, 233, 0.06);
            transform: translateY(-1px);
        }
        .vexoris-user-avatar {
            width: 32px; height: 32px; border-radius: 9px;
            display: flex; align-items: center; justify-content: center;
            font-weight: 900; font-size: 0.95rem; color: #fff;
            flex-shrink: 0; position: relative; overflow: hidden;
            box-shadow: 0 2px 6px -1px rgba(0,0,0,0.25);
        }
        .vexoris-user-avatar i {
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
        }
        .vexoris-user-avatar::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
            background-size: 200% 100%;
            animation: vexoris-shine 4s infinite;
            z-index: 1;
        }
        @keyframes vexoris-shine {
            0% { background-position: -200% 0; }
            50%, 100% { background-position: 200% 0; }
        }
        .vexoris-user-info { display: flex; flex-direction: column; gap: 1px; text-align: right; }
        .vexoris-user-name { font-size: 0.78rem; font-weight: 800; color: #f1f5f9; line-height: 1.1; }
        html:not(.dark) .vexoris-user-name { color: #0b1220; }
        .vexoris-user-role { font-size: 0.65rem; font-weight: 700; line-height: 1.1; }
        .vexoris-logout-btn {
            width: 36px; height: 36px; border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            background: transparent; color: #f87171;
            display: inline-flex; align-items: center; justify-content: center;
            cursor: pointer; transition: all 0.25s ease;
        }
        .vexoris-logout-btn:hover {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.4);
            transform: scale(1.05);
        }
        .vexoris-lock-overlay {
            position: fixed; inset: 0; z-index: 99999;
            display: none; align-items: center; justify-content: center;
            background: rgba(4, 7, 15, 0.65);
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            padding: 20px;
        }
        .vexoris-lock-overlay.active { display: flex; }

        #vexorisZoomWidget {
            display: inline-flex; align-items: center; gap: 1px;
            background: var(--card-bg, rgba(15,23,42,0.55));
            border: 1px solid var(--card-border, rgba(148,163,184,0.12));
            border-radius: 10px; padding: 2px;
            height: 36px; transition: all 0.25s ease;
        }
        #vexorisZoomWidget:hover { border-color: rgba(14, 165, 233, 0.4); }
        .vz-btn {
            width: 26px; height: 30px; border: none; background: transparent;
            color: var(--text-secondary, #94a3b8);
            border-radius: 7px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.6rem; transition: all 0.2s ease;
        }
        .vz-btn:hover {
            background: rgba(14, 165, 233, 0.12);
            color: var(--accent, #0ea5e9);
        }
        .vz-btn:active { transform: scale(0.9); }
        .vz-label {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 0.6rem; font-weight: 700;
            color: var(--text-primary, #f1f5f9);
            min-width: 32px; text-align: center;
            user-select: none; letter-spacing: 0.02em;
        }
        @media (max-width: 767px) {
            #vexorisZoomWidget { display: none !important; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// INJECT ZOOM CONTROLS
// ============================================
function injectZoomControls() {
    if (document.getElementById('vexorisZoomWidget')) return;
    if (window.innerWidth < 768) return;

    const themeBtn = document.querySelector('.icon-btn[onclick*="toggleTheme"]');
    if (!themeBtn) return;

    const widget = document.createElement('div');
    widget.id = 'vexorisZoomWidget';
    
    const current = getCurrentZoom();
    widget.innerHTML = `
        <button type="button" class="vz-btn" data-zoom="out" title="تصغير" aria-label="تصغير">
            <i class="fa-solid fa-minus"></i>
        </button>
        <span class="vz-label">${current}%</span>
        <button type="button" class="vz-btn" data-zoom="in" title="تكبير" aria-label="تكبير">
            <i class="fa-solid fa-plus"></i>
        </button>
    `;

    themeBtn.parentNode.insertBefore(widget, themeBtn);

    const label = widget.querySelector('.vz-label');

    widget.querySelectorAll('.vz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.zoom;
            const currentLevel = getCurrentZoom();
            let next;

            if (action === 'in') {
                next = ZOOM_LEVELS.find(l => l > currentLevel);
            } else {
                next = [...ZOOM_LEVELS].reverse().find(l => l < currentLevel);
            }

            if (next !== undefined && next !== currentLevel) {
                applyZoom(next);
                label.textContent = next + '%';
            }
        });
    });
}

// ============================================
// REPLACE "الرئيسية" WITH "لوحة التحكم"
// ============================================
function replaceHomeWithDashboard() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('dashboard.html') || path.endsWith('/dashboard')) return;

    const nav = document.querySelector('.nav-inner nav');
    if (!nav) return;
    if (nav.querySelector('a[href="dashboard.html"]')) return;

    const homeLink = nav.querySelector('a[href="index.html"]');
    if (!homeLink) return;

    const dashLink = document.createElement('a');
    dashLink.href = 'dashboard.html';
    dashLink.className = 'nav-link';
    dashLink.textContent = 'لوحة التحكم';
    homeLink.replaceWith(dashLink);
}

// ============================================
// LOGOUT (global with confirmation)
// ============================================
window.vexorisLogout = async function() {
    if (window.showConfirm) {
        const confirmed = await window.showConfirm({
            title: 'تسجيل الخروج',
            message: 'هل أنت متأكد أنك تريد تسجيل الخروج من النظام؟',
            confirmText: 'تسجيل الخروج',
            cancelText: 'إلغاء',
            type: 'danger'
        });
        if (!confirmed) return;
    }

    await supabase.auth.signOut();
    sessionStorage.clear();
    localStorage.removeItem('vexoris_user_email');
    window.location.href = './login.html';
};

// ============================================
// HEADER AUTH
// ============================================
async function initHeaderAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    localStorage.setItem('vexoris_user_email', session.user.email);

    const loginBtn = document.querySelector('a[href="login.html"].btn-primary');
    if (!loginBtn) return;

    const user = session.user;
    const displayName = user.user_metadata?.display_name || 'مستخدم';

    let role = 'viewer';
    try {
        const { data: profile } = await supabase
            .from('profiles').select('role').eq('id', user.id).single();
        role = profile?.role || 'viewer';
    } catch (e) {}

    const roleInfo = ROLE_META[role] || ROLE_META.viewer;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 8px;';
    wrapper.innerHTML = `
        <a href="dashboard.html" class="vexoris-user-chip">
            <div class="vexoris-user-avatar">
                <i class="fa-solid ${roleInfo.icon}"></i>
            </div>
            <div class="vexoris-user-info">
                <span class="vexoris-user-name">${displayName}</span>
                <span class="vexoris-user-role" style="color: ${roleInfo.color};">${roleInfo.name}</span>
            </div>
        </a>
        <button onclick="window.vexorisLogout()" class="vexoris-logout-btn" title="تسجيل الخروج">
            <i class="fa-solid fa-power-off"></i>
        </button>
    `;

    // Set avatar gradient after inserting to DOM
    const avatarEl = wrapper.querySelector('.vexoris-user-avatar');
    avatarEl.style.background = makeAvatarGradient(roleInfo.color);

    loginBtn.replaceWith(wrapper);
}

// ============================================
// SESSION TIMEOUT
// ============================================
function initSessionTimeout() {
    let locked = false;
    let warningTimer = null;
    let lockTimer = null;

    function ensureOverlay() {
        if (document.getElementById('vexorisLockOverlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'vexorisLockOverlay';
        overlay.className = 'vexoris-lock-overlay';
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.85));
                border: 1px solid rgba(14, 165, 233, 0.3);
                border-radius: 24px; padding: 40px 32px;
                max-width: 440px; width: 100%;
                text-align: center;
                box-shadow: 0 30px 60px -30px rgba(14, 165, 233, 0.4);
                position: relative; overflow: hidden;
                font-family: 'Tajawal', sans-serif;
            ">
                <div style="position: absolute; top: 0; right: 0; left: 0; height: 3px;
                    background: linear-gradient(90deg, transparent, #0ea5e9, #6366f1, transparent);"></div>
                <div style="
                    width: 68px; height: 68px; border-radius: 18px;
                    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.15));
                    border: 1px solid rgba(14, 165, 233, 0.35);
                    display: flex; align-items: center; justify-content: center;
                    color: #0ea5e9; font-size: 1.6rem;
                    margin: 0 auto 20px;
                ">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <h2 style="font-size: 1.4rem; font-weight: 900; color: #f1f5f9; margin: 0 0 10px;">
                    الجلسة مقفلة
                </h2>
                <p style="font-size: 0.88rem; color: #94a3b8; line-height: 1.75; margin: 0 0 24px;">
                    لأسباب أمنية، تم قفل جلستك بعد فترة من عدم النشاط.<br>
                    <strong style="color: #0ea5e9; font-weight: 800;">بياناتك محفوظة كما هي.</strong>
                    أدخل كلمة المرور لاستئناف العمل دون فقدان أي شيء.
                </p>
                <div id="vexorisLockError" style="
                    display: none; padding: 12px; border-radius: 10px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #f87171; font-size: 0.8rem; font-weight: 700;
                    margin-bottom: 16px; text-align: center;
                "></div>
                <div style="position: relative; margin-bottom: 16px;">
                    <input type="password" id="vexorisUnlockPassword"
                        placeholder="أدخل كلمة المرور"
                        autocomplete="current-password"
                        style="
                            width: 100%; padding: 14px 46px 14px 16px;
                            text-align: center;
                            background: rgba(15, 23, 42, 0.6);
                            border: 1px solid rgba(148, 163, 184, 0.2);
                            border-radius: 12px;
                            color: #f1f5f9; font-size: 0.9rem; font-weight: 600;
                            font-family: inherit; transition: all 0.25s ease;
                            box-sizing: border-box;
                        " />
                    <button type="button" id="vexorisTogglePass" style="
                        position: absolute; left: 12px; top: 50%;
                        transform: translateY(-50%);
                        width: 32px; height: 32px;
                        border: none; background: transparent;
                        color: #64748b; cursor: pointer;
                        display: flex; align-items: center; justify-content: center;
                        border-radius: 8px; transition: all 0.2s;
                    " title="إظهار/إخفاء كلمة المرور">
                        <i class="fa-solid fa-eye" id="vexorisPassEye"></i>
                    </button>
                </div>
                <button type="button" id="vexorisUnlockBtn" style="
                    width: 100%; padding: 14px;
                    border-radius: 12px; border: none;
                    background: linear-gradient(135deg, #0ea5e9, #6366f1);
                    color: white; font-weight: 800; font-size: 0.9rem;
                    cursor: pointer; font-family: inherit;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    transition: all 0.3s ease;
                    box-shadow: 0 8px 24px -8px rgba(14, 165, 233, 0.5);
                ">
                    <i class="fa-solid fa-unlock"></i>
                    <span>فتح الجلسة</span>
                </button>
                <button type="button" onclick="window.vexorisLogout()" style="
                    background: transparent; border: none; color: #64748b;
                    font-size: 0.75rem; font-weight: 700; margin-top: 18px;
                    cursor: pointer; text-decoration: underline; font-family: inherit;
                ">
                    أو تسجيل الخروج
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = overlay.querySelector('#vexorisUnlockPassword');
        const btn = overlay.querySelector('#vexorisUnlockBtn');
        const togglePass = overlay.querySelector('#vexorisTogglePass');
        const passEye = overlay.querySelector('#vexorisPassEye');

        input.addEventListener('focus', () => {
            input.style.borderColor = '#0ea5e9';
            input.style.boxShadow = '0 0 0 3px rgba(14, 165, 233, 0.12)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'rgba(148, 163, 184, 0.2)';
            input.style.boxShadow = 'none';
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleUnlock(); }
        });
        togglePass.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                passEye.classList.remove('fa-eye');
                passEye.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                passEye.classList.remove('fa-eye-slash');
                passEye.classList.add('fa-eye');
            }
        });
        btn.addEventListener('click', handleUnlock);

        async function handleUnlock() {
            const password = input.value.trim();
            const errorBox = overlay.querySelector('#vexorisLockError');
            errorBox.style.display = 'none';

            if (!password) {
                errorBox.textContent = 'يرجى إدخال كلمة المرور.';
                errorBox.style.display = 'block';
                return;
            }

            btn.disabled = true;
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>جاري التحقق...</span>';
            btn.style.opacity = '0.7';

            let email = localStorage.getItem('vexoris_user_email');
            if (!email) {
                const { data: { session } } = await supabase.auth.getSession();
                email = session?.user?.email;
            }
            if (!email) {
                window.location.href = './login.html';
                return;
            }

            try {
                const { error } = await supabase.auth.signInWithPassword({ email, password });

                if (error) {
                    btn.disabled = false;
                    btn.innerHTML = orig;
                    btn.style.opacity = '1';
                    errorBox.textContent = 'كلمة المرور غير صحيحة. حاول مرة أخرى.';
                    errorBox.style.display = 'block';
                    input.value = '';
                    input.focus();
                    return;
                }

                overlay.classList.remove('active');
                locked = false;
                input.value = '';
                input.type = 'password';
                passEye.classList.remove('fa-eye-slash');
                passEye.classList.add('fa-eye');
                btn.disabled = false;
                btn.innerHTML = orig;
                btn.style.opacity = '1';

                if (window.showNotification) {
                    showNotification('تم فتح الجلسة بنجاح. يمكنك متابعة العمل.', 'success');
                }

                resetTimers();
            } catch (err) {
                console.error('Unlock error:', err);
                btn.disabled = false;
                btn.innerHTML = orig;
                btn.style.opacity = '1';
                errorBox.textContent = 'حدث خطأ غير متوقع. حاول مرة أخرى.';
                errorBox.style.display = 'block';
            }
        }
    }

    function lockSession() {
        if (locked) return;
        locked = true;
        ensureOverlay();
        document.getElementById('vexorisLockOverlay').classList.add('active');
        setTimeout(() => {
            document.getElementById('vexorisUnlockPassword')?.focus();
        }, 100);
    }

    function resetTimers() {
        clearTimeout(warningTimer);
        clearTimeout(lockTimer);
        if (locked) return;

        warningTimer = setTimeout(() => {
            if (locked) return;
            if (window.showNotification) {
                showNotification('ستُقفل الجلسة خلال دقيقتين لعدم النشاط', 'warning');
            }
        }, CONFIG.inactivityMs - CONFIG.warningMs);

        lockTimer = setTimeout(lockSession, CONFIG.inactivityMs);
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'input', 'click'];
    let lastReset = 0;
    const throttledReset = () => {
        const now = Date.now();
        if (now - lastReset < 1000) return;
        lastReset = now;
        if (!locked) resetTimers();
    };
    events.forEach(evt => document.addEventListener(evt, throttledReset, { passive: true }));

    resetTimers();
}

// ============================================
// AUTO INIT
// ============================================
(async () => {
    if (document.readyState === 'loading') {
        await new Promise(r => document.addEventListener('DOMContentLoaded', r));
    }

    injectStyles();

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        const savedZoom = sessionStorage.getItem('vexoris_zoom');
        if (savedZoom && window.innerWidth >= 768) {
            applyZoom(parseInt(savedZoom));
        }

        replaceHomeWithDashboard();
        await initHeaderAuth();
        injectZoomControls();
        initSessionTimeout();
    }
})();

export { initHeaderAuth, initSessionTimeout, replaceHomeWithDashboard, injectZoomControls };