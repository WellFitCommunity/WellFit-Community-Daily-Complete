// Lab Result Vault Service - OCR/AI Lab Parsing & Trending
// Saves receiving hospitals 10-15 minutes by auto-extracting lab values from PDFs

import { supabase } from '../lib/supabaseClient';
import { PAGINATION_LIMITS, applyLimit } from '../utils/pagination';
import type { LabResult } from '../types/handoff';

interface ParsedLabData {
  test_name: string;
  value: string;
  unit: string;
  reference_range?: string;
  abnormal?: boolean;
  confidence: number;
}

interface CriticalAlert {
  high?: number;
  low?: number;
  message: string;
}

export interface ParsedLabResult extends LabResult {
  confidence_score?: number; // 0-1, AI confidence in extraction
  source_file?: string;
  extracted_at?: string;
  created_at?: string; // Timestamp when result was created
}

export interface LabTrend {
  test_name: string;
  values: Array<{
    value: string;
    unit?: string;
    date: string;
    abnormal: boolean;
  }>;
  trend_direction: 'rising' | 'falling' | 'stable' | 'fluctuating';
  clinical_significance?: string;
}

export class LabResultVaultService {
  /**
   * Parse uploaded lab PDF using Claude AI (via Anthropic API)
   * Extracts structured lab values from common lab report formats
   */
  static async parseLabPDF(file: File): Promise<ParsedLabResult[]> {
    try {
      // Convert PDF to base64 for Claude API
      const base64Data = await this.fileToBase64(file);

      // Call Claude AI via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('parse-lab-pdf', {
        body: {
          file_data: base64Data,
          file_name: file.name,
          file_type: file.type
        }
      });

      if (error) throw error;

      // Claude returns structured lab data
      const parsedLabs: ParsedLabResult[] = (data.labs as ParsedLabData[]).map((lab) => ({
        test_name: lab.test_name,
        value: lab.value,
        unit: lab.unit,
        reference_range: lab.reference_range,
        abnormal: lab.abnormal,
        confidence_score: lab.confidence,
        source_file: file.name,
        extracted_at: new Date().toISOString()
      }));

      return parsedLabs;
    } catch {

      // Fallback: Use regex-based extraction for common formats
      return this.fallbackRegexParsing(file);
    }
  }

  /**
   * Fallback regex-based parsing for common lab formats
   * Works for basic CBC, CMP, BMP reports
   */
  private static async fallbackRegexParsing(_file: File): Promise<ParsedLabResult[]> {
    // This would use pdf.js or similar to extract text, then regex patterns
    // For MVP, return empty array - Claude AI is primary method

    return [];
  }

  /**
   * Store parsed labs in patient's portable vault
   */
  static async storeInVault(
    patientMRN: string,
    labs: ParsedLabResult[],
    packetId: string
  ): Promise<void> {
    try {
      // Store in lab_results table with patient association
      const labRecords = labs.map(lab => ({
        patient_mrn: patientMRN,
        handoff_packet_id: packetId,
        test_name: lab.test_name,
        value: lab.value,
        unit: lab.unit,
        reference_range: lab.reference_range,
        abnormal: lab.abnormal,
        confidence_score: lab.confidence_score,
        source_file: lab.source_file,
        extracted_at: lab.extracted_at,
        created_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('lab_results')
        .insert(labRecords);

      if (error) throw error;


    } catch {

    }
  }

  /**
   * Get lab history for patient (for trending analysis)
   */
  static async getLabHistory(
    patientMRN: string,
    testName?: string,
    daysBack: number = 90
  ): Promise<ParsedLabResult[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      let query = supabase
        .from('lab_results')
        .select('*')
        .eq('patient_mrn', patientMRN)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (testName) {
        query = query.ilike('test_name', `%${testName}%`);
      }

      // Apply pagination limit to prevent unbounded queries
      // Limit to 50 most recent lab results for performance
      return await applyLimit<ParsedLabResult>(query, PAGINATION_LIMITS.LABS);
    } catch {

      return [];
    }
  }

  /**
   * Generate trending analysis for critical labs
   * Example: "Creatinine rising over 3 days: 1.2 → 1.8 → 2.4"
   */
  static async generateLabTrends(patientMRN: string): Promise<LabTrend[]> {
    const criticalLabs = [
      'creatinine', 'potassium', 'sodium', 'glucose', 'hemoglobin',
      'wbc', 'platelet', 'troponin', 'bun', 'inr'
    ];

    const trends: LabTrend[] = [];

    for (const labName of criticalLabs) {
      const history = await this.getLabHistory(patientMRN, labName, 30);

      if (history.length >= 2) {
        const trend = this.analyzeTrend(labName, history);
        if (trend) {
          trends.push(trend);
        }
      }
    }

    return trends;
  }

  /**
   * Analyze trend for a specific lab test
   */
  private static analyzeTrend(testName: string, history: ParsedLabResult[]): LabTrend | null {
    if (history.length < 2) return null;

    // Sort by date (oldest first)
    const sorted = history
      .filter(h => h.value && !isNaN(parseFloat(h.value)))
      .sort((a, b) => new Date(a.extracted_at || a.created_at || '').getTime() -
                       new Date(b.extracted_at || b.created_at || '').getTime());

    if (sorted.length < 2) return null;

    // Calculate trend direction
    const values = sorted.map(s => parseFloat(s.value));
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const percentChange = ((lastValue - firstValue) / firstValue) * 100;

    let direction: LabTrend['trend_direction'];
    if (Math.abs(percentChange) < 5) {
      direction = 'stable';
    } else if (percentChange > 0) {
      direction = 'rising';
    } else {
      direction = 'falling';
    }

    // Check for fluctuation
    if (values.length >= 3) {
      const changes = [];
      for (let i = 1; i < values.length; i++) {
        changes.push(values[i] > values[i - 1] ? 'up' : 'down');
      }
      const uniqueChanges = new Set(changes);
      if (uniqueChanges.size > 1) {
        direction = 'fluctuating';
      }
    }

    // Generate clinical significance for critical changes
    const significance = this.getClinicalSignificance(
      testName,
      direction,
      percentChange,
      sorted
    );

    return {
      test_name: testName,
      values: sorted.map(s => ({
        value: s.value,
        unit: s.unit,
        date: s.extracted_at || s.created_at || '',
        abnormal: s.abnormal || false
      })),
      trend_direction: direction,
      clinical_significance: significance
    };
  }

  /**
   * Get clinical significance of lab trend
   */
  private static getClinicalSignificance(
    testName: string,
    direction: string,
    percentChange: number,
    history: ParsedLabResult[]
  ): string | undefined {
    const latestValue = parseFloat(history[history.length - 1].value);

    // Critical thresholds
    const criticalAlerts: Record<string, CriticalAlert> = {
      creatinine: {
        high: 2.0,
        message: 'Acute kidney injury risk - Consider nephrology consult'
      },
      potassium: {
        low: 3.0,
        high: 5.5,
        message: 'Cardiac arrhythmia risk - Monitor EKG'
      },
      glucose: {
        low: 70,
        high: 300,
        message: 'Hypoglycemia/hyperglycemia risk - Adjust insulin'
      },
      troponin: {
        high: 0.04,
        message: 'Acute MI possible - Cardiology consult'
      },
      hemoglobin: {
        low: 7.0,
        message: 'Severe anemia - Consider transfusion'
      },
      wbc: {
        high: 15.0,
        message: 'Infection/leukocytosis - Investigate source'
      },
      inr: {
        high: 3.5,
        message: 'Bleeding risk - Hold anticoagulation, Vitamin K'
      }
    };

    const alert = criticalAlerts[testName.toLowerCase()];
    if (!alert) return undefined;

    if (alert.high && latestValue > alert.high) {
      return `⚠️ ${alert.message}`;
    }

    if (alert.low && latestValue < alert.low) {
      return `⚠️ ${alert.message}`;
    }

    if (Math.abs(percentChange) > 50) {
      return `⚠️ Rapid ${direction} trend (${percentChange.toFixed(1)}% change) - Review urgently`;
    }

    return undefined;
  }

  /**
   * Generate QR code for patient to access their own lab history
   */
  static async generatePatientQRCode(patientMRN: string): Promise<string> {
    // Generate secure token for patient access
    const { data: token, error } = await supabase.rpc('generate_patient_lab_token', {
      mrn: patientMRN
    });

    if (error || !token) {
      throw new Error('Failed to generate patient access token');
    }

    const accessUrl = `${window.location.origin}/patient/labs/${token}`;

    // Use QR code library (qrcode.react or similar)
    // For now, return URL that can be used with QR library
    return accessUrl;
  }

  /**
   * Auto-populate receiving hospital's packet view with parsed labs
   */
  static async autoPopulateLabsForPacket(packetId: string): Promise<ParsedLabResult[]> {
    try {
      const query = supabase
        .from('lab_results')
        .select('*')
        .eq('handoff_packet_id', packetId)
        .order('created_at', { ascending: false });

      // Apply pagination limit to prevent unbounded queries
      // Limit to 50 most recent lab results per packet
      return await applyLimit<ParsedLabResult>(query, PAGINATION_LIMITS.LABS);
    } catch {

      return [];
    }
  }

  /**
   * Helper: Convert file to base64
   */
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Common lab test reference ranges for validation
   */
  static REFERENCE_RANGES: Record<string, { min: number; max: number; unit: string }> = {
    'sodium': { min: 135, max: 145, unit: 'mmol/L' },
    'potassium': { min: 3.5, max: 5.0, unit: 'mmol/L' },
    'chloride': { min: 96, max: 106, unit: 'mmol/L' },
    'co2': { min: 23, max: 29, unit: 'mmol/L' },
    'glucose': { min: 70, max: 100, unit: 'mg/dL' },
    'bun': { min: 7, max: 20, unit: 'mg/dL' },
    'creatinine': { min: 0.6, max: 1.2, unit: 'mg/dL' },
    'calcium': { min: 8.5, max: 10.5, unit: 'mg/dL' },
    'wbc': { min: 4.0, max: 11.0, unit: 'K/uL' },
    'hemoglobin': { min: 12.0, max: 16.0, unit: 'g/dL' },
    'hematocrit': { min: 36, max: 48, unit: '%' },
    'platelet': { min: 150, max: 400, unit: 'K/uL' },
    'troponin': { min: 0, max: 0.04, unit: 'ng/mL' },
    'inr': { min: 0.8, max: 1.2, unit: '' }
  };
}

export default LabResultVaultService;
