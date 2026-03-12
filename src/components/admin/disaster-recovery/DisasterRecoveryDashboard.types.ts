/**
 * Disaster Recovery Dashboard - Type Definitions
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

export interface BackupComplianceStatus {
  compliance_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
  last_successful_backup: string | null;
  last_restore_test: string | null;
  backup_success_rate: number;
  total_backups_30d: number;
  failed_backups_30d: number;
  issues: string[];
  targets: {
    backup_frequency: string;
    restore_test_frequency: string;
    success_rate_target: string;
    rpo_target: string;
    rto_target: string;
  };
}

export interface DrillComplianceStatus {
  compliance_status: 'COMPLIANT' | 'WARNING' | 'NON_COMPLIANT';
  last_weekly_drill: string | null;
  last_monthly_drill: string | null;
  last_quarterly_drill: string | null;
  drills_30d: number;
  drills_passed_30d: number;
  pass_rate: number;
  avg_score: number | null;
  issues: string[];
  targets: {
    weekly_frequency: string;
    monthly_frequency: string;
    quarterly_frequency: string;
    pass_rate_target: string;
    avg_score_target: string;
  };
}

export interface Drill {
  id: string;
  drill_name: string;
  drill_type: string;
  drill_scenario: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  drill_passed: boolean | null;
  overall_score: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
}

export interface BackupLog {
  id: string;
  backup_type: string;
  backup_timestamp: string;
  verification_status: 'success' | 'failure' | 'warning' | 'pending';
  restore_tested: boolean;
  restore_status: string | null;
  data_integrity_check_passed: boolean | null;
}

export interface StatusConfig {
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// Import React type for StatusConfig
import type React from 'react';
