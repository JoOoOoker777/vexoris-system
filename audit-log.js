// audit-log.js
// Helper module لتسجيل الأحداث في سجل التدقيق

import { supabase } from './supabase-client.js';

/**
 * تسجيل حدث في سجل التدقيق
 */
export async function logAudit(action, options = {}) {
    try {
        const metadata = {
            ...(options.metadata || {}),
            user_agent: navigator.userAgent,
            url: window.location.pathname,
            timestamp: new Date().toISOString(),
        };

        const { error } = await supabase.rpc('log_audit_event', {
            p_action: action,
            p_entity_type: options.entityType || null,
            p_entity_id: options.entityId ? String(options.entityId) : null,
            p_description: options.description || null,
            p_metadata: metadata,
            p_severity: options.severity || 'info',
        });

        if (error) {
            console.warn('[audit] Failed:', error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.warn('[audit] Error:', e);
        return false;
    }
}

// ثوابت الأحداث الشائعة
export const AUDIT = {
    LOGIN: 'login',
    LOGOUT: 'logout',
    LOGIN_FAILED: 'login_failed',
    PASSWORD_CHANGED: 'password_changed',
    EMAIL_CHANGED: 'email_changed',
    MFA_ENABLED: 'mfa_enabled',
    MFA_DISABLED: 'mfa_disabled',
    MFA_CHANGED: 'mfa_changed',
    PROFILE_UPDATED: 'profile_updated',
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_ACTIVATED: 'user_activated',
    USER_DEACTIVATED: 'user_deactivated',
    ROLE_CHANGED: 'role_changed',
    PERMISSIONS_UPDATED: 'permissions_updated',
    DEVICE_TRUSTED: 'device_trusted',
    DEVICE_REVOKED: 'device_revoked',
    DEVICE_TRUST_FAILED: 'device_trust_failed',
    SESSION_LOCKED: 'session_locked',
    SESSION_UNLOCKED: 'session_unlocked',
    AUDIT_LOG_VIEWED: 'audit_log_viewed',
    AUDIT_LOG_EXPORTED: 'audit_log_exported',
};

// تسميات عربية للأحداث (للعرض)
export const AUDIT_LABELS = {
    login: { label: 'تسجيل دخول', icon: 'fa-right-to-bracket', color: '#0ea5e9' },
    logout: { label: 'تسجيل خروج', icon: 'fa-right-from-bracket', color: '#94a3b8' },
    login_failed: { label: 'محاولة دخول فاشلة', icon: 'fa-triangle-exclamation', color: '#ef4444' },
    password_changed: { label: 'تغيير كلمة المرور', icon: 'fa-key', color: '#f59e0b' },
    email_changed: { label: 'تغيير البريد', icon: 'fa-envelope', color: '#f59e0b' },
    mfa_enabled: { label: 'تفعيل MFA', icon: 'fa-shield-halved', color: '#10b981' },
    mfa_disabled: { label: 'إلغاء MFA', icon: 'fa-shield-slash', color: '#ef4444' },
    mfa_changed: { label: 'تغيير طريقة MFA', icon: 'fa-shield', color: '#f59e0b' },
    profile_updated: { label: 'تحديث الملف الشخصي', icon: 'fa-user-pen', color: '#10b981' },
    user_created: { label: 'إنشاء مستخدم', icon: 'fa-user-plus', color: '#10b981' },
    user_updated: { label: 'تعديل مستخدم', icon: 'fa-user-edit', color: '#0ea5e9' },
    user_activated: { label: 'تفعيل حساب', icon: 'fa-user-check', color: '#10b981' },
    user_deactivated: { label: 'إيقاف حساب', icon: 'fa-user-slash', color: '#ef4444' },
    role_changed: { label: 'تغيير دور', icon: 'fa-user-tag', color: '#a855f7' },
    permissions_updated: { label: 'تحديث صلاحيات', icon: 'fa-user-lock', color: '#a855f7' },
    device_trusted: { label: 'جهاز موثوق', icon: 'fa-mobile-screen', color: '#10b981' },
    device_revoked: { label: 'إلغاء جهاز', icon: 'fa-mobile-screen-button', color: '#f59e0b' },
    device_trust_failed: { label: 'فشل توثيق جهاز', icon: 'fa-mobile-screen-button', color: '#ef4444' },
    session_locked: { label: 'قفل جلسة', icon: 'fa-lock', color: '#f59e0b' },
    session_unlocked: { label: 'فتح جلسة', icon: 'fa-lock-open', color: '#10b981' },
    audit_log_viewed: { label: 'عرض سجل التدقيق', icon: 'fa-clipboard-list', color: '#64748b' },
    audit_log_exported: { label: 'تصدير سجل التدقيق', icon: 'fa-download', color: '#64748b' },
};

export const SEVERITY_LABELS = {
    info: { label: 'معلومة', color: '#0ea5e9' },
    warning: { label: 'تحذير', color: '#f59e0b' },
    critical: { label: 'حرج', color: '#ef4444' },
};