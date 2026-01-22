/**
 * PDF Health Summary Export
 *
 * Generates a human-readable health summary for patients per 21st Century Cures Act.
 * Includes ALL USCDI data elements: demographics, medications, allergies, conditions,
 * procedures, immunizations, lab results, clinical notes, care plans, observations.
 *
 * Returns HTML that can be printed to PDF via browser print dialog.
 * Senior-friendly design with large text and simple language.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createUserClient, batchQueries } from '../_shared/supabaseClient.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Profile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
  phone?: string;
  email?: string;
}

interface Medication {
  id: string;
  user_id: string;
  medication_name?: string;
  dosage?: string;
  strength?: string;
  frequency?: string;
  instructions?: string;
  prescribed_by?: string;
  purpose?: string;
  status: string;
}

interface Allergy {
  id: string;
  user_id: string;
  allergen_name?: string;
  allergen_type?: string;
  reaction_description?: string;
  criticality?: 'high' | 'low' | 'moderate' | 'unknown';
  severity?: string;
}

interface Condition {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  clinical_status?: string;
  severity_code?: string;
  onset_datetime?: string;
  recorded_date?: string;
  note?: string;
}

interface Procedure {
  id: string;
  patient_id: string;
  code_display?: string;
  performed_datetime?: string;
  status?: string;
}

interface Immunization {
  id: string;
  patient_id: string;
  vaccine_display?: string;
  occurrence_datetime?: string;
  status?: string;
}

interface Observation {
  id: string;
  patient_id: string;
  code?: string;
  code_display?: string;
  category?: string;
  value_quantity?: number;
  value_string?: string;
  value_unit?: string;
  effective_datetime?: string;
  reference_range_low?: number;
  reference_range_high?: number;
}

interface LabResult {
  id: string;
  patient_mrn: string;
  test_name?: string;
  value?: string | number;
  unit?: string;
  reference_range?: string;
  abnormal?: boolean;
  extracted_at?: string;
}

interface CarePlan {
  id: string;
  patient_id: string;
  title?: string;
  description?: string;
  status?: string;
  period_start?: string;
}

interface ClinicalNote {
  id: string;
  author_id: string;
  content?: string;
  created_at?: string;
}

interface DiagnosticReport {
  id: string;
  patient_id: string;
  code_display?: string;
  category?: string;
  issued?: string;
  effective_datetime?: string;
  status?: string;
}

interface CheckIn {
  id: string;
  user_id: string;
  heart_rate?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  pulse_oximeter?: number;
  glucose_mg_dl?: number;
  created_at?: string;
}

interface VitalReading {
  value: string | number;
  unit: string;
  date: string;
}

serve(async (req) => {
  // Handle CORS preflight
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

    // Fetch ALL USCDI data in parallel for performance
    const [
      { data: profile },
      { data: medications },
      { data: allergies },
      { data: conditions },
      { data: procedures },
      { data: immunizations },
      { data: observations },
      { data: labResults },
      { data: carePlans },
      { data: clinicalNotes },
      { data: diagnosticReports },
      { data: checkIns }
    ] = await batchQueries([
      // Demographics
      () => supabase.from('profiles').select('*').eq('user_id', userId).single(),
      // Medications
      () => supabase.from('medications').select('*').eq('user_id', userId).eq('status', 'active').order('medication_name'),
      // Allergies
      () => supabase.from('allergy_intolerances').select('*').eq('user_id', userId).order('allergen_name'),
      // Conditions
      () => supabase.from('fhir_conditions').select('*').eq('patient_id', userId).order('recorded_date', { ascending: false }),
      // Procedures
      () => supabase.from('fhir_procedures').select('*').eq('patient_id', userId).order('performed_datetime', { ascending: false }).limit(20),
      // Immunizations
      () => supabase.from('fhir_immunizations').select('*').eq('patient_id', userId).order('occurrence_datetime', { ascending: false }),
      // Observations (vitals)
      () => supabase.from('fhir_observations').select('*').eq('patient_id', userId).order('effective_datetime', { ascending: false }).limit(50),
      // Lab Results
      () => supabase.from('lab_results').select('*').eq('patient_mrn', userId).order('extracted_at', { ascending: false }).limit(30),
      // Care Plans
      () => supabase.from('fhir_care_plans').select('*').eq('patient_id', userId).in('status', ['active', 'draft']),
      // Clinical Notes
      () => supabase.from('clinical_notes').select('*').eq('author_id', userId).order('created_at', { ascending: false }).limit(10),
      // Diagnostic Reports
      () => supabase.from('fhir_diagnostic_reports').select('*').eq('patient_id', userId).order('issued', { ascending: false }).limit(20),
      // Check-ins (vitals from app)
      () => supabase.from('check_ins').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    ]);

    // Generate HTML document
    const html = generateHealthSummaryHTML({
      profile,
      medications: medications || [],
      allergies: allergies || [],
      conditions: conditions || [],
      procedures: procedures || [],
      immunizations: immunizations || [],
      observations: observations || [],
      labResults: labResults || [],
      carePlans: carePlans || [],
      clinicalNotes: clinicalNotes || [],
      diagnosticReports: diagnosticReports || [],
      checkIns: checkIns || [],
      generatedAt: new Date().toISOString()
    });

    return new Response(JSON.stringify({ html }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Failed to generate health summary', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface HealthData {
  profile: Profile | null;
  medications: Medication[];
  allergies: Allergy[];
  conditions: Condition[];
  procedures: Procedure[];
  immunizations: Immunization[];
  observations: Observation[];
  labResults: LabResult[];
  carePlans: CarePlan[];
  clinicalNotes: ClinicalNote[];
  diagnosticReports: DiagnosticReport[];
  checkIns: CheckIn[];
  generatedAt: string;
}

function generateHealthSummaryHTML(data: HealthData): string {
  const { profile, medications, allergies, conditions, procedures, immunizations,
          observations, labResults, carePlans, clinicalNotes, diagnosticReports, checkIns, generatedAt } = data;

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const patientName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Patient';
  const dob = profile?.dob ? formatDate(profile.dob) : 'Not provided';

  // Group observations by category
  const vitalSigns = observations.filter((o) => o.category?.includes('vital-signs'));
  const labObservations = observations.filter((o) => o.category?.includes('laboratory'));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Health Summary - ${patientName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 18px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 20px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 { font-size: 28px; color: #1e40af; margin-bottom: 10px; }
    h2 {
      font-size: 22px;
      color: #1e40af;
      margin: 30px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 3px solid #3b82f6;
    }
    h3 { font-size: 20px; color: #374151; margin: 20px 0 10px 0; }

    .header {
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { color: white; }
    .header p { font-size: 16px; opacity: 0.9; }

    .patient-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .patient-info div {
      background: rgba(255,255,255,0.15);
      padding: 12px;
      border-radius: 8px;
    }
    .patient-info label {
      display: block;
      font-size: 14px;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    .patient-info span { font-size: 18px; font-weight: 600; }

    .section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .alert-section {
      background: #fef2f2;
      border: 2px solid #ef4444;
    }
    .alert-section h2 { color: #dc2626; border-color: #ef4444; }

    .medication-card, .condition-card, .allergy-card, .item-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 12px;
    }
    .medication-card h4, .condition-card h4, .allergy-card h4, .item-card h4 {
      font-size: 18px;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .medication-card p, .condition-card p, .allergy-card p, .item-card p {
      font-size: 16px;
      color: #4b5563;
      margin: 4px 0;
    }

    .allergy-card {
      border-left: 4px solid #ef4444;
    }
    .allergy-card.high { background: #fef2f2; }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-right: 8px;
    }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #f3f4f6; color: #6b7280; }
    .badge-high { background: #fef2f2; color: #dc2626; }
    .badge-moderate { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dbeafe; color: #1e40af; }

    .vital-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
    }
    .vital-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .vital-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #1e40af;
    }
    .vital-card .label {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }
    .vital-card .date {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      color: #374151;
    }
    tr:hover { background: #f8fafc; }

    .footer {
      margin-top: 40px;
      padding: 20px;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 14px;
      color: #6b7280;
    }

    .empty-state {
      text-align: center;
      padding: 30px;
      color: #9ca3af;
      font-style: italic;
    }

    @media print {
      body { font-size: 12pt; padding: 0; }
      .section { break-inside: avoid; }
      .header { background: #1e40af !important; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 My Health Summary</h1>
    <p>Personal Health Record - Generated ${formatDate(generatedAt)}</p>
    <div class="patient-info">
      <div>
        <label>Name</label>
        <span>${escapeHtml(patientName)}</span>
      </div>
      <div>
        <label>Date of Birth</label>
        <span>${escapeHtml(dob)}</span>
      </div>
      ${profile?.phone ? `<div><label>Phone</label><span>${escapeHtml(profile.phone)}</span></div>` : ''}
      ${profile?.email ? `<div><label>Email</label><span>${escapeHtml(profile.email)}</span></div>` : ''}
    </div>
  </div>

  <!-- ALLERGIES - Critical Section -->
  <div class="section alert-section">
    <h2>⚠️ Allergies & Intolerances</h2>
    ${allergies.length === 0
      ? '<div class="empty-state">No known allergies recorded</div>'
      : allergies.map((a) => `
        <div class="allergy-card ${a.criticality === 'high' ? 'high' : ''}">
          <h4>${escapeHtml(a.allergen_name || 'Unknown Allergen')}</h4>
          <p><strong>Type:</strong> ${escapeHtml(a.allergen_type || 'Unknown')}</p>
          ${a.reaction_description ? `<p><strong>Reaction:</strong> ${escapeHtml(a.reaction_description)}</p>` : ''}
          <p>
            <span class="badge badge-${a.criticality === 'high' ? 'high' : a.criticality === 'low' ? 'low' : 'moderate'}">
              ${escapeHtml((a.criticality || 'unknown').toUpperCase())} RISK
            </span>
            ${a.severity ? `<span class="badge">${escapeHtml(a.severity)}</span>` : ''}
          </p>
        </div>
      `).join('')}
  </div>

  <!-- MEDICATIONS -->
  <div class="section">
    <h2>💊 Current Medications</h2>
    ${medications.length === 0
      ? '<div class="empty-state">No active medications recorded</div>'
      : medications.map((m) => `
        <div class="medication-card">
          <h4>${escapeHtml(m.medication_name || 'Unknown Medication')}</h4>
          ${m.dosage || m.strength ? `<p><strong>Dose:</strong> ${escapeHtml(m.dosage || m.strength || '')}</p>` : ''}
          ${m.frequency ? `<p><strong>How Often:</strong> ${escapeHtml(m.frequency)}</p>` : ''}
          ${m.instructions ? `<p><strong>Instructions:</strong> ${escapeHtml(m.instructions)}</p>` : ''}
          ${m.prescribed_by ? `<p><strong>Prescribed By:</strong> ${escapeHtml(m.prescribed_by)}</p>` : ''}
          ${m.purpose ? `<p><strong>Purpose:</strong> ${escapeHtml(m.purpose)}</p>` : ''}
        </div>
      `).join('')}
  </div>

  <!-- CONDITIONS -->
  <div class="section">
    <h2>🏥 Health Conditions</h2>
    ${conditions.length === 0
      ? '<div class="empty-state">No conditions recorded</div>'
      : conditions.map((c) => `
        <div class="condition-card">
          <h4>${escapeHtml(c.code_display || 'Unknown Condition')}</h4>
          ${c.code ? `<p><strong>Code:</strong> ${escapeHtml(c.code)}</p>` : ''}
          <p>
            <span class="badge badge-${c.clinical_status === 'active' ? 'active' : 'inactive'}">
              ${escapeHtml((c.clinical_status || 'unknown').toUpperCase())}
            </span>
            ${c.severity_code ? `<span class="badge">${escapeHtml(c.severity_code)}</span>` : ''}
          </p>
          ${c.onset_datetime ? `<p><strong>Since:</strong> ${formatDate(c.onset_datetime)}</p>` : ''}
          ${c.note ? `<p><strong>Notes:</strong> ${escapeHtml(c.note)}</p>` : ''}
        </div>
      `).join('')}
  </div>

  <!-- RECENT VITALS -->
  <div class="section">
    <h2>❤️ Recent Vital Signs</h2>
    ${generateVitalsSection(vitalSigns, checkIns)}
  </div>

  <!-- IMMUNIZATIONS -->
  <div class="section">
    <h2>💉 Immunizations</h2>
    ${immunizations.length === 0
      ? '<div class="empty-state">No immunizations recorded</div>'
      : `<table>
          <thead>
            <tr>
              <th>Vaccine</th>
              <th>Date Given</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${immunizations.map((i) => `
              <tr>
                <td>${escapeHtml(i.vaccine_display || 'Unknown Vaccine')}</td>
                <td>${formatDate(i.occurrence_datetime)}</td>
                <td><span class="badge badge-active">${escapeHtml(i.status || 'completed')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
  </div>

  <!-- PROCEDURES -->
  <div class="section">
    <h2>🔧 Procedures</h2>
    ${procedures.length === 0
      ? '<div class="empty-state">No procedures recorded</div>'
      : `<table>
          <thead>
            <tr>
              <th>Procedure</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${procedures.map((p) => `
              <tr>
                <td>${escapeHtml(p.code_display || 'Unknown Procedure')}</td>
                <td>${formatDate(p.performed_datetime)}</td>
                <td><span class="badge">${escapeHtml(p.status || 'completed')}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
  </div>

  <!-- LAB RESULTS -->
  <div class="section">
    <h2>🧪 Lab Results</h2>
    ${labResults.length === 0 && labObservations.length === 0
      ? '<div class="empty-state">No lab results recorded</div>'
      : `<table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Reference Range</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${labResults.map((l) => `
              <tr${l.abnormal ? ' style="background: #fef2f2;"' : ''}>
                <td>${escapeHtml(l.test_name || 'Unknown Test')}</td>
                <td><strong>${escapeHtml(l.value?.toString() || 'N/A')}</strong> ${escapeHtml(l.unit || '')}</td>
                <td>${escapeHtml(l.reference_range || 'N/A')}</td>
                <td>${formatDate(l.extracted_at)}</td>
              </tr>
            `).join('')}
            ${labObservations.map((o) => `
              <tr>
                <td>${escapeHtml(o.code_display || 'Unknown Test')}</td>
                <td><strong>${escapeHtml(o.value_quantity?.toString() || o.value_string || 'N/A')}</strong></td>
                <td>${o.reference_range_low && o.reference_range_high ? `${o.reference_range_low} - ${o.reference_range_high}` : 'N/A'}</td>
                <td>${formatDate(o.effective_datetime)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
  </div>

  <!-- CARE PLANS -->
  <div class="section">
    <h2>📝 Care Plans</h2>
    ${carePlans.length === 0
      ? '<div class="empty-state">No active care plans</div>'
      : carePlans.map((cp) => `
        <div class="item-card">
          <h4>${escapeHtml(cp.title || 'Care Plan')}</h4>
          ${cp.description ? `<p>${escapeHtml(cp.description)}</p>` : ''}
          <p>
            <span class="badge badge-${cp.status === 'active' ? 'active' : 'inactive'}">
              ${escapeHtml((cp.status || 'unknown').toUpperCase())}
            </span>
          </p>
          ${cp.period_start ? `<p><strong>Start Date:</strong> ${formatDate(cp.period_start)}</p>` : ''}
        </div>
      `).join('')}
  </div>

  <!-- DIAGNOSTIC REPORTS -->
  ${diagnosticReports.length > 0 ? `
  <div class="section">
    <h2>📊 Diagnostic Reports</h2>
    <table>
      <thead>
        <tr>
          <th>Report</th>
          <th>Category</th>
          <th>Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${diagnosticReports.map((dr) => `
          <tr>
            <td>${escapeHtml(dr.code_display || 'Unknown Report')}</td>
            <td>${escapeHtml(dr.category || 'N/A')}</td>
            <td>${formatDate(dr.issued || dr.effective_datetime)}</td>
            <td><span class="badge">${escapeHtml(dr.status || 'final')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p><strong>Important:</strong> This health summary is for informational purposes only. Always consult with your healthcare provider for medical advice.</p>
    <p style="margin-top: 10px;">
      <strong>Generated:</strong> ${new Date(generatedAt).toLocaleString()}<br>
      <strong>Source:</strong> WellFit Community Health Records
    </p>
    <p style="margin-top: 15px; font-size: 12px;">
      This document complies with 21st Century Cures Act requirements for patient access to Electronic Health Information (EHI).
    </p>
  </div>

  <script>
    // Auto-print hint
    window.onload = function() {
      if (window.location.search.includes('print=true')) {
        window.print();
      }
    }
  </script>
</body>
</html>`;
}

function generateVitalsSection(observations: Observation[], checkIns: CheckIn[]): string {
  // Get most recent vitals from either source
  const recentVitals: Record<string, VitalReading> = {};

  // From FHIR observations
  for (const obs of observations) {
    const code = obs.code;
    if (code && !recentVitals[code]) {
      recentVitals[code] = {
        value: obs.value_quantity || obs.value_string,
        unit: obs.value_unit || '',
        date: obs.effective_datetime
      };
    }
  }

  // From check-ins
  for (const ci of checkIns) {
    if (ci.heart_rate && !recentVitals['heart_rate']) {
      recentVitals['heart_rate'] = { value: ci.heart_rate, unit: 'bpm', date: ci.created_at };
    }
    if (ci.bp_systolic && ci.bp_diastolic && !recentVitals['blood_pressure']) {
      recentVitals['blood_pressure'] = { value: `${ci.bp_systolic}/${ci.bp_diastolic}`, unit: 'mmHg', date: ci.created_at };
    }
    if (ci.pulse_oximeter && !recentVitals['spo2']) {
      recentVitals['spo2'] = { value: ci.pulse_oximeter, unit: '%', date: ci.created_at };
    }
    if (ci.glucose_mg_dl && !recentVitals['glucose']) {
      recentVitals['glucose'] = { value: ci.glucose_mg_dl, unit: 'mg/dL', date: ci.created_at };
    }
  }

  const vitalLabels: { [key: string]: string } = {
    'heart_rate': '❤️ Heart Rate',
    'blood_pressure': '🩺 Blood Pressure',
    'spo2': '🫁 Oxygen Level',
    'glucose': '🩸 Blood Sugar',
    '8867-4': '❤️ Heart Rate',
    '85354-9': '🩺 Blood Pressure',
    '2708-6': '🫁 Oxygen Level',
    '2345-7': '🩸 Glucose'
  };

  const vitalKeys = Object.keys(recentVitals);
  if (vitalKeys.length === 0) {
    return '<div class="empty-state">No recent vital signs recorded</div>';
  }

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return `<div class="vital-grid">
    ${vitalKeys.map(key => `
      <div class="vital-card">
        <div class="value">${escapeHtml(recentVitals[key].value?.toString() || 'N/A')}</div>
        <div class="label">${vitalLabels[key] || key} ${recentVitals[key].unit}</div>
        <div class="date">${formatDate(recentVitals[key].date)}</div>
      </div>
    `).join('')}
  </div>`;
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
