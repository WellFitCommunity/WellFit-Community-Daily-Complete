// =====================================================
// MCP Medical Codes Server — Reference Data
// SDOH Z-Codes & Bundling Rules
// =====================================================

export const SDOH_CODES: Record<string, Array<{ code: string; description: string }>> = {
  housing: [
    { code: "Z59.0", description: "Homelessness" },
    { code: "Z59.1", description: "Inadequate housing" },
    { code: "Z59.2", description: "Discord with neighbors, lodgers and landlord" },
    { code: "Z59.3", description: "Problems related to living in residential institution" },
    { code: "Z59.41", description: "Food insecurity" },
    { code: "Z59.48", description: "Other specified lack of adequate food" },
    { code: "Z59.5", description: "Extreme poverty" },
    { code: "Z59.6", description: "Low income" },
    { code: "Z59.7", description: "Insufficient social insurance and welfare support" },
    { code: "Z59.81", description: "Housing instability, housed" },
    { code: "Z59.811", description: "Housing instability, housed, with risk of homelessness" },
    { code: "Z59.812", description: "Housing instability, housed, homelessness in past 12 months" },
    { code: "Z59.819", description: "Housing instability, housed, unspecified" },
    { code: "Z59.89", description: "Other problems related to housing and economic circumstances" },
  ],
  food: [
    { code: "Z59.41", description: "Food insecurity" },
    { code: "Z59.48", description: "Other specified lack of adequate food" },
    { code: "E63.9", description: "Nutritional deficiency, unspecified" },
    { code: "E46", description: "Unspecified protein-calorie malnutrition" },
  ],
  transportation: [
    { code: "Z59.82", description: "Transportation insecurity" },
    { code: "Z75.3", description: "Unavailability and inaccessibility of health-care facilities" },
  ],
  employment: [
    { code: "Z56.0", description: "Unemployment, unspecified" },
    { code: "Z56.1", description: "Change of job" },
    { code: "Z56.2", description: "Threat of job loss" },
    { code: "Z56.3", description: "Stressful work schedule" },
    { code: "Z56.4", description: "Discord with boss and workmates" },
    { code: "Z56.5", description: "Uncongenial work environment" },
    { code: "Z56.6", description: "Other physical and mental strain related to work" },
    { code: "Z56.81", description: "Sexual harassment on the job" },
    { code: "Z56.82", description: "Military deployment status" },
    { code: "Z56.89", description: "Other problems related to employment" },
  ],
  education: [
    { code: "Z55.0", description: "Illiteracy and low-level literacy" },
    { code: "Z55.1", description: "Schooling unavailable and unattainable" },
    { code: "Z55.2", description: "Failed school examinations" },
    { code: "Z55.3", description: "Underachievement in school" },
    { code: "Z55.4", description: "Educational maladjustment and discord with teachers and classmates" },
    { code: "Z55.5", description: "Less than a high school diploma" },
    { code: "Z55.8", description: "Other problems related to education and literacy" },
  ],
  social: [
    { code: "Z60.0", description: "Problems of adjustment to life-cycle transitions" },
    { code: "Z60.2", description: "Problems related to living alone" },
    { code: "Z60.3", description: "Acculturation difficulty" },
    { code: "Z60.4", description: "Social exclusion and rejection" },
    { code: "Z60.5", description: "Target of (perceived) adverse discrimination and persecution" },
    { code: "Z60.8", description: "Other problems related to social environment" },
    { code: "Z63.0", description: "Problems in relationship with spouse or partner" },
    { code: "Z63.4", description: "Disappearance and death of family member" },
    { code: "Z63.5", description: "Disruption of family by separation and divorce" },
    { code: "Z63.6", description: "Dependent relative needing care at home" },
    { code: "Z63.71", description: "Stress on family due to return of family member from military deployment" },
    { code: "Z63.72", description: "Alcoholism and drug addiction in family" },
    { code: "Z63.79", description: "Other stressful life events affecting family and household" },
    { code: "Z65.4", description: "Victim of crime and terrorism" },
  ]
};

export const BUNDLING_RULES: Array<{
  column1: string;
  column2: string;
  modifier: string | null;
  description: string;
}> = [
  { column1: "99213", column2: "99214", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "99213", column2: "99215", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "99214", column2: "99215", modifier: null, description: "Cannot bill multiple E/M codes same day same provider" },
  { column1: "36415", column2: "36416", modifier: null, description: "Blood draw codes bundle together" },
  { column1: "81000", column2: "81001", modifier: null, description: "Urinalysis codes bundle" },
  { column1: "81002", column2: "81003", modifier: null, description: "Urinalysis codes bundle" },
  { column1: "99201", column2: "99211", modifier: "25", description: "New patient and established patient codes need modifier 25" },
];

export function checkBundling(cptCodes: string[]): Array<{ codes: string[]; issue: string; suggestion: string }> {
  const issues: Array<{ codes: string[]; issue: string; suggestion: string }> = [];

  for (const rule of BUNDLING_RULES) {
    if (cptCodes.includes(rule.column1) && cptCodes.includes(rule.column2)) {
      issues.push({
        codes: [rule.column1, rule.column2],
        issue: rule.description,
        suggestion: rule.modifier
          ? `Add modifier ${rule.modifier} to separate the services`
          : `Remove one of the codes or document medical necessity`
      });
    }
  }

  // Check for duplicate codes
  const codeCounts = cptCodes.reduce((acc, code) => {
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  for (const [code, count] of Object.entries(codeCounts)) {
    if (count > 1) {
      issues.push({
        codes: [code],
        issue: `Code ${code} appears ${count} times`,
        suggestion: `Add modifier 76 or 77 for repeat procedures, or combine units`
      });
    }
  }

  return issues;
}
