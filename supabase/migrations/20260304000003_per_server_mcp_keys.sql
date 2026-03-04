-- Per-Server MCP Keys Migration
-- Replaces shared key (mcp_deb87fb957ded2691215ae7e47c87a66) with 13 individual keys
-- Security fix: if one key leaks, only one server is compromised
--
-- Each key has scopes restricted to its server's operations.
-- Old shared key is revoked at the end.

-- 1. Claude Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'b874913f404e452aa8eaab97cf068375a7c9f63b8a772b8da64094afeb4d2e31',
  'mcp_de82d0b7',
  'Claude Server Key',
  'Per-server key for mcp-claude-server',
  ARRAY['mcp:claude'],
  NOW(), NULL
);

-- 2. CMS Coverage Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'dfe20ba3750d708962aa4b03f7793bab14e63d58ed8893a65156b5fbb628d31e',
  'mcp_eeaa958a',
  'CMS Coverage Server Key',
  'Per-server key for mcp-cms-coverage-server',
  ARRAY['mcp:cms_coverage'],
  NOW(), NULL
);

-- 3. NPI Registry Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'b85c6eee6474b7730e7aa71f2514cdbd982984003058bc36a73920112a7e9b62',
  'mcp_4a7de851',
  'NPI Registry Server Key',
  'Per-server key for mcp-npi-registry-server',
  ARRAY['mcp:npi_registry'],
  NOW(), NULL
);

-- 4. Postgres Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '73581aefb2aefcc76a48b30190bb175e3b806a8aeba68ce169ef5c83b553924e',
  'mcp_60c0b455',
  'Postgres Server Key',
  'Per-server key for mcp-postgres-server',
  ARRAY['mcp:postgres'],
  NOW(), NULL
);

-- 5. Edge Functions Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'ffa81227303895f303e5f13dae5db1581127490f78e67fc5e9e8b7c5827e36dd',
  'mcp_eabd4814',
  'Edge Functions Server Key',
  'Per-server key for mcp-edge-functions-server',
  ARRAY['mcp:edge_functions'],
  NOW(), NULL
);

-- 6. Medical Codes Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '074c786a02f10e7c751b864e501d82aefec1c2b0c8a1bb657808c6896f944b63',
  'mcp_017ec37e',
  'Medical Codes Server Key',
  'Per-server key for mcp-medical-codes-server',
  ARRAY['mcp:medical_codes'],
  NOW(), NULL
);

-- 7. FHIR Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '8560ce2b9d98781111106eea2450812956f6ac916d93c90c0d01340f81b313d6',
  'mcp_0e240385',
  'FHIR Server Key',
  'Per-server key for mcp-fhir-server',
  ARRAY['mcp:fhir'],
  NOW(), NULL
);

-- 8. HL7-X12 Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'db97842d1c1ec9292f34f576d9e05ef448c40b303800083686be04b43f8ea6c3',
  'mcp_c8c7512e',
  'HL7-X12 Server Key',
  'Per-server key for mcp-hl7-x12-server',
  ARRAY['mcp:hl7_x12'],
  NOW(), NULL
);

-- 9. Clearinghouse Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '5c9adcd4eabb850cdea4132ccf5cc9d9a36e0bc077d8067b5b18c77af599bace',
  'mcp_93ed0292',
  'Clearinghouse Server Key',
  'Per-server key for mcp-clearinghouse-server',
  ARRAY['mcp:clearinghouse'],
  NOW(), NULL
);

-- 10. Prior Auth Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '6ada0d1450183edb1276a6525dd3e6d6f4653eb55e807753f17c3d75e9cd09b8',
  'mcp_6f9298da',
  'Prior Auth Server Key',
  'Per-server key for mcp-prior-auth-server',
  ARRAY['mcp:prior_auth'],
  NOW(), NULL
);

-- 11. PubMed Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '9460c7972088d45d097d0f37bb295e9e57262f0b1b0b0a38d9a0e700dfb7d5bf',
  'mcp_1e382ca8',
  'PubMed Server Key',
  'Per-server key for mcp-pubmed-server',
  ARRAY['mcp:pubmed'],
  NOW(), NULL
);

-- 12. Cultural Competency Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '54998cfbfe4a5e978812ed7783cf777becc047e82d92d3e6a5bb000b5fdf8f01',
  'mcp_aad90f5c',
  'Cultural Competency Server Key',
  'Per-server key for mcp-cultural-competency-server',
  ARRAY['mcp:cultural_competency'],
  NOW(), NULL
);

-- 13. Medical Coding Server Key
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '3b80c12de96176607bd00ff98004868585cceb9508dc6e83e16d4a60b23b5da9',
  'mcp_43dfdd07',
  'Medical Coding Server Key',
  'Per-server key for mcp-medical-coding-server',
  ARRAY['mcp:medical_coding'],
  NOW(), NULL
);

-- 14. Revoke the old shared key (mcp_deb87fb957ded2691215ae7e47c87a66)
-- Hash: computed from the raw key
UPDATE mcp_keys
SET revoked_at = NOW(),
    revocation_reason = 'Replaced with per-server keys (S2-1 security fix)'
WHERE key_prefix = 'mcp_deb87fb9'
  AND revoked_at IS NULL;

-- Add new scopes to the available scopes reference (informational comment only)
-- New scopes added: mcp:pubmed, mcp:cultural_competency, mcp:medical_coding
