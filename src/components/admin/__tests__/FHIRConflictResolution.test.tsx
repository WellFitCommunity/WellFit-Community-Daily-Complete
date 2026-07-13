/**
 * FHIRConflictResolution Test Suite
 *
 * Behavioral regression guards for the FHIR sync-conflict resolution UI,
 * written alongside the 2026-07-13 repair (restored fhir_sync_conflicts /
 * fhir_sync_logs tables + live-verified resourceTableMap). Each test would
 * fail if the table map or column mapping regressed to the pre-repair
 * aspirational names (patient_observations, date_of_birth, fhir_sync_log...).
 *
 * These are mock-based regression guards, not live proof — the live write
 * shapes were proven with rolled-back insert probes against the real DB.
 *
 * Location: src/components/admin/__tests__/FHIRConflictResolution.test.tsx
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { type ChainableQueryBuilder } from '../../../test-utils';
import { FHIRConflictResolution } from '../FHIRConflictResolution';

// --- Mock state (hoisted so the vi.mock factories can reach it) ---

const mockState = vi.hoisted(() => ({
  results: {} as Record<string, Partial<{ data: unknown; error: { message: string } | null }>>,
  builders: {} as Record<string, unknown[]>,
}));

vi.mock('../../../lib/supabaseClient', async () => {
  const { createQueryBuilder: build } = await import('../../../test-utils');
  return {
    supabase: {
      // Track every builder per table so tests can assert update/insert payloads.
      from: vi.fn((table: string) => {
        const builder = build(mockState.results[table] ?? {});
        (mockState.builders[table] ??= []).push(builder);
        return builder;
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-001' } }, error: null }),
      },
    },
  };
});

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Synthetic test data (obviously fake per CLAUDE.md PHI rules) ---

const observationConflict = {
  id: 'conflict-001',
  connection_id: 'conn-001',
  patient_id: 'patient-001',
  resource_type: 'Observation',
  resource_id: 'fhir-obs-001',
  conflict_type: 'data_mismatch',
  fhir_data: {
    code: { coding: [{ code: '8480-6', display: 'Systolic blood pressure' }] },
    valueQuantity: { value: 120, unit: 'mmHg' },
    effectiveDateTime: '2026-07-01T10:00:00Z',
    status: 'final',
  },
  community_data: { code: '8480-6', value_quantity_value: 118 },
  detected_at: '2026-07-02T09:00:00Z',
  resolution_action: null,
  resolved_at: null,
  resolved_by: null,
  resolution_notes: null,
  fhir_connections: { name: 'Test EHR Connection' },
  profiles: { first_name: 'Test', last_name: 'Patient Alpha' },
};

const patientConflict = {
  ...observationConflict,
  id: 'conflict-002',
  resource_type: 'Patient',
  resource_id: 'fhir-pat-001',
  fhir_data: {
    name: [{ given: ['Test'], family: 'Patient Alpha' }],
    birthDate: '2000-01-01',
    gender: 'female',
    address: [{ line: ['1 Test Way'], city: 'Testville', state: 'TX', postalCode: '75001' }],
  },
  community_data: { dob: '2000-01-02' },
};

function builderFor(table: string, index = 0): ChainableQueryBuilder {
  const list = mockState.builders[table];
  if (!list || !list[index]) throw new Error(`no builder captured for ${table}[${index}]`);
  return list[index] as ChainableQueryBuilder;
}

async function selectConflictAndResolve(buttonText: string) {
  // Click the conflict card, then the resolution action
  const card = await screen.findByText('data mismatch');
  fireEvent.click(card.closest('div[class*="cursor-pointer"]') as HTMLElement);
  const button = await screen.findByText(buttonText);
  fireEvent.click(button);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.builders = {};
  mockState.results = {
    fhir_sync_conflicts: { data: [observationConflict] },
  };
});

describe('FHIRConflictResolution', () => {
  it('renders conflicts fetched from fhir_sync_conflicts with patient and connection labels', async () => {
    render(<FHIRConflictResolution />);

    expect(await screen.findByText('Observation')).toBeInTheDocument();
    expect(screen.getByText('Patient: Test Patient Alpha')).toBeInTheDocument();
    expect(screen.getByText(/Test EHR Connection/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no conflicts', async () => {
    mockState.results = { fhir_sync_conflicts: { data: [] } };
    render(<FHIRConflictResolution />);

    expect(await screen.findByText('No conflicts found')).toBeInTheDocument();
  });

  it('use_fhir applies live fhir_observations columns keyed by fhir_id', async () => {
    render(<FHIRConflictResolution />);
    await selectConflictAndResolve('Use FHIR Server Data');

    await waitFor(() => {
      expect(mockState.builders['fhir_observations']).toBeDefined();
    });

    const target = builderFor('fhir_observations');
    const payload = (target.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Live column names — would fail on the pre-repair aspirational names
    // (display_name / value / unit / effective_date / fhir_synced_at)
    expect(payload).toMatchObject({
      code: '8480-6',
      code_display: 'Systolic blood pressure',
      value_quantity_value: 120,
      value_quantity_unit: 'mmHg',
      effective_datetime: '2026-07-01T10:00:00Z',
      status: 'final',
    });
    expect(payload.last_synced_at).toBeTruthy();
    expect(payload).not.toHaveProperty('fhir_synced_at');
    expect(target.eq).toHaveBeenCalledWith('fhir_id', 'fhir-obs-001');
  });

  it('use_fhir for Patient conflicts updates profiles by user_id with dob/address/zip_code', async () => {
    mockState.results = { fhir_sync_conflicts: { data: [patientConflict] } };
    render(<FHIRConflictResolution />);
    await selectConflictAndResolve('Use FHIR Server Data');

    await waitFor(() => {
      expect(mockState.builders['profiles']).toBeDefined();
    });

    const target = builderFor('profiles');
    const payload = (target.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({
      dob: '2000-01-01',
      gender: 'female',
      address: '1 Test Way',
      zip_code: '75001',
    });
    // Pre-repair names must be gone
    expect(payload).not.toHaveProperty('date_of_birth');
    expect(payload).not.toHaveProperty('address_line1');
    expect(payload).not.toHaveProperty('zip');
    // Keyed by the conflict's patient, never by the FHIR resource id
    expect(target.eq).toHaveBeenCalledWith('user_id', 'patient-001');
  });

  it('use_community records the rejection in fhir_sync_logs with the canonical shape', async () => {
    render(<FHIRConflictResolution />);
    await selectConflictAndResolve('Keep Community Data');

    await waitFor(() => {
      expect(mockState.builders['fhir_sync_logs']).toBeDefined();
    });

    const log = builderFor('fhir_sync_logs');
    const payload = (log.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({
      connection_id: 'conn-001',
      patient_id: 'patient-001',
      sync_type: 'manual',
      direction: 'pull',
      resource_types: ['Observation'],
      status: 'success',
    });
    expect(payload.summary).toMatchObject({
      conflict_id: 'conflict-001',
      resolution: 'use_community',
      fhir_data_rejected: true,
    });
    // Pre-repair drift columns must be gone
    expect(payload).not.toHaveProperty('sync_action');
    expect(payload).not.toHaveProperty('synced_at');
    expect(payload).not.toHaveProperty('metadata');
  });

  it('marks the conflict resolved on fhir_sync_conflicts with the resolver identity', async () => {
    render(<FHIRConflictResolution />);
    await selectConflictAndResolve('Use FHIR Server Data');

    await waitFor(() => {
      // fetch (mount) + update + refetch — at least 2 builders
      expect((mockState.builders['fhir_sync_conflicts'] ?? []).length).toBeGreaterThanOrEqual(2);
    });

    const updateBuilder = (mockState.builders['fhir_sync_conflicts'] as ChainableQueryBuilder[])
      .find(b => (b.update as ReturnType<typeof vi.fn>).mock.calls.length > 0);
    if (!updateBuilder) throw new Error('no update builder captured for fhir_sync_conflicts');
    const payload = (updateBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload).toMatchObject({
      resolution_action: 'use_fhir',
      resolved_by: 'admin-001',
    });
    expect(payload.resolved_at).toBeTruthy();
  });
});
