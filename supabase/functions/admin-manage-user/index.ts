import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return response({ error: 'Supabase function configuration is incomplete.' }, 500);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return response({ error: 'Authentication required.' }, 401);

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return response({ error: 'Invalid authentication session.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: caller, error: callerError } = await adminClient
    .from('user_profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (callerError || caller?.role !== 'admin') return response({ error: 'Only admins can manage users.' }, 403);

  try {
    const body = await request.json();
    const action = body?.action;
    if (action === 'list') {
      const { data, error } = await adminClient.from('user_profiles').select('id, username, display_name, role, city, district, active, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      return response({ users: data || [] });
    }

    if (action === 'create') {
      const user = body?.user || {};
      const username = String(user.username || '').trim().toLowerCase();
      const password = String(user.password || '');
      const allowedRoles = ['admin', 'tech', 'design', 'engineer', 'supervisor', 'management'];
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) return response({ error: 'Username must use 3-40 English letters, numbers, dot, dash, or underscore.' }, 400);
      if (password.length < 6) return response({ error: 'Password must contain at least 6 characters.' }, 400);
      if (!allowedRoles.includes(user.role)) return response({ error: 'Invalid role.' }, 400);
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: `${username}@site-survey.local`,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;
      const { error: profileError } = await adminClient.from('user_profiles').upsert({
        id: created.user.id,
        username,
        display_name: String(user.displayName || username).trim(),
        role: user.role,
        city: String(user.city || '').trim() || null,
        district: String(user.district || '').trim() || null,
        active: true,
      });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }
      return response({ user: { id: created.user.id, username } }, 201);
    }

    if (action === 'toggle') {
      if (!body.id || typeof body.active !== 'boolean') return response({ error: 'User id and active state are required.' }, 400);
      if (body.id === authData.user.id && body.active === false) return response({ error: 'You cannot disable your own account.' }, 400);
      const { error } = await adminClient.from('user_profiles').update({ active: body.active, updated_at: new Date().toISOString() }).eq('id', body.id);
      if (error) throw error;
      return response({ ok: true });
    }

    if (action === 'delete') {
      const userId = String(body.id || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        return response({ error: 'A valid user id is required.' }, 400);
      }
      if (userId === authData.user.id) return response({ error: 'You cannot delete your own account.' }, 400);

      const { data: target, error: targetError } = await adminClient
        .from('user_profiles')
        .select('id, username, role, active')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) return response({ error: 'User not found.' }, 404);

      if (target.role === 'admin' && target.active) {
        const { data: activeAdmins, error: adminsError } = await adminClient
          .from('user_profiles')
          .select('id')
          .eq('role', 'admin')
          .eq('active', true);
        if (adminsError) throw adminsError;
        if ((activeAdmins || []).length <= 1) {
          return response({ error: 'You cannot delete the last active admin account.' }, 409);
        }
      }

      const { data: assignedPoint, error: assignmentError } = await adminClient
        .from('planned_poles')
        .select('id')
        .eq('assigned_to', target.username)
        .eq('validation_status', 'validated')
        .limit(1)
        .maybeSingle();
      if (assignmentError) throw assignmentError;
      if (assignedPoint) {
        return response({ error: 'Reassign this user’s validated points before deleting the account.' }, 409);
      }

      const { data: legacyAssignments, error: legacyReadError } = await adminClient
        .from('legacy_area_assignments')
        .select('*')
        .eq('technician_username', target.username);
      if (legacyReadError) throw legacyReadError;
      if (legacyAssignments?.length) {
        const { error: legacyDeleteError } = await adminClient
          .from('legacy_area_assignments')
          .delete()
          .eq('technician_username', target.username);
        if (legacyDeleteError) throw legacyDeleteError;
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        if (legacyAssignments?.length) {
          const { error: restoreError } = await adminClient
            .from('legacy_area_assignments')
            .upsert(legacyAssignments, { onConflict: 'id' });
          if (restoreError) console.error('Could not restore Legacy assignments after failed user deletion:', restoreError);
        }
        throw deleteError;
      }

      return response({ ok: true, deletedUsername: target.username });
    }

    return response({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error.';
    if (/storage|owned.*object|object.*owner/i.test(message)) {
      return response({ error: 'This account owns uploaded files. Transfer or remove those files before deleting the user.' }, 409);
    }
    return response({ error: message }, 400);
  }
});
