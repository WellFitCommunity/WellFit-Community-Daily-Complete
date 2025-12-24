// =====================================================
// ADMIN PANEL WORKFLOW MODE SWITCHER
// Purpose: Focus modes for system administrators
// Reduces cognitive overload for IT/admin workflows
// =====================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server,
  Users,
  Settings,
  DollarSign,
  Activity,
  Zap,
  CheckCircle,
  BarChart3,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

// =====================================================
// TYPES
// =====================================================

export type AdminWorkflowMode = 'all' | 'system' | 'users' | 'billing' | 'monitoring';

export interface AdminWorkflowModeConfig {
  id: AdminWorkflowMode;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  gradient: string;
  sections: string[];
}

interface AdminWorkflowModeSwitcherProps {
  currentMode: AdminWorkflowMode;
  onModeChange: (mode: AdminWorkflowMode) => void;
}

// =====================================================
// WORKFLOW MODE CONFIGURATIONS
// =====================================================

export const ADMIN_WORKFLOW_MODES: Record<AdminWorkflowMode, AdminWorkflowModeConfig> = {
  all: {
    id: 'all',
    label: 'All Sections',
    description: 'Show everything',
    icon: Settings,
    gradient: 'from-gray-400 to-gray-600',
    sections: [],
  },
  system: {
    id: 'system',
    label: 'System & Infrastructure',
    description: 'Servers, databases, integrations, performance',
    icon: Server,
    gradient: 'from-indigo-400 via-blue-500 to-cyan-500',
    sections: [
      'system-health',
      'database-admin',
      'integration-status',
      'hospital-adapters',
      'api-usage',
      'performance-metrics',
      'system-configuration',
      'mcp-cost-dashboard',
    ],
  },
  users: {
    id: 'users',
    label: 'User Management',
    description: 'Accounts, roles, permissions, enrollment',
    icon: Users,
    gradient: 'from-green-400 via-emerald-500 to-teal-500',
    sections: [
      'user-list',
      'bulk-enrollment',
      'patient-enrollment',
      'role-management',
      'permissions',
      'mfa-enforcement',
      'access-control',
    ],
  },
  billing: {
    id: 'billing',
    label: 'Billing & Revenue',
    description: 'Claims, payments, revenue cycle, AI costs',
    icon: DollarSign,
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    sections: [
      'billing-dashboard',
      'claims-submission',
      'claims-appeals',
      'unified-billing',
      'claude-billing-monitoring',
      'mcp-cost-optimization',
      'revenue-reports',
    ],
  },
  monitoring: {
    id: 'monitoring',
    label: 'Performance & Monitoring',
    description: 'System metrics, logs, cache, performance',
    icon: Activity,
    gradient: 'from-purple-400 via-pink-500 to-rose-500',
    sections: [
      'performance-dashboard',
      'cache-monitoring',
      'error-tracking',
      'soc2-dashboard',
      'audit-logs',
      'fhir-interoperability',
      'patient-engagement',
    ],
  },
};

// =====================================================
// ADMIN WORKFLOW MODE SWITCHER COMPONENT
// =====================================================

export const AdminWorkflowModeSwitcher: React.FC<AdminWorkflowModeSwitcherProps> = ({
  currentMode,
  onModeChange,
}) => {
  const { user } = useAuth();

  const handleModeChange = async (mode: AdminWorkflowMode) => {
    onModeChange(mode);

    // Save preference
    if (!user || mode === 'all') return;

    const fieldMap = {
      system: 'last_system_mode',
      users: 'last_users_mode',
      billing: 'last_billing_mode',
      monitoring: 'last_monitoring_mode',
    };

    const field = fieldMap[mode as keyof typeof fieldMap];
    if (!field) return;

    try {
      await supabase
        .from('admin_workflow_preferences')
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
          <Zap className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-gray-800">Admin Workflow Mode</h3>
        </div>
        <div className="text-xs text-gray-500">Focus on specific admin tasks</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.values(ADMIN_WORKFLOW_MODES).map((mode) => {
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
          className="mt-4 p-3 bg-linear-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200"
        >
          <div className="flex items-start gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600 mt-0.5" />
            <div className="text-xs text-gray-700">
              <span className="font-semibold">
                {ADMIN_WORKFLOW_MODES[currentMode].label} mode active:
              </span>{' '}
              Showing {ADMIN_WORKFLOW_MODES[currentMode].sections.length} focused sections.
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

export const useAdminSectionFilter = (
  mode: AdminWorkflowMode,
  sectionId: string
): { visible: boolean; prioritized: boolean } => {
  if (mode === 'all') {
    return { visible: true, prioritized: false };
  }

  const config = ADMIN_WORKFLOW_MODES[mode];
  const visible = config.sections.includes(sectionId);
  const prioritized = visible;

  return { visible, prioritized };
};
