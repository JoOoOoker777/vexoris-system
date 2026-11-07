// notify.js - نظام الإشعارات ونوافذ التأكيد المركزي

(function() {
    const style = document.createElement('style');
    style.textContent = `
        /* ============ TOASTS ============ */
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
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px) saturate(180%);
            -webkit-backdrop-filter: blur(16px) saturate(180%);
            border: 1px solid rgba(148, 163, 184, 0.3);
            border-radius: 14px;
            padding: 16px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.6);
            transform: translateY(-20px) scale(0.95);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
            font-family: 'Tajawal', sans-serif;
        }
        
        /* تحسين الوضع النهاري للإشعارات */
        html:not(.dark) .vexoris-toast {
            background: #ffffff;
            border-color: rgba(148, 163, 184, 0.4);
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.15);
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
            font-size: 0.8rem;
            font-weight: 700;
            color: #cbd5e1;
            line-height: 1.4;
        }
        html:not(.dark) .vexoris-toast-message { color: #334155; }

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

        /* ألوان الوضع الليلي */
        .vexoris-toast.success { --toast-color: #10b981; --toast-bg: rgba(16, 185, 129, 0.1); --toast-border: rgba(16, 185, 129, 0.3); }
        .vexoris-toast.error { --toast-color: #ef4444; --toast-bg: rgba(239, 68, 68, 0.1); --toast-border: rgba(239, 68, 68, 0.3); }
        .vexoris-toast.warning { --toast-color: #f59e0b; --toast-bg: rgba(245, 158, 11, 0.1); --toast-border: rgba(245, 158, 11, 0.3); }
        .vexoris-toast.info { --toast-color: #0ea5e9; --toast-bg: rgba(14, 165, 233, 0.1); --toast-border: rgba(14, 165, 233, 0.3); }

        /* ألوان الوضع النهاري (أغمق وأوضح) */
        html:not(.dark) .vexoris-toast.success { --toast-bg: rgba(16, 185, 129, 0.15); --toast-border: #10b981; }
        html:not(.dark) .vexoris-toast.error { --toast-bg: rgba(239, 68, 68, 0.15); --toast-border: #ef4444; }
        html:not(.dark) .vexoris-toast.warning { --toast-bg: rgba(245, 158, 11, 0.15); --toast-border: #f59e0b; }
        html:not(.dark) .vexoris-toast.info { --toast-bg: rgba(14, 165, 233, 0.15); --toast-border: #0ea5e9; }

        /* ============ CONFIRM DIALOG ============ */
        .vexoris-confirm-overlay {
            position: fixed; inset: 0; z-index: 999998;
            background: rgba(4, 7, 15, 0.7);
            backdrop-filter: blur(12px) saturate(180%);
            -webkit-backdrop-filter: blur(12px) saturate(180%);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
            opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease;
        }
        .vexoris-confirm-overlay.show { opacity: 1; pointer-events: auto; }

        .vexoris-confirm-box {
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 20px;
            width: 100%; max-width: 400px;
            padding: 32px 28px;
            text-align: center;
            box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6);
            transform: scale(0.9);
            transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative; overflow: hidden;
            font-family: 'Tajawal', sans-serif;
        }
        html:not(.dark) .vexoris-confirm-box {
            background: #ffffff;
            border-color: rgba(148, 163, 184, 0.3);
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.15);
        }
        .vexoris-confirm-overlay.show .vexoris-confirm-box { transform: scale(1); }

        .vexoris-confirm-box::before {
            content: ''; position: absolute; top: 0; right: 0; left: 0; height: 3px;
            background: var(--confirm-color, #0ea5e9);
        }

        .vexoris-confirm-icon {
            width: 60px; height: 60px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 20px; font-size: 1.8rem;
            color: var(--confirm-color, #0ea5e9);
            background: var(--confirm-bg, rgba(14, 165, 233, 0.1));
            border: 1px solid var(--confirm-border, rgba(14, 165, 233, 0.3));
        }

        .vexoris-confirm-title {
            font-size: 1.2rem; font-weight: 900;
            color: #f1f5f9; margin-bottom: 10px;
        }
        html:not(.dark) .vexoris-confirm-title { color: #0f172a; }

        .vexoris-confirm-message {
            font-size: 0.85rem; font-weight: 600;
            color: #94a3b8; line-height: 1.6;
            margin-bottom: 24px;
        }
        html:not(.dark) .vexoris-confirm-message { color: #475569; }

        .vexoris-confirm-actions {
            display: flex; gap: 10px;
        }

        .vexoris-confirm-btn {
            flex: 1; padding: 12px; border-radius: 11px;
            font-family: inherit; font-weight: 800; font-size: 0.85rem;
            cursor: pointer; transition: all 0.3s ease; border: none;
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        
        .vexoris-confirm-btn.cancel {
            background: transparent; border: 1px solid rgba(148, 163, 184, 0.3);
            color: #94a3b8;
        }
        html:not(.dark) .vexoris-confirm-btn.cancel { color: #475569; border-color: rgba(148, 163, 184, 0.5); }
        .vexoris-confirm-btn.cancel:hover { background: rgba(148, 163, 184, 0.1); }

        .vexoris-confirm-btn.confirm {
            background: var(--confirm-color, #0ea5e9);
            color: #fff;
            box-shadow: 0 6px 18px -6px var(--confirm-color, #0ea5e9);
        }
        .vexoris-confirm-btn.confirm:hover { transform: translateY(-1px); filter: brightness(1.1); }

        /* Danger modifiers */
        .vexoris-confirm-danger {
            --confirm-color: #ef4444;
            --confirm-bg: rgba(239, 68, 68, 0.1);
            --confirm-border: rgba(239, 68, 68, 0.3);
        }
        .vexoris-confirm-warning {
            --confirm-color: #f59e0b;
            --confirm-bg: rgba(245, 158, 11, 0.1);
            --confirm-border: rgba(245, 158, 11, 0.3);
        }
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

    window.showConfirm = function(options) {
        return new Promise((resolve) => {
            const { 
                title = 'هل أنت متأكد؟', 
                message = 'لا يمكن التراجع عن هذا الإجراء.', 
                confirmText = 'تأكيد', 
                cancelText = 'إلغاء',
                type = 'primary'
            } = options;

            const overlay = document.createElement('div');
            overlay.className = 'vexoris-confirm-overlay';
            
            let iconClass = 'fa-circle-question';
            let typeClass = '';
            
            if (type === 'danger') { iconClass = 'fa-triangle-exclamation'; typeClass = 'vexoris-confirm-danger'; }
            else if (type === 'warning') { iconClass = 'fa-circle-exclamation'; typeClass = 'vexoris-confirm-warning'; }

            overlay.innerHTML = `
                <div class="vexoris-confirm-box ${typeClass}">
                    <div class="vexoris-confirm-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="vexoris-confirm-title">${title}</div>
                    <div class="vexoris-confirm-message">${message}</div>
                    <div class="vexoris-confirm-actions">
                        <button class="vexoris-confirm-btn cancel">${cancelText}</button>
                        <button class="vexoris-confirm-btn confirm">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                setTimeout(() => overlay.classList.add('show'), 10);
            });

            const btnCancel = overlay.querySelector('.cancel');
            const btnConfirm = overlay.querySelector('.confirm');

            function close(result) {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 300);
            }

            btnCancel.addEventListener('click', () => close(false));
            btnConfirm.addEventListener('click', () => close(true));
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });
        });
    };
})();