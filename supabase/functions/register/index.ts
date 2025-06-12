import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.2';
import { hash, genSalt } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

serve(async (req) => {
  try {
    // Move env access inside try/catch!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Supabase environment variables not set.' }),
        { status: 500 }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405 }
      );
    }

    const body = await req.json();

    // --- Explicit field validation with targeted errors ---
    if (!body.phone || typeof body.phone !== 'string' || body.phone.trim() === '') {
      return new Response(JSON.stringify({ error: 'Phone is required.' }), { status: 400 });
    }
    if (!body.password || typeof body.password !== 'string' || body.password.trim() === '') {
      return new Response(JSON.stringify({ error: 'Password is required.' }), { status: 400 });
    }
    if (!body.first_name || typeof body.first_name !== 'string' || body.first_name.trim() === '') {
      return new Response(JSON.stringify({ error: 'First name is required.' }), { status: 400 });
    }
    if (!body.last_name || typeof body.last_name !== 'string' || body.last_name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Last name is required.' }), { status: 400 });
    }
    if (body.password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters.' }), { status: 400 });
    }

    // Hash the password with bcrypt
    const salt = await genSalt(10);
    const password_hash = await hash(body.password, salt);

    // Connect to Supabase using the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if the phone is already registered
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', body.phone)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Phone already registered.' }),
        { status: 409 }
      );
    }

    // Insert the new user record (match your full registration flow)
    const { data, error } = await supabase.from('profiles').insert([{
      phone: body.phone,
      password_hash, // Never store plain password!
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email || null,
      consent: body.consent === true, // Store as boolean
      // photo_consent: body.photo_consent === true, // REMOVED
      phone_verified: false,
      email_verified: false
    }]);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400 }
      );
    }

    // Return the user ID for confirmation
    return new Response(
      JSON.stringify({ success: true, user_id: data?.[0]?.id }),
      { status: 201 }
    );
  } catch (err: any) {
    // Log for debugging
    console.error('Edge Function Error:', err);

    // Always return valid JSON
    return new Response(
      JSON.stringify({ error: err?.message || 'Server error' }),
      { status: 500 }
    );
  }
});
