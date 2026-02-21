-- Migration: Register MCP key for Claude Code / Claude Desktop access
-- Purpose: The MCP key in .mcp.json was never inserted into the mcp_keys table,
--          causing all Tier 3 (admin) MCP server calls to fail with "Key validation failed"
-- Date: 2026-02-21

-- Insert the key with correct hash (SHA-256 of the raw key value)
-- Key: mcp_deb87fb957ded2691215ae7e47c87a66
-- Prefix: mcp_deb87fb9 (first 12 chars)
-- Hash: SHA-256 of the full key string
INSERT INTO public.mcp_keys (
    key_hash,
    key_prefix,
    name,
    description,
    scopes,
    tenant_id,
    expires_at
) VALUES (
    '69aaa08f4b2b89ba0b7db128a05e11af6c00783a842958d07f380c89c33949d4',
    'mcp_deb87fb9',
    'Claude Code Default Key',
    'Default MCP key for Claude Code and Claude Desktop access. Created during initial MCP server setup.',
    ARRAY['mcp:admin', 'mcp:fhir', 'mcp:prior_auth', 'mcp:hl7', 'mcp:clearinghouse', 'mcp:edge_functions'],
    '2b902657-6a20-4435-a78a-576f397517ca',  -- WF-0001 default tenant
    NULL  -- Never expires
)
ON CONFLICT (key_prefix) DO UPDATE SET
    key_hash = EXCLUDED.key_hash,
    scopes = EXCLUDED.scopes,
    name = EXCLUDED.name,
    description = EXCLUDED.description;
