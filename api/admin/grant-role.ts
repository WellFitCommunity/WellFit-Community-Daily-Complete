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

  // 1) Authorize: caller must be super_admin (RLS handles this; we expect one row if allowed)
  const can = await sbAsUser<any[]>(
    req, headers,
    `/rest/v1/user_roles?select=user_id&user_id=eq.${'x'}&role=eq.super_admin&limit=1`
  );
  // Re-run with caller id (ts-friendly split)
  if (!can.ok) return new Response(JSON.stringify(can.body), { status: can.status, headers });
  const check = await sbAsUser<any[]>(
    req, headers,
    `/rest/v1/user_roles?select=user_id&role=eq.super_admin&limit=1`
  );
  if (!check.ok) return new Response(JSON.stringify(check.body), { status: check.status, headers });
  if ((check.data?.length ?? 0) === 0) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  // 2) Upsert role row for target
  const upsert = await sbAsUser<any[]>(
    req, headers,
    `/rest/v1/user_roles`,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([{ user_id: target_user_id, role }]),
    }
  );
  if (!upsert.ok) return new Response(JSON.stringify(upsert.body), { status: upsert.status, headers });

  // 3) Compute is_admin for target (does target have any admin-ish role?)
  const rolesRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?select=role&user_id=eq.${target_user_id}&role=in.("admin","super_admin")`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  const roles = rolesRes.ok ? await rolesRes.json() : [];
  const is_admin_after = Array.isArray(roles) && roles.length > 0;

  // 4) Update GoTrue app_metadata (service role)
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
