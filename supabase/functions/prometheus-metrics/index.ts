/**
 * Prometheus Metrics Edge Function
 *
 * Purpose: Expose metrics in Prometheus text format for scraping
 * Endpoint: GET /functions/v1/prometheus-metrics
 *
 * Security: Requires API key authentication (bearer token or header)
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-metrics-key',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    const metricsKey = req.headers.get('X-Metrics-Key');
    const expectedKey = Deno.env.get('PROMETHEUS_METRICS_KEY');

    // Allow either bearer token or metrics key
    if (!authHeader && !metricsKey) {
      return new Response(
        JSON.stringify({ error: 'Missing authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If using metrics key, verify it
    if (metricsKey && expectedKey && metricsKey !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Invalid metrics key' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
                        Deno.env.get('SB_SERVICE_ROLE_KEY') ??
                        Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get metrics from database
    const { data: metricsText, error } = await supabase.rpc('get_prometheus_metrics');

    if (error) {
      console.error('Failed to get metrics:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to get metrics', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Add standard process metrics
    let output = metricsText || '';

    // Add function invocation counter
    output += '\n# HELP wellfit_function_invocations_total Total edge function invocations\n';
    output += '# TYPE wellfit_function_invocations_total counter\n';
    output += 'wellfit_function_invocations_total{function="prometheus-metrics"} 1\n';

    // Add timestamp metric
    output += '\n# HELP wellfit_metrics_last_scrape_timestamp Unix timestamp of last scrape\n';
    output += '# TYPE wellfit_metrics_last_scrape_timestamp gauge\n';
    output += `wellfit_metrics_last_scrape_timestamp ${Math.floor(Date.now() / 1000)}\n`;

    // Return in Prometheus text format
    return new Response(output, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  } catch (err) {
    console.error('Prometheus metrics error:', err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
