-- MCP Key Rotation — S5-2 Security Fix
-- Rotates all 13 per-server MCP keys.
-- Old keys (from migration 20260304000003) are revoked.
-- New keys are inserted with the same scopes.
--
-- Reason: Old keys were committed to git history in .mcp.json.
-- After this migration, those keys are useless (revoked_at set).

BEGIN;

-- ============================
-- Step 1: Revoke all existing active keys
-- ============================
UPDATE mcp_keys
SET revoked_at = NOW(),
    description = description || ' [ROTATED — old key in git history]'
WHERE revoked_at IS NULL
  AND key_prefix IN (
    'mcp_de82d0b7', 'mcp_eeaa958a', 'mcp_4a7de851', 'mcp_60c0b455',
    'mcp_eabd4814', 'mcp_017ec37e', 'mcp_0e240385', 'mcp_c8c7512e',
    'mcp_93ed0292', 'mcp_6f9298da', 'mcp_1e382ca8', 'mcp_aad90f5c',
    'mcp_43dfdd07'
  );

-- ============================
-- Step 2: Insert 13 new rotated keys
-- ============================

-- 1. Claude Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '3c0fa2a3ae5be53d43ef88a0cd806fb0c596f1136e0a8fd9a53f2d62c52d3afe',
  'mcp_9e8525f2',
  'Claude Server Key (rotated)',
  'Per-server key for mcp-claude-server — rotated 2026-03-04',
  ARRAY['mcp:claude'],
  NOW(), NULL
);

-- 2. CMS Coverage Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'fe618371c4f7523453405adb231375999cf5f28ff3a3cf809381cc86ebc4945f',
  'mcp_32c9abba',
  'CMS Coverage Server Key (rotated)',
  'Per-server key for mcp-cms-coverage-server — rotated 2026-03-04',
  ARRAY['mcp:cms_coverage'],
  NOW(), NULL
);

-- 3. NPI Registry Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '84a49068b79687f7cedf74268d988e998dd8e597e023ecaca2f6232951507574',
  'mcp_d1c8a801',
  'NPI Registry Server Key (rotated)',
  'Per-server key for mcp-npi-registry-server — rotated 2026-03-04',
  ARRAY['mcp:npi_registry'],
  NOW(), NULL
);

-- 4. Postgres Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '86be737f66ce8885bbdcfbdd6452c86c664b2a8be8cf9a07f814c1d9058c9efa',
  'mcp_02fb28c0',
  'Postgres Server Key (rotated)',
  'Per-server key for mcp-postgres-server — rotated 2026-03-04',
  ARRAY['mcp:postgres'],
  NOW(), NULL
);

-- 5. Edge Functions Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '9fc26a3282bb67a671efb842821b531d42be26ae0ed49f579dafb60045f62c64',
  'mcp_86a657ec',
  'Edge Functions Server Key (rotated)',
  'Per-server key for mcp-edge-functions-server — rotated 2026-03-04',
  ARRAY['mcp:edge_functions'],
  NOW(), NULL
);

-- 6. Medical Codes Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '41ad541413c79077a7173d4d790adb2265151e4e5e8a616dab7f96b6f88b2ca5',
  'mcp_de438d12',
  'Medical Codes Server Key (rotated)',
  'Per-server key for mcp-medical-codes-server — rotated 2026-03-04',
  ARRAY['mcp:medical_codes'],
  NOW(), NULL
);

-- 7. FHIR Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '0a52159f20dce7b6fccca6be8ee5f04a9ea6f39f9fd8ffec3c4257ca7cbe21b8',
  'mcp_bbf40dae',
  'FHIR Server Key (rotated)',
  'Per-server key for mcp-fhir-server — rotated 2026-03-04',
  ARRAY['mcp:fhir'],
  NOW(), NULL
);

-- 8. HL7/X12 Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'd2b7ca520894dfcae1d9810c87e9020e025719f3f163f2914e21b58da2beae49',
  'mcp_206101b6',
  'HL7/X12 Server Key (rotated)',
  'Per-server key for mcp-hl7-x12-server — rotated 2026-03-04',
  ARRAY['mcp:hl7_x12'],
  NOW(), NULL
);

-- 9. Clearinghouse Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'a7c3a90ef95a391fa1ed513f26d5da346d0198a484c30ebc2021ebbcf27e6c78',
  'mcp_f6f4952b',
  'Clearinghouse Server Key (rotated)',
  'Per-server key for mcp-clearinghouse-server — rotated 2026-03-04',
  ARRAY['mcp:clearinghouse'],
  NOW(), NULL
);

-- 10. Prior Auth Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '689fd0d92f46101840ea70fe134a0fcf41274e0b871d156f4da25e313c283d36',
  'mcp_232e3425',
  'Prior Auth Server Key (rotated)',
  'Per-server key for mcp-prior-auth-server — rotated 2026-03-04',
  ARRAY['mcp:prior_auth'],
  NOW(), NULL
);

-- 11. PubMed Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '3797ed87719299a366a83ae1de8dc3010a32cd45ca11cb7f46b72f559d001761',
  'mcp_5c337d71',
  'PubMed Server Key (rotated)',
  'Per-server key for mcp-pubmed-server — rotated 2026-03-04',
  ARRAY['mcp:pubmed'],
  NOW(), NULL
);

-- 12. Cultural Competency Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  '9feaf62bbf0baecbc219bc33673a9fe3c23eb8758829b9c6020a6a76e7984780',
  'mcp_4130c9ba',
  'Cultural Competency Server Key (rotated)',
  'Per-server key for mcp-cultural-competency-server — rotated 2026-03-04',
  ARRAY['mcp:cultural_competency'],
  NOW(), NULL
);

-- 13. Medical Coding Server Key (rotated)
INSERT INTO mcp_keys (key_hash, key_prefix, name, description, scopes, created_at, expires_at)
VALUES (
  'c1651cc4a22fd4041681a841802691756830dc497426c65907824ca0a7c9c8dd',
  'mcp_b4253b04',
  'Medical Coding Server Key (rotated)',
  'Per-server key for mcp-medical-coding-server — rotated 2026-03-04',
  ARRAY['mcp:medical_coding'],
  NOW(), NULL
);

COMMIT;
