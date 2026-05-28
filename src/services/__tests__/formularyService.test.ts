/**
 * Tests for FormularyService — ONC 170.315(a)(10) Drug Formulary Check.
 *
 * Each test would fail if the service returned junk for the cases it
 * needs to handle (per CLAUDE.md deletion test).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FormularyService,
  summarizeFormulary,
  type FormularyEntry,
} from '../formularyService';

// Mock the supabase client used by the service
const chainMock = {
  select: vi.fn(),
  eq: vi.fn(),
  gt: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: vi.fn(),
};

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(() => chainMock) },
}));

// Each chain method returns the chain itself so call composition works
beforeEach(() => {
  vi.clearAllMocks();
  chainMock.select.mockReturnValue(chainMock);
  chainMock.eq.mockReturnValue(chainMock);
  chainMock.gt.mockReturnValue(chainMock);
  chainMock.order.mockReturnValue(chainMock);
  chainMock.limit.mockReturnValue(chainMock);
});

describe('FormularyService.lookupByNdc', () => {
  it('returns null without hitting the DB when ndc is blank', async () => {
    const result = await FormularyService.lookupByNdc('');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
    expect(chainMock.maybeSingle).not.toHaveBeenCalled();
  });

  it('returns the matched formulary entry when one exists', async () => {
    const row: FormularyEntry = {
      id: 'f-1',
      bin_number: '610014',
      ndc_code: '00071-0156-23',
      drug_name: 'Lipitor 10 mg',
      formulary_status: 'preferred',
      tier: 1,
      copay_amount: 5,
      coinsurance_percent: null,
      requires_prior_auth: false,
      requires_step_therapy: false,
      quantity_limit: 30,
      quantity_limit_days: 30,
      preferred_alternatives: [],
      expires_at: '2027-01-01T00:00:00.000Z',
      is_valid: true,
    };
    chainMock.maybeSingle.mockResolvedValueOnce({ data: row, error: null });

    const result = await FormularyService.lookupByNdc('00071-0156-23');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.tier).toBe(1);
    // Should filter on ndc, is_valid=true, and expires_at>now
    expect(chainMock.eq).toHaveBeenCalledWith('ndc_code', '00071-0156-23');
    expect(chainMock.eq).toHaveBeenCalledWith('is_valid', true);
    expect(chainMock.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
  });

  it('passes binNumber filter through when provided', async () => {
    chainMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await FormularyService.lookupByNdc('00071-0156-23', { binNumber: '610014' });

    expect(chainMock.eq).toHaveBeenCalledWith('bin_number', '610014');
  });

  it('returns null when no row matches (NDC not in cache)', async () => {
    chainMock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await FormularyService.lookupByNdc('99999-9999-99');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it('returns a failure when the DB query errors', async () => {
    chainMock.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied' },
    });
    const result = await FormularyService.lookupByNdc('00071-0156-23');
    expect(result.success).toBe(false);
  });
});

describe('summarizeFormulary', () => {
  function makeEntry(over: Partial<FormularyEntry> = {}): FormularyEntry {
    return {
      id: 'x',
      bin_number: '610014',
      ndc_code: '00000-0000-00',
      drug_name: 'X',
      formulary_status: 'covered',
      tier: 2,
      copay_amount: 25,
      coinsurance_percent: null,
      requires_prior_auth: false,
      requires_step_therapy: false,
      quantity_limit: null,
      quantity_limit_days: null,
      preferred_alternatives: [],
      expires_at: '2027-01-01T00:00:00.000Z',
      is_valid: true,
      ...over,
    };
  }

  it('marks a missing entry as unknown + warn', () => {
    const summary = summarizeFormulary(null);
    expect(summary.level).toBe('unknown');
    expect(summary.warn).toBe(true);
    expect(summary.block).toBe(false);
  });

  it('marks tier 1 as preferred', () => {
    const summary = summarizeFormulary(makeEntry({ tier: 1 }));
    expect(summary.level).toBe('preferred');
    expect(summary.label).toMatch(/preferred/i);
  });

  it('marks tier 3 as covered (not preferred)', () => {
    const summary = summarizeFormulary(makeEntry({ tier: 3 }));
    expect(summary.level).toBe('covered');
    expect(summary.label).toBe('Tier 3');
  });

  it('marks a not_covered status correctly (matches DB CHECK constraint values)', () => {
    const summary = summarizeFormulary(
      makeEntry({ tier: null, formulary_status: 'not_covered' })
    );
    expect(summary.level).toBe('non_formulary');
    expect(summary.warn).toBe(true);
  });

  it('surfaces prior auth as a warn + a guard string', () => {
    const summary = summarizeFormulary(makeEntry({ tier: 2, requires_prior_auth: true }));
    expect(summary.warn).toBe(true);
    expect(summary.detail).toMatch(/prior auth required/i);
  });

  it('surfaces step therapy as a warn + a guard string', () => {
    const summary = summarizeFormulary(makeEntry({ tier: 2, requires_step_therapy: true }));
    expect(summary.warn).toBe(true);
    expect(summary.detail).toMatch(/step therapy/i);
  });

  it('passes preferred alternatives through', () => {
    const summary = summarizeFormulary(
      makeEntry({ tier: null, formulary_status: 'not_covered', preferred_alternatives: ['Lisinopril', 'Losartan'] })
    );
    expect(summary.preferredAlternatives).toEqual(['Lisinopril', 'Losartan']);
  });
});
