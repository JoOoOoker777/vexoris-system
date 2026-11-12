/* ============================================
   VEXORIS — Mobile App Shell JS
   Auto-builds bottom nav, transforms tables, handles "More" sheet
   ============================================ */

(function () {
  'use strict';

  const MOBILE_BP = 768;
  const MAX_NAV_ITEMS = 4;

  function isMobile() { return window.innerWidth <= MOBILE_BP; }

  function resolvePath(file) {
    const p = window.location.pathname;
    if (p.includes('/apps/') || p.includes('/admin/')) return '../' + file;
    return './' + file;
  }

  /* ==========================================
     BOTTOM NAVIGATION
     ========================================== */
  function buildBottomNav() {
    if (document.getElementById('mobileBottomNav')) return;

    const tabsBar = document.querySelector('.tabs-bar');
    if (!tabsBar) return;

    const tabs = Array.from(tabsBar.querySelectorAll('.side-btn'))
      .filter(btn => btn.dataset.tab && btn.offsetParent !== null);

    if (tabs.length === 0) return;

    const nav = document.createElement('nav');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    nav.setAttribute('aria-label', 'التنقل الرئيسي');

    const hasMore = tabs.length > 5;
    const primaryTabs = hasMore ? tabs.slice(0, MAX_NAV_ITEMS) : tabs;

    primaryTabs.forEach(tab => {
      const item = document.createElement('button');
      item.className = 'mobile-nav-item';
      item.dataset.tab = tab.dataset.tab;
      const iconClass = tab.querySelector('i')?.className || 'fa-solid fa-circle';
      const label = tab.textContent.trim() || tab.dataset.tab;
      item.innerHTML = `<i class="${iconClass}"></i><span>${label}</span>`;
      item.addEventListener('click', () => activateTab(tab.dataset.tab));
      nav.appendChild(item);
    });

    if (hasMore) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'mobile-nav-item';
      moreBtn.dataset.tab = '__more__';
      moreBtn.innerHTML = '<i class="fa-solid fa-ellipsis"></i><span>المزيد</span>';
      moreBtn.addEventListener('click', openMoreSheet);
      nav.appendChild(moreBtn);
    }

    document.body.appendChild(nav);
    document.body.classList.add('has-bottom-nav');

    // Initial active state
    const activeTab = tabs.find(t => t.classList.contains('active'));
    if (activeTab) updateActiveNavItem(activeTab.dataset.tab);

    // Watch for active changes
    const observer = new MutationObserver(() => {
      const current = tabsBar.querySelector('.side-btn.active');
      if (current) updateActiveNavItem(current.dataset.tab);
    });
    observer.observe(tabsBar, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function activateTab(tabId) {
    if (tabId === '__more__') return;
    const original = document.querySelector(`.tabs-bar .side-btn[data-tab="${tabId}"]`);
    if (original) original.click();
    updateActiveNavItem(tabId);
  }

  function updateActiveNavItem(tabId) {
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });
  }

  /* ==========================================
     MORE BOTTOM SHEET
     ========================================== */
  let moreSheetEl = null;

  function openMoreSheet() {
    if (!moreSheetEl) {
      moreSheetEl = document.createElement('div');
      moreSheetEl.className = 'mobile-more-sheet';
      moreSheetEl.id = 'mobileMoreSheet';
      document.body.appendChild(moreSheetEl);
      moreSheetEl.addEventListener('click', (e) => {
        if (e.target === moreSheetEl) closeMoreSheet();
      });
    }

    const tabsBar = document.querySelector('.tabs-bar');
    const allTabs = Array.from(tabsBar?.querySelectorAll('.side-btn') || [])
      .filter(btn => btn.dataset.tab && btn.offsetParent !== null);

    // Read user info from existing DOM
    const userName = document.getElementById('navUserName')?.textContent || 'مستخدم';
    const userEmail = document.getElementById('dropdownEmail')?.textContent || '';
    const userRoleEl = document.getElementById('navUserRole');
    const userRole = userRoleEl?.textContent || '';
    const userRoleColor = userRoleEl?.style.color || 'var(--accent)';
    const avatarEl = document.getElementById('userAvatar');
    const avatarHTML = avatarEl?.innerHTML || '<i class="fa-solid fa-user"></i>';
    const avatarBg = avatarEl?.style.background || 'linear-gradient(135deg,#0ea5e9,#6366f1)';

    const tabsListHTML = allTabs.map(t => {
      const icon = t.querySelector('i')?.className || 'fa-solid fa-circle';
      const label = t.textContent.trim();
      const isActive = t.classList.contains('active');
      return `
        <button class="mobile-more-item ${isActive ? 'active' : ''}" data-more-tab="${t.dataset.tab}">
          <i class="${icon}"></i>
          <span>${label}</span>
        </button>
      `;
    }).join('');

    moreSheetEl.innerHTML = `
      <div class="mobile-more-panel" role="dialog" aria-modal="true" aria-label="القائمة">
        <div class="mobile-more-user">
          <div class="mobile-more-avatar" style="background:${avatarBg};">${avatarHTML}</div>
          <div style="flex:1;min-width:0;">
            <div class="mobile-more-name">${userName}</div>
            <div class="mobile-more-email">${userEmail}</div>
            ${userRole ? `<span class="mobile-more-role" style="color:${userRoleColor};">${userRole}</span>` : ''}
          </div>
        </div>

        <div class="mobile-more-section-title">التنقل</div>
        <div class="mobile-more-tab-list">${tabsListHTML}</div>

        <div class="mobile-more-divider"></div>

        <div class="mobile-more-section-title">الإعدادات</div>
        <div class="mobile-more-action-list">
          <button class="mobile-more-item" data-action="profile">
            <i class="fa-solid fa-user-pen"></i><span>الملف الشخصي</span>
          </button>
          <button class="mobile-more-item" data-action="password">
            <i class="fa-solid fa-key"></i><span>تغيير كلمة المرور</span>
          </button>
          <button class="mobile-more-item" data-action="dashboard">
            <i class="fa-solid fa-house"></i><span>لوحة التحكم</span>
          </button>
        </div>

        <div class="mobile-more-divider"></div>

        <button class="mobile-more-item danger" data-action="logout">
          <i class="fa-solid fa-power-off"></i><span>تسجيل الخروج</span>
        </button>
      </div>
    `;

    // Wire events
    moreSheetEl.querySelectorAll('[data-more-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activateTab(btn.dataset.moreTab);
        closeMoreSheet();
      });
    });

    moreSheetEl.querySelector('[data-action="profile"]')?.addEventListener('click', () => {
      closeMoreSheet();
      if (typeof window.showProfile === 'function') window.showProfile();
    });
    moreSheetEl.querySelector('[data-action="password"]')?.addEventListener('click', () => {
      closeMoreSheet();
      if (typeof window.showChangePassword === 'function') window.showChangePassword();
    });
    moreSheetEl.querySelector('[data-action="dashboard"]')?.addEventListener('click', () => {
      closeMoreSheet();
      window.location.href = resolvePath('dashboard.html');
    });
    moreSheetEl.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
      closeMoreSheet();
      if (typeof window.logout === 'function') window.logout();
      else if (typeof window.vexorisLogout === 'function') window.vexorisLogout();
    });

    requestAnimationFrame(() => {
      moreSheetEl.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }

  function closeMoreSheet() {
    if (!moreSheetEl) return;
    moreSheetEl.classList.remove('open');
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
     INIT
     ========================================== */
  function init() {
    if (!isMobile()) return;
    buildBottomNav();
    enhanceTables();

    // Re-enhance tables when new tabs activate
    const observer = new MutationObserver(() => enhanceTables());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isMobile() && !document.getElementById('mobileBottomNav')) init();
    }, 250);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150));
  } else {
    setTimeout(init, 150);
  }
})();