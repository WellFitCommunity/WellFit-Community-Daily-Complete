# MCP Servers - Quick Reference

WellFit healthcare platform MCP (Model Context Protocol) servers.

## Tier Architecture

| Tier | Name | Auth Required | Supabase | Use Case |
|------|------|---------------|----------|----------|
| **1** | `external_api` | apikey only | Optional | External APIs (CMS, clearinghouses) |
| **2** | `user_scoped` | apikey + JWT | Required (ANON) | User data with RLS isolation |
| **3** | `admin` | apikey + service role | Required (SECRET) | Admin ops, clinical writes |

## All 10 Servers

### Tier 1 - External API (No Supabase Required)

| Server | Purpose | External API |
|--------|---------|--------------|
| `mcp-cms-coverage-server` | Medicare LCD/NCD lookups | CMS Medicare Coverage DB |
| `mcp-npi-registry-server` | Provider NPI validation | CMS NPI Registry |
| `mcp-clearinghouse-server` | Claims, eligibility, remittance | Waystar/Change/Availity |

### Tier 2 - User Scoped (ANON Key + RLS)

| Server | Purpose | Data Access |
|--------|---------|-------------|
| `mcp-postgres-server` | Safe database queries | Whitelisted queries only |
| `mcp-medical-codes-server` | CPT/ICD-10/HCPCS lookup | Public reference data |

### Tier 3 - Admin (Service Role Required)

| Server | Purpose | Role Required |
|--------|---------|---------------|
| `mcp-claude-server` | AI operations via Claude | `super_admin` |
| `mcp-prior-auth-server` | Prior authorization FHIR API | Clinical roles |
| `mcp-fhir-server` | FHIR R4 resource operations | Clinical roles |
| `mcp-hl7-x12-server` | HL7/X12/FHIR transformation | `super_admin` |
| `mcp-edge-functions-server` | Edge function orchestration | `super_admin` |

## Header Template

All servers use this standardized header format:

```typescript
// =====================================================
// MCP [Name] Server
// Purpose: [Brief description]
// Features: [Comma-separated list]
//
// TIER [N] ([tier_value]): [Auth description]
// Auth: [Specific requirements]
// =====================================================
```

## Authentication Flow

```
Request → Supabase Edge (apikey check) → MCP Server
                                              ↓
                                    Tier 1: Process immediately
                                    Tier 2: Verify JWT, apply RLS
                                    Tier 3: Verify service role + role check
```

## Key Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `SB_ANON_KEY` | Tier 1-2 | Rate limiting, user context |
| `SB_SECRET_KEY` | Tier 3 | Admin operations |
| `SUPABASE_URL` | All | Database connection |
| `ANTHROPIC_API_KEY` | claude-server | AI operations |

## Adding a New Server

1. Choose appropriate tier based on data sensitivity
2. Copy header template from existing server of same tier
3. Use `initMCPServer()` from `mcpServerBase.ts`
4. Add auth verification from `mcpAuthGate.ts` if Tier 3
5. Update this README with new server entry
