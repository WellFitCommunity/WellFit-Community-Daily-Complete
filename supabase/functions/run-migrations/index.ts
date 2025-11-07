// Deno Edge Function to run migrations
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const INTERNAL_API_KEY = Deno.env.get("INTERNAL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${INTERNAL_API_KEY}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read migration files
    const migration1 = await Deno.readTextFile("./migrations/20251106000000_mcp_cost_tracking.sql");
    const migration2 = await Deno.readTextFile("./migrations/20251106000001_physician_workflow_preferences.sql");

    // Execute migrations
    const results = [];

    for (const [name, sql] of [
      ["mcp_cost_tracking", migration1],
      ["physician_workflow_preferences", migration2]
    ]) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        results.push({ migration: name, status: "error", error: error.message });
      } else {
        results.push({ migration: name, status: "success" });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
