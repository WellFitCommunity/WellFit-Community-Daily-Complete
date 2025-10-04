// Medication Reconciliation Service - Joint Commission Compliance
// Detects discrepancies between medication lists for patient safety

import type { Medication, HandoffPacket } from '../types/handoff';

export interface MedicationDiscrepancy {
  type: 'missing' | 'duplicate' | 'dose_change' | 'route_change' | 'frequency_change';
  severity: 'high' | 'medium' | 'low';
  medication_name: string;
  details: string;
  source_list: 'given' | 'prescribed' | 'current';
  target_list: 'given' | 'prescribed' | 'current';
  recommendation: string;
}

export interface MedRecReport {
  patient_mrn: string;
  patient_name: string;
  transfer_id: string;
  discrepancies: MedicationDiscrepancy[];
  total_medications: number;
  reconciliation_status: 'complete' | 'pending' | 'discrepancies_found';
  generated_at: string;
}

export class MedicationReconciliationService {
  /**
   * Analyze medication lists for discrepancies
   */
  static analyzeDiscrepancies(packet: HandoffPacket): MedicationDiscrepancy[] {
    const discrepancies: MedicationDiscrepancy[] = [];

    const medsGiven = packet.clinical_data?.medications_given || [];
    const medsPrescribed = packet.clinical_data?.medications_prescribed || [];
    const medsCurrent = packet.clinical_data?.medications_current || [];

    // Check 1: Medications given but not in current list (potential omission)
    medsGiven.forEach(given => {
      const inCurrent = medsCurrent.find(c =>
        this.normalizeMedName(c.name) === this.normalizeMedName(given.name)
      );

      if (!inCurrent) {
        discrepancies.push({
          type: 'missing',
          severity: 'high',
          medication_name: given.name,
          details: `Medication "${given.name}" was administered but not listed in patient's current medications.`,
          source_list: 'given',
          target_list: 'current',
          recommendation: 'Verify if patient is taking this medication at home. If not, document reason for omission.'
        });
      }
    });

    // Check 2: Prescribed medications not in current list (non-adherence or missing data)
    medsPrescribed.forEach(prescribed => {
      const inCurrent = medsCurrent.find(c =>
        this.normalizeMedName(c.name) === this.normalizeMedName(prescribed.name)
      );

      if (!inCurrent) {
        discrepancies.push({
          type: 'missing',
          severity: 'medium',
          medication_name: prescribed.name,
          details: `Prescribed medication "${prescribed.name}" (${prescribed.dosage}) not listed in patient's current medications.`,
          source_list: 'prescribed',
          target_list: 'current',
          recommendation: 'Assess medication adherence. Patient may have stopped taking this medication.'
        });
      }
    });

    // Check 3: Dosage discrepancies between prescribed and current
    medsPrescribed.forEach(prescribed => {
      const inCurrent = medsCurrent.find(c =>
        this.normalizeMedName(c.name) === this.normalizeMedName(prescribed.name)
      );

      if (inCurrent && prescribed.dosage !== inCurrent.dosage) {
        discrepancies.push({
          type: 'dose_change',
          severity: 'high',
          medication_name: prescribed.name,
          details: `Dosage mismatch: Prescribed ${prescribed.dosage} but patient taking ${inCurrent.dosage}.`,
          source_list: 'prescribed',
          target_list: 'current',
          recommendation: 'CRITICAL: Reconcile dosage immediately. Verify with patient and prescribing physician.'
        });
      }
    });

    // Check 4: Route discrepancies
    medsPrescribed.forEach(prescribed => {
      const inCurrent = medsCurrent.find(c =>
        this.normalizeMedName(c.name) === this.normalizeMedName(prescribed.name)
      );

      if (inCurrent && prescribed.route && inCurrent.route &&
          prescribed.route !== inCurrent.route) {
        discrepancies.push({
          type: 'route_change',
          severity: 'medium',
          medication_name: prescribed.name,
          details: `Route mismatch: Prescribed ${prescribed.route} but patient taking ${inCurrent.route}.`,
          source_list: 'prescribed',
          target_list: 'current',
          recommendation: 'Verify route with patient. Document if intentional change.'
        });
      }
    });

    // Check 5: Duplicate medications (same drug, different names)
    const allMeds = [...medsPrescribed, ...medsCurrent];
    const duplicates = this.findDuplicates(allMeds);

    duplicates.forEach(dup => {
      discrepancies.push({
        type: 'duplicate',
        severity: 'high',
        medication_name: dup.medications.join(', '),
        details: `Potential duplicate medications detected: ${dup.medications.join(' and ')}`,
        source_list: 'prescribed',
        target_list: 'current',
        recommendation: 'ALERT: Verify if these are the same medication. Risk of overdose if duplicated.'
      });
    });

    // Check 6: High-risk medications in current list not prescribed
    const highRiskMeds = this.identifyHighRiskMedications(medsCurrent);
    highRiskMeds.forEach(med => {
      const isPrescribed = medsPrescribed.find(p =>
        this.normalizeMedName(p.name) === this.normalizeMedName(med.name)
      );

      if (!isPrescribed) {
        discrepancies.push({
          type: 'missing',
          severity: 'high',
          medication_name: med.name,
          details: `High-risk medication "${med.name}" in current list but not in prescribed list.`,
          source_list: 'current',
          target_list: 'prescribed',
          recommendation: 'URGENT: Verify with patient. High-risk medication requires monitoring.'
        });
      }
    });

    return discrepancies;
  }

  /**
   * Generate full medication reconciliation report
   */
  static async generateReconciliationReport(
    packet: HandoffPacket,
    decryptedName: string
  ): Promise<MedRecReport> {
    const discrepancies = this.analyzeDiscrepancies(packet);

    const totalMeds = new Set([
      ...(packet.clinical_data?.medications_given || []).map(m => this.normalizeMedName(m.name)),
      ...(packet.clinical_data?.medications_prescribed || []).map(m => this.normalizeMedName(m.name)),
      ...(packet.clinical_data?.medications_current || []).map(m => this.normalizeMedName(m.name))
    ]).size;

    return {
      patient_mrn: packet.patient_mrn || '',
      patient_name: decryptedName,
      transfer_id: packet.packet_number,
      discrepancies,
      total_medications: totalMeds,
      reconciliation_status: discrepancies.length === 0 ? 'complete' : 'discrepancies_found',
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Normalize medication name for comparison
   */
  private static normalizeMedName(name: string): string {
    return name.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\(.*?\)/g, '') // Remove parentheses
      .replace(/[®™]/g, ''); // Remove trademark symbols
  }

  /**
   * Find duplicate medications (common drug with different brand names)
   */
  private static findDuplicates(medications: Medication[]): Array<{ medications: string[] }> {
    const duplicates: Array<{ medications: string[] }> = [];

    // Common duplicates map (expand as needed)
    const knownDuplicates: Record<string, string[]> = {
      'acetaminophen': ['tylenol', 'paracetamol', 'acetaminophen'],
      'ibuprofen': ['advil', 'motrin', 'ibuprofen'],
      'aspirin': ['aspirin', 'asa', 'acetylsalicylic acid'],
      'metformin': ['metformin', 'glucophage'],
      'lisinopril': ['lisinopril', 'prinivil', 'zestril'],
      'atorvastatin': ['atorvastatin', 'lipitor'],
      'omeprazole': ['omeprazole', 'prilosec'],
    };

    const foundGroups = new Set<string>();

    medications.forEach((med1, i) => {
      medications.forEach((med2, j) => {
        if (i >= j) return;

        const name1 = this.normalizeMedName(med1.name);
        const name2 = this.normalizeMedName(med2.name);

        // Check in known duplicates
        for (const [generic, brands] of Object.entries(knownDuplicates)) {
          if (brands.some(b => name1.includes(b)) &&
              brands.some(b => name2.includes(b))) {
            const groupKey = [name1, name2].sort().join('|');
            if (!foundGroups.has(groupKey)) {
              duplicates.push({
                medications: [med1.name, med2.name]
              });
              foundGroups.add(groupKey);
            }
            return;
          }
        }
      });
    });

    return duplicates;
  }

  /**
   * Identify high-risk medications requiring special monitoring
   */
  private static identifyHighRiskMedications(medications: Medication[]): Medication[] {
    const highRiskKeywords = [
      'warfarin', 'coumadin', // Anticoagulants
      'insulin', 'humulin', 'novolog', // Insulin
      'methotrexate', // Chemotherapy
      'digoxin', // Cardiac glycosides
      'lithium', // Mood stabilizers
      'phenytoin', 'dilantin', // Anticonvulsants
      'opioid', 'morphine', 'oxycodone', 'hydrocodone', 'fentanyl', // Opioids
      'heparin', // Anticoagulants
    ];

    return medications.filter(med =>
      highRiskKeywords.some(keyword =>
        this.normalizeMedName(med.name).includes(keyword)
      )
    );
  }

  /**
   * Get alert level based on discrepancy count and severity
   */
  static getAlertLevel(discrepancies: MedicationDiscrepancy[]): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (discrepancies.length === 0) return 'none';

    const highSeverityCount = discrepancies.filter(d => d.severity === 'high').length;
    const mediumSeverityCount = discrepancies.filter(d => d.severity === 'medium').length;

    if (highSeverityCount >= 3) return 'critical';
    if (highSeverityCount >= 1) return 'high';
    if (mediumSeverityCount >= 2) return 'medium';
    return 'low';
  }
}

export default MedicationReconciliationService;
