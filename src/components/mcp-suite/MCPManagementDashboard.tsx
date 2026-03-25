/**
 * MCPManagementDashboard - Tabbed MCP Server Management Hub
 *
 * Purpose: Consolidates all MCP server health, key management,
 * chain orchestration, cost tracking, and edge function dashboards.
 * Used by: /mcp-management route (super_admin role)
 *
 * Tab structure:
 *   Health → Keys → Chains → Cost → Edge Functions → Medical Coding
 */

import React, { Suspense, useState, lazy } from 'react';
import {
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';
import AdminHeader from '../admin/AdminHeader';
import {
  Server,
  Key,
  Link2,
  DollarSign,
  Zap,
  Stethoscope,
} from 'lucide-react';

// Lazy-load each dashboard
const MCPServerHealthPanel = lazy(() => import('../admin/MCPServerHealthPanel'));
const MCPKeyManagementPanel = lazy(() => import('../admin/MCPKeyManagementPanel'));
const MCPChainManagementPanel = lazy(() => import('../admin/mcp-chains/MCPChainManagementPanel'));
const MCPChainCostPanel = lazy(() => import('../admin/MCPChainCostPanel'));
const EdgeFunctionManagementPanel = lazy(() => import('../admin/EdgeFunctionManagementPanel'));
const MedicalCodingMCPPanel = lazy(() => import('../admin/medical-coding/MedicalCodingMCPPanel'));

/** Loading fallback for lazy-loaded tab content */
const TabLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-[var(--ea-primary,#00857a)]" />
      <span className="text-sm text-slate-400">Loading...</span>
    </div>
  </div>
);

export const MCPManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('health');

  return (
    <div className="min-h-screen bg-slate-950">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">MCP Management</h1>
          <p className="text-slate-400 mt-1">
            MCP server health, API keys, chain orchestration, cost tracking, and edge functions
          </p>
        </div>

        {/* Tabs */}
        <EATabs defaultValue="health" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="flex-wrap gap-1 overflow-x-auto">
            <EATabsTrigger value="health">
              <Server className="h-4 w-4 mr-2" />
              Health
            </EATabsTrigger>
            <EATabsTrigger value="keys">
              <Key className="h-4 w-4 mr-2" />
              Keys
            </EATabsTrigger>
            <EATabsTrigger value="chains">
              <Link2 className="h-4 w-4 mr-2" />
              Chains
            </EATabsTrigger>
            <EATabsTrigger value="cost">
              <DollarSign className="h-4 w-4 mr-2" />
              Cost
            </EATabsTrigger>
            <EATabsTrigger value="edge-functions">
              <Zap className="h-4 w-4 mr-2" />
              Edge Functions
            </EATabsTrigger>
            <EATabsTrigger value="medical-coding">
              <Stethoscope className="h-4 w-4 mr-2" />
              Medical Coding
            </EATabsTrigger>
          </EATabsList>

          {/* ── Tab 1: Health ──────────────────────────────────────── */}
          <EATabsContent value="health">
            <Suspense fallback={<TabLoadingFallback />}>
              <MCPServerHealthPanel />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 2: Keys ────────────────────────────────────────── */}
          <EATabsContent value="keys">
            <Suspense fallback={<TabLoadingFallback />}>
              <MCPKeyManagementPanel />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 3: Chains ──────────────────────────────────────── */}
          <EATabsContent value="chains">
            <Suspense fallback={<TabLoadingFallback />}>
              <MCPChainManagementPanel />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 4: Cost ────────────────────────────────────────── */}
          <EATabsContent value="cost">
            <Suspense fallback={<TabLoadingFallback />}>
              <MCPChainCostPanel />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 5: Edge Functions ──────────────────────────────── */}
          <EATabsContent value="edge-functions">
            <Suspense fallback={<TabLoadingFallback />}>
              <EdgeFunctionManagementPanel />
            </Suspense>
          </EATabsContent>

          {/* ── Tab 6: Medical Coding ──────────────────────────────── */}
          <EATabsContent value="medical-coding">
            <Suspense fallback={<TabLoadingFallback />}>
              <MedicalCodingMCPPanel />
            </Suspense>
          </EATabsContent>
        </EATabs>
      </div>
    </div>
  );
};

export default MCPManagementDashboard;
