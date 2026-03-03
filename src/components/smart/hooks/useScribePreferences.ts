/**
 * useScribePreferences.ts — Assistance level & provider preferences sub-hook
 *
 * Manages assistance level state (concise/balanced/detailed),
 * loading from database, and saving on change.
 *
 * Extracted from useSmartScribe.ts for modularity.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../../services/auditLogger';
import type { AssistanceSettings } from './useSmartScribe.types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get assistance level settings based on level
 * Simplified to 3 levels matching database schema: concise, balanced, detailed
 */
export function getAssistanceSettings(level: number): AssistanceSettings {
  // Concise (levels 1-4) - Maps to 'concise' in database
  if (level <= 4) {
    return {
      label: 'Concise',
      description: 'Codes only, minimal conversation',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-300',
      showConversationalMessages: false,
      showSuggestions: false,
      showReasoningDetails: false,
    };
  }
  // Balanced (levels 5-7) - Maps to 'balanced' in database
  if (level <= 7) {
    return {
      label: 'Balanced',
      description: 'Helpful suggestions and reminders',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300',
      showConversationalMessages: true,
      showSuggestions: true,
      showReasoningDetails: false,
    };
  }
  // Detailed (levels 8-10) - Maps to 'detailed' in database
  return {
    label: 'Detailed',
    description: 'Full coaching with explanations',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    showConversationalMessages: true,
    showSuggestions: true,
    showReasoningDetails: true,
  };
}

/**
 * Map verbosity text from database to numeric level
 * Database stores: 'concise' | 'balanced' | 'detailed'
 * UI displays: 1-10 scale
 */
function verbosityToLevel(verbosity: string): number {
  switch (verbosity) {
    case 'concise':
      return 3;
    case 'balanced':
      return 5;
    case 'detailed':
      return 8;
    default:
      return 5;
  }
}

/**
 * Map numeric level to verbosity text for database storage
 * UI levels 1-10 map to database values: 'concise' | 'balanced' | 'detailed'
 */
function levelToVerbosity(level: number): string {
  if (level <= 4) return 'concise';
  if (level <= 7) return 'balanced';
  return 'detailed';
}

// ============================================================================
// AUTO-CALIBRATION (Session 3 — 3.1)
// ============================================================================

/**
 * Compute whether the assistance level should auto-calibrate based on the
 * physician's observed documentation style (from ambient learning).
 *
 * Returns a suggestion only after 10+ sessions with a consistent verbosity
 * pattern that doesn't match the current assistance level. Returns null when
 * the current level is already appropriate or data is insufficient.
 */
export function computeAutoCalibration(
  preferredVerbosity: 'terse' | 'moderate' | 'verbose',
  sessionsAnalyzed: number,
  currentLevel: number
): { suggestedLevel: number; reason: string } | null {
  if (sessionsAnalyzed < 10) return null;

  if (preferredVerbosity === 'verbose' && currentLevel <= 7) {
    return {
      suggestedLevel: 8,
      reason: `Based on ${sessionsAnalyzed} sessions, Riley noticed you prefer more detail. Switching to Detailed mode would match your documentation style.`,
    };
  }

  if (preferredVerbosity === 'terse' && currentLevel >= 5) {
    return {
      suggestedLevel: 3,
      reason: `Based on ${sessionsAnalyzed} sessions, Riley noticed you prefer concise notes. Switching to Concise mode would match your documentation style.`,
    };
  }

  return null;
}

// ============================================================================
// HOOK
// ============================================================================

export interface UseScribePreferencesResult {
  assistanceLevel: number;
  assistanceLevelLoaded: boolean;
  assistanceLevelSaved: boolean;
  assistanceSettings: AssistanceSettings;
  handleAssistanceLevelChange: (newLevel: number) => Promise<void>;
  getAssistanceSettings: (level: number) => AssistanceSettings;
}

export function useScribePreferences(): UseScribePreferencesResult {
  const [assistanceLevel, setAssistanceLevel] = useState<number>(5);
  const [assistanceLevelLoaded, setAssistanceLevelLoaded] = useState(false);
  const [assistanceLevelSaved, setAssistanceLevelSaved] = useState(false);
  const [userTenantId, setUserTenantId] = useState<string | null>(null);

  const assistanceSettings = getAssistanceSettings(assistanceLevel);

  /**
   * Load assistance level from provider preferences on mount
   */
  useEffect(() => {
    const loadAssistanceLevel = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get user's tenant_id from their profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.tenant_id) {
          setUserTenantId(profile.tenant_id);
        }

        const { data: prefs, error } = await supabase
          .from('provider_scribe_preferences')
          .select('verbosity')
          .eq('provider_id', user.id)
          .maybeSingle();

        if (prefs && !error && prefs.verbosity !== null) {
          setAssistanceLevel(verbosityToLevel(prefs.verbosity));
          setAssistanceLevelLoaded(true);
        } else {
          setAssistanceLevelLoaded(true);
        }
      } catch (_error: unknown) {
        setAssistanceLevelLoaded(true);
      }
    };

    loadAssistanceLevel();
  }, []);

  /**
   * Handle assistance level change and save to preferences
   */
  const handleAssistanceLevelChange = async (newLevel: number) => {
    setAssistanceLevel(newLevel);
    setAssistanceLevelSaved(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Need tenant_id for RLS - if we don't have it yet, try to get it
      let tenantId = userTenantId;
      if (!tenantId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', user.id)
          .single();
        tenantId = profile?.tenant_id || null;
        if (tenantId) setUserTenantId(tenantId);
      }

      if (!tenantId) {
        auditLogger.warn('SCRIBE_ASSISTANCE_LEVEL_NO_TENANT', {
          providerId: user.id,
          newLevel,
        });
        return;
      }

      const verbosityText = levelToVerbosity(newLevel);

      const { error } = await supabase
        .from('provider_scribe_preferences')
        .upsert(
          {
            provider_id: user.id,
            tenant_id: tenantId,
            verbosity: verbosityText,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'provider_id',
          }
        );

      if (!error) {
        setAssistanceLevelSaved(true);
        auditLogger.info('SCRIBE_ASSISTANCE_LEVEL_UPDATED', {
          providerId: user.id,
          newLevel,
          verbosityText,
          label: getAssistanceSettings(newLevel).label,
        });
        setTimeout(() => setAssistanceLevelSaved(false), 3000);
      } else {
        auditLogger.error('SCRIBE_ASSISTANCE_LEVEL_SAVE_FAILED', error, {
          providerId: user.id,
          newLevel,
        });
      }
    } catch (error: unknown) {
      auditLogger.error(
        'SCRIBE_ASSISTANCE_LEVEL_ERROR',
        error instanceof Error ? error : new Error('Unknown error'),
        { newLevel }
      );
    }
  };

  return {
    assistanceLevel,
    assistanceLevelLoaded,
    assistanceLevelSaved,
    assistanceSettings,
    handleAssistanceLevelChange,
    getAssistanceSettings,
  };
}
