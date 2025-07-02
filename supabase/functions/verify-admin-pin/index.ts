import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_ATTEMPTS = 5; // Max attempts before rate limiting
const LOCKOUT_DURATION_MINUTES = 15; // Lockout duration in minutes

// Function to compare strings in constant time.
async function constantTimeCompare(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) {
    return false;
  }
  const encoder = new TextEncoder();
  const encodedA = encoder.encode(a);
  const encodedB = encoder.encode(b);

  let result = 0;
  for (let i = 0; i < encodedA.length; i++) {
    result |= encodedA[i] ^ encodedB[i];
  }
  return result === 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server configuration error (missing Supabase creds)' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  // Create a Supabase client with the service role key for admin operations
  // Do NOT pass client's Authorization header here for service role client.
  const supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey);

  // Get client IP address for rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   req.headers.get('cf-connecting-ip') || // Cloudflare
                   'unknown';

  try {
    const body = await req.json();
    const { pin, userId, role } = body; // role is for future use, userId for logging

    if (!pin) {
      return new Response(JSON.stringify({ error: 'PIN is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!userId) {
      console.warn('User ID not provided for PIN verification attempt.');
      // Decide if this is a hard error or just a warning. For now, soft fail on logging.
    }

    // 1. Check general user authentication and admin role (done client-side, but good to re-verify if possible or log)
    //    For this function, we assume the client (AdminPanel.tsx) has already verified
    //    that the user is logged in via Supabase Auth and has `isSupabaseAdmin === true`.
    //    The `userId` is passed for logging the PIN attempt against a specific admin user.

    // 2. Implement Rate Limiting for PIN attempts (based on IP)
    if (clientIp !== 'unknown') {
      const { data: attemptsData, error: attemptsError } = await supabaseAdminClient
        .from('admin_pin_attempts') // This table should store ip_address, attempts, last_attempt_at, (optionally user_id)
        .select('attempts, last_attempt_at')
        .eq('ip_address', clientIp)
        .single();

      if (attemptsError && attemptsError.code !== 'PGRST116') { // PGRST116: No rows found
        console.error('Error fetching PIN attempts:', attemptsError);
        // Potentially allow if DB error, or deny. For now, log and continue, but this is a risk.
      }

      if (attemptsData) {
        const lastAttemptTime = new Date(attemptsData.last_attempt_at).getTime();
        const currentTime = new Date().getTime();
        const timeDiffMinutes = (currentTime - lastAttemptTime) / (1000 * 60);

        if (attemptsData.attempts >= MAX_ATTEMPTS && timeDiffMinutes < LOCKOUT_DURATION_MINUTES) {
          // Log this attempt BEFORE returning the 429, including user_id if available
          await supabaseAdminClient.from('admin_pin_attempts_log').insert({ // New dedicated log table
            user_id: userId || null,
            ip_address: clientIp,
            success: false,
            reason: 'Rate limited',
            role_attempted: role || null,
          });
          return new Response(JSON.stringify({ error: 'Too many PIN attempts. Try again later.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429, // Too Many Requests
          });
        } else if (attemptsData.attempts >= MAX_ATTEMPTS && timeDiffMinutes >= LOCKOUT_DURATION_MINUTES) {
          // Reset attempts count if lockout duration has passed
          await supabaseAdminClient.from('admin_pin_attempts').delete().eq('ip_address', clientIp);
        }
      }
    } else {
      console.warn("Client IP is 'unknown', cannot apply IP-based rate limiting for PIN verification.");
    }

    // 3. Verify PIN
    const adminPinEnv = Deno.env.get('ADMIN_PANEL_PIN');
    if (!adminPinEnv) {
      console.error('ADMIN_PANEL_PIN environment variable is not set.');
      await supabaseAdminClient.from('admin_pin_attempts_log').insert({
        user_id: userId || null, ip_address: clientIp, success: false, reason: 'Server misconfiguration (PIN not set)', role_attempted: role || null,
      });
      return new Response(JSON.stringify({ error: 'Server configuration error (admin PIN not set)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const isPinValid = await constantTimeCompare(pin, adminPinEnv);

    // 4. Log PIN attempt (success or failure) to a new admin_pin_attempts_log table
    await supabaseAdminClient.from('admin_pin_attempts_log').insert({
      user_id: userId || null, // Log the user ID who made the attempt
      ip_address: clientIp,
      success: isPinValid,
      reason: isPinValid ? 'Successful PIN verification' : 'Invalid PIN',
      role_attempted: role || null, // Log the role they attempted to assume
    });

    if (isPinValid) {
      // If valid and IP was tracked, clear any 'admin_pin_attempts' counter records for this IP
      if (clientIp !== 'unknown') {
        await supabaseAdminClient.from('admin_pin_attempts').delete().eq('ip_address', clientIp);
      }
      return new Response(JSON.stringify({ success: true, role: role }), { // Return role for client context
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Invalid PIN, record/update attempt for rate limiting if IP is known
      if (clientIp !== 'unknown') {
        const { data: currentAttemptData } = await supabaseAdminClient
          .from('admin_pin_attempts')
          .select('attempts, last_attempt_at')
          .eq('ip_address', clientIp)
          .single();

        if (currentAttemptData && (new Date().getTime() - new Date(currentAttemptData.last_attempt_at).getTime()) / (1000 * 60) < LOCKOUT_DURATION_MINUTES) {
          const { error: updateError } = await supabaseAdminClient
            .from('admin_pin_attempts')
            .update({ attempts: (currentAttemptData.attempts || 0) + 1, last_attempt_at: new Date().toISOString() })
            .eq('ip_address', clientIp);
          if (updateError) console.error('Error updating PIN attempts counter:', updateError);
        } else { // No previous attempts or lockout expired, so (re)insert.
          const { error: insertError } = await supabaseAdminClient
            .from('admin_pin_attempts')
            .upsert({ ip_address: clientIp, attempts: 1, last_attempt_at: new Date().toISOString() }, { onConflict: 'ip_address' });
          if (insertError) console.error('Error inserting/updating PIN attempt counter:', insertError);
        }
      }
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // Unauthorized
      });
    }
  } catch (error) {
    console.error('Error in verify-admin-pin function:', error.message, error.stack);
    const errorMsg = error instanceof SyntaxError && error.message.includes("Unexpected end of JSON input")
      ? 'Request body is missing or not valid JSON.'
      : 'An unexpected error occurred';

    // Log this unexpected error too
    try {
      const bodyForLog = await req.json().catch(() => ({})); // Try to get body for logging context
      await supabaseAdminClient.from('admin_pin_attempts_log').insert({
        user_id: bodyForLog.userId || null,
        ip_address: clientIp,
        success: false,
        reason: `Server error: ${errorMsg} - ${error.message}`,
        role_attempted: bodyForLog.role || null,
      });
    } catch (logErr) {
      console.error("Failed to log server error for PIN attempt:", logErr);
    }

    return new Response(JSON.stringify({ error: errorMsg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
