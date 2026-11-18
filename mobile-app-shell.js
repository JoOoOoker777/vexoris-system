/* ============================================
   VEXORIS — Mobile App Shell v3
   Header Menu pattern · No bottom nav
   ============================================ */

(function () {
  'use strict';

  const MOBILE_BP = 768;
  let initialized = false;
  let sheetEl = null;
  let cachedUser = null;

  function isMobile() { return window.innerWidth <= MOBILE_BP; }

  function resolvePath(file) {
    const p = window.location.pathname;
    if (p.includes('/apps/') || p.includes('/admin/')) return '../' + file;
    return './' + file;
  }

  /* ==========================================
     WAIT FOR AUTH DATA
     ========================================== */
  function waitForAuthData(maxWait = 6000) {
    return new Promise(resolve => {
      const nameEl = document.getElementById('navUserName');
      if (!nameEl) { resolve(); return; }

      const isReady = () => {
        const v = nameEl.textContent?.trim();
        return v && v !== '...';
      };

      if (isReady()) { resolve(); return; }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      };

      const observer = new MutationObserver(() => {
        if (isReady()) finish();
      });
      observer.observe(nameEl, { childList: true, characterData: true, subtree: true });

      const timer = setTimeout(finish, maxWait);
    });
  }

  /* ==========================================
     READ USER FROM DOM
     ========================================== */
  function readUserFromDOM() {
    const nameRaw = document.getElementById('navUserName')?.textContent?.trim() || '';
    const emailRaw = document.getElementById('dropdownEmail')?.textContent?.trim() || '';
    const roleRaw = document.getElementById('navUserRole')?.textContent?.trim() || '';
    const roleColor = document.getElementById('navUserRole')?.style.color || '';
    const avatarEl = document.getElementById('userAvatar');
    const avatarHTML = avatarEl?.innerHTML || '<i class="fa-solid fa-user"></i>';
    const avatarBg = avatarEl?.style.background || 'linear-gradient(135deg,#0ea5e9,#6366f1)';

    const isLoading = !nameRaw || nameRaw === '...';
    const displayName = nameRaw && nameRaw !== '...' ? nameRaw : (isLoading ? 'جاري التحميل...' : 'مستخدم');

    return {
      name: displayName,
      email: emailRaw || '',
      role: roleRaw || '',
      roleColor: roleColor || 'var(--accent)',
      avatarHTML,
      avatarBg,
      isLoading,
    };
  }

  /* ==========================================
     INJECT MENU BUTTON INTO HEADER
     ========================================== */
  function injectMenuButton() {
    if (document.getElementById('vexMobMenuBtn')) return;

    const actionsDiv = document.querySelector('.nav-inner > div:last-child');
    if (!actionsDiv) {
      console.warn('[VEX-MOB] Header actions container not found');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'vexMobMenuBtn';
    btn.className = 'vex-mob-menu-btn';
    btn.setAttribute('aria-label', 'القائمة');
    btn.setAttribute('title', 'القائمة');
    btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    btn.addEventListener('click', openSheet);

    actionsDiv.appendChild(btn);
  }

  /* ==========================================
     BUILD MENU SHEET
     ========================================== */
  function buildSheet() {
    if (sheetEl) return sheetEl;

    sheetEl = document.createElement('div');
    sheetEl.className = 'vex-mob-sheet';
    sheetEl.id = 'vexMobSheet';
    document.body.appendChild(sheetEl);

    // Close on backdrop click
    sheetEl.addEventListener('click', (e) => {
      if (e.target === sheetEl) closeSheet();
    });

    return sheetEl;
  }

  function renderSheetContent() {
    if (!sheetEl) return;

    const user = cachedUser || readUserFromDOM();
    const userName = user.name;
    const userEmail = user.email;
    const userRole = user.role;
    const userRoleColor = user.roleColor;
    const avatarHTML = user.avatarHTML;
    const avatarBg = user.avatarBg;

    // Read tabs from tabs-bar
    const tabsBar = document.querySelector('.tabs-bar');
    const tabs = tabsBar
      ? Array.from(tabsBar.querySelectorAll('.side-btn')).filter(btn => btn.dataset.tab && btn.offsetParent !== null)
      : [];

    const tabsHTML = tabs.map(t => {
      const icon = t.querySelector('i')?.className || 'fa-solid fa-circle';
      const label = t.textContent.trim();
      const isActive = t.classList.contains('active');
      return `
        <button class="vex-mob-item ${isActive ? 'active' : ''}" data-mob-tab="${t.dataset.tab}">
          <i class="${icon}"></i>
          <span>${label}</span>
          ${isActive ? '<i class="fa-solid fa-check vex-mob-arrow" style="color:var(--accent);"></i>' : ''}
        </button>
      `;
    }).join('');

    sheetEl.innerHTML = `
      <div class="vex-mob-panel" role="dialog" aria-modal="true" aria-label="القائمة">

        <div class="vex-mob-user">
          <div class="vex-mob-avatar" style="background:${avatarBg};">
            ${avatarHTML}
          </div>
          <div class="vex-mob-user-info">
            <div class="vex-mob-name">${userName}</div>
            <div class="vex-mob-email">${userEmail}</div>
            ${userRole ? `<span class="vex-mob-role" style="color:${userRoleColor};">${userRole}</span>` : ''}
          </div>
        </div>

        ${tabs.length > 0 ? `
          <div class="vex-mob-section-title">التنقل</div>
          <div class="vex-mob-list">${tabsHTML}</div>
          <div class="vex-mob-divider"></div>
        ` : ''}

        <div class="vex-mob-section-title">الحساب</div>
        <div class="vex-mob-list">
          <button class="vex-mob-item" data-mob-action="profile">
            <i class="fa-solid fa-user-pen"></i>
            <span>الملف الشخصي</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="password">
            <i class="fa-solid fa-key"></i>
            <span>تغيير كلمة المرور</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="sessions">
            <i class="fa-solid fa-desktop"></i>
            <span>الجلسات النشطة</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="theme">
            <i class="fa-solid fa-moon"></i>
            <span>تبديل الثيم</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
        </div>

        <div class="vex-mob-divider"></div>

        <div class="vex-mob-section-title">النظام</div>
        <div class="vex-mob-list">
          <button class="vex-mob-item" data-mob-action="dashboard">
            <i class="fa-solid fa-house"></i>
            <span>لوحة التحكم</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="about">
            <i class="fa-solid fa-circle-info"></i>
            <span>عن النظام</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="security">
            <i class="fa-solid fa-shield-halved"></i>
            <span>درع VEXORIS</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="courses">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>دورات تدريبية</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
          <button class="vex-mob-item" data-mob-action="feedback">
            <i class="fa-solid fa-comment-dots"></i>
            <span>رأيك يهمنا</span>
            <i class="fa-solid fa-chevron-left vex-mob-arrow"></i>
          </button>
        </div>

        <div class="vex-mob-divider"></div>

        <button class="vex-mob-item danger" data-mob-action="logout">
          <i class="fa-solid fa-power-off"></i>
          <span>تسجيل الخروج</span>
        </button>

      </div>
    `;

    wireSheetEvents();
  }

  /* ==========================================
     WIRE EVENTS
     ========================================== */
  function wireSheetEvents() {
    if (!sheetEl) return;

    // Tab clicks
    sheetEl.querySelectorAll('[data-mob-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.mobTab;
        closeSheet();
        // Try direct click first
        const originalTab = document.querySelector(`.tabs-bar .side-btn[data-tab="${tabId}"]`);
        if (originalTab) {
          originalTab.click();
        } else if (typeof window.switchTab === 'function') {
          window.switchTab(tabId);
        }
      });
    });

    // Action clicks
    sheetEl.querySelectorAll('[data-mob-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.mobAction;
        handleAction(action);
      });
    });
  }

  function handleAction(action) {
    switch (action) {
      case 'profile':
        closeSheet();
        setTimeout(() => {
          if (typeof window.showProfile === 'function') window.showProfile();
          else window.location.href = resolvePath('profile.html');
        }, 200);
        break;
      case 'password':
        closeSheet();
        setTimeout(() => {
          if (typeof window.showChangePassword === 'function') window.showChangePassword();
          else window.location.href = resolvePath('change-password.html');
        }, 200);
        break;
      case 'sessions':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('sessions.html'); }, 200);
        break;
      case 'theme':
        if (typeof window.toggleTheme === 'function') window.toggleTheme();
        // Keep sheet open so user sees the change
        break;
      case 'dashboard':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('dashboard.html'); }, 200);
        break;
      case 'about':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('about.html'); }, 200);
        break;
      case 'security':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('security.html'); }, 200);
        break;
      case 'courses':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('courses.html'); }, 200);
        break;
      case 'feedback':
        closeSheet();
        setTimeout(() => { window.location.href = resolvePath('feedback.html'); }, 200);
        break;
      case 'logout':
        closeSheet();
        setTimeout(() => {
          if (typeof window.logout === 'function') window.logout();
          else if (typeof window.vexorisLogout === 'function') window.vexorisLogout();
        }, 200);
        break;
    }
  }

  /* ==========================================
     OPEN / CLOSE SHEET
     ========================================== */
  function openSheet() {
    buildSheet();
    cachedUser = readUserFromDOM(); // fresh read every open
    renderSheetContent();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      sheetEl.classList.add('open');
    });

    // If auth data still loading, retry once after it arrives
    if (cachedUser.isLoading) {
      setTimeout(() => {
        const fresh = readUserFromDOM();
        if (!fresh.isLoading && sheetEl?.classList.contains('open')) {
          cachedUser = fresh;
          renderSheetContent();
        }
      }, 800);
    }
  }

  function closeSheet() {
    if (!sheetEl) return;
    sheetEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ==========================================
     TABLES → CARDS
     ========================================== */
  function enhanceTables() {
    document.querySelectorAll('table.data-table').forEach(table => {
      if (table.dataset.mobileEnhanced) return;
      table.dataset.mobileEnhanced = '1';

      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      if (!headers.length) return;

      table.querySelectorAll('tbody tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, i) => {
          if (!cell.hasAttribute('data-label') && headers[i]) {
            cell.setAttribute('data-label', headers[i]);
          }
        });
      });

      table.classList.add('mobile-converted');
    });
  }

  /* ==========================================
     WIRE USER CHIP TO MENU
     ========================================== */
  function wireUserChipToMenu() {
    const chip = document.getElementById('userChip');
    if (!chip || chip.dataset.mobMenuWired) return;
    chip.dataset.mobMenuWired = '1';

    // Use capture phase to fire before session-manager's bubble listener
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSheet();
    }, true);
  }

  /* ==========================================
     INIT
     ========================================== */
  async function init() {
    if (!isMobile() || initialized) return;
    initialized = true;

    injectMenuButton();
    wireUserChipToMenu();
    buildSheet();
    enhanceTables();

    await waitForAuthData();
    cachedUser = readUserFromDOM();

    // Watch for new tables (tab switching)
    const observer = new MutationObserver(() => enhanceTables());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Re-init on resize back to mobile
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isMobile() && !initialized) {
        init();
      } else if (isMobile() && !document.getElementById('vexMobMenuBtn')) {
        initialized = false;
        init();
      }
    }, 300);
  });

  // Escape key closes sheet
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 200));
  } else {
    setTimeout(init, 200);
  }
})();