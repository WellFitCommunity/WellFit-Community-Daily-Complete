/**
 * DoctorsView — Vital sign utility functions
 *
 * Pure functions for vital sign status classification and extraction.
 *
 * @module DoctorsView/vitalUtils
 * Copyright 2025-2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import Activity from 'lucide-react/dist/esm/icons/activity';
import Heart from 'lucide-react/dist/esm/icons/heart';
import type { CheckInData, HealthDataEntry } from './useDoctorsViewData';
import type { VitalMetric } from './types';

/**
 * Classify vital sign status based on clinical thresholds.
 */
export function getVitalStatus(type: string, value: number): 'normal' | 'warning' | 'critical' {
  if (type === 'bp_systolic') {
    if (value >= 180 || value < 90) return 'critical';
    if (value >= 140 || value < 100) return 'warning';
    return 'normal';
  }
  if (type === 'bp_diastolic') {
    if (value >= 120 || value < 60) return 'critical';
    if (value >= 90 || value < 65) return 'warning';
    return 'normal';
  }
  if (type === 'heart_rate') {
    if (value >= 120 || value < 50) return 'critical';
    if (value >= 100 || value < 60) return 'warning';
    return 'normal';
  }
  if (type === 'glucose') {
    if (value >= 250 || value < 70) return 'critical';
    if (value >= 180 || value < 80) return 'warning';
    return 'normal';
  }
  if (type === 'oxygen') {
    if (value < 90) return 'critical';
    if (value < 95) return 'warning';
    return 'normal';
  }
  return 'normal';
}

/**
 * Extract displayable vital metrics from check-in and self-report data.
 * Prefers check-in vitals (most recent), falls back to self-reports.
 */
export function extractVitals(
  latestCheckIn: CheckInData | null,
  recentHealthEntries: HealthDataEntry[]
): VitalMetric[] {
  const vitals: VitalMetric[] = [];

  // Check latest check-in first (most recent)
  if (latestCheckIn) {
    if (latestCheckIn.bp_systolic && latestCheckIn.bp_diastolic) {
      vitals.push({
        label: 'Blood Pressure',
        value: `${latestCheckIn.bp_systolic}/${latestCheckIn.bp_diastolic}`,
        unit: 'mmHg',
        status: getVitalStatus('bp_systolic', latestCheckIn.bp_systolic),
        icon: Activity,
      });
    }
    if (latestCheckIn.heart_rate) {
      vitals.push({
        label: 'Heart Rate',
        value: latestCheckIn.heart_rate,
        unit: 'bpm',
        status: getVitalStatus('heart_rate', latestCheckIn.heart_rate),
        icon: Heart,
      });
    }
    if (latestCheckIn.glucose_mg_dl) {
      vitals.push({
        label: 'Blood Glucose',
        value: latestCheckIn.glucose_mg_dl,
        unit: 'mg/dL',
        status: getVitalStatus('glucose', latestCheckIn.glucose_mg_dl),
        icon: Activity,
      });
    }
    if (latestCheckIn.pulse_oximeter) {
      vitals.push({
        label: 'Oxygen Saturation',
        value: latestCheckIn.pulse_oximeter,
        unit: '%',
        status: getVitalStatus('oxygen', latestCheckIn.pulse_oximeter),
        icon: Activity,
      });
    }
  }

  // Fallback to self-reports if no check-in vitals
  if (vitals.length === 0 && recentHealthEntries.length > 0) {
    const latest = recentHealthEntries[0];
    if (latest.bp_systolic && latest.bp_diastolic) {
      vitals.push({
        label: 'Blood Pressure',
        value: `${latest.bp_systolic}/${latest.bp_diastolic}`,
        unit: 'mmHg',
        status: getVitalStatus('bp_systolic', latest.bp_systolic),
        icon: Activity,
      });
    }
    if (latest.heart_rate) {
      vitals.push({
        label: 'Heart Rate',
        value: latest.heart_rate,
        unit: 'bpm',
        status: getVitalStatus('heart_rate', latest.heart_rate),
        icon: Heart,
      });
    }
    if (latest.blood_sugar) {
      vitals.push({
        label: 'Blood Glucose',
        value: latest.blood_sugar,
        unit: 'mg/dL',
        status: getVitalStatus('glucose', latest.blood_sugar),
        icon: Activity,
      });
    }
    if (latest.blood_oxygen) {
      vitals.push({
        label: 'Oxygen Saturation',
        value: latest.blood_oxygen,
        unit: '%',
        status: getVitalStatus('oxygen', latest.blood_oxygen),
        icon: Activity,
      });
    }
  }

  return vitals;
}

/**
 * Format a date string for display.
 */
export function formatDateTime(dateString?: string | null): string {
  return dateString
    ? new Date(dateString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';
}

/**
 * Build a summary string from a health data entry's fields.
 */
export function renderHealthEntryContent(entry: HealthDataEntry): string {
  const parts: string[] = [];
  if (entry.mood) parts.push(`Mood: ${entry.mood}`);
  if (entry.symptoms) parts.push(`Symptoms: ${entry.symptoms}`);
  if (entry.physical_activity) parts.push(`Activity: ${entry.physical_activity}`);
  if (entry.social_engagement) parts.push(`Social: ${entry.social_engagement}`);
  return parts.join(' \u2022 ') || 'No details provided';
}
