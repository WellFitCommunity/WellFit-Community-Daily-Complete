/**
 * Workflow Preferences Service
 *
 * Manages role-based navigation ordering and user workflow preferences.
 * Allows nurses/admins to have Patient List at the top, and supports
 * both click-based and voice-based navigation.
 *
 * Key Features:
 * - Role-based default ordering (nurse sees Patient Care first)
 * - User-customizable section ordering
 * - Voice command mapping for navigation
 * - Persistence via localStorage + database sync
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';

/**
 * Category ordering by role
 * Defines which categories appear first based on user role
 */
export interface CategoryOrder {
  categoryId: string;
  defaultOpen: boolean;
  priority: number; // Lower = higher priority (appears first)
}

/**
 * Role-based workflow defaults
 */
export const ROLE_BASED_DEFAULTS: Record<string, CategoryOrder[]> = {
  // Nurses: Patient Care first, then Clinical, then Revenue
  nurse: [
    { categoryId: 'patient-care', defaultOpen: true, priority: 1 },
    { categoryId: 'clinical', defaultOpen: false, priority: 2 },
    { categoryId: 'revenue', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],

  // Physicians: Patient Care first, Clinical second
  physician: [
    { categoryId: 'patient-care', defaultOpen: true, priority: 1 },
    { categoryId: 'clinical', defaultOpen: true, priority: 2 },
    { categoryId: 'revenue', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],
  doctor: [
    { categoryId: 'patient-care', defaultOpen: true, priority: 1 },
    { categoryId: 'clinical', defaultOpen: true, priority: 2 },
    { categoryId: 'revenue', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],

  // Billing: Revenue first
  billing_specialist: [
    { categoryId: 'revenue', defaultOpen: true, priority: 1 },
    { categoryId: 'patient-care', defaultOpen: false, priority: 2 },
    { categoryId: 'clinical', defaultOpen: false, priority: 3 },
    { categoryId: 'admin', defaultOpen: false, priority: 4 },
    { categoryId: 'security', defaultOpen: false, priority: 5 },
  ],

  // IT Admin: Security first, then Admin
  it_admin: [
    { categoryId: 'security', defaultOpen: true, priority: 1 },
    { categoryId: 'admin', defaultOpen: true, priority: 2 },
    { categoryId: 'patient-care', defaultOpen: false, priority: 3 },
    { categoryId: 'clinical', defaultOpen: false, priority: 4 },
    { categoryId: 'revenue', defaultOpen: false, priority: 5 },
  ],

  // Case Manager / Social Worker: Patient Care first
  case_manager: [
    { categoryId: 'patient-care', defaultOpen: true, priority: 1 },
    { categoryId: 'clinical', defaultOpen: false, priority: 2 },
    { categoryId: 'revenue', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],
  social_worker: [
    { categoryId: 'patient-care', defaultOpen: true, priority: 1 },
    { categoryId: 'clinical', defaultOpen: false, priority: 2 },
    { categoryId: 'revenue', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],

  // Admin/Super Admin: Revenue first (business focus), but all accessible
  admin: [
    { categoryId: 'revenue', defaultOpen: true, priority: 1 },
    { categoryId: 'patient-care', defaultOpen: false, priority: 2 },
    { categoryId: 'clinical', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],
  super_admin: [
    { categoryId: 'revenue', defaultOpen: true, priority: 1 },
    { categoryId: 'patient-care', defaultOpen: false, priority: 2 },
    { categoryId: 'clinical', defaultOpen: false, priority: 3 },
    { categoryId: 'security', defaultOpen: false, priority: 4 },
    { categoryId: 'admin', defaultOpen: false, priority: 5 },
  ],
};

/**
 * Voice command aliases for navigation
 * Maps spoken phrases to section/category IDs and routes
 */
export interface VoiceCommandMapping {
  phrases: string[]; // All phrases that trigger this command
  targetType: 'category' | 'section' | 'route' | 'action';
  targetId: string; // category ID, section ID, or route path
  displayName: string; // Human-readable name for confirmation
}

export const VOICE_COMMANDS: VoiceCommandMapping[] = [
  // Patient-related commands
  {
    phrases: ['patient list', 'patients', 'show patients', 'user management', 'users', 'manage patients', 'patient management'],
    targetType: 'section',
    targetId: 'user-management',
    displayName: 'Patient List',
  },
  {
    phrases: ['patient care', 'patient engagement', 'engagement dashboard'],
    targetType: 'section',
    targetId: 'patient-engagement',
    displayName: 'Patient Engagement Dashboard',
  },
  {
    phrases: ['patient handoff', 'handoff', 'transfer', 'patient transfer'],
    targetType: 'section',
    targetId: 'patient-handoff',
    displayName: 'Patient Handoff System',
  },
  {
    phrases: ['enroll patient', 'hospital enrollment', 'new patient', 'add patient'],
    targetType: 'section',
    targetId: 'hospital-enrollment',
    displayName: 'Hospital Patient Enrollment',
  },

  // Billing/Revenue commands
  {
    phrases: ['billing', 'billing dashboard', 'claims', 'billing claims'],
    targetType: 'section',
    targetId: 'billing-dashboard',
    displayName: 'Billing Dashboard',
  },
  {
    phrases: ['revenue', 'revenue dashboard', 'money', 'financials'],
    targetType: 'section',
    targetId: 'revenue-dashboard',
    displayName: 'Revenue Dashboard',
  },
  {
    phrases: ['ccm', 'chronic care', 'ccm autopilot', 'chronic care management'],
    targetType: 'section',
    targetId: 'ccm-autopilot',
    displayName: 'CCM Autopilot',
  },
  {
    phrases: ['claims submission', 'submit claims', 'claim submission'],
    targetType: 'section',
    targetId: 'claims-submission',
    displayName: 'Claims Submission Center',
  },
  {
    phrases: ['claims appeals', 'appeals', 'denied claims', 'appeal claims'],
    targetType: 'section',
    targetId: 'claims-appeals',
    displayName: 'Claims Appeals',
  },
  {
    phrases: ['smart scribe', 'scribe', 'transcription', 'dictation', 'voice notes'],
    targetType: 'section',
    targetId: 'smartscribe-atlus',
    displayName: 'SmartScribe Atlus',
  },
  {
    phrases: ['sdoh', 'social determinants', 'sdoh billing', 'social determinants billing'],
    targetType: 'section',
    targetId: 'sdoh-billing',
    displayName: 'SDOH Billing Encoder',
  },
  {
    phrases: ['staff savings', 'financial savings', 'savings tracker', 'cost savings'],
    targetType: 'section',
    targetId: 'staff-financial-savings',
    displayName: 'Staff Financial Savings',
  },

  // Clinical data commands
  {
    phrases: ['fhir', 'fhir analytics', 'ai analytics', 'clinical analytics'],
    targetType: 'section',
    targetId: 'fhir-analytics',
    displayName: 'FHIR Analytics',
  },
  {
    phrases: ['questionnaire', 'questionnaire builder', 'form builder', 'fhir forms'],
    targetType: 'section',
    targetId: 'fhir-questionnaire',
    displayName: 'FHIR Questionnaire Builder',
  },
  {
    phrases: ['reports', 'analytics', 'reports analytics'],
    targetType: 'section',
    targetId: 'reports-analytics',
    displayName: 'Reports & Analytics',
  },

  // Security commands
  {
    phrases: ['security', 'security dashboard', 'facility security'],
    targetType: 'section',
    targetId: 'tenant-security',
    displayName: 'Security Dashboard',
  },
  {
    phrases: ['audit', 'audit logs', 'access logs'],
    targetType: 'section',
    targetId: 'tenant-audit-logs',
    displayName: 'Audit Logs',
  },
  {
    phrases: ['compliance', 'compliance report', 'hipaa compliance'],
    targetType: 'section',
    targetId: 'tenant-compliance',
    displayName: 'Compliance Report',
  },

  // Admin commands
  {
    phrases: ['facility management', 'facilities', 'manage facilities'],
    targetType: 'section',
    targetId: 'facility-management',
    displayName: 'Facility Management',
  },
  {
    phrases: ['module config', 'modules', 'module configuration', 'feature flags'],
    targetType: 'section',
    targetId: 'module-configuration',
    displayName: 'Module Configuration',
  },
  {
    phrases: ['export', 'data export', 'export data'],
    targetType: 'section',
    targetId: 'data-export',
    displayName: 'Data Export',
  },
  {
    phrases: ['paper form', 'scan', 'scanner', 'ocr', 'paper scanner'],
    targetType: 'section',
    targetId: 'paper-form-scanner',
    displayName: 'Paper Form Scanner',
  },

  // Category commands
  {
    phrases: ['show revenue', 'revenue section', 'billing section', 'open revenue'],
    targetType: 'category',
    targetId: 'revenue',
    displayName: 'Revenue & Billing',
  },
  {
    phrases: ['show patient care', 'patient care section', 'open patient care'],
    targetType: 'category',
    targetId: 'patient-care',
    displayName: 'Patient Care',
  },
  {
    phrases: ['show clinical', 'clinical section', 'open clinical'],
    targetType: 'category',
    targetId: 'clinical',
    displayName: 'Clinical Data',
  },
  {
    phrases: ['show security', 'security section', 'open security'],
    targetType: 'category',
    targetId: 'security',
    displayName: 'Security & Compliance',
  },
  {
    phrases: ['show admin', 'admin section', 'system admin', 'open admin'],
    targetType: 'category',
    targetId: 'admin',
    displayName: 'System Administration',
  },

  // Route commands (navigate to different pages)
  {
    phrases: ['er dashboard', 'emergency', 'er', 'emergency room'],
    targetType: 'route',
    targetId: '/er-dashboard',
    displayName: 'ER Dashboard',
  },
  {
    phrases: ['bed management', 'beds', 'bed board'],
    targetType: 'route',
    targetId: '/bed-management',
    displayName: 'Bed Management',
  },
  {
    phrases: ['nurse dashboard', 'nurse panel'],
    targetType: 'route',
    targetId: '/nurse-dashboard',
    displayName: 'Nurse Dashboard',
  },
  {
    phrases: ['physician dashboard', 'doctor dashboard', 'physician panel'],
    targetType: 'route',
    targetId: '/physician-dashboard',
    displayName: 'Physician Dashboard',
  },
  {
    phrases: ['enroll senior', 'senior enrollment'],
    targetType: 'route',
    targetId: '/admin/enroll-senior',
    displayName: 'Enroll Senior',
  },
  {
    phrases: ['photo approval', 'approve photos'],
    targetType: 'route',
    targetId: '/admin/photo-approval',
    displayName: 'Photo Approval',
  },
  {
    phrases: ['neuro suite', 'neurology', 'stroke', 'dementia', 'parkinsons'],
    targetType: 'route',
    targetId: '/neuro-suite',
    displayName: 'NeuroSuite',
  },
  {
    phrases: ['physical therapy', 'pt dashboard', 'pt'],
    targetType: 'route',
    targetId: '/physical-therapy',
    displayName: 'Physical Therapy',
  },
  {
    phrases: ['care coordination', 'care team'],
    targetType: 'route',
    targetId: '/care-coordination',
    displayName: 'Care Coordination',
  },
  {
    phrases: ['referrals', 'referral dashboard'],
    targetType: 'route',
    targetId: '/referrals',
    displayName: 'Referrals',
  },
  {
    phrases: ['chw dashboard', 'community health', 'chw'],
    targetType: 'route',
    targetId: '/chw/dashboard',
    displayName: 'CHW Dashboard',
  },

  // Quick actions
  {
    phrases: ['bulk enroll', 'batch enroll'],
    targetType: 'route',
    targetId: '/admin/bulk-enroll',
    displayName: 'Bulk Enroll',
  },
  {
    phrases: ['bulk export', 'batch export'],
    targetType: 'route',
    targetId: '/admin/bulk-export',
    displayName: 'Bulk Export',
  },
];

/**
 * User workflow preferences (persisted per user)
 */
export interface WorkflowPreferences {
  userId: string;
  categoryOrder: CategoryOrder[];
  pinnedSections: string[]; // Section IDs pinned to top
  recentSections: string[]; // Recently accessed sections (for quick access)
  voiceEnabled: boolean;
  lastUpdated: Date;
}

const STORAGE_KEY_PREFIX = 'workflow_prefs_';

/**
 * Get workflow preferences for a user
 */
export async function getWorkflowPreferences(
  supabase: SupabaseClient,
  userId: string,
  userRole: string
): Promise<WorkflowPreferences> {
  try {
    // Try localStorage first (faster)
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(storageKey);

    if (cached) {
      const prefs = JSON.parse(cached) as WorkflowPreferences;
      return prefs;
    }

    // Try database
    const { data, error } = await supabase
      .from('user_workflow_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data && !error) {
      const prefs: WorkflowPreferences = {
        userId: data.user_id,
        categoryOrder: data.category_order || [],
        pinnedSections: data.pinned_sections || [],
        recentSections: data.recent_sections || [],
        voiceEnabled: data.voice_enabled ?? true,
        lastUpdated: new Date(data.updated_at),
      };

      // Cache in localStorage
      localStorage.setItem(storageKey, JSON.stringify(prefs));
      return prefs;
    }

    // Return role-based defaults
    return getDefaultPreferences(userId, userRole);
  } catch (error) {
    // Return role-based defaults on error
    return getDefaultPreferences(userId, userRole);
  }
}

/**
 * Get default preferences based on user role
 */
export function getDefaultPreferences(userId: string, userRole: string): WorkflowPreferences {
  const roleDefaults = ROLE_BASED_DEFAULTS[userRole] || ROLE_BASED_DEFAULTS['admin'];

  return {
    userId,
    categoryOrder: roleDefaults,
    pinnedSections: [],
    recentSections: [],
    voiceEnabled: true,
    lastUpdated: new Date(),
  };
}

/**
 * Save workflow preferences
 */
export async function saveWorkflowPreferences(
  supabase: SupabaseClient,
  prefs: WorkflowPreferences
): Promise<void> {
  try {
    // Save to localStorage immediately
    const storageKey = `${STORAGE_KEY_PREFIX}${prefs.userId}`;
    localStorage.setItem(storageKey, JSON.stringify({
      ...prefs,
      lastUpdated: new Date(),
    }));

    // Save to database
    await supabase
      .from('user_workflow_preferences')
      .upsert({
        user_id: prefs.userId,
        category_order: prefs.categoryOrder,
        pinned_sections: prefs.pinnedSections,
        recent_sections: prefs.recentSections,
        voice_enabled: prefs.voiceEnabled,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });
  } catch (error) {
    auditLogger.error('SAVE_WORKFLOW_PREFERENCES_FAILED', error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * Update recent sections (track what user accesses)
 */
export async function trackSectionAccess(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  sectionId: string
): Promise<void> {
  try {
    const prefs = await getWorkflowPreferences(supabase, userId, userRole);

    // Add to recent sections (max 10, most recent first)
    const recent = [sectionId, ...prefs.recentSections.filter(s => s !== sectionId)].slice(0, 10);

    await saveWorkflowPreferences(supabase, {
      ...prefs,
      recentSections: recent,
    });
  } catch (error) {
    // Fail silently
  }
}

/**
 * Pin/unpin a section to the top
 */
export async function togglePinnedSection(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  sectionId: string
): Promise<boolean> {
  try {
    const prefs = await getWorkflowPreferences(supabase, userId, userRole);

    const isPinned = prefs.pinnedSections.includes(sectionId);

    const newPinned = isPinned
      ? prefs.pinnedSections.filter(s => s !== sectionId)
      : [...prefs.pinnedSections, sectionId];

    await saveWorkflowPreferences(supabase, {
      ...prefs,
      pinnedSections: newPinned,
    });

    return !isPinned; // Return new pinned state
  } catch (error) {
    return false;
  }
}

/**
 * Reorder categories based on user preference
 */
export async function reorderCategories(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  newOrder: CategoryOrder[]
): Promise<void> {
  try {
    const prefs = await getWorkflowPreferences(supabase, userId, userRole);

    await saveWorkflowPreferences(supabase, {
      ...prefs,
      categoryOrder: newOrder,
    });
  } catch (error) {
    auditLogger.error('REORDER_CATEGORIES_FAILED', error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * Find voice command match
 */
export function findVoiceCommandMatch(transcript: string): VoiceCommandMapping | null {
  const normalizedTranscript = transcript.toLowerCase().trim();

  // Find exact or partial match
  for (const command of VOICE_COMMANDS) {
    for (const phrase of command.phrases) {
      if (normalizedTranscript.includes(phrase.toLowerCase())) {
        return command;
      }
    }
  }

  return null;
}

/**
 * Get all available voice commands (for help/suggestions)
 */
export function getAllVoiceCommands(): { phrase: string; displayName: string }[] {
  return VOICE_COMMANDS.map(cmd => ({
    phrase: cmd.phrases[0], // Primary phrase
    displayName: cmd.displayName,
  }));
}

/**
 * Move category to top (spoken command: "move billing to top")
 */
export async function moveCategoryToTop(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  categoryId: string
): Promise<void> {
  try {
    const prefs = await getWorkflowPreferences(supabase, userId, userRole);

    // Find the category and move it to top
    const categoryIndex = prefs.categoryOrder.findIndex(c => c.categoryId === categoryId);
    if (categoryIndex === -1) return;

    const [category] = prefs.categoryOrder.splice(categoryIndex, 1);
    category.priority = 0;
    category.defaultOpen = true;

    // Re-number priorities
    const newOrder = [
      category,
      ...prefs.categoryOrder.map((c, i) => ({ ...c, priority: i + 1 })),
    ];

    await saveWorkflowPreferences(supabase, {
      ...prefs,
      categoryOrder: newOrder,
    });
  } catch (error) {
    auditLogger.error('MOVE_CATEGORY_FAILED', error instanceof Error ? error : new Error('Unknown error'));
  }
}
