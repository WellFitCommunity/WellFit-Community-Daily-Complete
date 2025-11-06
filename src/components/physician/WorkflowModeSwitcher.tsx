// =====================================================
// WORKFLOW MODE SWITCHER
// Purpose: Focus modes to reduce cognitive overload
// Filters/highlights sections based on workflow context
// =====================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  ClipboardList,
  Heart,
  Zap,
  CheckCircle,
  Settings,
  Shield,
  Server,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// =====================================================
// TYPES
// =====================================================

export type WorkflowMode = 'all' | 'clinical' | 'administrative' | 'wellness' | 'security' | 'it';

export interface WorkflowModeConfig {
  id: WorkflowMode;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  gradient: string;
  sections: string[]; // IDs of sections to show/prioritize
}

interface WorkflowModeSwitcherProps {
  currentMode: WorkflowMode;
  onModeChange: (mode: WorkflowMode) => void;
}

// =====================================================
// WORKFLOW MODE CONFIGURATIONS
// =====================================================

export const WORKFLOW_MODES: Record<WorkflowMode, WorkflowModeConfig> = {
  all: {
    id: 'all',
    label: 'All Sections',
    description: 'Show everything',
    icon: Settings,
    gradient: 'from-gray-400 to-gray-600',
    sections: [],
  },
  clinical: {
    id: 'clinical',
    label: 'Clinical Focus',
    description: 'Patient care, vitals, medications, notes',
    icon: Stethoscope,
    gradient: 'from-blue-400 via-cyan-500 to-teal-500',
    sections: [
      'patient-summary',
      'smart-scribe',
      'telehealth',
      'medications',
      'vitals',
      'conditions',
      'labs',
      'risk-assessment',
      'ccm',
      'clinical-resources',
    ],
  },
  administrative: {
    id: 'administrative',
    label: 'Administrative',
    description: 'Documentation, reports, compliance',
    icon: ClipboardList,
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    sections: [
      'reports',
      'quality-metrics',
      'documentation',
      'user-questions',
    ],
  },
  wellness: {
    id: 'wellness',
    label: 'Wellness Hub',
    description: 'Community programs, SDOH, prevention',
    icon: Heart,
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    sections: [
      'physician-wellness',
      'chw-alerts',
      'community-programs',
      'sdoh',
    ],
  },
  security: {
    id: 'security',
    label: 'Security',
    description: 'HIPAA compliance, audit logs, access control',
    icon: Shield,
    gradient: 'from-red-400 via-orange-500 to-amber-500',
    sections: [
      'security-alerts',
      'audit-logs',
      'access-control',
      'compliance-reports',
      'mfa-enforcement',
      'phi-access-tracking',
    ],
  },
  it: {
    id: 'it',
    label: 'IT/Systems',
    description: 'System health, integrations, performance',
    icon: Server,
    gradient: 'from-indigo-400 via-blue-500 to-cyan-500',
    sections: [
      'system-health',
      'integration-status',
      'performance-metrics',
      'api-usage',
      'mcp-cost-dashboard',
      'error-tracking',
    ],
  },
};

// =====================================================
// WORKFLOW MODE SWITCHER COMPONENT
// =====================================================

export const WorkflowModeSwitcher: React.FC<WorkflowModeSwitcherProps> = ({
  currentMode,
  onModeChange,
}) => {
  const { user } = useAuth();
  const [lastUsed, setLastUsed] = useState<Record<WorkflowMode, Date>>({} as any);

  // Load last used timestamps from user preferences
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('physician_workflow_preferences')
        .select('last_clinical_mode, last_admin_mode, last_wellness_mode, last_security_mode, last_it_mode')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setLastUsed({
          all: new Date(),
          clinical: data.last_clinical_mode ? new Date(data.last_clinical_mode) : new Date(0),
          administrative: data.last_admin_mode ? new Date(data.last_admin_mode) : new Date(0),
          wellness: data.last_wellness_mode ? new Date(data.last_wellness_mode) : new Date(0),
          security: data.last_security_mode ? new Date(data.last_security_mode) : new Date(0),
          it: data.last_it_mode ? new Date(data.last_it_mode) : new Date(0),
        });
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const handleModeChange = async (mode: WorkflowMode) => {
    onModeChange(mode);

    // Save preference
    if (!user || mode === 'all') return;

    const fieldMap = {
      clinical: 'last_clinical_mode',
      administrative: 'last_admin_mode',
      wellness: 'last_wellness_mode',
      security: 'last_security_mode',
      it: 'last_it_mode',
    };

    const field = fieldMap[mode as keyof typeof fieldMap];
    if (!field) return;

    try {
      await supabase
        .from('physician_workflow_preferences')
        .upsert({
          user_id: user.id,
          [field]: new Date().toISOString(),
        });
    } catch (error) {
      // Error handled silently
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-800">Workflow Mode</h3>
        </div>
        <div className="text-xs text-gray-500">Filter sections by workflow</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.values(WORKFLOW_MODES).map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleModeChange(mode.id)}
              className={`
                relative p-4 rounded-lg transition-all text-left
                ${
                  isActive
                    ? `bg-gradient-to-br ${mode.gradient} text-white shadow-lg border-2 border-white`
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200'
                }
              `}
            >
              {/* Active indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-2 right-2"
                  >
                    <CheckCircle className="w-5 h-5 text-white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Icon */}
              <div className="mb-2">
                <Icon
                  className={`w-6 h-6 ${isActive ? 'text-white' : 'text-gray-600'}`}
                />
              </div>

              {/* Label */}
              <div
                className={`font-semibold text-sm mb-1 ${
                  isActive ? 'text-white' : 'text-gray-800'
                }`}
              >
                {mode.label}
              </div>

              {/* Description */}
              <div
                className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500'}`}
              >
                {mode.description}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Mode-specific tips */}
      {currentMode !== 'all' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-gray-700">
              <span className="font-semibold">
                {WORKFLOW_MODES[currentMode].label} mode active:
              </span>{' '}
              Showing {WORKFLOW_MODES[currentMode].sections.length} focused sections.
              Switch modes or press Cmd+K for quick access.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// =====================================================
// SECTION FILTER HOOK
// =====================================================

export const useSectionFilter = (
  mode: WorkflowMode,
  sectionId: string
): { visible: boolean; prioritized: boolean } => {
  if (mode === 'all') {
    return { visible: true, prioritized: false };
  }

  const config = WORKFLOW_MODES[mode];
  const visible = config.sections.includes(sectionId);
  const prioritized = visible;

  return { visible, prioritized };
};

// =====================================================
// WORKFLOW MODE PERSISTENCE
// =====================================================

export const saveWorkflowPreference = async (
  userId: string,
  mode: WorkflowMode,
  sectionOrder: string[]
) => {
  try {
    await supabase.from('physician_workflow_preferences').upsert({
      user_id: userId,
      preferred_mode: mode,
      section_order: sectionOrder,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    // Error handled silently
  }
};

export const loadWorkflowPreference = async (
  userId: string
): Promise<{ mode: WorkflowMode; sectionOrder: string[] } | null> => {
  try {
    const { data, error } = await supabase
      .from('physician_workflow_preferences')
      .select('preferred_mode, section_order')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return data
      ? {
          mode: (data.preferred_mode as WorkflowMode) || 'all',
          sectionOrder: data.section_order || [],
        }
      : null;
  } catch (error) {
    // Error handled silently
    return null;
  }
};
