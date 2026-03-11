/**
 * MCP Infrastructure Section Definitions
 * Extracted from sectionDefinitions.tsx for 600-line compliance.
 */

import React, { Suspense } from 'react';
import { DashboardSection } from './types';
import { SectionLoadingFallback } from './sectionDefinitions';
import {
  MCPServerHealthPanel,
  MCPKeyManagementPanel,
  MCPChainManagementPanel,
  EdgeFunctionManagementPanel,
  MCPChainCostPanel,
} from './lazyImports';

export function getMcpSections(): DashboardSection[] {
  return [
    {
      id: 'mcp-server-health',
      title: 'MCP Server Health Monitor',
      subtitle: 'Real-time health and performance monitoring for all 11 MCP servers',
      icon: '\uD83D\uDD0C',
      headerColor: 'text-blue-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><MCPServerHealthPanel /></Suspense>,
      category: 'admin',
      priority: 'high',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'mcp-key-management',
      title: 'MCP API Key Management',
      subtitle: 'Create, rotate, and revoke machine-to-machine API keys for MCP servers',
      icon: '\uD83D\uDD11',
      headerColor: 'text-indigo-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><MCPKeyManagementPanel /></Suspense>,
      category: 'admin',
      priority: 'high',
      roles: ['super_admin'],
    },
    {
      id: 'mcp-chain-management',
      title: 'MCP Chain Orchestration',
      subtitle: 'Manage multi-server pipelines, monitor chain runs, and approve clinical gates',
      icon: '\u26D3',
      headerColor: 'text-teal-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><MCPChainManagementPanel /></Suspense>,
      category: 'admin',
      priority: 'high',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'edge-function-management',
      title: 'Edge Function Management',
      subtitle: 'Browse, invoke, and batch-execute whitelisted edge functions via MCP',
      icon: '\u26A1',
      headerColor: 'text-amber-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><EdgeFunctionManagementPanel /></Suspense>,
      category: 'admin',
      priority: 'medium',
      roles: ['admin', 'super_admin'],
    },
    {
      id: 'chain-execution-costs',
      title: 'Chain Execution Costs',
      subtitle: 'Per-run cost tracking, step breakdowns, and execution performance for MCP chain pipelines',
      icon: '\uD83D\uDCB0',
      headerColor: 'text-green-800',
      component: <Suspense fallback={<SectionLoadingFallback />}><MCPChainCostPanel /></Suspense>,
      category: 'admin',
      priority: 'medium',
      roles: ['admin', 'super_admin'],
    },
  ];
}
