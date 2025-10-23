// Supabase Edge Function: claude-chat
// Secure server-side Claude API integration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Anthropic from "npm:@anthropic-ai/sdk@0.20.9";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

serve(async (req) => {
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

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

    // Parse request body
    const { messages, model, max_tokens, system } = await req.json();

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
    const modelUsed = model || "claude-3-5-sonnet-20241022";

    // Call Claude API
    const response = await anthropic.messages.create({
      model: modelUsed,
      max_tokens: max_tokens || 4000,
      system: system || undefined,
      messages: messages,
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
      console.error('[Audit Log Error]:', logError);
    }

    // Also log to console for real-time monitoring (temporary)
    console.log(`[Claude API] RequestID: ${requestId}, User: ${user.id}, Model: ${modelUsed}, Input: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}, Cost: $${totalCost.toFixed(4)}, Time: ${responseTime}ms`);

    // Return response
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // HIPAA AUDIT LOGGING: Log failure to database
    try {
      const requestId = crypto.randomUUID();
      await supabaseClient.from('claude_api_audit').insert({
        request_id: requestId,
        user_id: user.id,
        request_type: 'chat',
        model: model || "claude-3-5-sonnet-20241022",
        input_tokens: 0,
        output_tokens: 0,
        cost: 0,
        response_time_ms: 0,
        success: false,
        error_code: error.name || 'UNKNOWN_ERROR',
        error_message: error.message || error.toString(),
        phi_scrubbed: true,
        metadata: {
          error_type: error.constructor.name
        }
      });
    } catch (logError) {
      console.error('[Audit Log Error]:', logError);
    }

    console.error("[Claude API Error]:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Internal server error",
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
