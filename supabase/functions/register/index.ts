// supabase/functions/register/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.2';
import { hash, genSalt } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

// Get environment variables (set in Supabase dashboard or .env)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Main handler
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const {
      phone,
      password,
      first_name,
      last_name,
      email,
      consent
    } = await req.json();

    // --- Validation ---
    if (!phone || !password || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields.' }),
        { status: 400 }
      );
    }

    // Enforce password min length (match frontend)
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400 }
      );
    }

    // Hash the password with bcrypt
    const salt = await genSalt(10);
    const password_hash = await hash(password, salt);

    // Connect to Supabase using the service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if the phone is already registered
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Phone already registered.' }),
        { status: 409 }
      );
    }

    // Insert the new user record (match your full registration flow)
    const { data, error } = await supabase.from('profiles').insert([
      {
        phone,
        password_hash, // Never store plain password!
        first_name,
        last_name,
        email: email || null,
        consent: consent === true, // Store as boolean
        phone_verified: false,
        email_verified: false
      }
    ]);

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
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500 }
    );
  }
});
