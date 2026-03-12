// =====================================================
// MCP CMS Coverage Server — Type Definitions
//
// Database row interfaces for CMS reference tables.
// Used by toolHandlers.ts for typed query results.
// =====================================================

export interface CMSLCDRow {
  lcd_id: string;
  title: string;
  contractor_name: string | null;
  contractor_number: string | null;
  jurisdiction: string | null;
  status: string;
  effective_date: string | null;
  revision_date: string | null;
  related_codes: string[] | null;
  coverage_indications: string[] | null;
  limitations: string[] | null;
  summary: string | null;
  benefit_category: string | null;
}

export interface CMSNCDRow {
  ncd_id: string;
  title: string;
  manual_section: string | null;
  status: string;
  effective_date: string | null;
  implementation_date: string | null;
  benefit_category: string | null;
  coverage_provisions: string | null;
  covered_indications: string[] | null;
  non_covered_indications: string[] | null;
  documentation_requirements: string[] | null;
  related_lcd_ids: string[] | null;
}

export interface CMSPriorAuthRow {
  code: string;
  code_system: string;
  description: string;
  requires_prior_auth: boolean;
  documentation_required: string[] | null;
  typical_approval_time: string | null;
  category: string | null;
  payer_type: string | null;
}

export interface CMSArticleRow {
  article_id: string;
  title: string;
  article_type: string;
  related_lcd_id: string | null;
  related_codes: string[] | null;
  content: string | null;
  contractor_name: string | null;
  effective_date: string | null;
}

export interface CMSMACRow {
  state_code: string;
  jurisdiction_type: string;
  contractor_name: string;
  contractor_number: string;
  jurisdiction_label: string | null;
}

export interface MCPLogger {
  info(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
  warn?(event: string, data?: Record<string, unknown>): void;
}
