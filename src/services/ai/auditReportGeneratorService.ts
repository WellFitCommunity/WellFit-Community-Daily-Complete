/**
 * Audit Report Generator Service
 *
 * Automatically generates SOC2, HIPAA, and compliance audit reports
 * from system logs, access patterns, and security events.
 *
 * @module auditReportGeneratorService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditReportType = 'soc2' | 'hipaa' | 'pci_dss' | 'custom';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';
export type FindingStatus = 'open' | 'remediated' | 'accepted_risk' | 'false_positive';

export interface AuditFinding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  controlId: string;
  controlName: string;
  evidence: string[];
  recommendation: string;
  dueDate?: string;
  assignedTo?: string;
}

export interface ControlAssessment {
  controlId: string;
  controlName: string;
  category: string;
  status: 'effective' | 'partially_effective' | 'ineffective' | 'not_applicable';
  testingResults: string;
  findings: AuditFinding[];
  evidence: string[];
}

export interface AuditReportResult {
  reportId: string;
  reportType: AuditReportType;
  title: string;
  executiveSummary: string;
  periodStart: string;
  periodEnd: string;
  overallComplianceScore: number;
  overallStatus: 'compliant' | 'partially_compliant' | 'non_compliant';
  controlCategories: Array<{
    category: string;
    score: number;
    controlCount: number;
    findingCount: number;
  }>;
  controlAssessments: ControlAssessment[];
  findings: AuditFinding[];
  recommendations: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
    impactedControls: string[];
    estimatedEffort: string;
  }>;
  riskSummary: {
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
    acceptedRisks: number;
  };
  appendices: Array<{
    title: string;
    content: string;
  }>;
}

export interface AuditReportRequest {
  reportType: AuditReportType;
  periodStart: string;
  periodEnd: string;
  customControls?: string[];
  includeEvidence?: boolean;
  tenantId?: string;
}

export interface AuditReportResponse {
  result: AuditReportResult;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    dataSourceCount: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class AuditReportGeneratorService {
  /**
   * Generate compliance audit report
   */
  static async generateReport(
    request: AuditReportRequest
  ): Promise<ServiceResult<AuditReportResponse>> {
    try {
      if (!request.reportType) {
        return failure('INVALID_INPUT', 'Report type is required');
      }

      if (!request.periodStart || !request.periodEnd) {
        return failure('INVALID_INPUT', 'Audit period start and end dates are required');
      }

      const { data, error } = await supabase.functions.invoke('ai-audit-report-generator', {
        body: {
          reportType: request.reportType,
          periodStart: request.periodStart,
          periodEnd: request.periodEnd,
          customControls: request.customControls,
          includeEvidence: request.includeEvidence ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as AuditReportResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('REPORT_GENERATION_FAILED', error.message, error);
    }
  }

  /**
   * Save generated report
   */
  static async saveReport(
    request: AuditReportRequest,
    response: AuditReportResponse,
    generatedBy: string
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const { data, error } = await supabase
        .from('ai_audit_reports')
        .insert({
          report_id: response.result.reportId,
          report_type: request.reportType,
          period_start: request.periodStart,
          period_end: request.periodEnd,
          status: 'draft',
          findings: response.result.findings,
          recommendations: response.result.recommendations,
          compliance_score: response.result.overallComplianceScore,
          result: response.result,
          generated_by: generatedBy,
          tenant_id: request.tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Get previous audit reports
   */
  static async getReportHistory(
    tenantId: string,
    reportType?: AuditReportType,
    limit: number = 20
  ): Promise<ServiceResult<AuditReportResult[]>> {
    try {
      let query = supabase
        .from('ai_audit_reports')
        .select('result')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return success((data || []).map((d) => d.result as AuditReportResult));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Update finding status
   */
  static async updateFindingStatus(
    reportId: string,
    findingId: string,
    status: FindingStatus,
    notes?: string
  ): Promise<ServiceResult<void>> {
    try {
      const { data: report, error: fetchError } = await supabase
        .from('ai_audit_reports')
        .select('findings')
        .eq('id', reportId)
        .single();

      if (fetchError) throw fetchError;

      const findings = (report.findings as AuditFinding[]).map((f) =>
        f.id === findingId ? { ...f, status } : f
      );

      const { error: updateError } = await supabase
        .from('ai_audit_reports')
        .update({ findings, updated_at: new Date().toISOString() })
        .eq('id', reportId);

      if (updateError) throw updateError;

      return success(undefined);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UPDATE_FAILED', error.message, error);
    }
  }

  /**
   * Get compliance score trends
   */
  static async getComplianceTrends(
    tenantId: string,
    reportType: AuditReportType,
    months: number = 12
  ): Promise<ServiceResult<Array<{ period: string; score: number }>>> {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const { data, error } = await supabase
        .from('ai_audit_reports')
        .select('period_end, compliance_score')
        .eq('tenant_id', tenantId)
        .eq('report_type', reportType)
        .gte('period_end', startDate.toISOString())
        .order('period_end', { ascending: true });

      if (error) throw error;

      return success(
        (data || []).map((d) => ({
          period: d.period_end,
          score: d.compliance_score,
        }))
      );
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }
}

export default AuditReportGeneratorService;
