export const config = { runtime: 'edge' };

import { sbAsUser } from '../_lib/sb-fetch';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '../_lib/env';

export default async function handler(req: Request): Promise<Response> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const { target_user_id, role } = await req.json().catch(() => ({}));
  if (!target_user_id || !['admin','super_admin'].includes(role)) {
    return new Response(JSON.stringify({ error: 'target_user_id and role (admin|super_admin) required' }), { status: 400, headers });
  }

  // Authorize caller is super_admin
  const check = await sbAsUser<any[]>(
    req, headers,
    `/rest/v1/user_roles?select=user_id&role=eq.super_admin&limit=1`
  );
  if (!check.ok) return new Response(JSON.stringify(check.body), { status: check.status, headers });
  if ((check.data?.length ?? 0) === 0) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  // Delete specific role for target
  const del = await sbAsUser(
    req, headers,
    `/rest/v1/user_roles?user_id=eq.${target_user_id}&role=eq.${role}`,
    { method: 'DELETE' }
  );
  if (!del.ok) return new Response(JSON.stringify(del.body), { status: del.status, headers });

  // Recompute is_admin flag
  const rolesRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${target_user_id}&role=in.("admin","super_admin")`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const roles = rolesRes.ok ? await rolesRes.json() : [];
  const is_admin_after = Array.isArray(roles) && roles.length > 0;

  // Update app_metadata
  const put = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target_user_id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ app_metadata: { is_admin: is_admin_after } }),
  });
  if (!put.ok) {
    const txt = await put.text().catch(() => '');
    return new Response(JSON.stringify({ error: txt || 'failed to update app_metadata' }), { status: 500, headers });
  }

  return new Response(JSON.stringify({ ok: true, is_admin: is_admin_after }), { status: 200, headers });
}
