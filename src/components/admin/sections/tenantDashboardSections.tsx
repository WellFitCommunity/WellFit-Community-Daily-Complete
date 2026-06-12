/**
 * Tenant-Based Dashboard Section Definitions
 * Extracted from sectionDefinitions.tsx for 600-line compliance.
 *
 * These dashboards are tenant-based (RLS-scoped per organization) and are
 * surfaced to tenant admins via the admin section nav (/admin-tools). Each is
 * gated by a modular feature flag (default ON) — see DashboardSection.featureFlag
 * and src/config/featureFlags.ts. Set VITE_FEATURE_<NAME>=false to hide one
 * without a code change.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React, { Suspense } from 'react';
import { DashboardSection } from './types';
import { SectionLoadingFallback } from './sectionDefinitions';
import {
  AICostDashboard,
  AIFinancialDashboard,
  AIAccuracyDashboard,
  AuditAnalyticsDashboard,
  DisclosureAccountingDashboard,
} from './lazyImports';

export const getTenantDashboardSections = (): DashboardSection[] => [
  {
    id: 'audit-analytics',
    title: 'Audit Analytics',
    subtitle: 'Audit log analytics, PHI access patterns, and anomaly trends for your facility',
    icon: '📊',
    headerColor: 'text-red-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AuditAnalyticsDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'it_admin', 'compliance_officer'],
    featureFlag: 'auditAnalyticsDashboard',
  },
  {
    id: 'disclosure-accounting',
    title: 'Disclosure Accounting',
    subtitle: 'HIPAA accounting of disclosures — who accessed PHI, when, and why',
    icon: '📝',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><DisclosureAccountingDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'compliance_officer'],
    featureFlag: 'disclosureAccountingDashboard',
  },
  {
    id: 'ai-cost',
    title: 'AI Cost Dashboard',
    subtitle: 'Per-skill AI cost breakdown, token spend, and trend analysis for your organization',
    icon: '💰',
    headerColor: 'text-purple-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AICostDashboard /></Suspense>,
    category: 'revenue',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'billing_specialist'],
    featureFlag: 'aiCostTracking',
  },
  {
    id: 'ai-financial',
    title: 'AI Financial Dashboard',
    subtitle: 'AI ROI, staff savings, and financial impact of AI workflows',
    icon: '📈',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AIFinancialDashboard /></Suspense>,
    category: 'revenue',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'billing_specialist'],
    featureFlag: 'aiFinancialDashboard',
  },
  {
    id: 'ai-accuracy',
    title: 'AI Accuracy Monitoring',
    subtitle: 'Model accuracy metrics, confidence calibration, and drift detection',
    icon: '🎯',
    headerColor: 'text-indigo-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AIAccuracyDashboard /></Suspense>,
    category: 'admin',
    priority: 'medium',
    roles: ['admin', 'super_admin'],
    featureFlag: 'aiAccuracyDashboard',
  },
];
