// device-trust.js
// إدارة الأجهزة الموثوقة — كل جهاز يحتاج تأكيد مرة واحدة

import { supabase } from './supabase-client.js';

/**
 * توليد بصمة فريدة للجهاز
 * تعتمد على مجموعة من خصائص المتصفح والجهاز
 */
export function generateDeviceFingerprint() {
    const data = [
        navigator.userAgent || '',
        navigator.language || '',
        navigator.platform || '',
        navigator.hardwareConcurrency || 0,
        screen.width || 0,
        screen.height || 0,
        screen.colorDepth || 0,
        new Date().getTimezoneOffset(),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    ].join('|||');

    // Hash بسيط (djb2)
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) + hash) + data.charCodeAt(i);
        hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(36) + '_' + data.length.toString(36);
}

/**
 * وصف مقروء للجهاز (لعرضه في القائمة للمستخدم)
 */
export function getDeviceName() {
    const ua = navigator.userAgent;
    let browser = 'متصفح';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

    let os = 'جهاز';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'Mac';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} على ${os}`;
}

/**
 * هل الجهاز الحالي موثوق للمستخدم ده؟
 */
export async function isDeviceTrusted(userId) {
    const fp = generateDeviceFingerprint();
    const { data, error } = await supabase
        .from('trusted_devices')
        .select('id')
        .eq('user_id', userId)
        .eq('device_fingerprint', fp)
        .maybeSingle();

    if (error) {
        console.warn('Device trust check failed:', error);
        return { trusted: false, error };
    }

    // تحديث last_used_at إذا كان موثوقاً
    if (data) {
        await supabase
            .from('trusted_devices')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', data.id);
    }

    return { trusted: !!data, fingerprint: fp };
}

/**
 * تسجيل الجهاز الحالي كموثوق (بعد نجاح MFA)
 */
export async function trustCurrentDevice(userId) {
    const fp = generateDeviceFingerprint();
    const name = getDeviceName();

    const { error } = await supabase
        .from('trusted_devices')
        .upsert({
            user_id: userId,
            device_fingerprint: fp,
            device_name: name,
            user_agent: navigator.userAgent,
            last_used_at: new Date().toISOString(),
        }, { onConflict: 'user_id,device_fingerprint' });

    if (error) {
        console.error('Failed to trust device:', error);
        return false;
    }
    return true;
}

/**
 * حذف جهاز من القائمة الموثوقة
 */
export async function removeTrustedDevice(deviceId) {
    const { error } = await supabase
        .from('trusted_devices')
        .delete()
        .eq('id', deviceId);
    return !error;
}

/**
 * جلب كل أجهزة المستخدم
 */
export async function listTrustedDevices(userId) {
    const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false });

    return { devices: data || [], error };
}

/**
 * مسح البصمة المخزنة محلياً (للتسجيل الخروج)
 */
export function clearLocalDeviceState() {
    // لا نحذف البصمة من DB، فقط نمسح أي cache محلي إذا وجد
    sessionStorage.removeItem('device_verified');
}