// loading-logo.js — VEXORIS Lottie Loader (v3 — Theme-Aware Colors)
(function () {
    'use strict';
    if (window.__vexorisLoaderLoaded) return;
    window.__vexorisLoaderLoaded = true;

    let currentAnim = null;
    let currentContainer = null;
    let cachedLottieData = null;

    function getLoaderPath() {
        const scripts = document.getElementsByTagName('script');
        for (let s of scripts) {
            if (s.src && s.src.includes('loading-logo.js')) {
                return s.src.replace('loading-logo.js', 'assets/loader.json');
            }
        }
        return '/assets/loader.json';
    }

    // يشيل الخلفيات المدمجة اللي مغطية الكانفس
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
                        return false;
                    }
                }
            }
            return true;
        });
        return data;
    }

    // يعكس الألوان للوضع الليلي
    function recolorForDark(data) {
        const cloned = JSON.parse(JSON.stringify(data));

        function near(c, r, g, b, tol) {
            return c && c.length >= 3 &&
                   Math.abs(c[0] - r) < tol &&
                   Math.abs(c[1] - g) < tol &&
                   Math.abs(c[2] - b) < tol;
        }

        function swapColor(c) {
            // حروف VEXORIS الغامقة → أبيض بمسحة أزرق
            if (near(c, 0.133, 0.157, 0.192, 0.02)) {
                return [0.94, 0.97, 1, 1];
            }
            // المؤشر الخامل (رمادي) → رمادي فاتح
            if (near(c, 0.549, 0.592, 0.631, 0.05)) {
                return [0.78, 0.85, 0.92, 1];
            }
            // المؤشر النشط (أحمر) → أحمر أوضح
            if (near(c, 0.941, 0.329, 0.329, 0.05)) {
                return [1, 0.45, 0.45, 1];
            }
            return c;
        }

        function recolorValue(k, animated) {
            if (!k) return k;
            if (animated && Array.isArray(k)) {
                for (const frame of k) {
                    if (frame && frame.s) {
                        const swapped = swapColor(frame.s);
                        if (swapped !== frame.s) frame.s = swapped;
                    }
                }
            } else if (!animated && Array.isArray(k)) {
                return swapColor(k);
            }
            return k;
        }

        function walkShapes(shapes) {
            if (!shapes) return;
            for (const shape of shapes) {
                if (shape.ty === 'fl' && shape.c) {
                    if (shape.c.a === 0) {
                        shape.c.k = recolorValue(shape.c.k, false);
                    } else if (shape.c.a === 1) {
                        recolorValue(shape.c.k, true);
                    }
                }
                if (shape.it) walkShapes(shape.it);
            }
        }

        function walkLayers(layers) {
            if (!layers) return;
            for (const layer of layers) {
                if (layer.shapes) walkShapes(layer.shapes);
            }
        }

        walkLayers(cloned.layers);
        if (cloned.assets) {
            for (const asset of cloned.assets) {
                walkLayers(asset.layers);
            }
        }

        return cloned;
    }

    async function renderLottie(container) {
        if (!container || !container.isConnected) return;

        try {
            if (!cachedLottieData) {
                const res = await fetch(getLoaderPath());
                if (!res.ok) throw new Error('HTTP ' + res.status);
                let raw = await res.json();
                cachedLottieData = stripBackgroundLayers(raw);
            }

            if (currentAnim) {
                try { currentAnim.destroy(); } catch (e) {}
                currentAnim = null;
            }

            container.innerHTML = '';

            const isDark = document.documentElement.classList.contains('dark');
            const data = isDark ? recolorForDark(cachedLottieData) : cachedLottieData;

            currentContainer = container;
            currentAnim = window.lottie.loadAnimation({
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

            currentAnim.addEventListener('DOMLoaded', () => {
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

    function fallback(container) {
        if (!container) return;
        container.innerHTML =
            '<i class="fa-solid fa-circle-notch fa-spin" ' +
            'style="font-size:2.6rem;color:#0ea5e9;display:block;text-align:center;line-height:100px;"></i>';
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
                renderLottie(player);
            } else {
                console.warn('[VEXORIS Loader] lottie library not loaded');
                fallback(player);
            }
        });
    }

    // 🔥 يستمع لتغيير الثيم ويعيد الرسم تلقائياً
    try {
        const themeObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (currentContainer && currentContainer.isConnected && currentAnim) {
                        renderLottie(currentContainer);
                    }
                    break;
                }
            }
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    } catch (e) {
        console.warn('[VEXORIS Loader] theme observer failed:', e);
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