// =====================================================
// MCP NPI Registry Server — Healthcare Taxonomy Codes
// =====================================================

export const TAXONOMY_CODES: Record<string, {
  code: string;
  type: string;
  classification: string;
  specialization?: string;
}> = {
  "internal_medicine": { code: "207R00000X", type: "individual", classification: "Internal Medicine" },
  "family_medicine": { code: "207Q00000X", type: "individual", classification: "Family Medicine" },
  "cardiology": { code: "207RC0000X", type: "individual", classification: "Internal Medicine", specialization: "Cardiovascular Disease" },
  "orthopedic_surgery": { code: "207X00000X", type: "individual", classification: "Orthopaedic Surgery" },
  "neurology": { code: "2084N0400X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Neurology" },
  "pediatrics": { code: "208000000X", type: "individual", classification: "Pediatrics" },
  "ob_gyn": { code: "207V00000X", type: "individual", classification: "Obstetrics & Gynecology" },
  "psychiatry": { code: "2084P0800X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Psychiatry" },
  "emergency_medicine": { code: "207P00000X", type: "individual", classification: "Emergency Medicine" },
  "general_surgery": { code: "208600000X", type: "individual", classification: "Surgery" },
  "dermatology": { code: "207N00000X", type: "individual", classification: "Dermatology" },
  "radiology": { code: "2085R0202X", type: "individual", classification: "Radiology", specialization: "Diagnostic Radiology" },
  "anesthesiology": { code: "207L00000X", type: "individual", classification: "Anesthesiology" },
  "nursing": { code: "163W00000X", type: "individual", classification: "Nursing" },
  "nurse_practitioner": { code: "363L00000X", type: "individual", classification: "Nurse Practitioner" },
  "physician_assistant": { code: "363A00000X", type: "individual", classification: "Physician Assistant" },
  "physical_therapy": { code: "225100000X", type: "individual", classification: "Physical Therapist" },
  "occupational_therapy": { code: "225X00000X", type: "individual", classification: "Occupational Therapist" },
  "hospital": { code: "282N00000X", type: "organization", classification: "General Acute Care Hospital" },
  "clinic": { code: "261QM1300X", type: "organization", classification: "Clinic/Center", specialization: "Multi-Specialty" },
  "pharmacy": { code: "333600000X", type: "organization", classification: "Pharmacy" },
  "home_health": { code: "251E00000X", type: "organization", classification: "Home Health" },
  "skilled_nursing": { code: "314000000X", type: "organization", classification: "Skilled Nursing Facility" },
  "dme_supplier": { code: "332B00000X", type: "organization", classification: "Durable Medical Equipment & Medical Supplies" }
};
