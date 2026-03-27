# /deploy-edge — Deploy Edge Functions

Deploy one or all Supabase edge functions with health verification. Pass a function name to deploy one, or "all" to deploy everything.

## Usage

- `/deploy-edge ai-care-plan-generator` — deploy one function
- `/deploy-edge all` — deploy all functions
- `/deploy-edge mcp` — deploy all MCP servers

## Steps

### Step 1: Identify Target

Parse the argument:
- If a specific function name: deploy just that one
- If "all": deploy all functions
- If "mcp": deploy all `mcp-*-server` functions
- If no argument: ask which function to deploy

### Step 2: Pre-Deploy Check

```bash
npm run lint 2>&1 | tail -3
```

If lint fails, stop and fix first.

### Step 3: Deploy

For single function:
```bash
npx supabase functions deploy <function-name> --no-verify-jwt
```

For all:
```bash
npx supabase functions deploy --no-verify-jwt
```

For MCP servers:
```bash
for dir in supabase/functions/mcp-*-server; do
  name=$(basename "$dir")
  npx supabase functions deploy "$name" --no-verify-jwt
done
```

Report the script size for each deployed function.

### Step 4: Health Verification

Wait 15 seconds after deploy, then verify each deployed function:

```bash
curl -s -w "HTTP %{http_code}" "https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/<function-name>"
```

**Pass:** HTTP 200 or 401 (auth required = server is alive). **Fail:** HTTP 500 or timeout.

### Step 5: Report

```
Edge Function Deployment
────────────────────────
Deployed: X function(s)
  [function-name]: XXX.XkB — ✅ healthy / ❌ failed
Total deploy time: Xs
```

If any function fails health check, flag it and suggest checking logs.
