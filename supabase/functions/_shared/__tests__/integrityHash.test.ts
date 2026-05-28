/**
 * Tests for SHA-256 integrity-hash helper used by exports.
 *
 * Each test would fail if the function returned an empty digest
 * (per CLAUDE.md deletion test).
 */

import {
  assertEquals,
  assertMatch,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeSha256,
  digestHeader,
  responseIntegrity,
} from "../integrityHash.ts";

// NIST FIPS 180-2 published reference vector — the SHA-256 of the
// empty string is the canonical "is your implementation correct" test.
const SHA256_EMPTY_HEX =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

// "abc" — the second canonical FIPS reference vector (NIST FIPS 180-4 Appendix).
const SHA256_ABC_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

Deno.test("computeSha256 matches the FIPS 180-2 reference vector for empty input", async () => {
  const hash = await computeSha256("");
  assertEquals(hash.hex, SHA256_EMPTY_HEX);
  assertEquals(hash.algorithm, "SHA-256");
});

Deno.test('computeSha256 matches the FIPS 180-2 reference vector for "abc"', async () => {
  const hash = await computeSha256("abc");
  assertEquals(hash.hex, SHA256_ABC_HEX);
});

Deno.test("computeSha256 produces a 64-char lowercase hex digest", async () => {
  const hash = await computeSha256("any input");
  assertEquals(hash.hex.length, 64);
  assertMatch(hash.hex, /^[0-9a-f]{64}$/);
});

Deno.test("computeSha256 produces a 44-char base64 digest (32 bytes + padding)", async () => {
  const hash = await computeSha256("any input");
  assertEquals(hash.base64.length, 44);
  // Base64 of a 32-byte digest always ends with '='
  assertMatch(hash.base64, /=$/);
});

Deno.test("computeSha256 is deterministic for the same input", async () => {
  const a = await computeSha256("Patient/123|2026-05-28");
  const b = await computeSha256("Patient/123|2026-05-28");
  assertEquals(a.hex, b.hex);
  assertEquals(a.base64, b.base64);
});

Deno.test("computeSha256 produces different digests for different inputs", async () => {
  const a = await computeSha256("Patient/123");
  const b = await computeSha256("Patient/124");
  assertNotEquals(a.hex, b.hex);
});

Deno.test("computeSha256 handles UTF-8 encoded strings (multi-byte chars)", async () => {
  // The bytes for "naïve" differ between Latin-1 and UTF-8.
  // crypto.subtle hashes UTF-8 bytes — we normalize to UTF-8 in the helper.
  const hash = await computeSha256("naïve");
  assertMatch(hash.hex, /^[0-9a-f]{64}$/);
});

Deno.test("computeSha256 accepts a Uint8Array payload directly (no double-encoding)", async () => {
  const bytes = new TextEncoder().encode("abc");
  const hash = await computeSha256(bytes);
  assertEquals(hash.hex, SHA256_ABC_HEX);
});

Deno.test("digestHeader returns RFC 3230 sha-256 value", async () => {
  const hash = await computeSha256("payload");
  const header = digestHeader(hash);
  assertMatch(header, /^sha-256=/);
  assertEquals(header.slice("sha-256=".length), hash.base64);
});

Deno.test("responseIntegrity returns both Digest and X-Integrity-Algorithm headers", async () => {
  const { integrity, headers } = await responseIntegrity("payload");
  assertEquals(headers["X-Integrity-Algorithm"], "SHA-256");
  assertEquals(headers["Digest"], `sha-256=${integrity.base64}`);
});

Deno.test("responseIntegrity hash matches a separate computeSha256 on the same payload", async () => {
  const payload = '{"resourceType":"Bundle","type":"document"}';
  const { integrity } = await responseIntegrity(payload);
  const independent = await computeSha256(payload);
  assertEquals(integrity.hex, independent.hex);
});
