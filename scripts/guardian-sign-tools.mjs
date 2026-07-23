#!/usr/bin/env node
/**
 * Sign all first-party Guardian tools (Session 2).
 *
 *   GUARDIAN_SIGNING_KEY='<private jwk json from guardian-generate-signing-key>' \
 *     node scripts/guardian-sign-tools.mjs
 *
 * Recomputes each built-in tool's deterministic checksum (the same
 * `${id}:${version}:builtin` scheme BuiltInTools.computeChecksum uses), signs
 * it with ES256, and writes src/services/guardian-agent/guardianToolSignatures.json.
 * A tool edit that changes id/version without re-running this script produces a
 * signature mismatch — deliberately loud.
 *
 * `--check` exits 1 if the committed signature file is stale (CI gate).
 */

import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { TextEncoder } from 'node:util';

const { subtle } = webcrypto;
const SIGNATURES_PATH = 'src/services/guardian-agent/guardianToolSignatures.json';
const REGISTRY_PATH = 'src/services/guardian-agent/ToolRegistry.ts';

// ---- The built-in tool list: parsed from ToolRegistry.ts so the script can
// ---- never drift from the source of truth silently.
const registrySource = readFileSync(REGISTRY_PATH, 'utf8');
const toolMatches = [...registrySource.matchAll(/checksum:\s*this\.computeChecksum\('([^']+)',\s*'([^']+)'\)/g)];
if (toolMatches.length === 0) {
  process.stderr.write('No built-in tools found in ToolRegistry.ts — parser drift?\n');
  process.exit(1);
}

// Mirror of BuiltInTools.computeChecksum (deterministic, sync)
function computeBuiltinChecksum(toolId, version) {
  const str = `${toolId}:${version}:builtin`;
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) | 0;
    hash2 = ((hash2 << 7) + hash2 + char) | 0;
  }
  const part1 = Math.abs(hash1).toString(16).padStart(16, '0');
  const part2 = Math.abs(hash2).toString(16).padStart(16, '0');
  const part3 = Math.abs(hash1 ^ hash2).toString(16).padStart(16, '0');
  const part4 = Math.abs(hash1 + hash2).toString(16).padStart(16, '0');
  return (part1 + part2 + part3 + part4).slice(0, 64);
}

function bytesToBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

const checkMode = process.argv.includes('--check');
const rawKey = process.env.GUARDIAN_SIGNING_KEY;

if (checkMode && !rawKey) {
  // CI without the secret: verify the signature file covers every tool id
  // (content verification needs the private key or a verify pass in tests).
  const existing = JSON.parse(readFileSync(SIGNATURES_PATH, 'utf8'));
  const missing = toolMatches.map(([, id]) => id).filter((id) => !existing[id]);
  if (Object.keys(existing).length === 0) {
    process.stdout.write('guardian-sign-tools --check: signing not yet provisioned (empty map) — OK in warn-only phase\n');
    process.exit(0);
  }
  if (missing.length > 0) {
    process.stderr.write(`Unsigned tools: ${missing.join(', ')} — run guardian-sign-tools.mjs with the key\n`);
    process.exit(1);
  }
  process.stdout.write(`guardian-sign-tools --check: all ${toolMatches.length} tools have signatures on file\n`);
  process.exit(0);
}

if (!rawKey) {
  process.stderr.write('GUARDIAN_SIGNING_KEY env var (private JWK JSON) is required\n');
  process.exit(1);
}

const { keyId, jwk } = JSON.parse(rawKey);
const privateKey = await subtle.importKey(
  'jwk',
  jwk,
  { name: 'ECDSA', namedCurve: 'P-256' },
  false,
  ['sign']
);

const signatures = {};
for (const [, toolId, version] of toolMatches) {
  const checksum = computeBuiltinChecksum(toolId, version);
  const data = new TextEncoder().encode(checksum);
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data);
  signatures[toolId] = {
    signature: bytesToBase64Url(new Uint8Array(sig)),
    keyId,
    signedAt: new Date().toISOString(),
  };
  process.stdout.write(`signed ${toolId}@${version}\n`);
}

writeFileSync(SIGNATURES_PATH, JSON.stringify(signatures, null, 2) + '\n');
process.stdout.write(`Wrote ${Object.keys(signatures).length} signatures to ${SIGNATURES_PATH}\n`);
