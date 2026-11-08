// loading-logo.js — VEXORIS Lottie Loader (v2 — Cleaned + Cropped)
(function () {
    'use strict';
    if (window.__vexorisLoaderLoaded) return;
    window.__vexorisLoaderLoaded = true;

    function getLoaderPath() {
        const scripts = document.getElementsByTagName('script');
        for (let s of scripts) {
            if (s.src && s.src.includes('loading-logo.js')) {
                return s.src.replace('loading-logo.js', 'assets/loader.json');
            }
        }
        return '/assets/loader.json';
    }

    // يمسح الخلفيات المدمجة (مستطيلات مغطية الكانفس)
    function stripBackgroundLayers(data) {
        if (!data.layers) return data;
        data.layers = data.layers.filter(layer => {
            if (layer.ty !== 4 || !layer.shapes) return true;
            for (const shape of layer.shapes) {
                if (shape.ty === 'rc' && shape.s && shape.s.a === 0) {
                    const size = shape.s.k;
                    if (Array.isArray(size) &&
                        size[0] >= data.w * 0.85 &&
                        size[1] >= data.h * 0.85) {
                        return false; // دي خلفية — استبعدها
                    }
                }
            }
            return true;
        });
        return data;
    }

    async function loadCleanLottie(container) {
        try {
            const res = await fetch(getLoaderPath());
            if (!res.ok) throw new Error('Failed to fetch loader.json: ' + res.status);
            let data = await res.json();

            data = stripBackgroundLayers(data);

            const anim = window.lottie.loadAnimation({
                container,
                renderer: 'svg',
                loop: true,
                autoplay: true,
                animationData: data,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid slice',
                    progressiveLoad: true
                }
            });

            // قص viewBox على المحتوى الفعلي (VEXORIS في نص الكانفس)
            anim.addEventListener('DOMLoaded', () => {
                const svg = container.querySelector('svg');
                if (svg) {
                    svg.setAttribute('viewBox', '180 210 440 140');
                    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    svg.style.width = '100%';
                    svg.style.height = '100%';
                    svg.style.display = 'block';
                }
            });

        } catch (e) {
            console.error('[VEXORIS Loader] Lottie failed:', e);
            fallback(container);
        }
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
                <div class="vex-loader-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;">
                    <div id="vex-lottie-player" style="width:260px;height:100px;"></div>
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
                loadCleanLottie(player);
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
            'style="font-size:2.6rem;color:#0ea5e9;display:block;text-align:center;line-height:100px;"></i>';
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