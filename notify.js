// notify.js - نظام الرسائل التنبيهية المركزي لهوية VEXORIS

(function() {
    const style = document.createElement('style');
    style.textContent = `
        .vexoris-toast-container {
            position: fixed;
            top: 24px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        }

        .vexoris-toast {
            pointer-events: auto;
            min-width: 320px;
            max-width: 90vw;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 14px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4);
            transform: translateY(-20px) scale(0.95);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
            font-family: 'Tajawal', sans-serif;
        }
        
        html:not(.dark) .vexoris-toast {
            background: rgba(255, 255, 255, 0.9);
            border-color: rgba(148, 163, 184, 0.3);
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
        }

        .vexoris-toast.show {
            transform: translateY(0) scale(1);
            opacity: 1;
        }

        .vexoris-toast::before {
            content: '';
            position: absolute;
            top: 0; right: 0; left: 0;
            height: 3px;
            background: var(--toast-color);
        }

        .vexoris-toast-icon {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1rem;
            color: var(--toast-color);
            background: var(--toast-bg);
            border: 1px solid var(--toast-border);
            flex-shrink: 0;
        }

        .vexoris-toast-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .vexoris-toast-title {
            font-size: 0.85rem;
            font-weight: 900;
            color: #f1f5f9;
            line-height: 1.2;
        }
        html:not(.dark) .vexoris-toast-title { color: #0f172a; }

        .vexoris-toast-message {
            font-size: 0.78rem;
            font-weight: 600;
            color: #94a3b8;
            line-height: 1.4;
        }
        html:not(.dark) .vexoris-toast-message { color: #475569; }

        .vexoris-toast-progress {
            position: absolute;
            bottom: 0;
            right: 0;
            height: 3px;
            background: var(--toast-color);
            width: 100%;
            animation: vexoris-toast-progress-anim var(--toast-duration) linear forwards;
            opacity: 0.6;
        }

        @keyframes vexoris-toast-progress-anim {
            to { width: 0%; }
        }

        .vexoris-toast.success { --toast-color: #10b981; --toast-bg: rgba(16, 185, 129, 0.1); --toast-border: rgba(16, 185, 129, 0.3); }
        .vexoris-toast.error { --toast-color: #ef4444; --toast-bg: rgba(239, 68, 68, 0.1); --toast-border: rgba(239, 68, 68, 0.3); }
        .vexoris-toast.warning { --toast-color: #f59e0b; --toast-bg: rgba(245, 158, 11, 0.1); --toast-border: rgba(245, 158, 11, 0.3); }
        .vexoris-toast.info { --toast-color: #0ea5e9; --toast-bg: rgba(14, 165, 233, 0.1); --toast-border: rgba(14, 165, 233, 0.3); }
    `;
    document.head.appendChild(style);

    let container = document.querySelector('.vexoris-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'vexoris-toast-container';
        document.body.appendChild(container);
    }

    window.showNotification = function(message, type = 'info', title = '', duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `vexoris-toast ${type}`;
        toast.style.setProperty('--toast-duration', `${duration}ms`);

        let icon = 'fa-circle-info';
        let defaultTitle = 'معلومة';
        
        if (type === 'success') { icon = 'fa-circle-check'; defaultTitle = 'تم بنجاح'; } 
        else if (type === 'error') { icon = 'fa-circle-xmark'; defaultTitle = 'حدث خطأ'; } 
        else if (type === 'warning') { icon = 'fa-triangle-exclamation'; defaultTitle = 'تنبيه'; }

        toast.innerHTML = `
            <div class="vexoris-toast-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="vexoris-toast-content">
                <div class="vexoris-toast-title">${title || defaultTitle}</div>
                <div class="vexoris-toast-message">${message}</div>
            </div>
            <div class="vexoris-toast-progress"></div>
        `;

        container.appendChild(toast);

        requestAnimationFrame(() => {
            setTimeout(() => toast.classList.add('show'), 10);
        });

        const timeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, duration);

        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        });
    };
})();