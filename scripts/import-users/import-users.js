import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, 'users.csv');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DOMAIN = 'vexoris.app';
const BCRYPT_ROUNDS = 10;

// 🔑 دالة تنظيف قوية: شيل BOM، Zero-Width، NBSP، \r، مسافات
function cleanString(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/^\uFEFF/, '')           // BOM
    .replace(/[\u200B-\u200D\u2060]/g, '') // Zero-width
    .replace(/\u00A0/g, ' ')          // Non-breaking space
    .replace(/[\r\n]+/g, '')          // Newlines
    .trim();
}

// 🔑 دالة تنظيف أسماء الأعمدة (مفاتيح الكائن)
function cleanHeader(h) {
  return cleanString(h).toLowerCase();
}

// تنظيف الدور من الإيموجي
function cleanRole(raw) {
  const cleaned = cleanString(raw)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{2B00}-\u{2BFF}]/gu, '')
    .trim();
  return cleaned || 'viewer';
}

// اكتشاف الفاصل
const firstLine = fs.readFileSync(CSV_PATH, 'utf-8').split('\n')[0];
const separator = firstLine.includes('\t') ? '\t' : ',';

const rows = [];

fs.createReadStream(CSV_PATH)
  .pipe(csv({
    separator,
    // 🔑 تنظيف اسم كل عمود عند القراءة
    mapHeaders: ({ header }) => cleanHeader(header),
  }))
  .on('data', (rawRow) => {
    // 🔑 تنظيف القيم أيضاً
    const row = {};
    for (const [k, v] of Object.entries(rawRow)) {
      row[k] = cleanString(v);
    }
    rows.push(row);
  })
  .on('error', (err) => {
    console.error('❌ خطأ في قراءة الملف:', err.message);
    process.exit(1);
  })
  .on('end', async () => {
    console.log(`📄 تم قراءة ${rows.length} صف من الملف`);
    console.log(`🔍 الفاصل: ${separator === '\t' ? 'TAB' : 'COMMA'}\n`);

    // عرض الأعمدة الحقيقية بعد التنظيف
    if (rows.length > 0) {
      console.log('📋 الأعمدة (بعد التنظيف):', Object.keys(rows[0]).join(' | '));
      console.log('🔍 أول صف للتحقق:', JSON.stringify(rows[0]));
      console.log('');
    }

    let success = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const u = rows[i];

      const username = (u['username'] || '').toLowerCase();
      const password = u['password'] || '';
      const displayName = u['displayname'] || u['display_name'] || '';
      const role = cleanRole(u['role']);
      const department = u['department'] || '';

      if (!username || !password) {
        console.log(`⚠️  صف ${i + 1} تخطي — username="${username}" password="${password}"`);
        console.log(`    كامل الصف: ${JSON.stringify(u)}`);
        failed++;
        continue;
      }

      const email = `${username}@${DOMAIN}`;

      try {
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password_hash: passwordHash,
          email_confirm: true,
          user_metadata: {
            username,
            display_name: displayName,
            department,
            role,
          },
        });

        if (error) {
          console.error(`❌ ${email}: ${error.message}`);
          failed++;
        } else {
          console.log(`✅ ${email}  →  [${role}]  ${displayName}`);
          success++;
        }
      } catch (err) {
        console.error(`💥 ${email}: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`📊 النتيجة النهائية:`);
    console.log(`   ✅ ناجح:  ${success}`);
    console.log(`   ❌ فاشل:  ${failed}`);
    console.log(`   📋 الإجمالي: ${rows.length}`);
    console.log(`═══════════════════════════════════════`);
  });