import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.2';
import { hash, genSalt } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase environment variables not set.' }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { "Content-Type": "application/json" } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.phone || typeof body.phone !== 'string' || body.phone.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Phone is required.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!body.password || typeof body.password !== 'string' || body.password.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Password is required.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!body.first_name || typeof body.first_name !== 'string' || body.first_name.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'First name is required.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (!body.last_name || typeof body.last_name !== 'string' || body.last_name.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Last name is required.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (body.password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const salt = await genSalt(10);
    const password_hash = await hash(body.password, salt);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', body.phone)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Phone already registered.' }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase.from('profiles').insert([{
      phone: body.phone,
      password_hash,
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email || null,
      consent: body.consent === true,
      phone_verified: false,
      email_verified: false
    }]);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user_id: data?.[0]?.id }),_
