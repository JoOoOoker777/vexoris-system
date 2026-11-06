import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function populateProfiles() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) { console.error('❌ خطأ:', error.message); return; }

  for (const user of users) {
    const username = user.user_metadata?.username;
    if (!username) {
      console.warn(`⚠️ تخطي ${user.email}: لا يوجد username في user_metadata`);
      continue;
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username,
        email: user.email,
      }, { onConflict: 'id' });

    if (upsertError) {
      console.error(`❌ ${username}: ${upsertError.message}`);
    } else {
      console.log(`✅ ${username} -> ${user.email}`);
    }
  }
  console.log('\n✅ تم الانتهاء.');
}

populateProfiles();