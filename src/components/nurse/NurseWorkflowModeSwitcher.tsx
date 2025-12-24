// =====================================================
// NURSE WORKFLOW MODE SWITCHER
// Purpose: Focus modes for nursing workflows
// Reduces cognitive overload for RNs across different contexts
// =====================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  ClipboardList,
  Heart,
  RefreshCw,
  Settings,
  Zap,
  CheckCircle,
  Activity,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// =====================================================
// TYPES
// =====================================================

export type NurseWorkflowMode = 'all' | 'clinical' | 'shift' | 'wellness' | 'administrative';

export interface NurseWorkflowModeConfig {
  id: NurseWorkflowMode;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  gradient: string;
  sections: string[];
}

interface NurseWorkflowModeSwitcherProps {
  currentMode: NurseWorkflowMode;
  onModeChange: (mode: NurseWorkflowMode) => void;
}

// =====================================================
// WORKFLOW MODE CONFIGURATIONS
// =====================================================

export const NURSE_WORKFLOW_MODES: Record<NurseWorkflowMode, NurseWorkflowModeConfig> = {
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
    label: 'Clinical Care',
    description: 'Documentation, assessments, CCM, scribe',
    icon: Stethoscope,
    gradient: 'from-blue-400 via-cyan-500 to-teal-500',
    sections: [
      'smart-scribe',
      'risk-assessment',
      'ccm-timeline',
      'patient-vitals',
      'medication-admin',
      'care-plans',
      'clinical-documentation',
    ],
  },
  shift: {
    id: 'shift',
    label: 'Shift Management',
    description: 'Handoffs, prioritization, coordination',
    icon: RefreshCw,
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    sections: [
      'shift-handoff',
      'patient-prioritization',
      'care-coordination',
      'telehealth-scheduler',
      'chw-alerts',
    ],
  },
  wellness: {
    id: 'wellness',
    label: 'Wellness & Support',
    description: 'Resilience, burnout prevention, community',
    icon: Heart,
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    sections: [
      'resilience-hub',
      'burnout-prevention',
      'peer-support',
      'wellness-resources',
      'self-care-tools',
    ],
  },
  administrative: {
    id: 'administrative',
    label: 'Administrative',
    description: 'Enrollment, reports, patient questions',
    icon: ClipboardList,
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    sections: [
      'patient-enrollment',
      'patient-questions',
      'reports-analytics',
      'claude-care-assistant',
      'documentation-templates',
    ],
  },
};

// =====================================================
// NURSE WORKFLOW MODE SWITCHER COMPONENT
// =====================================================

export const NurseWorkflowModeSwitcher: React.FC<NurseWorkflowModeSwitcherProps> = ({
  currentMode,
  onModeChange,
}) => {
  const { user } = useAuth();

  const handleModeChange = async (mode: NurseWorkflowMode) => {
    onModeChange(mode);

    // Save preference
    if (!user || mode === 'all') return;

    const fieldMap = {
      clinical: 'last_clinical_mode',
      shift: 'last_shift_mode',
      wellness: 'last_wellness_mode',
      administrative: 'last_administrative_mode',
    };

    const field = fieldMap[mode as keyof typeof fieldMap];
    if (!field) return;

    try {
      await supabase
        .from('nurse_workflow_preferences')
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
          <h3 className="font-bold text-gray-800">Nursing Workflow Mode</h3>
        </div>
        <div className="text-xs text-gray-500">Focus on specific nursing tasks</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(NURSE_WORKFLOW_MODES).map((mode) => {
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
                    ? `bg-linear-to-br ${mode.gradient} text-white shadow-lg border-2 border-white`
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
          className="mt-4 p-3 bg-linear-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-gray-700">
              <span className="font-semibold">
                {NURSE_WORKFLOW_MODES[currentMode].label} mode active:
              </span>{' '}
              Showing {NURSE_WORKFLOW_MODES[currentMode].sections.length} focused sections.
              Press Cmd+K for quick access.
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

export const useNurseSectionFilter = (
  mode: NurseWorkflowMode,
  sectionId: string
): { visible: boolean; prioritized: boolean } => {
  if (mode === 'all') {
    return { visible: true, prioritized: false };
  }

  const config = NURSE_WORKFLOW_MODES[mode];
  const visible = config.sections.includes(sectionId);
  const prioritized = visible;

  return { visible, prioritized };
};
