// =====================================================
// SECURITY PANEL WORKFLOW MODE SWITCHER
// Purpose: Focus modes for security/compliance teams
// Reduces cognitive overload for HIPAA/SOC2 workflows
// =====================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Lock,
  Eye,
  AlertTriangle,
  FileText,
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

export type SecurityWorkflowMode = 'all' | 'compliance' | 'monitoring' | 'incidents' | 'audits';

export interface SecurityWorkflowModeConfig {
  id: SecurityWorkflowMode;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  gradient: string;
  sections: string[];
}

interface SecurityWorkflowModeSwitcherProps {
  currentMode: SecurityWorkflowMode;
  onModeChange: (mode: SecurityWorkflowMode) => void;
}

// =====================================================
// WORKFLOW MODE CONFIGURATIONS
// =====================================================

export const SECURITY_WORKFLOW_MODES: Record<SecurityWorkflowMode, SecurityWorkflowModeConfig> = {
  all: {
    id: 'all',
    label: 'All Sections',
    description: 'Show everything',
    icon: Settings,
    gradient: 'from-gray-400 to-gray-600',
    sections: [],
  },
  compliance: {
    id: 'compliance',
    label: 'HIPAA/SOC2 Compliance',
    description: 'Compliance monitoring, policies, certifications',
    icon: Shield,
    gradient: 'from-blue-400 via-indigo-500 to-purple-500',
    sections: [
      'compliance-dashboard',
      'hipaa-controls',
      'soc2-controls',
      'policy-management',
      'certification-status',
      'risk-assessments',
      'compliance-reports',
    ],
  },
  monitoring: {
    id: 'monitoring',
    label: 'Security Monitoring',
    description: 'Real-time alerts, PHI access, anomalies',
    icon: Eye,
    gradient: 'from-green-400 via-teal-500 to-cyan-500',
    sections: [
      'security-alerts',
      'guardian-eyes',
      'phi-access-logs',
      'behavioral-analytics',
      'anomaly-detection',
      'real-time-monitoring',
    ],
  },
  incidents: {
    id: 'incidents',
    label: 'Incident Response',
    description: 'Security incidents, breaches, investigations',
    icon: AlertTriangle,
    gradient: 'from-red-400 via-orange-500 to-amber-500',
    sections: [
      'active-incidents',
      'breach-notifications',
      'incident-timeline',
      'investigation-tools',
      'forensics',
      'remediation-tracking',
    ],
  },
  audits: {
    id: 'audits',
    label: 'Audit Logs & Reports',
    description: 'Audit trails, access logs, compliance reports',
    icon: FileText,
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    sections: [
      'audit-logs',
      'access-control-logs',
      'phi-access-tracking',
      'mfa-enforcement',
      'audit-reports',
      'export-logs',
    ],
  },
};

// =====================================================
// SECURITY WORKFLOW MODE SWITCHER COMPONENT
// =====================================================

export const SecurityWorkflowModeSwitcher: React.FC<SecurityWorkflowModeSwitcherProps> = ({
  currentMode,
  onModeChange,
}) => {
  const { user } = useAuth();

  const handleModeChange = async (mode: SecurityWorkflowMode) => {
    onModeChange(mode);

    // Save preference
    if (!user || mode === 'all') return;

    const fieldMap = {
      compliance: 'last_compliance_mode',
      monitoring: 'last_monitoring_mode',
      incidents: 'last_incidents_mode',
      audits: 'last_audits_mode',
    };

    const field = fieldMap[mode as keyof typeof fieldMap];
    if (!field) return;

    try {
      await supabase
        .from('security_workflow_preferences')
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
          <Zap className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-gray-800">Security Workflow Mode</h3>
        </div>
        <div className="text-xs text-gray-500">Focus on specific security tasks</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(SECURITY_WORKFLOW_MODES).map((mode) => {
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
          className="mt-4 p-3 bg-linear-to-r from-red-50 to-orange-50 rounded-lg border border-red-200"
        >
          <div className="flex items-start gap-2">
            <Activity className="w-4 h-4 text-red-600 mt-0.5" />
            <div className="text-xs text-gray-700">
              <span className="font-semibold">
                {SECURITY_WORKFLOW_MODES[currentMode].label} mode active:
              </span>{' '}
              Showing {SECURITY_WORKFLOW_MODES[currentMode].sections.length} focused sections.
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

export const useSecuritySectionFilter = (
  mode: SecurityWorkflowMode,
  sectionId: string
): { visible: boolean; prioritized: boolean } => {
  if (mode === 'all') {
    return { visible: true, prioritized: false };
  }

  const config = SECURITY_WORKFLOW_MODES[mode];
  const visible = config.sections.includes(sectionId);
  const prioritized = visible;

  return { visible, prioritized };
};
