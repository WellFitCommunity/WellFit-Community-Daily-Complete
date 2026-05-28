// Shared SHA-256 integrity-hash helper for exported records.
//
// ONC 170.315(d)(7)/(d)(8) — exported clinical records must be
// integrity-verifiable end-to-end. The recipient recomputes SHA-256
// on the payload and compares to the value transmitted with the
// export (in the response body AND in the RFC 3230 `Digest` HTTP header).
//
// Deno's Web Crypto SHA-256 is used; no Node polyfills.

const ALGORITHM = "SHA-256";
const DIGEST_HEADER_NAME = "Digest";

export interface IntegrityHash {
  /** RFC 3279 algorithm label */
  algorithm: "SHA-256";
  /** Lowercase hex digest (64 chars) */
  hex: string;
  /** Base64 digest (44 chars including padding) — used in the `Digest` HTTP header */
  base64: string;
}

/**
 * Compute SHA-256 of the supplied payload. Accepts string, Uint8Array,
 * or ArrayBuffer; strings are UTF-8 encoded before hashing.
 */
export async function computeSha256(
  payload: string | Uint8Array | ArrayBuffer,
): Promise<IntegrityHash> {
  let bytes: Uint8Array;
  if (typeof payload === "string") {
    bytes = new TextEncoder().encode(payload);
  } else if (payload instanceof Uint8Array) {
    bytes = payload;
  } else {
    bytes = new Uint8Array(payload);
  }

  // .slice() materializes a fresh ArrayBuffer-backed Uint8Array (not
  // ArrayBufferLike) so Deno's crypto.subtle.digest BufferSource type
  // accepts it without a cast.
  const hashBuffer = await crypto.subtle.digest(ALGORITHM, bytes.slice());
  const hashBytes = new Uint8Array(hashBuffer);

  return {
    algorithm: "SHA-256",
    hex: toHex(hashBytes),
    base64: toBase64(hashBytes),
  };
}

/**
 * Build an RFC 3230 `Digest` header value for the supplied hash.
 * Example: `sha-256=u3F2YW5...=`
 */
export function digestHeader(hash: IntegrityHash): string {
  return `sha-256=${hash.base64}`;
}

/**
 * Convenience: hash the payload and return a {headers, integrity} pair
 * ready to be merged into a `Response` init object.
 *
 *   const { integrity, headers } = await responseIntegrity(payload);
 *   return new Response(payload, { headers: { ...corsHeaders, ...headers } });
 */
export async function responseIntegrity(
  payload: string | Uint8Array,
): Promise<{ integrity: IntegrityHash; headers: Record<string, string> }> {
  const integrity = await computeSha256(payload);
  return {
    integrity,
    headers: {
      [DIGEST_HEADER_NAME]: digestHeader(integrity),
      "X-Integrity-Algorithm": ALGORITHM,
    },
  };
}

// ---------------------------------------------------------------------------
// Encoding helpers — kept inline to avoid a dependency for this tiny module
// ---------------------------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}
