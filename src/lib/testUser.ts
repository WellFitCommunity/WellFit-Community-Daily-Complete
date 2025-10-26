// lib/testUsers.ts
import { supabase } from './supabaseClient';

export async function createTestPatient(opts: {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  test_tag?: string;
}) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/test-users/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Create failed");
  return data; // { user_id, email, phone, password }
}

export async function purgeTestPatients(opts: {
  test_tag?: string;
  older_than_minutes?: number; // default 10
}) {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/test-users/purge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Purge failed");
  return data; // { requested, auth_deleted }
}
