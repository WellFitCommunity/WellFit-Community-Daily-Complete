// File: supabase/functions/generate-api-key/index.ts
import { serve } from 'std/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, createHash } from 'crypto'

serve(async (req) => {
  // 1. Read org_name from POST request
  const { org_name } = await req.json()
  if (!org_name || typeof org_name !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing or invalid org_name' }), { status: 400 })
  }

  // 2. Generate secure API key
  const apiKeyPlain = `${org_name.toLowerCase().replace(/\s+/g, '-')}-${randomBytes(32).toString('hex')}`

  // 3. Hash the API key with SHA-256
  const apiKeyHash = createHash('sha256').update(apiKeyPlain).digest('hex')

  // 4. Insert into api_keys table (only the hash!)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await supabase
    .from('api_keys')
    .insert([{ org_name, api_key_hash: apiKeyHash, active: true }])

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // 5. Return the plain API key (never returned again!)
  return new Response(JSON.stringify({ api_key: apiKeyPlain }), { status: 200 })
})
