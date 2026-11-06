import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: { users }, error } = await supabase.auth.admin.listUsers();

if (error) {
  console.error('❌ خطأ:', error.message);
  process.exit(1);
}

console.log(`📋 عدد المستخدمين: ${users.length}`);

for (const user of users) {
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      password_changed: false,  // لازم يغيّر الباسورد
      phone: null,               // لازم يدخل رقمه
      mfa_method: null,          // لازم يفعّل MFA
    }
  });

  if (updateError) {
    console.error(`❌ ${user.email}: ${updateError.message}`);
  } else {
    console.log(`✅ ${user.email}`);
  }
}

console.log('\n✅ تم تحديث جميع المستخدمين بنجاح');