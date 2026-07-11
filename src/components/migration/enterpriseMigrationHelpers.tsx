/**
 * Shared types + helpers for the Enterprise Migration Dashboard. Extracted from
 * EnterpriseMigrationDashboard to keep it (and each tab) under the 600-line rule.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { EABadge } from '../envision-atlus';

// =============================================================================
// TYPES
// =============================================================================

export interface MigrationBatch {
  batchId: string;
  sourceSystem: string;
  recordCount: number;
  successCount: number;
  errorCount: number;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  qualityScore?: number;
}

export interface LineageRecord {
  sourceFile: string;
  sourceRow: number;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  transformations: string[];
  validationPassed: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

export const getGrade = (score: number): string => {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

export const getGradeColor = (grade: string): string => {
  if (grade.startsWith('A')) return 'text-green-400';
  if (grade.startsWith('B')) return 'text-blue-400';
  if (grade.startsWith('C')) return 'text-yellow-400';
  return 'text-red-400';
};

export const getStatusBadge = (status: string) => {
  const colors: Record<string, 'critical' | 'high' | 'elevated' | 'normal' | 'info' | 'neutral'> = {
    'COMPLETED': 'normal',
    'COMPLETED_WITH_ERRORS': 'elevated',
    'PROCESSING': 'info',
    'FAILED': 'critical',
    'DRY_RUN': 'info'
  };
  return <EABadge variant={colors[status] || 'info'}>{status}</EABadge>;
};

export const parseCSV = (text: string): Record<string, unknown>[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const data: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || null;
    });
    data.push(row);
  }

  return data;
};
