import { serve } from "https://deno.land/std@0.183.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseService = createClient(URL, KEY);

serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const { id, notes } = await req.json();
  const { error } = await supabaseService
    .from("profiles")
    .update({ notes })
    .eq("id", id);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
