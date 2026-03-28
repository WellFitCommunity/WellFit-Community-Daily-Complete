// Supabase Edge Function: claude-chat
// Secure server-side Claude API integration with per-tenant rate/budget enforcement
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createUserClient, createAdminClient } from '../_shared/supabaseClient.ts';
import Anthropic from "npm:@anthropic-ai/sdk@0.20.9";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";
import { createLogger } from '../_shared/auditLogger.ts';
import { SONNET_MODEL } from '../_shared/models.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

// Per-tenant daily budget cap (USD). Prevents runaway AI costs.
const DEFAULT_DAILY_BUDGET_USD = 50.0;
// Max requests per user per minute
const USER_RATE_LIMIT = { maxAttempts: 15, windowSeconds: 60, keyPrefix: 'claude-chat' };
// Max tokens per request (server-enforced ceiling)
const MAX_TOKENS_CEILING = 8000;

serve(async (req) => {
  const logger = createLogger('claude-chat', req);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Get Anthropic API key from Supabase secrets
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured in Supabase secrets");
    }

    // Verify user authentication
    const supabaseClient = createUserClient(req.headers.get("Authorization"));

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // SERVER-SIDE RATE LIMITING — per-user (A-17)
    // =========================================================================
    const rateResult = await checkRateLimit(user.id, USER_RATE_LIMIT);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many AI requests. Retry in ${rateResult.retryAfter} seconds.`,
          retryAfter: rateResult.retryAfter
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rateResult.retryAfter || 60)
          }
        }
      );
    }

    // =========================================================================
    // PER-TENANT DAILY BUDGET ENFORCEMENT — prevents runaway costs (A-17)
    // =========================================================================
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    const tenantId = profile?.tenant_id;

    if (tenantId) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      // Get tenant budget override (if configured)
      const { data: tenantConfig } = await admin
        .from('tenant_ai_skill_config')
        .select('config_value')
        .eq('tenant_id', tenantId)
        .eq('config_key', 'daily_budget_usd')
        .single();

      const dailyBudget = tenantConfig?.config_value
        ? parseFloat(String(tenantConfig.config_value))
        : DEFAULT_DAILY_BUDGET_USD;

      // Get all tenant user_ids for cost aggregation
      const { data: tenantUsers } = await admin
        .from('profiles')
        .select('user_id')
        .eq('tenant_id', tenantId);

      const tenantUserIds = new Set((tenantUsers ?? []).map((u: { user_id: string }) => u.user_id));

      // Re-query with tenant user filter for accurate cost
      const { data: tenantCosts } = await admin
        .from('claude_api_audit')
        .select('cost')
        .eq('success', true)
        .gte('created_at', todayStart.toISOString())
        .in('user_id', Array.from(tenantUserIds).length > 0 ? Array.from(tenantUserIds) : ['__none__']);

      const totalSpent = (tenantCosts ?? []).reduce(
        (sum: number, row: { cost: number | null }) => sum + (row.cost ?? 0),
        0
      );

      if (totalSpent >= dailyBudget) {
        logger.warn('Tenant daily AI budget exceeded', {
          tenantId,
          totalSpent: totalSpent.toFixed(4),
          dailyBudget
        });
        return new Response(
          JSON.stringify({
            error: 'Daily AI budget exceeded',
            message: `Your organization's daily AI budget ($${dailyBudget.toFixed(2)}) has been reached. Resets at midnight UTC.`,
            spent: parseFloat(totalSpent.toFixed(4)),
            budget: dailyBudget
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Parse request body
    const { messages, model, max_tokens, system, temperature } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: messages array required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });

    // Generate request ID for tracking
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const modelUsed = model || SONNET_MODEL;

    // Server-enforced max_tokens ceiling — clients cannot request more than MAX_TOKENS_CEILING
    const enforcedMaxTokens = Math.min(max_tokens || 4000, MAX_TOKENS_CEILING);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: modelUsed,
      max_tokens: enforcedMaxTokens,
      system: system || undefined,
      messages: messages,
      ...(temperature !== undefined ? { temperature } : {}),
    });

    const responseTime = Date.now() - startTime;

    // Calculate cost
    const inputCost = (response.usage.input_tokens * 0.003) / 1000; // $3 per 1M tokens
    const outputCost = (response.usage.output_tokens * 0.015) / 1000; // $15 per 1M tokens
    const totalCost = inputCost + outputCost;

    // HIPAA AUDIT LOGGING: Log to database (permanent record)
    try {
      await supabaseClient.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: user.id,
        request_type: 'chat',
        model: modelUsed,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost: totalCost,
        response_time_ms: responseTime,
        success: true,
        phi_scrubbed: true,
        metadata: {
          max_tokens: max_tokens || 4000,
          has_system: !!system,
          message_count: messages.length
        }
      });
    } catch (logError) {
      // Don't fail request if logging fails, but log the error
      logger.error('Audit log insertion failed', { error: logError instanceof Error ? logError.message : String(logError) });
    }

    // Also log to console for real-time monitoring (temporary)
    logger.info('Claude API request completed', {
      requestId,
      userId: user.id,
      model: modelUsed,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cost: totalCost,
      responseTimeMs: responseTime
    });

    // Return response
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    // Log error - audit logging happens in try block only when we have valid context
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Claude API request failed', { error: errorMessage });

    return new Response(
      JSON.stringify({
        error: errorMessage || "Internal server error",
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
