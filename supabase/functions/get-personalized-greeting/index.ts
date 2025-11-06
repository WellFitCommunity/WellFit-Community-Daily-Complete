// =====================================================
// GET PERSONALIZED GREETING - Edge Function
// Purpose: Generate personalized greeting with motivational quote
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, role, specialty')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Determine time of day
    const hour = new Date().getHours()
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

      // Filter by role if available
      if (profile?.role) {
        quoteQuery = quoteQuery.or(`role_specific.cs.{all,${profile.role}}`)
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
        console.error('Quote fetch error:', quoteError)
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error generating personalized greeting:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
