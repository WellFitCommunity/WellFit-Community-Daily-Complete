// Shared types for the bulk-export function.

export interface ExportFilters {
  dateFrom: string;
  dateTo: string;
  userTypes: string[];
  includeArchived: boolean;
  format: "csv" | "xlsx" | "json";
  compression: boolean;
}

export type ExportType =
  | "check_ins"
  | "risk_assessments"
  | "users_profiles"
  | "billing_claims"
  | "fhir_resources"
  | "audit_logs";

export interface ExportRequest {
  jobId: string;
  exportType: ExportType;
  filters: ExportFilters;
  requestedBy: string;
  tenantId?: string; // Optional override for super-admins
}

// Profile with roles join result
export interface ProfileWithRoles {
  tenant_id: string | null;
  is_admin: boolean | null;
  role_id: string | null;
  roles: { name: string } | null;
}

// Generic export record for CSV/FHIR conversion
export interface ExportRecord {
  id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
  mood?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  blood_oxygen?: number;
  spo2?: number;
  blood_sugar?: number;
  weight?: number;
  created_at?: string;
  [key: string]: unknown;
}

// FHIR Bundle entry structure
export interface FHIRBundleEntry {
  fullUrl: string;
  resource: Record<string, unknown>;
}

// Minimal audit logger interface (the shared createLogger return shape we use)
export interface AuditLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  security: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}
