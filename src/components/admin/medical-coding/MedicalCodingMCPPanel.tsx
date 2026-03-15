/**
 * MedicalCodingMCPPanel - Admin panel for medical coding MCP tools
 *
 * Provides UI access to 11 medical coding tools:
 * - Payer reimbursement rules (Medicare DRG, Medicaid per diem)
 * - AI-powered DRG grouping (3-pass MS-DRG methodology)
 * - Revenue projection and optimization
 * - Charge validation and completeness checking
 *
 * Advisory Only: All AI suggestions are advisory - never auto-filed.
 */

import React, { useState, Suspense, lazy } from 'react';
import { DollarSign, Brain, TrendingUp } from 'lucide-react';

const PayerRulesTab = lazy(() => import('./PayerRulesTab'));
const DRGGrouperTab = lazy(() => import('./DRGGrouperTab'));
const RevenueProjectionTab = lazy(() => import('./RevenueProjectionTab'));

type TabId = 'payer-rules' | 'drg-grouper' | 'revenue';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'payer-rules',
    label: 'Payer Rules',
    icon: <DollarSign className="w-4 h-4" />,
    description: 'Medicare DRG rates, Medicaid per diem, commercial case rates',
  },
  {
    id: 'drg-grouper',
    label: 'DRG Grouper',
    icon: <Brain className="w-4 h-4" />,
    description: 'AI-powered 3-pass MS-DRG methodology',
  },
  {
    id: 'revenue',
    label: 'Revenue & Validation',
    icon: <TrendingUp className="w-4 h-4" />,
    description: 'Projection, charge validation, and optimization',
  },
];

const TabFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--ea-primary)]" />
    <span className="ml-2 text-gray-500 text-sm">Loading...</span>
  </div>
);

export const MedicalCodingMCPPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('payer-rules');

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 -mb-px" aria-label="Medical Coding tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--ea-primary)] text-[var(--ea-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Description */}
      <p className="text-sm text-gray-500">
        {TABS.find((t) => t.id === activeTab)?.description}
      </p>

      {/* Tab Content */}
      <Suspense fallback={<TabFallback />}>
        {activeTab === 'payer-rules' && <PayerRulesTab />}
        {activeTab === 'drg-grouper' && <DRGGrouperTab />}
        {activeTab === 'revenue' && <RevenueProjectionTab />}
      </Suspense>
    </div>
  );
};

export default MedicalCodingMCPPanel;
