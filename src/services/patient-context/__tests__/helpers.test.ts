/**
 * Tests for Patient Context helpers (pure functions)
 *
 * Tests: assessFreshness, getDefaultRiskSummary, getDefaultCarePlanSummary
 */
import { describe, it, expect } from 'vitest';
import {
  assessFreshness,
  getDefaultRiskSummary,
  getDefaultCarePlanSummary,
} from '../helpers';
import type { DataSourceRecord } from '../../../types/patientContext';

describe('assessFreshness', () => {
  it('returns "real_time" when all sources fetched within 5 minutes', () => {
    const now = new Date().toISOString();
    const sources: DataSourceRecord[] = [
      { source: 'profiles', fetched_at: now, success: true, record_count: 1, note: null },
      { source: 'check_ins', fetched_at: now, success: true, record_count: 5, note: null },
    ];

    expect(assessFreshness(sources)).toBe('real_time');
  });

  it('returns "recent" when sources are between 5 minutes and 1 hour old', () => {
    const thirtyMinutesAgo = new Date();
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
    const sources: DataSourceRecord[] = [
      { source: 'profiles', fetched_at: thirtyMinutesAgo.toISOString(), success: true, record_count: 1, note: null },
    ];

    expect(assessFreshness(sources)).toBe('recent');
  });

  it('returns "stale" when any source is older than 1 hour', () => {
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const now = new Date().toISOString();
    const sources: DataSourceRecord[] = [
      { source: 'profiles', fetched_at: now, success: true, record_count: 1, note: null },
      { source: 'old_data', fetched_at: twoHoursAgo.toISOString(), success: true, record_count: 1, note: null },
    ];

    expect(assessFreshness(sources)).toBe('stale');
  });

  it('handles empty sources array as real_time', () => {
    expect(assessFreshness([])).toBe('real_time');
  });
});

describe('getDefaultRiskSummary', () => {
  it('returns low risk with all null scores', () => {
    const defaults = getDefaultRiskSummary();

    expect(defaults.risk_level).toBe('low');
    expect(defaults.risk_score).toBeNull();
    expect(defaults.risk_factors).toEqual([]);
    expect(defaults.last_assessment_date).toBeNull();
    expect(defaults.readmission_risk_30day).toBeNull();
    expect(defaults.fall_risk_score).toBeNull();
  });

  it('returns a new object each call (not shared reference)', () => {
    const a = getDefaultRiskSummary();
    const b = getDefaultRiskSummary();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getDefaultCarePlanSummary', () => {
  it('returns all null fields', () => {
    const defaults = getDefaultCarePlanSummary();

    expect(defaults.active_plan_id).toBeNull();
    expect(defaults.plan_type).toBeNull();
    expect(defaults.plan_status).toBeNull();
    expect(defaults.primary_goal).toBeNull();
    expect(defaults.next_review_date).toBeNull();
    expect(defaults.care_coordinator_name).toBeNull();
  });

  it('returns a new object each call (not shared reference)', () => {
    const a = getDefaultCarePlanSummary();
    const b = getDefaultCarePlanSummary();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
