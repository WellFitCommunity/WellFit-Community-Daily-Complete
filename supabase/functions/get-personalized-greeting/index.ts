// =====================================================
// GET PERSONALIZED GREETING - Edge Function
// Purpose: Generate personalized greeting with motivational quote
// HIPAA Compliance: §164.312(b) - Audit Controls
// =====================================================

import { SUPABASE_URL, SB_PUBLISHABLE_API_KEY, SB_SECRET_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsFromRequest, handleOptions } from '../_shared/cors.ts'
import { createLogger } from '../_shared/auditLogger.ts'

serve(async (req) => {
  const logger = createLogger('get-personalized-greeting', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers } = corsFromRequest(req);

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      SUPABASE_URL ?? '',
      SB_PUBLISHABLE_API_KEY ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Get user profile - try with user context first, fallback to service role
    let profile: { first_name: string | null; last_name: string | null; role: string | null; specialty: string | null } | null = null;

    const { data: profileData, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, role, specialty')
      .eq('user_id', user.id)
      .single()

    if (profileError) {
      logger.warn('Profile fetch with user context failed, trying service role', {
        userId: user.id,
        error: profileError.message
      })

      // Fallback to service role to bypass RLS
      if (SB_SECRET_KEY) {
        const serviceClient = createClient(SUPABASE_URL ?? '', SB_SECRET_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        const { data: serviceProfile } = await serviceClient
          .from('profiles')
          .select('first_name, last_name, role, specialty')
          .eq('user_id', user.id)
          .single()

        profile = serviceProfile
      }
    } else {
      profile = profileData
    }

    // Get or create greeting preferences
    let { data: preferences, error: prefError } = await supabaseClient
      .from('user_greeting_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (prefError && prefError.code === 'PGRST116') {
      // Create default preferences
      const { data: newPrefs, error: createError } = await supabaseClient
        .from('user_greeting_preferences')
        .insert({
          user_id: user.id,
          show_greeting: true,
          show_quote: true,
          last_shown_quote_ids: [],
          quotes_shown_count: 0,
        })
        .select()
        .single()

      if (createError) throw createError
      preferences = newPrefs
    } else if (prefError) {
      throw prefError
    }

    // Skip if user has disabled greeting
    if (!preferences?.show_greeting) {
      return new Response(
        JSON.stringify({
          show_greeting: false,
        }),
        {
          headers: { ...headers, 'Content-Type': 'application/json' },
        }
      )
    }

    // Determine time of day using client's timezone if provided
    // Parse request body for timezone info (POST) or use query param (GET)
    let clientTimezone: string | null = null;
    let clientHour: number | null = null;

    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        clientTimezone = body.timezone || null;
        clientHour = typeof body.hour === 'number' ? body.hour : null;
      } else {
        const url = new URL(req.url);
        clientTimezone = url.searchParams.get('timezone');
        const hourParam = url.searchParams.get('hour');
        clientHour = hourParam ? parseInt(hourParam, 10) : null;
      }
    } catch {
      // Ignore parse errors, will fallback to UTC
    }

    // Determine hour to use for greeting
    let hour: number;
    if (clientHour !== null && clientHour >= 0 && clientHour <= 23) {
      // Use explicitly provided hour from client
      hour = clientHour;
    } else if (clientTimezone) {
      // Use timezone to calculate local hour
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: clientTimezone,
          hour: 'numeric',
          hour12: false,
        });
        hour = parseInt(formatter.format(now), 10);
      } catch {
        // Invalid timezone, fallback to UTC
        hour = new Date().getUTCHours();
      }
    } else {
      // Fallback to UTC (not ideal, but safe)
      hour = new Date().getUTCHours();
    }

    let timeGreeting = 'Good morning'
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon'
    } else if (hour >= 17 && hour < 21) {
      timeGreeting = 'Good evening'
    } else if (hour >= 21 || hour < 6) {
      timeGreeting = 'Good evening'
    }

    // Determine name to use
    const displayName = preferences?.preferred_name || profile?.first_name || 'there'

    // Add title based on role
    let title = ''
    if (profile?.role === 'physician' || profile?.role === 'pa' || profile?.role === 'np') {
      title = 'Dr. '
    } else if (profile?.role === 'nurse') {
      title = 'Nurse '
    }

    const fullGreeting = `${timeGreeting}, ${title}${displayName}!`

    // Get motivational quote if enabled
    let quote = null
    if (preferences?.show_quote) {
      // Get last shown quote IDs
      const lastShownIds = Array.isArray(preferences.last_shown_quote_ids) ? preferences.last_shown_quote_ids : []

      // Build query to get quotes
      let quoteQuery = supabaseClient
        .from('motivational_quotes')
        .select('*')
        .eq('is_active', true)

      // Filter by role if available - check for 'all' OR the user's specific role
      if (profile?.role) {
        quoteQuery = quoteQuery.or(`role_specific.cs.{all},role_specific.cs.{${profile.role}}`)
      }

      // Filter by specialty if available
      if (profile?.specialty) {
        quoteQuery = quoteQuery.or(`specialty_specific.cs.{${profile.specialty}},specialty_specific.is.null`)
      }

      // Exclude recently shown quotes
      if (lastShownIds.length > 0) {
        quoteQuery = quoteQuery.not('id', 'in', `(${lastShownIds.join(',')})`)
      }

      // Get random quote
      const { data: quotes, error: quoteError } = await quoteQuery.limit(10)

      if (quoteError) {
        logger.warn('Quote fetch failed', { userId: user.id, error: quoteError.message })
      } else if (quotes && quotes.length > 0) {
        // Pick random quote from results
        quote = quotes[Math.floor(Math.random() * quotes.length)]

        // Update preferences with this quote ID
        const newLastShownIds = [...lastShownIds, quote.id].slice(-20) // Keep last 20
        await supabaseClient
          .from('user_greeting_preferences')
          .update({
            last_shown_quote_ids: newLastShownIds,
            quotes_shown_count: (preferences.quotes_shown_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      }
    }

    return new Response(
      JSON.stringify({
        show_greeting: true,
        greeting: fullGreeting,
        quote: quote
          ? {
              text: quote.quote_text,
              author: quote.author,
              theme: quote.theme,
            }
          : null,
        user_display_name: `${title}${displayName}`,
        time_of_day: timeGreeting.replace('Good ', '').toLowerCase(),
      }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Greeting generation failed', {
      error: errorMessage
    })
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }
    )
  }
})
