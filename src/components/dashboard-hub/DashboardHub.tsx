/**
 * DashboardHub - Central navigation hub for all dashboard suites
 *
 * Purpose: Front door to every tabbed suite and standalone dashboard.
 * Replaces the need to know URLs — touch a card, go to the suite.
 * Used by: /hub route (admin+ roles)
 *
 * Layout: Card grid grouped by category, role-aware visibility.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import AdminHeader from '../admin/AdminHeader';
import {
  DollarSign,
  Shield,
  Users,
  Network,
  Server,
  Settings,
  Award,
  Wrench,
  BedDouble,
  Stethoscope,
  Brain,
  Activity,
  Heart,
  ClipboardList,
  FileText,
  AlertTriangle,
  BarChart3,
  Pill,
  Eye,
  Zap,
} from 'lucide-react';

/** Card definition for hub navigation */
interface HubCard {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: React.ElementType;
  color: string;
  category: 'suites' | 'clinical' | 'workflows';
  roles?: string[];
  badge?: string;
}

/** All hub cards organized by priority */
const hubCards: HubCard[] = [
  // ── Tabbed Suites (new) ──────────────────────────────────────
  {
    id: 'billing',
    title: 'Billing Suite',
    description: 'Revenue cycle — claims, eligibility, ERA posting, appeals',
    path: '/billing-suite',
    icon: DollarSign,
    color: 'from-emerald-600 to-emerald-800',
    category: 'suites',
    badge: '15 dashboards',
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    description: 'HIPAA monitoring, audit logs, breach tracking, MFA',
    path: '/security-compliance',
    icon: Shield,
    color: 'from-red-600 to-red-800',
    category: 'suites',
    badge: '12 dashboards',
  },
  {
    id: 'care-ops',
    title: 'Care Operations',
    description: 'Provider assignments, task queues, referral tracking',
    path: '/care-operations',
    icon: Users,
    color: 'from-blue-600 to-blue-800',
    category: 'suites',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'case_manager', 'nurse_practitioner'],
    badge: '7 dashboards',
  },
  {
    id: 'interop',
    title: 'Interoperability',
    description: 'FHIR R4 analytics, HL7 testing, data mapping',
    path: '/interoperability',
    icon: Network,
    color: 'from-violet-600 to-violet-800',
    category: 'suites',
    badge: '5 dashboards',
  },
  {
    id: 'mcp',
    title: 'MCP Management',
    description: 'Server health, API keys, chain orchestration, costs',
    path: '/mcp-management',
    icon: Server,
    color: 'from-slate-600 to-slate-800',
    category: 'suites',
    roles: ['super_admin'],
    badge: '6 dashboards',
  },
  {
    id: 'system-admin',
    title: 'System Administration',
    description: 'Users, roles, facilities, modules, clearinghouse',
    path: '/system-admin',
    icon: Settings,
    color: 'from-amber-600 to-amber-800',
    category: 'suites',
    badge: '6 dashboards',
  },
  {
    id: 'clinical-quality',
    title: 'Clinical Quality',
    description: 'Quality measures, AI validation, public health reporting',
    path: '/clinical-quality',
    icon: Award,
    color: 'from-teal-600 to-teal-800',
    category: 'suites',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'],
    badge: '3 dashboards',
  },
  {
    id: 'admin-tools',
    title: 'Admin Tools',
    description: 'Engagement monitoring, enrollment, export, paper forms',
    path: '/admin-tools',
    icon: Wrench,
    color: 'from-orange-600 to-orange-800',
    category: 'suites',
    badge: '5 dashboards',
  },

  // ── Clinical Dashboards (existing routes) ────────────────────
  {
    id: 'bed-mgmt',
    title: 'Bed Management',
    description: 'Real-time bed board and capacity operations',
    path: '/bed-management',
    icon: BedDouble,
    color: 'from-indigo-600 to-indigo-800',
    category: 'clinical',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'physician'],
  },
  {
    id: 'readmissions',
    title: 'Readmission Prevention',
    description: 'Community readmission risk dashboard',
    path: '/community-readmission',
    icon: Heart,
    color: 'from-rose-600 to-rose-800',
    category: 'clinical',
  },
  {
    id: 'neuro',
    title: 'NeuroSuite',
    description: 'Stroke, dementia, Parkinson\'s monitoring',
    path: '/neuro-suite',
    icon: Brain,
    color: 'from-purple-600 to-purple-800',
    category: 'clinical',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'nurse_practitioner'],
  },
  {
    id: 'rpm',
    title: 'Remote Patient Monitoring',
    description: 'Home vitals, wearables, device data',
    path: '/rpm-dashboard',
    icon: Activity,
    color: 'from-cyan-600 to-cyan-800',
    category: 'clinical',
  },
  {
    id: 'medication-mgr',
    title: 'Medication Manager',
    description: 'Medication reconciliation and interaction checks',
    path: '/medication-manager',
    icon: Pill,
    color: 'from-pink-600 to-pink-800',
    category: 'clinical',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'pharmacist'],
  },
  {
    id: 'clinical-alerts',
    title: 'Clinical Alerts',
    description: 'Escalation and alert management',
    path: '/clinical-alerts',
    icon: AlertTriangle,
    color: 'from-yellow-600 to-yellow-800',
    category: 'clinical',
    roles: ['admin', 'super_admin', 'physician', 'nurse'],
  },
  {
    id: 'care-coord',
    title: 'Care Coordination',
    description: 'Interdisciplinary care plans and team management',
    path: '/care-coordination',
    icon: ClipboardList,
    color: 'from-sky-600 to-sky-800',
    category: 'clinical',
    roles: ['admin', 'super_admin', 'case_manager', 'nurse'],
  },

  // ── Workflow Dashboards (existing routes) ────────────────────
  {
    id: 'shift-handoff',
    title: 'Shift Handoff',
    description: 'AI-assisted nurse shift handoffs',
    path: '/shift-handoff',
    icon: FileText,
    color: 'from-lime-600 to-lime-800',
    category: 'workflows',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner'],
  },
  {
    id: 'doctors-view',
    title: 'Doctors View',
    description: 'Patient vitals and self-reports for clinical staff',
    path: '/doctors-view',
    icon: Eye,
    color: 'from-fuchsia-600 to-fuchsia-800',
    category: 'workflows',
  },
  {
    id: 'ai-cost',
    title: 'AI Cost Dashboard',
    description: 'Claude API spending and token usage analysis',
    path: '/admin/ai-cost',
    icon: BarChart3,
    color: 'from-stone-600 to-stone-800',
    category: 'workflows',
    roles: ['super_admin'],
  },
  {
    id: 'guardian',
    title: 'Guardian Agent',
    description: 'Self-healing system monitoring and alerts',
    path: '/guardian/dashboard',
    icon: Zap,
    color: 'from-emerald-700 to-emerald-900',
    category: 'workflows',
    roles: ['super_admin'],
  },
  {
    id: 'healthcare-algorithms',
    title: 'Healthcare Algorithms',
    description: 'AI algorithm performance and transparency',
    path: '/admin/healthcare-algorithms',
    icon: Stethoscope,
    color: 'from-blue-700 to-blue-900',
    category: 'workflows',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'],
  },
];

/** Category labels */
const categoryLabels: Record<string, string> = {
  suites: 'Dashboard Suites',
  clinical: 'Clinical Dashboards',
  workflows: 'Workflows & Monitoring',
};

export const DashboardHub: React.FC = () => {
  const navigate = useNavigate();
  const { adminRole } = useAdminAuth();

  /** Filter cards by role — no roles means visible to all admin+ */
  const visibleCards = hubCards.filter((card) => {
    if (!card.roles) return true;
    return card.roles.includes(adminRole ?? '');
  });

  /** Group cards by category */
  const groupedCards = (['suites', 'clinical', 'workflows'] as const).map((cat) => ({
    category: cat,
    label: categoryLabels[cat],
    cards: visibleCards.filter((c) => c.category === cat),
  })).filter((group) => group.cards.length > 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Dashboard Hub</h1>
          <p className="text-slate-400 mt-2 text-lg">
            All dashboards in one place — touch a card to open
          </p>
        </div>

        {/* Card groups */}
        {groupedCards.map((group) => (
          <div key={group.category} className="mb-10">
            <h2 className="text-lg font-semibold text-slate-300 mb-4 border-b border-slate-800 pb-2">
              {group.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => navigate(card.path)}
                    className={`
                      relative flex flex-col items-start p-5 rounded-xl
                      bg-gradient-to-br ${card.color}
                      text-white text-left
                      shadow-lg hover:shadow-xl hover:scale-[1.02]
                      transition-all duration-200
                      min-h-[140px] min-w-0
                      focus:outline-hidden focus:ring-2 focus:ring-[var(--ea-primary,#00857a)] focus:ring-offset-2 focus:ring-offset-slate-950
                    `}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-6 w-6 shrink-0" />
                      <span className="text-base font-bold leading-tight">{card.title}</span>
                    </div>
                    <p className="text-sm text-white/80 leading-snug flex-1">
                      {card.description}
                    </p>
                    {card.badge && (
                      <span className="mt-3 inline-block text-xs font-medium bg-white/20 rounded-full px-2.5 py-0.5">
                        {card.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHub;
