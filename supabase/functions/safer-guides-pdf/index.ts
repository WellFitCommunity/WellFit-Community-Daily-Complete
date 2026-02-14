/**
 * SAFER Guides PDF Attestation Edge Function
 *
 * ONC Requirement: CMS Promoting Interoperability Program
 * Purpose: Generate professional HTML attestation document for SAFER Guides assessment
 *
 * POST { assessmentId, tenantId }
 * Returns { html: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// =============================================================================
// TYPES
// =============================================================================

interface PdfRequest {
  assessmentId: string;
  tenantId: string;
}

interface GuideScore {
  guideNumber: string;
  score: number;
}

// =============================================================================
// HTML GENERATION
// =============================================================================

function generateAttestationHtml(params: {
  orgName: string;
  attesterName: string;
  year: number;
  attestedAt: string;
  overallScore: number | null;
  guideScores: GuideScore[];
  guideNames: Record<string, string>;
  totalQuestions: number;
  totalAnswered: number;
}): string {
  const {
    orgName,
    attesterName,
    year,
    attestedAt,
    overallScore,
    guideScores,
    guideNames,
    totalQuestions,
    totalAnswered,
  } = params;

  const attestDate = new Date(attestedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const scoreRows = guideScores
    .sort((a, b) => Number(a.guideNumber) - Number(b.guideNumber))
    .map(gs => {
      const name = guideNames[gs.guideNumber] || `Guide ${gs.guideNumber}`;
      const scoreColor = gs.score >= 80 ? '#16a34a' : gs.score >= 60 ? '#ca8a04' : '#dc2626';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">Guide ${gs.guideNumber}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:600;color:${scoreColor};">${gs.score}%</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>SAFER Guides Attestation - ${year}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1e293b;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1e40af;
      font-size: 24px;
      margin: 0 0 4px;
    }
    .header h2 {
      color: #475569;
      font-size: 16px;
      font-weight: normal;
      margin: 0;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .meta-item { text-align: center; }
    .meta-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-value { font-size: 18px; font-weight: 600; color: #1e293b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead th {
      background: #f1f5f9;
      padding: 10px 12px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    thead th:last-child { text-align: center; }
    .attestation-block {
      margin-top: 40px;
      padding: 24px;
      border: 2px solid #2563eb;
      border-radius: 8px;
      background: #eff6ff;
    }
    .attestation-block h3 { color: #1e40af; margin-top: 0; }
    .signature-line {
      margin-top: 30px;
      padding-top: 8px;
      border-top: 1px solid #1e293b;
      display: inline-block;
      min-width: 300px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    .overall-score {
      font-size: 48px;
      font-weight: 700;
      color: ${(overallScore ?? 0) >= 80 ? '#16a34a' : (overallScore ?? 0) >= 60 ? '#ca8a04' : '#dc2626'};
    }
    .print-btn {
      display: block;
      margin: 0 auto 30px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      cursor: pointer;
    }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

  <div class="header">
    <h1>SAFER Guides Self-Assessment Attestation</h1>
    <h2>${year} Annual Assessment</h2>
  </div>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Organization</div>
      <div class="meta-value">${orgName}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Overall Score</div>
      <div class="overall-score">${overallScore ?? 'N/A'}%</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Questions</div>
      <div class="meta-value">${totalAnswered} / ${totalQuestions}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Date Attested</div>
      <div class="meta-value">${attestDate}</div>
    </div>
  </div>

  <h3>Guide Scores</h3>
  <table>
    <thead>
      <tr>
        <th style="width:100px;">Guide</th>
        <th>Name</th>
        <th style="width:80px;text-align:center;">Score</th>
      </tr>
    </thead>
    <tbody>
      ${scoreRows}
    </tbody>
  </table>

  <div class="attestation-block">
    <h3>Attestation Statement</h3>
    <p>
      I, <strong>${attesterName}</strong>, hereby attest that <strong>${orgName}</strong>
      has completed the ${year} SAFER Guides Self-Assessment as required by the
      CMS Promoting Interoperability Program. The results documented above accurately
      reflect our organization's current EHR safety practices as assessed against
      the ONC Safety Assurance Factors for EHR Resilience (SAFER) guides.
    </p>
    <p>
      This assessment was completed on <strong>${attestDate}</strong> and covers
      all 9 SAFER Guides with an overall compliance score of <strong>${overallScore ?? 'N/A'}%</strong>.
    </p>
    <div style="margin-top:30px;">
      <div class="signature-line">${attesterName}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Authorized Representative</div>
    </div>
  </div>

  <div class="footer">
    <p>Generated by Envision ATLUS I.H.I.S. | ONC SAFER Guides Assessment Module</p>
    <p>Reference: https://www.healthit.gov/topic/safety/safer-guides</p>
  </div>
</body>
</html>`;
}

// =============================================================================
// HANDLER
// =============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body: PdfRequest = await req.json();
    const { assessmentId, tenantId } = body;

    if (!assessmentId || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: assessmentId, tenantId' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch assessment
    const { data: assessment, error: assessError } = await supabase
      .from('safer_guide_assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (assessError || !assessment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Assessment not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Fetch organization name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('organization_name')
      .eq('id', tenantId)
      .single();

    // Fetch attester name
    let attesterName = 'Authorized Representative';
    if (assessment.attested_by) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('user_id', assessment.attested_by)
        .single();

      if (profile) {
        attesterName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || attesterName;
      }
    }

    // Fetch guide definitions for names
    const { data: guides } = await supabase
      .from('safer_guide_definitions')
      .select('guide_number, guide_name')
      .eq('is_active', true)
      .order('guide_number');

    const guideNames: Record<string, string> = {};
    (guides || []).forEach((g: { guide_number: number; guide_name: string }) => {
      guideNames[g.guide_number.toString()] = g.guide_name;
    });

    // Parse guide scores
    const rawScores = (assessment.guide_scores || {}) as Record<string, number>;
    const guideScores: GuideScore[] = Object.entries(rawScores).map(([num, score]) => ({
      guideNumber: num,
      score,
    }));

    // Count questions
    const { count: totalQuestions } = await supabase
      .from('safer_guide_questions')
      .select('id', { count: 'exact', head: true });

    const { count: totalAnswered } = await supabase
      .from('safer_guide_responses')
      .select('id', { count: 'exact', head: true })
      .eq('assessment_id', assessmentId);

    const html = generateAttestationHtml({
      orgName: tenant?.organization_name || 'Organization',
      attesterName,
      year: assessment.assessment_year,
      attestedAt: assessment.attested_at || new Date().toISOString(),
      overallScore: assessment.overall_score,
      guideScores,
      guideNames,
      totalQuestions: totalQuestions || 0,
      totalAnswered: totalAnswered || 0,
    });

    return new Response(
      JSON.stringify({ success: true, html }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
