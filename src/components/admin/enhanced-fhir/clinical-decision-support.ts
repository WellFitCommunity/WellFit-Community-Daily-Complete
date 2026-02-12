/**
 * Enhanced FHIR Service — Clinical Decision Support
 *
 * Evidence-based recommendations, drug interaction checking,
 * clinical guidelines matching, and condition determination.
 */

import type {
  PatientInsight,
  ComprehensivePatientData,
  MedicationRecord,
  EvidenceBasedRecommendation,
  DrugInteraction,
  ClinicalGuideline
} from './types';

/**
 * Determine the primary condition from patient risk factors.
 */
export function determinePrimaryCondition(aiInsights: PatientInsight): string {
  const riskFactors = aiInsights.riskAssessment.riskFactors;

  if (riskFactors.some(f => f.includes('blood pressure'))) return 'Hypertension';
  if (riskFactors.some(f => f.includes('glucose'))) return 'Diabetes';
  if (riskFactors.some(f => f.includes('heart rate'))) return 'Cardiac Arrhythmia';
  if (riskFactors.some(f => f.includes('oxygen'))) return 'Respiratory Condition';

  return 'General Wellness Monitoring';
}

/**
 * Get evidence-based recommendations for a given condition.
 */
export function getEvidenceBasedRecommendations(condition: string, _aiInsights: PatientInsight): EvidenceBasedRecommendation[] {
  // Simplified evidence-based recommendations
  const recommendations: Record<string, EvidenceBasedRecommendation[]> = {
    'Hypertension': [
      {
        recommendation: 'ACE inhibitor or ARB therapy initiation',
        evidenceLevel: 'A',
        source: 'AHA/ACC 2017 Guidelines',
        contraindications: ['Pregnancy', 'Bilateral renal artery stenosis']
      },
      {
        recommendation: 'Lifestyle modifications including DASH diet',
        evidenceLevel: 'A',
        source: 'Multiple RCTs',
        contraindications: []
      }
    ],
    'Diabetes': [
      {
        recommendation: 'Metformin as first-line therapy',
        evidenceLevel: 'A',
        source: 'ADA Standards of Care 2023',
        contraindications: ['eGFR < 30', 'Severe heart failure']
      }
    ]
  };

  return recommendations[condition] || [];
}

/**
 * Check drug interactions based on patient medication data.
 */
export function checkDrugInteractions(patientData: ComprehensivePatientData): DrugInteraction[] {
  const interactions: DrugInteraction[] = [];
  const medications = patientData?.medications || patientData?.medicationRequests || [];

  // Known high-risk interaction pairs (simplified for demo)
  const interactionPairs: Record<string, { drugs: string[], severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED', description: string, recommendation: string }[]> = {
    'warfarin': [
      { drugs: ['aspirin'], severity: 'MAJOR', description: 'Increased bleeding risk', recommendation: 'Monitor INR closely' },
      { drugs: ['ibuprofen', 'naproxen'], severity: 'MAJOR', description: 'NSAIDs increase bleeding risk with anticoagulants', recommendation: 'Avoid NSAIDs or use with caution' }
    ],
    'metformin': [
      { drugs: ['contrast'], severity: 'MAJOR', description: 'Risk of lactic acidosis with contrast media', recommendation: 'Hold metformin 48h before/after contrast' }
    ],
    'lisinopril': [
      { drugs: ['potassium', 'spironolactone'], severity: 'MODERATE', description: 'Risk of hyperkalemia', recommendation: 'Monitor potassium levels' }
    ],
    'simvastatin': [
      { drugs: ['amiodarone', 'diltiazem'], severity: 'MAJOR', description: 'Increased risk of myopathy/rhabdomyolysis', recommendation: 'Limit simvastatin dose to 10mg' }
    ]
  };

  // Check each medication against known interactions
  const medNames = medications.map((m: MedicationRecord) =>
    (m.medication_display || m.name || '').toLowerCase()
  );

  for (const [drug, pairs] of Object.entries(interactionPairs)) {
    if (medNames.some((name: string) => name.includes(drug))) {
      for (const pair of pairs) {
        if (pair.drugs.some(d => medNames.some((name: string) => name.includes(d)))) {
          interactions.push({
            medications: [drug, ...pair.drugs.filter(d => medNames.some((name: string) => name.includes(d)))],
            severity: pair.severity,
            description: pair.description,
            recommendation: pair.recommendation
          });
        }
      }
    }
  }

  return interactions;
}

/**
 * Get applicable clinical guidelines for a condition with patient-specific adjustments.
 */
export function getApplicableClinicalGuidelines(condition: string, patientData: ComprehensivePatientData): ClinicalGuideline[] {
  // Clinical guidelines with patient-specific applicability scoring
  const allGuidelines: Record<string, ClinicalGuideline[]> = {
    'Hypertension': [
      {
        guideline: '2017 ACC/AHA High Blood Pressure Clinical Practice Guideline',
        organization: 'American College of Cardiology',
        applicability: 95,
        keyPoints: ['BP goal <130/80 for most patients', 'Lifestyle modifications first-line', 'Combination therapy often needed']
      }
    ],
    'Diabetes': [
      {
        guideline: 'ADA Standards of Medical Care in Diabetes 2023',
        organization: 'American Diabetes Association',
        applicability: 90,
        keyPoints: ['A1C target <7% for most adults', 'Metformin as first-line therapy', 'SGLT2i or GLP-1 RA for cardiovascular risk reduction']
      }
    ],
    'Heart Failure': [
      {
        guideline: '2022 AHA/ACC/HFSA Heart Failure Guideline',
        organization: 'American Heart Association',
        applicability: 85,
        keyPoints: ['GDMT optimization', 'Consider SGLT2i regardless of diabetes status', 'Regular monitoring of volume status']
      }
    ],
    'Chronic Kidney Disease': [
      {
        guideline: 'KDIGO 2021 Clinical Practice Guideline for CKD',
        organization: 'Kidney Disease: Improving Global Outcomes',
        applicability: 88,
        keyPoints: ['BP target <120/80 if tolerated', 'ACEi/ARB for proteinuria', 'SGLT2i for eGFR 20-45']
      }
    ]
  };

  // Get base guidelines for condition
  const baseGuidelines = allGuidelines[condition] || [];

  // Adjust applicability based on patient data
  const patientAge = patientData?.profile?.age;
  const patientConditions = patientData?.conditions || [];

  return baseGuidelines.map(g => {
    let adjustedApplicability = g.applicability;

    // Adjust for age (elderly may have different targets)
    if (patientAge && patientAge > 75) {
      adjustedApplicability -= 10; // Less aggressive targets for elderly
    }

    // Adjust for comorbidities
    if (patientConditions.some((c: string) => c.includes?.('kidney') || c.includes?.('renal'))) {
      adjustedApplicability -= 5; // May need renal dosing adjustments
    }

    return {
      ...g,
      applicability: Math.max(0, Math.min(100, adjustedApplicability)),
      patientSpecificNotes: (patientAge ?? 0) > 75 ? 'Consider less aggressive targets for elderly patient' : undefined
    };
  });
}
