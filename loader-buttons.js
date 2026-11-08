/* ═══════════════════════════════════════════════════════════════
   VEXORIS Loader Extras v1 — Button / Inline / Section
   Companion to loading-logo.js (v3)
   - Auto-replaces .fa-circle-notch / .fa-spinner with VEXORIS brand
   - Provides VexorisBtnLoader.start(btn, text) / .end(btn) API
   - Never touches spinners inside .loading-screen (v3 handles them)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ASSET_BASE = '/assets/loader.json';
  const SPINNER_SELECTORS = [
    'i.fa-circle-notch.fa-spin',
    'i.fa-spinner.fa-spin',
    'i.fa-arrows-rotate.fa-spin',
    'i.fa-sync.fa-spin',
    'i.fa-rotate.fa-spin',
    'i.fa-rotate-right.fa-spin'
  ].join(',');

  // ── 1. Inject CSS ──────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vx-loader-extras-styles')) return;
    const s = document.createElement('style');
    s.id = 'vx-loader-extras-styles';
    s.textContent = `
      .vx-btn-spinner {
        display: inline-block;
        width: 16px; height: 16px;
        vertical-align: middle;
        border-radius: 50%;
        background: conic-gradient(from 0deg, #0ea5e9 0%, #6366f1 50%, #8b5cf6 75%, transparent 100%);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
        mask: radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px));
        animation: vxBtnSpin 0.85s linear infinite;
        flex-shrink: 0;
      }
      .vx-btn-spinner.lg { width: 22px; height: 22px; }
      @keyframes vxBtnSpin { to { transform: rotate(360deg); } }

      .vx-section-loader {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 120px; height: 42px;
        vertical-align: middle;
      }
      .vx-section-loader svg {
        width: 100% !important;
        height: 100% !important;
      }
    `;
    document.head.appendChild(s);
  }

  // ── 2. Section lottie builder ──────────────────────────
  function buildSectionLottie() {
    const wrap = document.createElement('div');
    wrap.className = 'vx-section-loader';
    wrap.setAttribute('aria-label', 'loading');
    if (!window.lottie) return wrap;

    fetch(ASSET_BASE)
      .then(r => (r.ok ? r.json() : Promise.reject('loader.json 404')))
      .then(data => {
        window.lottie.loadAnimation({
          container: wrap,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: data,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' }
        });
        setTimeout(() => {
          const svg = wrap.querySelector('svg');
          if (svg) svg.setAttribute('viewBox', '180 210 440 140');
        }, 60);
      })
      .catch(err => console.warn('[VexorisLoader] section lottie failed:', err));

    return wrap;
  }

  // ── 3. Replace a single spinner icon ───────────────────
  function replaceSpinner(iconEl) {
    if (!iconEl || iconEl.dataset.vxReplaced) return;
    if (iconEl.closest('.loading-screen') || iconEl.closest('#loadingScreen')) return;
    if (iconEl.closest('.vx-section-loader') || iconEl.closest('.vx-btn-spinner')) return;

    iconEl.dataset.vxReplaced = '1';

    const cs = getComputedStyle(iconEl);
    const fontPx = parseFloat(cs.fontSize) || 16;
    const isLarge = fontPx >= 24;

    let replacement;
    if (isLarge) {
      replacement = buildSectionLottie();
    } else {
      replacement = document.createElement('span');
      replacement.className = 'vx-btn-spinner' + (fontPx >= 18 ? ' lg' : '');
      replacement.setAttribute('aria-label', 'loading');
    }
    iconEl.replaceWith(replacement);
  }

  // ── 4. Scan & observe ──────────────────────────────────
  function scan() {
    document.querySelectorAll(SPINNER_SELECTORS).forEach(replaceSpinner);
  }

  function initObserver() {
    const mo = new MutationObserver(mutations => {
      let needsScan = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) { needsScan = true; break; }
          }
        }
        if (needsScan) break;
      }
      if (needsScan) scan();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ── 5. Public API ──────────────────────────────────────
  window.VexorisBtnLoader = {
    start(btn, text) {
      if (!btn) return;
      if (!btn.dataset.vxOrigHtml) btn.dataset.vxOrigHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.gap = '8px';

      const ring = document.createElement('span');
      ring.className = 'vx-btn-spinner';
      btn.appendChild(ring);

      if (text) {
        const t = document.createElement('span');
        t.textContent = text;
        btn.appendChild(t);
      }
    },
    end(btn) {
      if (!btn) return;
      if (btn.dataset.vxOrigHtml) {
        btn.innerHTML = btn.dataset.vxOrigHtml;
        delete btn.dataset.vxOrigHtml;
      }
      btn.disabled = false;
    },
    scan
  };

  // ── 6. Boot ────────────────────────────────────────────
  function boot() {
    injectStyles();
    scan();
    initObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();