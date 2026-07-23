/**
 * recordingSummarizer - Heuristic session-summary generation for Guardian Eyes.
 *
 * Pure functions extracted from AISystemRecorder (600-line limit, 2026-07-23).
 * Produces the ai_summary stored on session_recordings rows.
 *
 * Used by: AISystemRecorder.stopRecording().
 */

import type { SystemSnapshot, SessionRecording } from './AISystemRecorder';

export function generateAISummary(
  recording: SessionRecording
): SessionRecording['ai_summary'] {
  try {
    const userActions = recording.snapshots.filter((s) => s.type === 'user_action');
    const errors = recording.snapshots.filter((s) => s.type === 'error');
    const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');

    return {
      user_goal: detectUserGoal(userActions),
      success: errors.length === 0,
      pain_points: detectPainPoints(errors, stateChanges),
      optimizations: generateOptimizations(recording),
      security_concerns: detectSecurityConcerns(recording),
    };
  } catch {
    return undefined;
  }
}

function detectUserGoal(actions: SystemSnapshot[]): string {
  if (actions.length === 0) return 'Unknown goal';

  const components = actions.map((a) => a.component);
  const uniqueComponents = Array.from(new Set(components));

  if (uniqueComponents.includes('LoginForm')) return 'User attempting to login';
  if (uniqueComponents.includes('RegisterForm')) return 'User attempting to register';
  if (uniqueComponents.includes('PatientDashboard')) return 'User viewing patient data';
  if (uniqueComponents.includes('BillingForm')) return 'User processing billing';

  return `User interacting with ${uniqueComponents.join(', ')}`;
}

function detectPainPoints(errors: SystemSnapshot[], stateChanges: SystemSnapshot[]): string[] {
  const painPoints: string[] = [];

  if (errors.length > 3) {
    painPoints.push(`Multiple errors encountered (${errors.length} total)`);
  }

  const repeatedActions = detectRepeatedActions(stateChanges);
  if (repeatedActions > 0) {
    painPoints.push(`User repeated action ${repeatedActions} times (possible confusion)`);
  }

  return painPoints;
}

function generateOptimizations(recording: SessionRecording): string[] {
  const optimizations: string[] = [];

  const performanceSnapshots = recording.snapshots.filter((s) => s.type === 'performance');
  const avgMemory =
    performanceSnapshots.reduce(
      (sum, s) => sum + (typeof s.metadata.performance?.memory_used === 'number' ? s.metadata.performance.memory_used : 0),
      0
    ) / (performanceSnapshots.length || 1);

  if (avgMemory > 100 * 1024 * 1024) {
    optimizations.push('High memory usage detected - consider optimizing component rendering');
  }

  const stateChanges = recording.snapshots.filter((s) => s.type === 'state_change');
  if (stateChanges.length > 50) {
    optimizations.push('Excessive state changes - consider state optimization or memoization');
  }

  return optimizations;
}

function detectSecurityConcerns(recording: SessionRecording): string[] {
  const concerns: string[] = [];

  for (const snapshot of recording.snapshots) {
    const metadataStr = JSON.stringify(snapshot.metadata);
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(metadataStr)) {
      concerns.push('Potential SSN detected in captured data');
    }
    if (/patient.*data/i.test(metadataStr)) {
      concerns.push('Patient data reference detected - verify PHI protection');
    }
  }

  return concerns;
}

function detectRepeatedActions(snapshots: SystemSnapshot[]): number {
  if (snapshots.length < 2) return 0;

  let repeatedCount = 0;
  for (let i = 1; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = snapshots[i - 1];

    if (
      current.component === previous.component &&
      current.action === previous.action &&
      Date.parse(current.timestamp) - Date.parse(previous.timestamp) < 3000
    ) {
      repeatedCount++;
    }
  }

  return repeatedCount;
}
