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

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for admin operations
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  // Get client IP address
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                   req.headers.get('cf-connecting-ip') || // Cloudflare
                   'unknown';

  try {
    // Check existing attempts for this IP
    const { data: attemptsData, error: attemptsError } = await supabaseClient
      .from('admin_pin_attempts')
      .select('attempts, last_attempt_at')
      .eq('ip_address', clientIp)
      .single();

    if (attemptsError && attemptsError.code !== 'PGRST116') { // PGRST116: No rows found
      console.error('Error fetching attempts:', attemptsError);
      return new Response(JSON.stringify({ error: 'Server error checking attempts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (attemptsData) {
      const lastAttemptTime = new Date(attemptsData.last_attempt_at).getTime();
      const currentTime = new Date().getTime();
      const timeDiffMinutes = (currentTime - lastAttemptTime) / (1000 * 60);

      if (attemptsData.attempts >= MAX_ATTEMPTS && timeDiffMinutes < LOCKOUT_DURATION_MINUTES) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429, // Too Many Requests
        });
      } else if (attemptsData.attempts >= MAX_ATTEMPTS && timeDiffMinutes >= LOCKOUT_DURATION_MINUTES) {
        // Reset attempts if lockout duration has passed
        await supabaseClient.from('admin_pin_attempts').delete().eq('ip_address', clientIp);
      }
    }

    const { pin } = await req.json();
    if (!pin) {
      return new Response(JSON.stringify({ error: 'PIN is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const adminPin = Deno.env.get('ADMIN_PANEL_PIN');
    if (!adminPin) {
      console.error('ADMIN_PANEL_PIN environment variable is not set.');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const isValid = await constantTimeCompare(pin, adminPin);

    if (isValid) {
      // If valid, clear any attempts records for this IP
      if (attemptsData) {
        await supabaseClient.from('admin_pin_attempts').delete().eq('ip_address', clientIp);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Invalid PIN, record attempt
      if (attemptsData && (new Date().getTime() - new Date(attemptsData.last_attempt_at).getTime()) / (1000 * 60) < LOCKOUT_DURATION_MINUTES) {
        const { error: updateError } = await supabaseClient
          .from('admin_pin_attempts')
          .update({ attempts: attemptsData.attempts + 1, last_attempt_at: new Date().toISOString() })
          .eq('ip_address', clientIp);
        if (updateError) console.error('Error updating attempts:', updateError);
      } else { // No previous attempts or lockout expired
        const { error: insertError } = await supabaseClient
          .from('admin_pin_attempts')
          .insert({ ip_address: clientIp, attempts: 1, last_attempt_at: new Date().toISOString() });
        if (insertError) console.error('Error inserting new attempt:', insertError);
      }

      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // Unauthorized
      });
    }
  } catch (error) {
    console.error('Error in verify-admin-pin function:', error);
    // Check if it's a JSON parsing error (e.g. empty body)
    if (error instanceof SyntaxError && error.message.includes("Unexpected end of JSON input")) {
      return new Response(JSON.stringify({ error: 'Request body is missing or not valid JSON.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
