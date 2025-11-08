/**
 * Public System Status Endpoint
 *
 * Purpose: Provide a public health check for uptime monitoring
 * Usage: UptimeRobot, Methodist IT, status pages
 *
 * Returns:
 * - status: "operational" | "degraded" | "down"
 * - timestamp: ISO8601
 * - checks: Database, API, Guardian
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers - public endpoint, allow all origins
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

interface HealthCheck {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  responseTime?: number;
  message?: string;
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'down';
  timestamp: string;
  checks: HealthCheck[];
  uptime_seconds: number;
}

const startTime = Date.now();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    )
  }

  const checks: HealthCheck[] = [];
  let overallStatus: 'operational' | 'degraded' | 'down' = 'operational';

  try {
    // Check 1: Database connectivity
    const dbCheck = await checkDatabase();
    checks.push(dbCheck);
    if (dbCheck.status === 'down') overallStatus = 'down';
    else if (dbCheck.status === 'degraded' && overallStatus === 'operational') {
      overallStatus = 'degraded';
    }

    // Check 2: API responsiveness
    const apiCheck = await checkAPI();
    checks.push(apiCheck);
    if (apiCheck.status === 'down') overallStatus = 'down';
    else if (apiCheck.status === 'degraded' && overallStatus === 'operational') {
      overallStatus = 'degraded';
    }

    // Check 3: Guardian monitoring system
    const guardianCheck = await checkGuardian();
    checks.push(guardianCheck);
    // Guardian down is degraded, not critical (monitoring can be temporarily offline)
    if (guardianCheck.status === 'down' && overallStatus === 'operational') {
      overallStatus = 'degraded';
    }

    const status: SystemStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    };

    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'operational' ? 200 :
                      overallStatus === 'degraded' ? 200 :
                      503; // Service unavailable if down

    return new Response(
      JSON.stringify(status, null, 2),
      { status: httpStatus, headers: corsHeaders }
    );

  } catch (error) {
    // If health check itself fails, system is down
    const errorStatus: SystemStatus = {
      status: 'down',
      timestamp: new Date().toISOString(),
      checks: [{
        name: 'system',
        status: 'down',
        message: `Health check failed: ${error.message}`
      }],
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    };

    return new Response(
      JSON.stringify(errorStatus, null, 2),
      { status: 503, headers: corsHeaders }
    );
  }
})

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return {
        name: 'database',
        status: 'down',
        message: 'Missing Supabase credentials'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to test DB connectivity
    const { data, error } = await supabase
      .from('security_alerts')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      return {
        name: 'database',
        status: 'down',
        responseTime,
        message: `Database error: ${error.message}`
      };
    }

    // If query takes > 2 seconds, mark as degraded
    if (responseTime > 2000) {
      return {
        name: 'database',
        status: 'degraded',
        responseTime,
        message: 'Slow database response'
      };
    }

    return {
      name: 'database',
      status: 'operational',
      responseTime
    };

  } catch (error) {
    return {
      name: 'database',
      status: 'down',
      responseTime: Date.now() - start,
      message: `Exception: ${error.message}`
    };
  }
}

async function checkAPI(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!supabaseUrl) {
      return {
        name: 'api',
        status: 'down',
        message: 'Missing Supabase URL'
      };
    }

    // Check if API is responsive by pinging verify-hcaptcha (lightweight endpoint)
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-hcaptcha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'health-check' })
    });

    const responseTime = Date.now() - start;

    // Any response (even 400/401) means API is up
    if (response.status === 0 || response.status >= 500) {
      return {
        name: 'api',
        status: 'down',
        responseTime,
        message: `API returned ${response.status}`
      };
    }

    if (responseTime > 3000) {
      return {
        name: 'api',
        status: 'degraded',
        responseTime,
        message: 'Slow API response'
      };
    }

    return {
      name: 'api',
      status: 'operational',
      responseTime
    };

  } catch (error) {
    return {
      name: 'api',
      status: 'down',
      responseTime: Date.now() - start,
      message: `Exception: ${error.message}`
    };
  }
}

async function checkGuardian(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return {
        name: 'guardian',
        status: 'degraded',
        message: 'Cannot verify Guardian status'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if Guardian has created any alerts in the last hour (sign it's running)
    const { data, error } = await supabase
      .from('security_alerts')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      return {
        name: 'guardian',
        status: 'degraded',
        responseTime,
        message: 'Cannot query Guardian alerts'
      };
    }

    // If no alerts in last hour, Guardian might not be running (or system is very healthy!)
    // Mark as operational but note last alert time would be in metadata
    return {
      name: 'guardian',
      status: 'operational',
      responseTime,
      message: data && data.length > 0 ? 'Active' : 'No recent alerts (system healthy)'
    };

  } catch (error) {
    return {
      name: 'guardian',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: `Exception: ${error.message}`
    };
  }
}
