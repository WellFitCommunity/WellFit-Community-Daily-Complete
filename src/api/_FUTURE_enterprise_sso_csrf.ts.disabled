type Role = 'admin' | 'super_admin';

async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',                // <-- REQUIRED so HttpOnly cookie is sent
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export function grantRole(target_user_id: string, role: Role) {
  return jsonFetch<{ ok: true; is_admin: boolean }>(
    '/api/admin/grant-role',
    { method: 'POST', body: JSON.stringify({ target_user_id, role }) }
  );
}

export function revokeRole(target_user_id: string, role: Role) {
  return jsonFetch<{ ok: true; is_admin: boolean }>(
    '/api/admin/revoke-role',
    { method: 'POST', body: JSON.stringify({ target_user_id, role }) }
  );
}
