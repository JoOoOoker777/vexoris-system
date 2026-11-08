// loading-logo.js — VEXORIS Lottie Loader
// يستبدل أي .loading-screen أو #loadingScreen بمشغل Lottie
(function () {
    'use strict';
    if (window.__vexorisLoaderLoaded) return;
    window.__vexorisLoaderLoaded = true;

    // اكتشاف مسار ملف Lottie بناءً على مكان الـ script نفسه
    function getLoaderPath() {
        const scripts = document.getElementsByTagName('script');
        for (let s of scripts) {
            if (s.src && s.src.includes('loading-logo.js')) {
                return s.src.replace('loading-logo.js', 'assets/loader.json');
            }
        }
        return '/assets/loader.json';
    }

    function replaceLoadingScreens() {
        const screens = document.querySelectorAll('.loading-screen, #loadingScreen');
        screens.forEach(screen => {
            if (screen.dataset.vexReplaced) return;
            screen.dataset.vexReplaced = '1';

            const existingTextEl = screen.querySelector('#loadingText');
            const existingText = existingTextEl
                ? existingTextEl.textContent.trim()
                : 'جاري التحميل...';

            screen.innerHTML = `
                <div class="vex-loader-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
                    <div id="vex-lottie-player" style="width:140px;height:140px;"></div>
                    <p id="loadingText" style="
                        font-family:'Tajawal',sans-serif;
                        font-size:0.78rem;
                        font-weight:700;
                        color:var(--text-secondary,#94a3b8);
                        margin:0;
                        letter-spacing:0.02em;
                    ">${existingText}</p>
                </div>
            `;

            const player = screen.querySelector('#vex-lottie-player');

            if (window.lottie && player) {
                try {
                    window.lottie.loadAnimation({
                        container: player,
                        renderer: 'svg',
                        loop: true,
                        autoplay: true,
                        path: getLoaderPath()
                    });
                } catch (e) {
                    console.warn('[VEXORIS Loader] Lottie error:', e);
                    fallback(player);
                }
            } else {
                console.warn('[VEXORIS Loader] lottie library not loaded');
                fallback(player);
            }
        });
    }

    function fallback(container) {
        if (!container) return;
        container.innerHTML =
            '<i class="fa-solid fa-circle-notch fa-spin" ' +
            'style="font-size:2.6rem;color:#0ea5e9;display:block;text-align:center;line-height:140px;"></i>';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceLoadingScreens);
    } else {
        replaceLoadingScreens();
    }

    window.vexorisLoaderRefresh = function () {
        document.querySelectorAll('.loading-screen, #loadingScreen').forEach(s => {
            delete s.dataset.vexReplaced;
        });
        replaceLoadingScreens();
    };
})();