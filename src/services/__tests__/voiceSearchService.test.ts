/**
 * Tests for voiceSearchService — the clinical search engine.
 *
 * The bug these guard against: the query selected `date_of_birth` (a column that
 * does NOT exist on live `profiles` — the real column is `dob`) and `specialty`
 * (also nonexistent). PostgREST 400'd the whole query, the error was swallowed,
 * and EVERY search returned []. Because patient search is the default path, the
 * entire global search was dead.
 *
 * These are behavior tests (Deletion Test): they fail if the column names
 * regress or the PHI audit logging is removed — not merely if an import breaks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createQueryBuilder } from '../../test-utils/supabaseMock';
import type { ParsedEntity } from '../../contexts/VoiceActionContext';
import { searchPatients, searchProviders, searchClinicalNotes } from '../voiceSearchService';
import { auditLogger } from '../auditLogger';

vi.mock('../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../voiceLearningService', () => ({
  VoiceLearningService: { loadVoiceProfile: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../medicalSynonymService', () => ({
  medicalSynonymService: {
    expandSearchTerm: vi
      .fn()
      .mockResolvedValue({ success: false, data: { has_synonyms: false, expanded_terms: [] } }),
  },
}));

function entity(overrides: Partial<ParsedEntity>): ParsedEntity {
  return {
    type: 'patient',
    query: '',
    filters: {},
    rawTranscript: '',
    confidence: 50,
    ...overrides,
  } as ParsedEntity;
}

/** Wrap a single chainable builder as a supabase-shaped client. */
function clientFor(builder: ReturnType<typeof createQueryBuilder>) {
  return { from: vi.fn(() => builder), rpc: vi.fn(() => builder) } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks wipes call history but NOT the resolved-value impl, so phi()
  // still resolves. Re-assert it defensively in case a future test overrides it.
  (auditLogger.phi as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
});

describe('searchPatients — column fix', () => {
  const patientRow = {
    id: 'p1',
    user_id: 'u1',
    first_name: 'Test',
    last_name: 'Alpha',
    dob: '2000-01-01',
    mrn: 'MRN-0001',
    room_number: '205A',
    risk_score: 82,
    hospital_unit: 'ICU',
  };

  it('selects `dob`, never `date_of_birth`', async () => {
    const builder = createQueryBuilder({ data: [patientRow] });
    await searchPatients(clientFor(builder), entity({ query: 'Test Alpha', filters: { name: 'Test Alpha' } }));

    const selectArg = (builder.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(selectArg).toContain('dob');
    expect(selectArg).not.toContain('date_of_birth');
  });

  it('maps `dob` into the DOB display and metadata (proves it reads the real column)', async () => {
    const builder = createQueryBuilder({ data: [patientRow] });
    const results = await searchPatients(
      clientFor(builder),
      entity({ query: 'Test Alpha', filters: { name: 'Test Alpha' } })
    );

    expect(results).toHaveLength(1);
    expect(results[0].secondaryText).toContain('DOB:');
    expect(results[0].metadata.dateOfBirth).toBe('2000-01-01');
    expect(results[0].id).toBe('u1'); // user_id preferred over id
  });

  it('audits PHI access with patient tokens and count (HIPAA §164.312(b))', async () => {
    const builder = createQueryBuilder({ data: [patientRow] });
    await searchPatients(clientFor(builder), entity({ query: 'Test Alpha', filters: { name: 'Test Alpha' } }));

    expect(auditLogger.phi).toHaveBeenCalledWith(
      'PATIENT_SEARCH',
      'u1',
      expect.objectContaining({ resultCount: 1, patientIds: ['u1'] })
    );
  });

  it('does NOT log the raw query text (it can contain a patient name = PHI)', async () => {
    const builder = createQueryBuilder({ data: [patientRow] });
    await searchPatients(clientFor(builder), entity({ query: 'Test Alpha', filters: { name: 'Test Alpha' } }));

    const phiMeta = (auditLogger.phi as ReturnType<typeof vi.fn>).mock.calls[0][2];
    expect(JSON.stringify(phiMeta)).not.toContain('Test Alpha');
  });

  it('returns [] and logs no PHI access when the query errors', async () => {
    const builder = createQueryBuilder({
      error: { message: 'column profiles.date_of_birth does not exist', code: '42703' },
    });
    const results = await searchPatients(
      clientFor(builder),
      entity({ query: 'Test Alpha', filters: { name: 'Test Alpha' } })
    );

    expect(results).toEqual([]);
    expect(auditLogger.phi).not.toHaveBeenCalled();
  });
});

describe('searchProviders — column fix', () => {
  it('selects `department`, never `specialty`', async () => {
    const builder = createQueryBuilder({ data: [] });
    await searchProviders(
      clientFor(builder),
      entity({ type: 'provider', query: 'Smith', filters: { name: 'Smith' } })
    );

    const selectArg = (builder.select as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(selectArg).not.toContain('specialty');
    expect(selectArg).toContain('department');
  });
});

describe('searchClinicalNotes — PHI audit', () => {
  it('audits PHI access for a clinical-note search', async () => {
    const builder = createQueryBuilder({
      data: [
        {
          note_id: 'n1',
          encounter_id: 'e1',
          note_type: 'progress',
          content_snippet: 'diabetes management plan',
          author_id: 'a1',
          tenant_id: 't1',
          created_at: '2026-01-01T00:00:00Z',
          relevance: 0.8,
        },
      ],
    });

    const results = await searchClinicalNotes(
      clientFor(builder),
      entity({ type: 'clinical_note', query: 'diabetes' })
    );

    expect(results[0].type).toBe('clinical_note');
    expect(auditLogger.phi).toHaveBeenCalledWith(
      'CLINICAL_NOTE_SEARCH',
      'n1',
      expect.objectContaining({ resultCount: 1 })
    );
  });
});
