/**
 * Encounter State Machine Tests
 *
 * Tests the visit lifecycle: draft → scheduled → arrived → triaged →
 * in_progress → ready_for_sign → signed → ready_for_billing → billed → completed
 *
 * Deletion Test: If the state machine logic were removed, ALL of these tests
 * would fail because they test actual transition validation, not just rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the service
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(),
        })),
        order: vi.fn(),
      })),
    })),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

import { encounterStateMachine } from '../encounterStateMachine';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import {
  canTransitionTo,
  isEditable,
  isFinalized,
  isTerminal,
  isEncounterStatus,
  getAvailableTransitions,
  ENCOUNTER_STATUSES,
  VALID_TRANSITIONS,
  STATUS_DISPLAY,
} from '../../types/encounterStatus';
import type { EncounterStatus } from '../../types/encounterStatus';

describe('encounterStatus type guards and helpers', () => {
  it('validates all defined statuses as valid', () => {
    for (const status of ENCOUNTER_STATUSES) {
      expect(isEncounterStatus(status)).toBe(true);
    }
  });

  it('rejects invalid status strings', () => {
    expect(isEncounterStatus('invalid')).toBe(false);
    expect(isEncounterStatus('')).toBe(false);
    expect(isEncounterStatus(42)).toBe(false);
    expect(isEncounterStatus(null)).toBe(false);
    expect(isEncounterStatus(undefined)).toBe(false);
  });

  it('identifies editable states correctly', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('scheduled')).toBe(true);
    expect(isEditable('arrived')).toBe(true);
    expect(isEditable('triaged')).toBe(true);
    expect(isEditable('in_progress')).toBe(true);
    expect(isEditable('ready_for_sign')).toBe(true);
    // Not editable
    expect(isEditable('signed')).toBe(false);
    expect(isEditable('ready_for_billing')).toBe(false);
    expect(isEditable('billed')).toBe(false);
    expect(isEditable('completed')).toBe(false);
  });

  it('identifies finalized states correctly', () => {
    expect(isFinalized('signed')).toBe(true);
    expect(isFinalized('ready_for_billing')).toBe(true);
    expect(isFinalized('billed')).toBe(true);
    expect(isFinalized('completed')).toBe(true);
    // Not finalized
    expect(isFinalized('draft')).toBe(false);
    expect(isFinalized('in_progress')).toBe(false);
  });

  it('identifies terminal states correctly', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('no_show')).toBe(true);
    // Not terminal
    expect(isTerminal('draft')).toBe(false);
    expect(isTerminal('signed')).toBe(false);
    expect(isTerminal('billed')).toBe(false);
  });

  it('has display metadata for every status', () => {
    for (const status of ENCOUNTER_STATUSES) {
      const display = STATUS_DISPLAY[status];
      expect(display).toBeDefined();
      expect(display.label).toBeTruthy();
      expect(display.color).toBeTruthy();
      expect(display.bgColor).toBeTruthy();
      expect(display.description).toBeTruthy();
    }
  });
});

describe('canTransitionTo — valid forward transitions', () => {
  const validForwardPath: [EncounterStatus, EncounterStatus][] = [
    ['draft', 'scheduled'],
    ['draft', 'arrived'],
    ['draft', 'in_progress'],
    ['scheduled', 'arrived'],
    ['arrived', 'triaged'],
    ['triaged', 'in_progress'],
    ['in_progress', 'ready_for_sign'],
    ['ready_for_sign', 'signed'],
    ['signed', 'ready_for_billing'],
    ['ready_for_billing', 'billed'],
    ['billed', 'completed'],
  ];

  it.each(validForwardPath)(
    'allows %s → %s',
    (from, to) => {
      expect(canTransitionTo(from, to)).toBe(true);
    }
  );
});

describe('canTransitionTo — valid backward transitions', () => {
  it('allows ready_for_sign → in_progress (provider needs to add notes)', () => {
    expect(canTransitionTo('ready_for_sign', 'in_progress')).toBe(true);
  });

  it('allows signed → ready_for_sign (unlock for correction before billing)', () => {
    expect(canTransitionTo('signed', 'ready_for_sign')).toBe(true);
  });
});

describe('canTransitionTo — cancellation and no-show', () => {
  it('allows draft → cancelled', () => {
    expect(canTransitionTo('draft', 'cancelled')).toBe(true);
  });

  it('allows scheduled → cancelled', () => {
    expect(canTransitionTo('scheduled', 'cancelled')).toBe(true);
  });

  it('allows scheduled → no_show', () => {
    expect(canTransitionTo('scheduled', 'no_show')).toBe(true);
  });

  it('allows arrived → cancelled (patient leaves)', () => {
    expect(canTransitionTo('arrived', 'cancelled')).toBe(true);
  });
});

describe('canTransitionTo — invalid transitions', () => {
  const invalidTransitions: [EncounterStatus, EncounterStatus][] = [
    ['completed', 'draft'],
    ['completed', 'in_progress'],
    ['cancelled', 'scheduled'],
    ['no_show', 'arrived'],
    ['billed', 'in_progress'],
    ['signed', 'triaged'],
    ['draft', 'billed'],
    ['scheduled', 'signed'],
    ['arrived', 'ready_for_billing'],
    ['triaged', 'completed'],
  ];

  it.each(invalidTransitions)(
    'blocks %s → %s',
    (from, to) => {
      expect(canTransitionTo(from, to)).toBe(false);
    }
  );
});

describe('canTransitionTo — terminal states have no outgoing transitions', () => {
  const terminalStates: EncounterStatus[] = ['completed', 'cancelled', 'no_show'];

  it.each(terminalStates)(
    '%s has no available transitions',
    (status) => {
      const transitions = getAvailableTransitions(status);
      expect(transitions).toHaveLength(0);
    }
  );
});

describe('getAvailableTransitions', () => {
  it('returns correct transitions for draft', () => {
    const transitions = getAvailableTransitions('draft');
    expect(transitions).toContain('scheduled');
    expect(transitions).toContain('arrived');
    expect(transitions).toContain('in_progress');
    expect(transitions).toContain('cancelled');
    expect(transitions).not.toContain('billed');
  });

  it('returns correct transitions for in_progress', () => {
    const transitions = getAvailableTransitions('in_progress');
    expect(transitions).toEqual(['ready_for_sign']);
  });

  it('returns bidirectional transition for ready_for_sign', () => {
    const transitions = getAvailableTransitions('ready_for_sign');
    expect(transitions).toContain('in_progress');
    expect(transitions).toContain('signed');
  });
});

describe('VALID_TRANSITIONS covers all statuses', () => {
  it('every status has an entry in the transitions map', () => {
    for (const status of ENCOUNTER_STATUSES) {
      expect(VALID_TRANSITIONS[status]).toBeDefined();
      expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
    }
  });

  it('every target status in the map is a valid EncounterStatus', () => {
    for (const [, targets] of Object.entries(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(isEncounterStatus(target)).toBe(true);
      }
    }
  });
});

describe('encounterStateMachine.transitionStatus', () => {
  const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on valid transition', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        valid: true,
        from_status: 'draft',
        to_status: 'scheduled',
        encounter_id: 'enc-123',
        changed_at: '2026-02-12T00:00:00Z',
      },
      error: null,
    });

    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'scheduled',
      'user-456'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.from_status).toBe('draft');
      expect(result.data.to_status).toBe('scheduled');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'ENCOUNTER_STATUS_TRANSITION',
      true,
      expect.objectContaining({
        encounter_id: 'enc-123',
        from_status: 'draft',
        to_status: 'scheduled',
      })
    );
  });

  it('returns failure for invalid transition from RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        valid: false,
        error: 'Invalid transition: completed → draft',
        code: 'INVALID_TRANSITION',
      },
      error: null,
    });

    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'draft',
      'user-456'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_TRANSITION');
    }
  });

  it('returns failure for immutability violation', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: '[CLINICAL_IMMUTABILITY_VIOLATION] Cannot UPDATE finalized encounter (status: signed).',
      },
    });

    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'draft',
      'user-456'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('IMMUTABILITY_VIOLATION');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'ENCOUNTER_TRANSITION_BLOCKED',
      false,
      expect.objectContaining({ encounter_id: 'enc-123' })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await encounterStateMachine.transitionStatus('', 'scheduled', 'user-456');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure for invalid status value', async () => {
    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'bogus_status' as EncounterStatus,
      'user-456'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_STATUS');
    }
  });

  it('handles no-op transition (same status) gracefully', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        valid: true,
        no_op: true,
        message: 'Already in requested status',
      },
      error: null,
    });

    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'draft',
      'user-456'
    );

    expect(result.success).toBe(true);
    // No audit log for no-op
    expect(auditLogger.clinical).not.toHaveBeenCalledWith(
      'ENCOUNTER_STATUS_TRANSITION',
      expect.anything(),
      expect.anything()
    );
  });

  it('logs and returns failure on unexpected error', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Connection timeout'));

    const result = await encounterStateMachine.transitionStatus(
      'enc-123',
      'scheduled',
      'user-456'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });

  it('passes reason and metadata through to RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { valid: true, from_status: 'scheduled', to_status: 'cancelled' },
      error: null,
    });

    await encounterStateMachine.transitionStatus(
      'enc-123',
      'cancelled',
      'user-456',
      { reason: 'Patient requested cancellation', metadata: { source: 'phone_call' } }
    );

    expect(mockRpc).toHaveBeenCalledWith('transition_encounter_status', {
      p_encounter_id: 'enc-123',
      p_new_status: 'cancelled',
      p_changed_by: 'user-456',
      p_reason: 'Patient requested cancellation',
      p_metadata: { source: 'phone_call' },
    });
  });
});

describe('encounterStateMachine.getStatusInfo', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full status info for a valid encounter', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: { id: 'enc-123', status: 'in_progress' },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterStateMachine.getStatusInfo('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('in_progress');
      expect(result.data.is_editable).toBe(true);
      expect(result.data.is_finalized).toBe(false);
      expect(result.data.is_terminal).toBe(false);
      expect(result.data.available_transitions).toEqual(['ready_for_sign']);
      expect(result.data.display.label).toBe('In Progress');
    }
  });

  it('returns failure when encounter not found', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterStateMachine.getStatusInfo('enc-missing');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('encounterStateMachine.canTransition (static)', () => {
  it('returns true for valid transitions', () => {
    expect(encounterStateMachine.canTransition('draft', 'scheduled')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(encounterStateMachine.canTransition('completed', 'draft')).toBe(false);
  });
});

describe('full visit lifecycle path', () => {
  it('validates the complete happy path from draft to completed', () => {
    const happyPath: EncounterStatus[] = [
      'draft',
      'scheduled',
      'arrived',
      'triaged',
      'in_progress',
      'ready_for_sign',
      'signed',
      'ready_for_billing',
      'billed',
      'completed',
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(canTransitionTo(happyPath[i], happyPath[i + 1])).toBe(true);
    }
  });

  it('validates walk-in patient path (skip scheduling)', () => {
    const walkInPath: EncounterStatus[] = [
      'draft',
      'arrived',
      'triaged',
      'in_progress',
      'ready_for_sign',
      'signed',
      'ready_for_billing',
      'billed',
      'completed',
    ];

    for (let i = 0; i < walkInPath.length - 1; i++) {
      expect(canTransitionTo(walkInPath[i], walkInPath[i + 1])).toBe(true);
    }
  });

  it('validates provider-initiated direct start path', () => {
    expect(canTransitionTo('draft', 'in_progress')).toBe(true);
    expect(canTransitionTo('in_progress', 'ready_for_sign')).toBe(true);
    expect(canTransitionTo('ready_for_sign', 'signed')).toBe(true);
  });
});
