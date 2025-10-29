/**
 * MCP Usage Examples
 * Copy-paste these examples into your components/services
 */

import {
  analyzeText,
  generateSuggestion,
  summarizeContent,
  generateCodingSuggestions,
  summarizeClinicalNotes
} from './index';

// ============================================================================
// EXAMPLE 1: Auto-Generate Billing Codes
// ============================================================================
// Use case: Physician completes an encounter, system suggests billing codes
// Where to use: Billing screen, encounter completion workflow
// ============================================================================

export async function exampleGenerateBillingCodes(userId: string) {
  const encounterData = {
    chiefComplaint: 'Chest pain radiating to left arm',
    diagnosis: 'Acute myocardial infarction',
    procedures: ['ECG', 'Cardiac enzyme panel', 'Chest X-ray'],
    duration: 45, // minutes
    encounterType: 'Emergency'
  };

  const codes = await generateCodingSuggestions({
    encounterData,
    userId
  });


  // Expected output:
  // {
  //   cpt: ['99285', '93000', '71046'],
  //   icd10: ['I21.9', 'R07.2'],
  //   hcpcs: []
  // }

  return codes;
}

// ============================================================================
// EXAMPLE 2: Nurse Shift Handoff Summary
// ============================================================================
// Use case: Generate concise handoff summary for incoming nurse
// Where to use: Shift change screens, handoff reports
// ============================================================================

export async function exampleNurseHandoffSummary(
  patientId: string,
  nurseId: string
) {
  // Imagine this comes from your database
  const recentNotes = `
    08:00 - Patient admitted with chest pain. Vitals stable. BP 140/90, HR 88, O2 sat 98%.
    10:30 - Administered aspirin 325mg, nitroglycerin 0.4mg sublingual.
    12:00 - ECG shows ST elevation in leads II, III, aVF. Cardiology consulted.
    14:00 - Patient transferred to cath lab. PCI performed, stent placed in RCA.
    16:00 - Returned to floor. Stable post-procedure. Started on dual antiplatelet therapy.
    18:00 - Family updated. Patient resting comfortably. Pain 2/10.
  `;

  const summary = await summarizeClinicalNotes({
    notes: recentNotes,
    maxLength: 200,
    userId: nurseId
  });


  // Expected output:
  // "Patient admitted with chest pain, found to have STEMI. Successfully underwent PCI with
  // stent to RCA. Currently stable on dual antiplatelet therapy. Pain well-controlled at 2/10."

  return summary;
}

// ============================================================================
// EXAMPLE 3: SDOH (Social Determinants of Health) Risk Assessment
// ============================================================================
// Use case: Analyze patient intake forms for social risk factors
// Where to use: Registration, social worker dashboard
// ============================================================================

export async function exampleSDOHRiskAssessment(
  patientIntake: any,
  socialWorkerId: string
) {
  const intake = {
    housing: 'Homeless shelter',
    employment: 'Unemployed',
    insurance: 'Medicaid',
    transportation: 'Public transit - unreliable',
    foodSecurity: 'Sometimes skips meals',
    socialSupport: 'Lives alone, no family nearby'
  };

  const analysis = await analyzeText({
    text: JSON.stringify(intake, null, 2),
    prompt: `Analyze this patient's social determinants of health (SDOH).
    Identify risk factors in these categories:
    - Housing instability
    - Food insecurity
    - Transportation barriers
    - Social isolation
    - Financial strain

    Return JSON with:
    {
      "riskLevel": "low" | "medium" | "high",
      "concerns": ["concern1", "concern2"],
      "recommendations": ["action1", "action2"]
    }`,
    model: 'claude-sonnet-4-5-20250929',
    userId: socialWorkerId
  });

  const result = JSON.parse(analysis);

  // Expected output:
  // {
  //   riskLevel: "high",
  //   concerns: ["Housing instability", "Food insecurity", "Social isolation"],
  //   recommendations: [
  //     "Connect with housing assistance program",
  //     "Refer to food bank/SNAP enrollment",
  //     "Social work follow-up within 1 week"
  //   ]
  // }

  return result;
}

// ============================================================================
// EXAMPLE 4: Medication Interaction Check
// ============================================================================
// Use case: Physician prescribes new medication, check for interactions
// Where to use: ePrescribe workflow, pharmacy review
// ============================================================================

export async function exampleMedicationInteractionCheck(
  currentMeds: string[],
  newMed: string,
  physicianId: string
) {
  const medications = [...currentMeds, newMed];

  const analysis = await analyzeText({
    text: medications.join('\n'),
    prompt: `Analyze these medications for:
    1. Drug-drug interactions
    2. Duplicate therapies
    3. Contraindications
    4. QT prolongation risk

    Current medications: ${currentMeds.join(', ')}
    New medication being added: ${newMed}

    Return JSON:
    {
      "hasInteractions": boolean,
      "interactions": [{ "severity": "major|moderate|minor", "description": "..." }],
      "warnings": ["warning1", "warning2"],
      "recommendation": "prescribe|avoid|adjust_dose"
    }`,
    model: 'claude-sonnet-4-5-20250929',
    userId: physicianId
  });

  const result = JSON.parse(analysis);


  return result;
}

// ============================================================================
// EXAMPLE 5: Clinical Note Quality Check
// ============================================================================
// Use case: Check if clinical note has all required elements for billing
// Where to use: Documentation assistant, billing compliance
// ============================================================================

export async function exampleClinicalNoteQualityCheck(
  note: string,
  providerId: string
) {
  const analysis = await analyzeText({
    text: note,
    prompt: `Review this clinical note for documentation quality and billing compliance.
    Check for presence of:
    - Chief complaint
    - History of present illness (HPI)
    - Review of systems (ROS)
    - Physical examination
    - Medical decision making (MDM)
    - Assessment and plan

    Return JSON:
    {
      "completeness": 0-100,
      "missing": ["element1", "element2"],
      "strengths": ["strength1", "strength2"],
      "billingLevel": "99211" | "99212" | "99213" | "99214" | "99215",
      "suggestions": ["improvement1", "improvement2"]
    }`,
    model: 'claude-sonnet-4-5-20250929',
    userId: providerId
  });

  return JSON.parse(analysis);
}

// ============================================================================
// EXAMPLE 6: Patient Education Material Generation
// ============================================================================
// Use case: Create patient-friendly explanation of diagnosis/treatment
// Where to use: After-visit summaries, patient portal
// ============================================================================

export async function examplePatientEducation(
  diagnosis: string,
  treatment: string,
  providerId: string
) {
  const explanation = await generateSuggestion({
    context: { diagnosis, treatment },
    task: `Create a patient-friendly explanation (8th grade reading level) for:
    Diagnosis: ${diagnosis}
    Treatment: ${treatment}

    Include:
    - What this condition means in simple terms
    - Why this treatment is recommended
    - What to expect
    - When to seek immediate care

    Keep it under 200 words, warm and reassuring tone.`,
    model: 'claude-haiku-4-5-20250929',
    userId: providerId
  });



  return explanation;
}

// ============================================================================
// EXAMPLE 7: Prior Authorization Letter Generation
// ============================================================================
// Use case: Generate medical necessity letter for insurance
// Where to use: Prior authorization workflow
// ============================================================================

export async function examplePriorAuthLetter(
  patientInfo: any,
  procedure: string,
  providerId: string
) {
  const letter = await generateSuggestion({
    context: {
      diagnosis: patientInfo.diagnosis,
      priorTreatments: patientInfo.priorTreatments,
      currentSymptoms: patientInfo.symptoms,
      requestedProcedure: procedure
    },
    task: `Write a medical necessity letter for prior authorization.
    Include:
    - Clinical indication
    - Why this procedure is medically necessary
    - Why less invasive options are inadequate
    - Expected outcome

    Professional medical tone, cite clinical guidelines where applicable.`,
    model: 'claude-sonnet-4-5-20250929',
    userId: providerId
  });

  return letter;
}

// ============================================================================
// EXAMPLE 8: Triage Severity Assessment
// ============================================================================
// Use case: Help triage nurse determine urgency level
// Where to use: Emergency department triage, urgent care intake
// ============================================================================

export async function exampleTriageSeverity(
  chiefComplaint: string,
  vitals: any,
  symptoms: string[],
  nurseId: string
) {
  const assessment = await analyzeText({
    text: JSON.stringify({ chiefComplaint, vitals, symptoms }, null, 2),
    prompt: `Assess the urgency of this patient presentation.

    Return JSON:
    {
      "triageLevel": 1-5 (1=immediate, 5=non-urgent),
      "reasoning": "explanation",
      "redFlags": ["flag1", "flag2"],
      "recommendedActions": ["action1", "action2"],
      "estimatedWaitTime": "minutes"
    }`,
    model: 'claude-sonnet-4-5-20250929',
    userId: nurseId
  });

  return JSON.parse(assessment);
}

// ============================================================================
// EXAMPLE 9: Lab Result Interpretation
// ============================================================================
// Use case: Help providers interpret complex lab results
// Where to use: Lab review dashboard, clinical decision support
// ============================================================================

export async function exampleLabInterpretation(
  labResults: any,
  patientContext: any,
  providerId: string
) {
  const interpretation = await analyzeText({
    text: JSON.stringify({ labs: labResults, context: patientContext }, null, 2),
    prompt: `Interpret these lab results in clinical context.

    Highlight:
    - Critical abnormal values
    - Trend changes from previous results
    - Clinical significance
    - Recommended follow-up

    Return JSON with structured interpretation.`,
    model: 'claude-sonnet-4-5-20250929',
    userId: providerId
  });

  return JSON.parse(interpretation);
}

// ============================================================================
// EXAMPLE 10: Discharge Summary Generation
// ============================================================================
// Use case: Generate comprehensive discharge summary
// Where to use: Patient discharge workflow
// ============================================================================

export async function exampleDischargeSummary(
  admissionData: any,
  hospitalization: any,
  providerId: string
) {
  const summary = await generateSuggestion({
    context: {
      admissionReason: admissionData.reason,
      hospitalCourse: hospitalization.course,
      procedures: hospitalization.procedures,
      medications: hospitalization.medications,
      followUp: hospitalization.followUp
    },
    task: `Generate a comprehensive discharge summary including:
    - Admission diagnosis
    - Hospital course
    - Procedures performed
    - Discharge medications
    - Follow-up instructions
    - Patient education provided

    Professional medical format suitable for medical record.`,
    model: 'claude-sonnet-4-5-20250929',
    userId: providerId
  });

  return summary;
}

// ============================================================================
// HOW TO USE THESE EXAMPLES
// ============================================================================
//
// 1. Copy the example function you need
// 2. Adapt it to your component/service
// 3. Replace mock data with real data from your database
// 4. Add error handling as needed
//
// Example in a React component:
//
// import { exampleGenerateBillingCodes } from '@/services/mcp/examples';
//
// function BillingScreen() {
//   const handleGenerateCodes = async () => {
//     try {
//       const codes = await exampleGenerateBillingCodes(currentUser.id);
//       setBillingCodes(codes);
//     } catch (error) {
//       console.error('Failed to generate codes:', error);
//       toast.error('Could not generate billing codes');
//     }
//   };
//
//   return <button onClick={handleGenerateCodes}>Generate Codes</button>;
// }
//
// ============================================================================
