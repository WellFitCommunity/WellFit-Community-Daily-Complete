// =====================================================
// MCP PostgreSQL Server — Query Whitelist
// SECURITY: Only allow specific, pre-approved query patterns
// =====================================================

export interface WhitelistedQuery {
  name: string;
  description: string;
  query: string;
  parameters: string[];
  returnsRows: boolean;
  maxRows?: number;
}

export const WHITELISTED_QUERIES: Record<string, WhitelistedQuery> = {
  "get_patient_count_by_risk": {
    name: "get_patient_count_by_risk",
    description: "Get count of patients by risk level",
    query: `SELECT risk_level, COUNT(*) as count FROM patients WHERE tenant_id = $1 GROUP BY risk_level`,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_readmission_risk_summary": {
    name: "get_readmission_risk_summary",
    description: "Get readmission risk distribution",
    query: `
      SELECT
        CASE
          WHEN readmission_risk_30 >= 0.7 THEN 'high'
          WHEN readmission_risk_30 >= 0.4 THEN 'medium'
          ELSE 'low'
        END as risk_category,
        COUNT(*) as patient_count
      FROM patients
      WHERE tenant_id = $1 AND readmission_risk_30 IS NOT NULL
      GROUP BY risk_category
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_encounter_summary": {
    name: "get_encounter_summary",
    description: "Get encounter counts by status and type",
    query: `
      SELECT
        encounter_type,
        status,
        COUNT(*) as count,
        DATE_TRUNC('day', encounter_date) as date
      FROM encounters
      WHERE tenant_id = $1
        AND encounter_date >= NOW() - INTERVAL '30 days'
      GROUP BY encounter_type, status, DATE_TRUNC('day', encounter_date)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true,
    maxRows: 100
  },
  "get_sdoh_flags_summary": {
    name: "get_sdoh_flags_summary",
    description: "Get SDOH risk flag distribution",
    query: `
      SELECT
        flag_type,
        severity,
        COUNT(*) as count
      FROM sdoh_flags
      WHERE tenant_id = $1 AND resolved = false
      GROUP BY flag_type, severity
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_medication_adherence_stats": {
    name: "get_medication_adherence_stats",
    description: "Get medication adherence statistics",
    query: `
      SELECT
        CASE
          WHEN adherence_rate >= 0.8 THEN 'good'
          WHEN adherence_rate >= 0.5 THEN 'moderate'
          ELSE 'poor'
        END as adherence_category,
        COUNT(*) as patient_count
      FROM (
        SELECT patient_id, AVG(taken::int) as adherence_rate
        FROM medication_logs
        WHERE tenant_id = $1 AND log_date >= NOW() - INTERVAL '30 days'
        GROUP BY patient_id
      ) adherence
      GROUP BY adherence_category
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_claims_status_summary": {
    name: "get_claims_status_summary",
    description: "Get claims by status",
    query: `
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_charges), 0) as total_charges
      FROM claims
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_billing_revenue_summary": {
    name: "get_billing_revenue_summary",
    description: "Get billing revenue by date",
    query: `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as claim_count,
        COALESCE(SUM(total_charges), 0) as charges,
        COALESCE(SUM(amount_paid), 0) as collected
      FROM claims
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true,
    maxRows: 30
  },
  "get_care_plan_summary": {
    name: "get_care_plan_summary",
    description: "Get care plan statistics",
    query: `
      SELECT
        status,
        COUNT(*) as count
      FROM care_plans
      WHERE tenant_id = $1
      GROUP BY status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_task_completion_rate": {
    name: "get_task_completion_rate",
    description: "Get task completion statistics",
    query: `
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
      FROM care_tasks
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_referral_summary": {
    name: "get_referral_summary",
    description: "Get referral statistics by source",
    query: `
      SELECT
        ers.organization_name,
        pr.status,
        COUNT(*) as count
      FROM patient_referrals pr
      JOIN external_referral_sources ers ON pr.referral_source_id = ers.id
      WHERE pr.tenant_id = $1
        AND pr.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY ers.organization_name, pr.status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_bed_availability": {
    name: "get_bed_availability",
    description: "Get bed availability by unit",
    query: `
      SELECT
        unit,
        status,
        COUNT(*) as count
      FROM beds
      WHERE tenant_id = $1
      GROUP BY unit, status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_shift_handoff_summary": {
    name: "get_shift_handoff_summary",
    description: "Get shift handoff statistics",
    query: `
      SELECT
        shift_type,
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_duration_minutes
      FROM shift_handoffs
      WHERE tenant_id = $1
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY shift_type, status
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_dashboard_metrics": {
    name: "get_dashboard_metrics",
    description: "Get key dashboard metrics",
    query: `
      SELECT
        (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND enrollment_type = 'app') as active_members,
        (SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND readmission_risk_30 >= 0.7) as high_risk_patients,
        (SELECT COUNT(*) FROM encounters WHERE tenant_id = $1 AND encounter_date::date = CURRENT_DATE) as todays_encounters,
        (SELECT COUNT(*) FROM care_tasks WHERE tenant_id = $1 AND status = 'pending') as pending_tasks,
        (SELECT COUNT(*) FROM sdoh_flags WHERE tenant_id = $1 AND resolved = false) as active_sdoh_flags
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  },
  "get_quality_metrics": {
    name: "get_quality_metrics",
    description: "Get quality measure performance",
    query: `
      SELECT
        measure_code,
        measure_name,
        numerator,
        denominator,
        CASE WHEN denominator > 0 THEN (numerator::float / denominator * 100) ELSE 0 END as performance_rate
      FROM quality_measures
      WHERE tenant_id = $1
        AND reporting_period >= DATE_TRUNC('quarter', CURRENT_DATE)
    `,
    parameters: ["tenant_id"],
    returnsRows: true
  }
};

// Safe tables that can have schema/counts retrieved
export const SAFE_TABLES = new Set([
  'patients', 'encounters', 'claims', 'care_plans', 'care_tasks',
  'medications', 'allergies', 'sdoh_flags', 'referral_alerts',
  'beds', 'shift_handoffs', 'quality_measures', 'code_cpt',
  'code_icd10', 'code_hcpcs', 'questionnaire_responses'
]);
