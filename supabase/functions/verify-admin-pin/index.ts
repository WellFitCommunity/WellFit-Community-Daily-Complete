import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

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

  try {
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
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // Unauthorized
      });
    }
  } catch (error) {
    console.error('Error in verify-admin-pin function:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
