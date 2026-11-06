// session-manager.js
// Shared authentication UI + smart session timeout with lock overlay
// يُحمّل تلقائياً في كل الصفحات

import { supabase } from './supabase-client.js';

// ============================================
// ROLE METADATA
// ============================================
const ROLE_META = {
    super_admin: { name: 'مالك النظام', color: '#a855f7' },
    admin:       { name: 'مدير إداري', color: '#0ea5e9' },
    manager:     { name: 'مدير طبي', color: '#6366f1' },
    auditor:     { name: 'مدقق جودة', color: '#f59e0b' },
    senior:      { name: 'أخصائي أول', color: '#10b981' },
    doctor:      { name: 'طبيب', color: '#14b8a6' },
    viewer:      { name: 'مشاهد', color: '#94a3b8' },
};

// ============================================
// CONFIG
// ============================================
const CONFIG = {
    inactivityMs: 30 * 60 * 1000, // 30 minutes
    warningMs: 2 * 60 * 1000,      // 2 minutes before lock
};

// ============================================
// HELPERS
// ============================================
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return parts[0][0] + (parts[1]?.[0] || '');
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
            font-weight: 900; font-size: 0.8rem; color: #fff;
            flex-shrink: 0; position: relative; overflow: hidden;
        }
        .vexoris-user-avatar::before {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
            background-size: 200% 100%;
            animation: vexoris-shine 4s infinite;
        }
        @keyframes vexoris-shine {
            0% { background-position: -200% 0; }
            50%, 100% { background-position: 200% 0; }
        }
        .vexoris-user-info { display: flex; flex-direction: column; gap: 1px; text-align: right; }
        .vexoris-user-name { font-size: 0.78rem; font-weight: 800; color: #f1f5f9; line-height: 1.1; }
        html:not(.dark) .vexoris-user-name { color: #0f172a; }
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
        .vexoris-toast {
            position: fixed; bottom: 24px; left: 50%;
            transform: translateX(-50%) translateY(20px);
            padding: 14px 24px; border-radius: 12px;
            font-family: 'Tajawal', sans-serif;
            font-weight: 700; font-size: 0.85rem;
            z-index: 99998;
            display: flex; align-items: center; gap: 10px;
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.4);
            backdrop-filter: blur(20px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            pointer-events: none;
        }
        .vexoris-toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// REPLACE "الرئيسية" WITH "لوحة التحكم"
// ============================================
function replaceHomeWithDashboard() {
    // Skip if we're already on the dashboard page (it has its own nav)
    const path = window.location.pathname.toLowerCase();
    if (path.includes('dashboard.html') || path.endsWith('/dashboard')) return;

    const nav = document.querySelector('.nav-inner nav');
    if (!nav) return;

    // Skip if already replaced
    if (nav.querySelector('a[href="dashboard.html"]')) return;

    // Find "الرئيسية" link (points to index.html)
    const homeLink = nav.querySelector('a[href="index.html"]');
    if (!homeLink) return;

    // Create the dashboard replacement
    const dashLink = document.createElement('a');
    dashLink.href = 'dashboard.html';
    dashLink.className = 'nav-link';
    dashLink.textContent = 'لوحة التحكم';
    // Note: no "active" class since we're not on dashboard page

    // Replace in place (keeps position: first in nav)
    homeLink.replaceWith(dashLink);
}

// ============================================
// LOGOUT (global)
// ============================================
window.vexorisLogout = async function() {
    await supabase.auth.signOut();
    sessionStorage.clear();
    localStorage.removeItem('vexoris_user_email');
    window.location.href = './login.html';
};

// ============================================
// HEADER AUTH — Replaces login button with user chip
// ============================================
async function initHeaderAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Store email for unlock flow (in case JWT expires)
    localStorage.setItem('vexoris_user_email', session.user.email);

    // Find the login button on this page
    const loginBtn = document.querySelector('a[href="login.html"].btn-primary');
    if (!loginBtn) return;

    // Get user info
    const user = session.user;
    const displayName = user.user_metadata?.display_name || 'مستخدم';
    const initials = getInitials(displayName);

    // Fetch role
    let role = 'viewer';
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        role = profile?.role || 'viewer';
    } catch (e) {
        console.warn('Could not fetch role:', e);
    }

    const roleInfo = ROLE_META[role] || ROLE_META.viewer;

    // Build replacement
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: inline-flex; align-items: center; gap: 8px;';
    wrapper.innerHTML = `
        <a href="dashboard.html" class="vexoris-user-chip">
            <div class="vexoris-user-avatar" style="background: linear-gradient(135deg, ${roleInfo.color}, ${roleInfo.color}cc);">${initials}</div>
            <div class="vexoris-user-info">
                <span class="vexoris-user-name">${displayName}</span>
                <span class="vexoris-user-role" style="color: ${roleInfo.color};">${roleInfo.name}</span>
            </div>
        </a>
        <button onclick="window.vexorisLogout()" class="vexoris-logout-btn" title="تسجيل الخروج">
            <i class="fa-solid fa-power-off"></i>
        </button>
    `;

    loginBtn.replaceWith(wrapper);
}

// ============================================
// SESSION TIMEOUT
// ============================================
function initSessionTimeout() {
    let locked = false;
    let warningTimer = null;
    let lockTimer = null;
    let toastEl = null;

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

                showToast('تم فتح الجلسة بنجاح. يمكنك متابعة العمل.', {
                    bg: 'rgba(16, 185, 129, 0.15)',
                    fg: '#5eead4',
                    border: 'rgba(16, 185, 129, 0.3)',
                    icon: 'fa-circle-check'
                });

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

    function showToast(message, colors) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'vexoris-toast';
            document.body.appendChild(toastEl);
        }
        toastEl.style.background = colors.bg;
        toastEl.style.color = colors.fg;
        toastEl.style.border = `1px solid ${colors.border}`;
        toastEl.innerHTML = `<i class="fa-solid ${colors.icon}"></i> ${message}`;
        requestAnimationFrame(() => toastEl.classList.add('show'));
        setTimeout(() => toastEl.classList.remove('show'), 5000);
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
            showToast('ستُقفل الجلسة خلال دقيقتين لعدم النشاط', {
                bg: 'rgba(245, 158, 11, 0.15)',
                fg: '#fbbf24',
                border: 'rgba(245, 158, 11, 0.3)',
                icon: 'fa-triangle-exclamation'
            });
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
        replaceHomeWithDashboard(); // 🔥 استبدال "الرئيسية" بـ"لوحة التحكم"
        await initHeaderAuth();     // استبدال زر login بـ User Chip
        initSessionTimeout();       // تفعيل حماية الجلسة
    }
})();

export { initHeaderAuth, initSessionTimeout, replaceHomeWithDashboard };