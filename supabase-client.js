// supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://omezrsyjsxdeaautmsad.supabase.co';

// ✅ التصدير في مكان واحد فقط
export const SUPABASE_ANON_KEY = 'sb_publishable_PwAPeoiMzkFVCxBbFu551A__gOKoWoM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function normalizeEmail(input) {
  const trimmed = String(input || '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@vexoris.app`;
}

export function translateAuthError(message) {
  const map = {
    'Invalid login credentials': 'بيانات الاعتماد غير صحيحة. تحقق من البريد وكلمة المرور.',
    'Email not confirmed': 'لم يتم تأكيد بريدك الإلكتروني بعد.',
    'Too many requests': 'محاولات كثيرة جداً. انتظر دقيقة ثم أعد المحاولة.',
    'User not found': 'هذا الحساب غير موجود في النظام.',
    'Email rate limit exceeded': 'تم تجاوز حد المحاولات. انتظر قليلاً.',
  };
  return map[message] || message;
}

export async function resolveLoginEmail(input) {
  const trimmed = String(input || '').trim().toLowerCase();
  if (!trimmed) return '';

  if (trimmed.includes('@')) {
    return trimmed;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('username', trimmed)
    .single();

  if (!error && profile?.email) {
    return profile.email;
  }

  return `${trimmed}@vexoris.app`;
}