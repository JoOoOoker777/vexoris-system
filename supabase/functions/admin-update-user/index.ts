import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'unauthorized' }, 401);

    const { data: callerProfile } = await userClient
      .from('profiles').select('role').eq('id', user.id).single();

    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
      return json({ error: 'forbidden', message: 'ليس لديك صلاحية' }, 403);
    }

    const body = await req.json();
    const { userId, updates } = body;
    if (!userId) return json({ error: 'userId required' }, 400);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user: targetUser }, error: targetErr } =
      await adminClient.auth.admin.getUserById(userId);
    if (targetErr || !targetUser) return json({ error: 'user not found' }, 404);

    const { data: targetProfile } = await adminClient
      .from('profiles').select('role, username').eq('id', userId).single();

    if (targetProfile?.role === 'super_admin' && callerProfile.role !== 'super_admin') {
      return json({ error: 'forbidden', message: 'لا يمكن تعديل المطور إلا بواسطة مطور آخر' }, 403);
    }

    const authUpdates: Record<string, any> = {};
    if (updates.email && updates.email !== targetUser.email) {
      authUpdates.email = updates.email;
      authUpdates.email_confirm = true;
    }
    if (updates.password) authUpdates.password = updates.password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, authUpdates);
      if (authErr) {
        return json({ error: 'auth_update_failed', message: authErr.message }, 500);
      }
    }

    const profileUpdates: Record<string, any> = {};
    if (updates.username) profileUpdates.username = updates.username.trim().toLowerCase();
    if (updates.display_name !== undefined) profileUpdates.display_name = updates.display_name;
    if (updates.email) profileUpdates.email = updates.email;
    if (updates.role) profileUpdates.role = updates.role;
    if (updates.is_active !== undefined) profileUpdates.is_active = updates.is_active;
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
    if (updates.department !== undefined) profileUpdates.department = updates.department;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await adminClient
        .from('profiles').update(profileUpdates).eq('id', userId);
      if (profileErr) {
        return json({ error: 'profile_update_failed', message: profileErr.message }, 500);
      }
    }

    return json({ success: true }, 200);
  } catch (err: any) {
    return json({ error: 'internal', message: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}