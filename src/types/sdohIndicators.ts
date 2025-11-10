/**
 * SDOH (Social Determinants of Health) Comprehensive Indicator Types
 *
 * This file defines the data structure for the SDOH visual indicator system
 * that provides at-a-glance visualization of patient social determinants.
 */

/**
 * Risk severity levels for SDOH factors
 */
export type SDOHRiskLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical' | 'unknown';

/**
 * Status of SDOH factor intervention
 */
export type SDOHInterventionStatus =
  | 'not-assessed'      // Haven't screened for this factor
  | 'identified'        // Factor identified, no action yet
  | 'referral-made'     // Referred to services
  | 'in-progress'       // Actively receiving support
  | 'resolved'          // Issue addressed/resolved
  | 'declined';         // Patient declined assistance

/**
 * SDOH Category Groupings
 */
export type SDOHCategoryGroup =
  | 'core-needs'        // Housing, Food, Transportation, Financial
  | 'health-behaviors'  // Tobacco, Alcohol, Substance use
  | 'healthcare-access' // Dental, Vision, Mental health, Medications
  | 'social-support'    // Social isolation, Community, Caregiver
  | 'barriers'          // Legal, Language, Education, Technology
  | 'safety';           // Domestic violence, Neighborhood safety

/**
 * Individual SDOH Factor Categories
 */
export type SDOHCategory =
  // Core Needs
  | 'housing'
  | 'food-security'
  | 'transportation'
  | 'financial'
  | 'employment'

  // Health Behaviors
  | 'tobacco-use'
  | 'alcohol-use'
  | 'substance-use'

  // Healthcare Access
  | 'dental-care'
  | 'vision-care'
  | 'mental-health'
  | 'medication-access'
  | 'primary-care-access'

  // Social Support
  | 'social-isolation'
  | 'caregiver-burden'
  | 'community-connection'

  // Barriers
  | 'education'
  | 'health-literacy'
  | 'digital-literacy'
  | 'language-barrier'
  | 'legal-issues'
  | 'immigration-status'

  // Safety
  | 'domestic-violence'
  | 'neighborhood-safety'

  // Special Populations
  | 'disability'
  | 'veteran-status';

/**
 * Complete SDOH factor data
 */
export interface SDOHFactor {
  category: SDOHCategory;
  riskLevel: SDOHRiskLevel;
  interventionStatus: SDOHInterventionStatus;

  // Metadata
  lastAssessed?: string;          // ISO date string
  assessedBy?: string;            // Practitioner ID or name
  nextAssessmentDue?: string;     // ISO date string

  // Clinical coding
  zCodes?: string[];              // ICD-10 Z-codes (e.g., Z59.0 for homelessness)
  loincCode?: string;             // LOINC code for SDOH observation
  snomedCode?: string;            // SNOMED CT code if applicable

  // Details
  description?: string;           // Brief description of the specific issue
  notes?: string;                 // Clinical notes

  // Interventions
  referrals?: SDOHReferral[];     // Services referred to
  resources?: SDOHResource[];     // Resources provided

  // Impact
  impactOnHealth?: 'none' | 'minimal' | 'moderate' | 'significant' | 'severe';
  priorityLevel?: number;         // 1-5, with 5 being highest priority
}

/**
 * Referral made for SDOH support
 */
export interface SDOHReferral {
  id: string;
  service: string;                // e.g., "Food Bank", "Housing Authority"
  organization?: string;
  contactInfo?: string;
  dateReferred: string;
  status: 'pending' | 'completed' | 'declined' | 'no-show';
  followUpDate?: string;
  notes?: string;
}

/**
 * Resource provided to patient
 */
export interface SDOHResource {
  id: string;
  type: 'information' | 'material' | 'financial' | 'service';
  name: string;
  description?: string;
  dateProvided: string;
  providedBy?: string;
}

/**
 * Complete SDOH Profile for a patient
 */
export interface SDOHProfile {
  patientId: string;
  lastUpdated: string;

  // All SDOH factors
  factors: SDOHFactor[];

  // Summary metrics
  overallRiskScore: number;        // 0-100, calculated from all factors
  highRiskCount: number;           // Count of high/critical factors
  activeInterventionCount: number; // Count of in-progress interventions

  // Complexity scoring (for CCM billing)
  complexityTier: 'minimal' | 'low' | 'moderate' | 'high' | 'complex';
  ccmEligible: boolean;

  // Screening history
  screeningHistory?: SDOHScreening[];
}

/**
 * SDOH Screening Event
 */
export interface SDOHScreening {
  id: string;
  date: string;
  type: 'full' | 'targeted' | 'rapid' | 'update';
  tool?: 'PRAPARE' | 'AHC' | 'iHELP' | 'custom';  // Standardized screening tools
  screenedBy?: string;
  factorsIdentified: number;
  factorsAddressed: number;
  notes?: string;
}

/**
 * Visual indicator configuration for each SDOH category
 */
export interface SDOHIndicatorConfig {
  category: SDOHCategory;
  label: string;
  shortLabel: string;              // 2-3 chars for compact view
  icon: string;                    // Emoji or icon identifier
  color: string;                   // Primary color (hex)
  group: SDOHCategoryGroup;
  description: string;

  // Risk level styling
  riskColors: {
    none: string;
    low: string;
    moderate: string;
    high: string;
    critical: string;
    unknown: string;
  };
}

/**
 * Display preferences for SDOH indicators
 */
export interface SDOHDisplayPreferences {
  mode: 'compact' | 'standard' | 'detailed';
  showUnassessed: boolean;         // Show categories not yet assessed
  showResolved: boolean;           // Show resolved factors
  groupByCategory: boolean;        // Group by core-needs, behaviors, etc.
  highlightPriority: boolean;      // Highlight high-priority factors
  colorCodeIntensity: 'subtle' | 'normal' | 'vibrant';
}

/**
 * SDOH Alert Configuration
 */
export interface SDOHAlert {
  id: string;
  category: SDOHCategory;
  severity: 'info' | 'warning' | 'urgent' | 'critical';
  message: string;
  actionRequired?: string;
  dismissible: boolean;
  expiresAt?: string;
}

/**
 * Pre-configured SDOH indicator definitions
 */
export const SDOH_INDICATOR_CONFIGS: Record<SDOHCategory, SDOHIndicatorConfig> = {
  // Core Needs
  'housing': {
    category: 'housing',
    label: 'Housing',
    shortLabel: 'HSG',
    icon: '🏠',
    color: '#6366f1',
    group: 'core-needs',
    description: 'Housing stability, homelessness, unsafe conditions',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'food-security': {
    category: 'food-security',
    label: 'Food Security',
    shortLabel: 'FD',
    icon: '🍎',
    color: '#10b981',
    group: 'core-needs',
    description: 'Food access, hunger, nutrition quality',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'transportation': {
    category: 'transportation',
    label: 'Transportation',
    shortLabel: 'TRN',
    icon: '🚗',
    color: '#3b82f6',
    group: 'core-needs',
    description: 'Transportation access, mobility barriers',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'financial': {
    category: 'financial',
    label: 'Financial',
    shortLabel: 'FIN',
    icon: '💵',
    color: '#22c55e',
    group: 'core-needs',
    description: 'Financial security, income, debt',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'employment': {
    category: 'employment',
    label: 'Employment',
    shortLabel: 'EMP',
    icon: '💼',
    color: '#8b5cf6',
    group: 'core-needs',
    description: 'Employment status, job security, working conditions',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Health Behaviors
  'tobacco-use': {
    category: 'tobacco-use',
    label: 'Tobacco Use',
    shortLabel: 'TOB',
    icon: '🚬',
    color: '#ef4444',
    group: 'health-behaviors',
    description: 'Smoking, vaping, smokeless tobacco',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'alcohol-use': {
    category: 'alcohol-use',
    label: 'Alcohol Use',
    shortLabel: 'ALC',
    icon: '🍺',
    color: '#f59e0b',
    group: 'health-behaviors',
    description: 'Alcohol consumption, risk level',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'substance-use': {
    category: 'substance-use',
    label: 'Substance Use',
    shortLabel: 'SUB',
    icon: '💊',
    color: '#dc2626',
    group: 'health-behaviors',
    description: 'Drug use, recovery status, overdose risk',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Healthcare Access
  'dental-care': {
    category: 'dental-care',
    label: 'Dental Care',
    shortLabel: 'DNT',
    icon: '🦷',
    color: '#06b6d4',
    group: 'healthcare-access',
    description: 'Dental access, oral health needs',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'vision-care': {
    category: 'vision-care',
    label: 'Vision Care',
    shortLabel: 'VIS',
    icon: '👁️',
    color: '#8b5cf6',
    group: 'healthcare-access',
    description: 'Vision care access, eye health needs',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'mental-health': {
    category: 'mental-health',
    label: 'Mental Health',
    shortLabel: 'MH',
    icon: '🧠',
    color: '#a855f7',
    group: 'healthcare-access',
    description: 'Mental health access, treatment status, crisis risk',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'medication-access': {
    category: 'medication-access',
    label: 'Medication Access',
    shortLabel: 'MED',
    icon: '💊',
    color: '#ec4899',
    group: 'healthcare-access',
    description: 'Medication affordability, adherence barriers',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'primary-care-access': {
    category: 'primary-care-access',
    label: 'Primary Care Access',
    shortLabel: 'PCP',
    icon: '⚕️',
    color: '#14b8a6',
    group: 'healthcare-access',
    description: 'Primary care physician access, appointment availability',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Social Support
  'social-isolation': {
    category: 'social-isolation',
    label: 'Social Isolation',
    shortLabel: 'SOC',
    icon: '👥',
    color: '#6366f1',
    group: 'social-support',
    description: 'Social connections, support network, loneliness',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'caregiver-burden': {
    category: 'caregiver-burden',
    label: 'Caregiver Burden',
    shortLabel: 'CG',
    icon: '👵',
    color: '#f97316',
    group: 'social-support',
    description: 'Family caregiver stress, respite needs',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'community-connection': {
    category: 'community-connection',
    label: 'Community Connection',
    shortLabel: 'COM',
    icon: '🤝',
    color: '#84cc16',
    group: 'social-support',
    description: 'Community engagement, cultural connection',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Barriers
  'education': {
    category: 'education',
    label: 'Education',
    shortLabel: 'EDU',
    icon: '🎓',
    color: '#0891b2',
    group: 'barriers',
    description: 'Educational attainment, literacy',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'health-literacy': {
    category: 'health-literacy',
    label: 'Health Literacy',
    shortLabel: 'HL',
    icon: '📚',
    color: '#7c3aed',
    group: 'barriers',
    description: 'Understanding health information, medical instructions',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'digital-literacy': {
    category: 'digital-literacy',
    label: 'Digital Literacy',
    shortLabel: 'DIG',
    icon: '📱',
    color: '#0ea5e9',
    group: 'barriers',
    description: 'Technology access, digital skills, telehealth capacity',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'language-barrier': {
    category: 'language-barrier',
    label: 'Language Barrier',
    shortLabel: 'LNG',
    icon: '🌐',
    color: '#d946ef',
    group: 'barriers',
    description: 'Language barriers, interpreter needs',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'legal-issues': {
    category: 'legal-issues',
    label: 'Legal Issues',
    shortLabel: 'LEG',
    icon: '⚖️',
    color: '#64748b',
    group: 'barriers',
    description: 'Legal problems, justice involvement, documentation',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'immigration-status': {
    category: 'immigration-status',
    label: 'Immigration Status',
    shortLabel: 'IMM',
    icon: '🛂',
    color: '#475569',
    group: 'barriers',
    description: 'Immigration concerns, documentation status',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Safety
  'domestic-violence': {
    category: 'domestic-violence',
    label: 'Domestic Violence',
    shortLabel: 'DV',
    icon: '🔒',
    color: '#be123c',
    group: 'safety',
    description: 'Intimate partner violence, safety concerns',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'neighborhood-safety': {
    category: 'neighborhood-safety',
    label: 'Neighborhood Safety',
    shortLabel: 'NSF',
    icon: '🏘️',
    color: '#65a30d',
    group: 'safety',
    description: 'Neighborhood violence, environmental safety',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  // Special Populations
  'disability': {
    category: 'disability',
    label: 'Disability',
    shortLabel: 'DIS',
    icon: '♿',
    color: '#2563eb',
    group: 'barriers',
    description: 'Disability accommodations, mobility, accessibility',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  },

  'veteran-status': {
    category: 'veteran-status',
    label: 'Veteran Status',
    shortLabel: 'VET',
    icon: '🎖️',
    color: '#b91c1c',
    group: 'social-support',
    description: 'Veteran benefits access, service-related needs',
    riskColors: {
      none: '#f0fdf4',
      low: '#bbf7d0',
      moderate: '#fef08a',
      high: '#fed7aa',
      critical: '#fecaca',
      unknown: '#f3f4f6'
    }
  }
};

/**
 * Helper function to get risk color for a specific factor
 */
export function getSDOHRiskColor(category: SDOHCategory, riskLevel: SDOHRiskLevel): string {
  return SDOH_INDICATOR_CONFIGS[category].riskColors[riskLevel];
}

/**
 * Helper function to calculate overall risk score
 */
export function calculateOverallSDOHRisk(factors: SDOHFactor[]): number {
  if (factors.length === 0) return 0;

  const riskWeights = {
    none: 0,
    low: 25,
    moderate: 50,
    high: 75,
    critical: 100,
    unknown: 0
  };

  const totalRisk = factors.reduce((sum, factor) => {
    const weight = riskWeights[factor.riskLevel];
    const priority = factor.priorityLevel || 1;
    return sum + (weight * priority);
  }, 0);

  const maxPossibleRisk = factors.reduce((sum, factor) => {
    return sum + (100 * (factor.priorityLevel || 1));
  }, 0);

  return maxPossibleRisk > 0 ? Math.round((totalRisk / maxPossibleRisk) * 100) : 0;
}

/**
 * Helper function to determine complexity tier
 */
export function calculateComplexityTier(factors: SDOHFactor[]): 'minimal' | 'low' | 'moderate' | 'high' | 'complex' {
  const highRiskCount = factors.filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical').length;
  const moderateRiskCount = factors.filter(f => f.riskLevel === 'moderate').length;
  const totalFactors = highRiskCount + moderateRiskCount;

  if (totalFactors === 0) return 'minimal';
  if (totalFactors === 1 && highRiskCount === 0) return 'low';
  if (totalFactors <= 2) return 'moderate';
  if (totalFactors <= 4 || highRiskCount >= 2) return 'high';
  return 'complex';
}
