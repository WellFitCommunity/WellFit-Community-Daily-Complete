/**
 * DoctorsView — Shared type definitions
 *
 * @module DoctorsView/types
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

export interface VitalMetric {
  label: string;
  value: string | number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  icon: React.ComponentType<{ className?: string }>;
}
