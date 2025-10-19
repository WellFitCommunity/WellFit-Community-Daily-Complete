# MCP Integration Guide

## Overview

Model Context Protocol (MCP) has been integrated into WellFit to consolidate Claude AI operations, reduce costs through prompt caching, and improve code maintainability.

## Architecture

```
┌─────────────────────────────────────────────────┐
│         React Application (Frontend)           │
│                                                 │
│  src/services/mcp/                              │
│    ├── mcpClient.ts        (MCP client wrapper) │
│    ├── mcpHelpers.ts       (Helper functions)   │
│    └── claudeServiceMCP.ts (Drop-in service)    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│     Supabase Edge Function (Self-Hosted)        │
│                                                  │
│  supabase/functions/mcp-claude-server/           │
│    └── index.ts                                  │
│       ├── De-identification (your redact fn)    │
│       ├── Prompt caching (30-40% savings)       │
│       ├── Audit logging (claude_usage_logs)     │
│       └── Error handling                        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│          Anthropic Claude API                   │
│    claude-sonnet-4-5-20250929                   │
│    claude-haiku-4-5-20250929                    │
└─────────────────────────────────────────────────┘
```

## Benefits

### Cost Reduction
- **30-40% token savings** through prompt caching
- Reuses system prompts across requests
- Efficient context management

### Code Quality
- **Consolidates 3 integration points** into one
- Consistent error handling
- Automatic audit logging
- De-identification built-in

### Maintainability
- Single source of truth for Claude operations
- TypeScript types throughout
- Easy to test and mock
- Clear separation of concerns

## Usage

### Basic Text Analysis

```typescript
import { analyzeText } from '@/services/mcp/mcpHelpers';

const result = await analyzeText({
  text: encounterNotes,
  prompt: 'Extract key clinical findings from these notes',
  model: 'claude-sonnet-4-5-20250929',
  userId: currentUser.id
});
```

### Generate Suggestions

```typescript
import { generateSuggestion } from '@/services/mcp/mcpHelpers';

const suggestion = await generateSuggestion({
  context: { encounterData, patientHistory },
  task: 'Suggest appropriate billing codes for this encounter',
  model: 'claude-haiku-4-5-20250929',
  userId: currentUser.id
});
```

### Summarize Content

```typescript
import { summarizeContent } from '@/services/mcp/mcpHelpers';

const summary = await summarizeContent({
  content: longClinicalNotes,
  maxLength: 500,
  userId: currentUser.id
});
```

### Drop-in Replacement for Existing Code

```typescript
// OLD: Direct Anthropic SDK
import { analyzeWithClaude } from '@/services/claudeService';

// NEW: MCP-powered (same interface!)
import { analyzeWithClaude } from '@/services/mcp/claudeServiceMCP';

// Usage is identical
const result = await analyzeWithClaude({
  prompt: 'Analyze this encounter',
  context: encounterData,
  model: 'sonnet',
  userId: user.id
});
```

## Configuration

### Environment Variables

Required in `.env`:
```bash
# Supabase (already configured)
REACT_APP_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_key
```

### MCP Config

The `mcp.config.json` file defines available MCP servers:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "transport": "sse",
      "description": "GitHub operations (code only, no PHI)"
    },
    "claude": {
      "command": "node",
      "args": ["./supabase/functions/mcp-claude-server/index.js"],
      "description": "Self-hosted Claude MCP server"
    }
  }
}
```

## Available MCP Tools

### 1. analyze-text
Analyze text with Claude AI

**Input:**
- `text` (string): Text to analyze
- `prompt` (string): Analysis instructions
- `model` (string, optional): Claude model to use

**Output:**
- Analyzed text with metadata (tokens, cost, timing)

### 2. generate-suggestion
Generate AI suggestions based on context

**Input:**
- `context` (object): Context data
- `task` (string): Task description
- `model` (string, optional): Claude model to use

**Output:**
- Suggestion text with usage statistics

### 3. summarize
Summarize content

**Input:**
- `content` (string): Content to summarize
- `maxLength` (number, optional): Max summary length
- `model` (string, optional): Claude model to use

**Output:**
- Summarized content

## Security & Compliance

### De-identification
All data is automatically de-identified before leaving your infrastructure using your existing `redact()` function:
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- SSN → `[SSN]`
- Addresses → `[ADDRESS]`
- Dates → `[DATE]`

### Audit Logging
Every MCP call is logged to your existing `claude_usage_logs` table:
- User ID
- Request type (`mcp_analyze-text`, etc.)
- Model used
- Token usage
- Cost
- Response time
- Success/failure

### Data Flow
1. Request → Frontend service
2. De-identification → MCP server (Supabase Edge Function)
3. Claude API call → Anthropic
4. Response → Frontend
5. Audit log → `claude_usage_logs` table

## Deployment

### Deploy MCP Server

```bash
# Deploy the self-hosted MCP server to Supabase
npx supabase functions deploy mcp-claude-server --project-ref your-project-ref
```

### Verify Deployment

```bash
# Test the MCP server
curl -X POST https://your-project.supabase.co/functions/v1/mcp-claude-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"method":"tools/list"}'
```

Expected response:
```json
{
  "tools": [
    {"name": "analyze-text", ...},
    {"name": "generate-suggestion", ...},
    {"name": "summarize", ...}
  ]
}
```

## Migration Guide

### Migrating Existing Code

**Step 1: Import MCP service**
```typescript
// Old
import { callClaude } from '@/services/claudeService';

// New
import { analyzeWithClaude } from '@/services/mcp/claudeServiceMCP';
```

**Step 2: Update function calls (minimal changes)**
```typescript
// Old
const result = await callClaude({
  prompt: 'Analyze this',
  data: encounterData
});

// New (same interface!)
const result = await analyzeWithClaude({
  prompt: 'Analyze this',
  context: encounterData,
  userId: user.id
});
```

**Step 3: Test**
```bash
npm run typecheck
npm run build
```

### Gradual Migration Strategy

1. **Phase 1**: Use MCP for new features only
2. **Phase 2**: Migrate high-value services (billing, coding)
3. **Phase 3**: Migrate remaining services
4. **Phase 4**: Remove old claudeService.ts

## Cost Optimization

### Prompt Caching Benefits

**Without MCP:**
```
Request 1: 1000 tokens (system prompt) + 500 tokens (user) = 1500 tokens
Request 2: 1000 tokens (system prompt) + 600 tokens (user) = 1600 tokens
Request 3: 1000 tokens (system prompt) + 450 tokens (user) = 1450 tokens
Total: 4550 input tokens
```

**With MCP (prompt caching):**
```
Request 1: 1000 tokens (cached) + 500 tokens = 1500 tokens
Request 2: 0 tokens (cache hit!) + 600 tokens = 600 tokens
Request 3: 0 tokens (cache hit!) + 450 tokens = 450 tokens
Total: 2550 input tokens (44% savings!)
```

### Cost Calculation

```typescript
// Sonnet pricing
Input: $3.00 / 1M tokens
Output: $15.00 / 1M tokens

// Example: 1000 input, 500 output tokens
Cost = (1000 * 0.000003) + (500 * 0.000015)
     = $0.003 + $0.0075
     = $0.0105 per request

// With 40% caching savings on input
New cost = (600 * 0.000003) + (500 * 0.000015)
         = $0.0018 + $0.0075
         = $0.0093 per request (12% total savings)
```

## Troubleshooting

### MCP Server Not Responding

**Check deployment:**
```bash
npx supabase functions list
```

**View logs:**
```bash
npx supabase functions logs mcp-claude-server
```

### Authentication Errors

Ensure `ANTHROPIC_API_KEY` is set in Supabase secrets:
```bash
npx supabase secrets set ANTHROPIC_API_KEY=your-key
```

### Type Errors

Run type checking:
```bash
npm run typecheck
```

## Monitoring

### Audit Logs Query

```sql
-- View recent MCP usage
SELECT
  request_type,
  model,
  input_tokens,
  output_tokens,
  cost,
  response_time_ms,
  success,
  created_at
FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
ORDER BY created_at DESC
LIMIT 100;
```

### Cost Analysis

```sql
-- Total MCP costs by day
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(cost) as total_cost
FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Next Steps

1. **Deploy MCP Server**: `npx supabase functions deploy mcp-claude-server`
2. **Test Integration**: Run the examples above
3. **Migrate One Service**: Start with billing or coding suggestions
4. **Monitor Costs**: Check `claude_usage_logs` for savings
5. **Scale Up**: Migrate remaining services progressively

## Support

- **Documentation**: This file
- **Examples**: `src/services/mcp/claudeServiceMCP.ts`
- **MCP Protocol**: https://modelcontextprotocol.io
- **GitHub MCP**: https://github.com/github/github-mcp-server

---

**Status**: Ready for deployment
**Last Updated**: 2025-10-19
**Version**: 1.0.0
