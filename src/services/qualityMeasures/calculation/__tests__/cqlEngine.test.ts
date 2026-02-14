/**
 * CQL Execution Engine Tests
 *
 * Tests the CQL engine wrapper that provides graceful degradation
 * when cql-execution/cql-exec-fhir packages are not available.
 *
 * Deletion Test: Every test verifies actual engine behavior — availability
 * checking, execution failure paths, result mapping, library loading.
 * An empty module would fail all tests.
 *
 * ONC Criteria: 170.315(c)(1) — CQL-based eCQM evaluation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('../../../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

// We need to control the dynamic imports for cql-execution and cql-exec-fhir.
// Reset module registry between tests to clear the cached cqlAvailable value.

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { auditLogger } from '../../../auditLogger';
import type { CqlPatientResult } from '../cqlEngine.types';

// ---------------------------------------------------------------------------
// isCqlAvailable tests
// ---------------------------------------------------------------------------

describe('isCqlAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module to clear cached cqlAvailable
    vi.resetModules();
  });

  it('returns false when cql-execution package is not importable', async () => {
    // Re-import with fresh module state
    vi.doMock('cql-execution', () => {
      throw new Error('Module not found');
    });

    const { isCqlAvailable } = await import('../cqlEngine');

    const result = await isCqlAvailable();

    expect(result).toBe(false);
    expect(auditLogger.warn).toHaveBeenCalledWith(
      'CQL_PACKAGES_NOT_AVAILABLE',
      expect.objectContaining({
        message: expect.stringContaining('cql-execution'),
      })
    );
  });

  it('returns false when cql-exec-fhir package is not importable', async () => {
    vi.doMock('cql-execution', () => ({}));
    vi.doMock('cql-exec-fhir', () => {
      throw new Error('Module not found');
    });

    const { isCqlAvailable } = await import('../cqlEngine');

    const result = await isCqlAvailable();

    expect(result).toBe(false);
  });

  it('returns true when both packages are importable', async () => {
    vi.doMock('cql-execution', () => ({ Library: class {}, Executor: class {} }));
    vi.doMock('cql-exec-fhir', () => ({ PatientSource: { FHIRv401: class {} } }));

    const { isCqlAvailable } = await import('../cqlEngine');

    const result = await isCqlAvailable();

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeCql tests
// ---------------------------------------------------------------------------

describe('executeCql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns failure when CQL packages are not available', async () => {
    vi.doMock('cql-execution', () => {
      throw new Error('Not installed');
    });

    const { executeCql } = await import('../cqlEngine');

    const result = await executeCql({
      elmLibrary: {
        library: {
          identifier: { id: 'CMS130', version: '12.0.0' },
          statements: { def: [] },
        },
      },
      patientBundle: {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('CQL_NOT_AVAILABLE');
    expect(result.error.message).toContain('not installed');
  });

  it('returns failure and logs error when execution throws', async () => {
    // Make packages "available" but executor throws
    vi.doMock('cql-execution', () => ({
      Library: class {
        source = { library: { identifier: { id: 'CMS130', version: '12.0.0' } } };
      },
      CodeService: class {},
      Executor: class {
        exec() {
          throw new Error('Execution engine crashed');
        }
      },
    }));
    vi.doMock('cql-exec-fhir', () => ({
      PatientSource: {
        FHIRv401: class {
          loadBundles() { /* no-op */ }
        },
      },
    }));

    const { executeCql } = await import('../cqlEngine');

    const result = await executeCql({
      elmLibrary: {
        library: {
          identifier: { id: 'CMS130', version: '12.0.0' },
          statements: { def: [] },
        },
      },
      patientBundle: {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('CQL_EXECUTION_ERROR');
    expect(auditLogger.error).toHaveBeenCalledWith(
      'CQL_EXECUTION_FAILED',
      expect.any(Error),
      expect.objectContaining({ libraryId: 'CMS130' })
    );
  });
});

// ---------------------------------------------------------------------------
// cqlResultToMeasureResult tests
// ---------------------------------------------------------------------------

describe('cqlResultToMeasureResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('maps population flags correctly from CQL statement results', async () => {
    // Import fresh to avoid module cache issues
    const { cqlResultToMeasureResult } = await import('../cqlEngine');

    const cqlResult: CqlPatientResult = {
      patientId: 'patient-1',
      statementResults: {
        'Initial Population': true,
        'Denominator': true,
        'Denominator Exclusion': false,
        'Denominator Exception': false,
        'Numerator': true,
        'Numerator Exclusion': false,
      },
    };

    const result = cqlResultToMeasureResult('CMS130v12', 'patient-1', cqlResult);

    expect(result.measureId).toBe('CMS130v12');
    expect(result.patientId).toBe('patient-1');
    expect(result.initialPopulation).toBe(true);
    expect(result.denominator).toBe(true);
    expect(result.denominatorExclusion).toBe(false);
    expect(result.denominatorException).toBe(false);
    expect(result.numerator).toBe(true);
    expect(result.numeratorExclusion).toBe(false);
    expect(result.dataElementsUsed).toEqual({
      source: 'cql',
      statementNames: [
        'Initial Population',
        'Denominator',
        'Denominator Exclusion',
        'Denominator Exception',
        'Numerator',
        'Numerator Exclusion',
      ],
    });
  });

  it('defaults missing populations to false', async () => {
    const { cqlResultToMeasureResult } = await import('../cqlEngine');

    const cqlResult: CqlPatientResult = {
      patientId: 'patient-2',
      statementResults: {
        // Only Initial Population is set; others are missing
        'Initial Population': true,
      },
    };

    const result = cqlResultToMeasureResult('CMS131v11', 'patient-2', cqlResult);

    expect(result.initialPopulation).toBe(true);
    // Missing fields should be false (Boolean(undefined) === false)
    expect(result.denominator).toBe(false);
    expect(result.denominatorExclusion).toBe(false);
    expect(result.denominatorException).toBe(false);
    expect(result.numerator).toBe(false);
    expect(result.numeratorExclusion).toBe(false);
  });

  it('handles null/falsy CQL values correctly', async () => {
    const { cqlResultToMeasureResult } = await import('../cqlEngine');

    const cqlResult: CqlPatientResult = {
      patientId: 'patient-3',
      statementResults: {
        'Initial Population': null,
        'Denominator': 0,
        'Denominator Exclusion': '',
        'Denominator Exception': undefined,
        'Numerator': [],
        'Numerator Exclusion': false,
      },
    };

    const result = cqlResultToMeasureResult('CMS125v12', 'patient-3', cqlResult);

    // null, 0, '' => false via Boolean()
    expect(result.initialPopulation).toBe(false);
    expect(result.denominator).toBe(false);
    expect(result.denominatorExclusion).toBe(false);
    expect(result.denominatorException).toBe(false);
    // [] is truthy in JavaScript
    expect(result.numerator).toBe(true);
    expect(result.numeratorExclusion).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadElmLibrary tests
// ---------------------------------------------------------------------------

describe('loadElmLibrary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns null when storage download returns an error', async () => {
    vi.doMock('../../../../lib/supabaseClient', () => ({
      supabase: {
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'File not found' },
            }),
          })),
        },
      },
    }));

    // Need fresh import after mock
    const { loadElmLibrary } = await import('../cqlEngine');

    const result = await loadElmLibrary('CMS999');

    expect(result).toBeNull();
  });

  it('returns null when downloaded content is not a valid ELM library', async () => {
    const invalidBlob = new Blob([JSON.stringify({ notALibrary: true })], {
      type: 'application/json',
    });

    vi.doMock('../../../../lib/supabaseClient', () => ({
      supabase: {
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({
              data: invalidBlob,
              error: null,
            }),
          })),
        },
      },
    }));

    const { loadElmLibrary } = await import('../cqlEngine');

    const result = await loadElmLibrary('CMS999');

    // Missing 'library' key => fails shape validation => returns null
    expect(result).toBeNull();
  });

  it('returns parsed ELM library when valid JSON with library key is downloaded', async () => {
    const validElm = {
      library: {
        identifier: { id: 'CMS130', version: '12.0.0' },
        statements: {
          def: [
            { name: 'Initial Population', context: 'Patient', expression: {} },
          ],
        },
      },
    };

    // Use a mock object with text() instead of a real Blob to avoid jsdom issues
    const mockBlobData = {
      text: vi.fn().mockResolvedValue(JSON.stringify(validElm)),
    };

    vi.doMock('../../../../lib/supabaseClient', () => ({
      supabase: {
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockResolvedValue({
              data: mockBlobData,
              error: null,
            }),
          })),
        },
      },
    }));

    const { loadElmLibrary } = await import('../cqlEngine');
    const result = await loadElmLibrary('CMS130');

    expect(result).not.toBeNull();
    expect(result?.library.identifier.id).toBe('CMS130');
    expect(result?.library.identifier.version).toBe('12.0.0');
  });

  it('returns null when download throws an exception', async () => {
    vi.doMock('../../../../lib/supabaseClient', () => ({
      supabase: {
        storage: {
          from: vi.fn(() => ({
            download: vi.fn().mockRejectedValue(new Error('Network error')),
          })),
        },
      },
    }));

    const { loadElmLibrary } = await import('../cqlEngine');

    const result = await loadElmLibrary('CMS130');

    expect(result).toBeNull();
  });
});
