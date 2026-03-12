// =====================================================
// MCP CMS Coverage Server — Fallback Reference Data
//
// FALLBACK ONLY: Used when Supabase database is unreachable.
// Primary data source is now the cms_* database tables
// seeded in migration 20260312000001_cms_coverage_reference_tables.sql
//
// This file provides Tier 1 resilience — the server can still
// answer common prior auth and MAC contractor queries even if
// the database connection fails.
// =====================================================

// Common Prior Auth Requirements by CPT/HCPCS Code (fallback subset)
export const FALLBACK_PRIOR_AUTH_CODES: Record<string, {
  description: string;
  requires_prior_auth: boolean;
  documentation_required: string[];
  typical_approval_time: string;
}> = {
  // Imaging
  "70553": {
    description: "MRI brain with and without contrast",
    requires_prior_auth: true,
    documentation_required: ["Clinical indication", "Prior imaging results", "Neurological exam"],
    typical_approval_time: "2-5 business days"
  },
  "71250": {
    description: "CT chest without contrast",
    requires_prior_auth: false,
    documentation_required: ["Clinical indication"],
    typical_approval_time: "N/A"
  },
  "72148": {
    description: "MRI lumbar spine without contrast",
    requires_prior_auth: true,
    documentation_required: ["Clinical indication", "Conservative treatment documentation (6 weeks)", "Physical exam findings"],
    typical_approval_time: "2-5 business days"
  },
  // Surgeries
  "27447": {
    description: "Total knee replacement",
    requires_prior_auth: true,
    documentation_required: ["X-rays showing bone-on-bone", "Failed conservative treatment (3+ months)", "BMI documentation", "Pre-op clearance"],
    typical_approval_time: "5-10 business days"
  },
  "27130": {
    description: "Total hip replacement",
    requires_prior_auth: true,
    documentation_required: ["X-rays showing joint deterioration", "Failed conservative treatment", "Functional assessment"],
    typical_approval_time: "5-10 business days"
  },
  // DME
  "E0601": {
    description: "CPAP device",
    requires_prior_auth: true,
    documentation_required: ["Sleep study (AHI >= 15 or AHI 5-14 with symptoms)", "Face-to-face evaluation", "Diagnosis of OSA"],
    typical_approval_time: "3-7 business days"
  },
  "K0823": {
    description: "Power wheelchair, Group 2 standard",
    requires_prior_auth: true,
    documentation_required: ["Face-to-face exam", "Mobility limitation documentation", "Home assessment", "7-element order"],
    typical_approval_time: "10-14 business days"
  },
  // Specialty Drugs
  "J0897": {
    description: "Denosumab injection",
    requires_prior_auth: true,
    documentation_required: ["Bone density scan (T-score <= -2.5)", "Contraindication to bisphosphonates or failure"],
    typical_approval_time: "3-5 business days"
  }
};

// MAC Contractor Information by State (fallback subset — 7 states)
export const FALLBACK_MAC_CONTRACTORS: Record<string, {
  part_a_b: { name: string; number: string; };
  dme: { name: string; number: string; };
}> = {
  "TX": {
    part_a_b: { name: "Novitas Solutions", number: "JH" },
    dme: { name: "CGS Administrators", number: "DME-C" }
  },
  "CA": {
    part_a_b: { name: "Noridian Healthcare Solutions", number: "JE" },
    dme: { name: "Noridian Healthcare Solutions", number: "DME-A" }
  },
  "FL": {
    part_a_b: { name: "First Coast Service Options", number: "JN" },
    dme: { name: "CGS Administrators", number: "DME-C" }
  },
  "NY": {
    part_a_b: { name: "National Government Services", number: "JK" },
    dme: { name: "CGS Administrators", number: "DME-B" }
  },
  "PA": {
    part_a_b: { name: "Novitas Solutions", number: "JL" },
    dme: { name: "CGS Administrators", number: "DME-B" }
  },
  "IL": {
    part_a_b: { name: "National Government Services", number: "JK" },
    dme: { name: "CGS Administrators", number: "DME-B" }
  },
  "OH": {
    part_a_b: { name: "CGS Administrators", number: "J15" },
    dme: { name: "CGS Administrators", number: "DME-B" }
  }
};
