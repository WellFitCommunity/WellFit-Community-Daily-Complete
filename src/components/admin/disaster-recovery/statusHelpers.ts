/**
 * Disaster Recovery Dashboard - Status Helper Functions
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertOctagon,
} from 'lucide-react';
import type { StatusConfig } from './DisasterRecoveryDashboard.types';

export const getStatusConfig = (status: string): StatusConfig => {
  switch (status) {
    case 'COMPLIANT':
      return { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Compliant' };
    case 'WARNING':
      return { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle, label: 'Warning' };
    case 'NON_COMPLIANT':
      return { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Non-Compliant' };
    default:
      return { color: 'bg-gray-100 text-gray-800', icon: AlertOctagon, label: 'Unknown' };
  }
};

export const getDrillTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    weekly_automated: 'Weekly Automated',
    monthly_simulation: 'Monthly Simulation',
    quarterly_tabletop: 'Quarterly Tabletop',
    annual_full_scale: 'Annual Full-Scale',
    ad_hoc: 'Ad Hoc',
  };
  return labels[type] || type;
};

export const getScenarioLabel = (scenario: string): string => {
  const labels: Record<string, string> = {
    database_loss: 'Database Loss',
    security_breach: 'Security Breach',
    infrastructure_failure: 'Infrastructure Failure',
    ransomware_attack: 'Ransomware Attack',
    natural_disaster: 'Natural Disaster',
    insider_threat: 'Insider Threat',
    multi_region_outage: 'Multi-Region Outage',
    supply_chain_attack: 'Supply Chain Attack',
  };
  return labels[scenario] || scenario;
};
