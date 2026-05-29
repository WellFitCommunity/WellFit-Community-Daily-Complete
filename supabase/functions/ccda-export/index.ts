/**
 * C-CDA Export Function
 *
 * Generates a Consolidated Clinical Document Architecture (C-CDA) document
 * for a patient's own health records per the 21st Century Cures Act.
 *
 * Implements the CCD (Continuity of Care Document) template with sections:
 * Demographics, Allergies, Medications, Problems, Procedures, Immunizations,
 * Vital Signs, Results (Labs), Plan of Care.
 *
 * ONC 170.315(d)(7)/(d)(8) data integrity: a SHA-256 digest of the exported
 * XML is returned both in the RFC 3230 `Digest` response header and in the
 * JSON body so a recipient can verify the document was not altered in transit.
 *
 * Decomposed (2026-05-29) from an 836-line single file into:
 *   types.ts | helpers.ts | sections.ts | document.ts | queries.ts | index.ts
 *
 * @see https://www.hl7.org/ccdasearch/
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createUserClient } from '../_shared/supabaseClient.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { computeSha256, digestHeader } from '../_shared/integrityHash.ts';
import { fetchCcdaData } from './queries.ts';
import { generateCCDA } from './document.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createUserClient(authHeader);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Fetch all USCDI data for the patient's own records (explicit columns).
    const data = await fetchCcdaData(supabase, userId);

    // Generate the C-CDA XML.
    const ccda = generateCCDA({
      ...data,
      documentId: `${userId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    });

    // ONC (d)(7)/(d)(8): integrity hash over the exact transmitted document.
    const integrity = await computeSha256(ccda);

    return new Response(
      JSON.stringify({
        xml: ccda,
        integrity: {
          algorithm: integrity.algorithm,
          sha256_hex: integrity.hex,
          digest: digestHeader(integrity),
        },
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Digest': digestHeader(integrity),
          'X-Integrity-Algorithm': integrity.algorithm,
        },
      }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate C-CDA', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
