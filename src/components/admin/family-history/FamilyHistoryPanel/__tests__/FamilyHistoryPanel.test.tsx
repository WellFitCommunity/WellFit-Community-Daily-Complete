/**
 * Tests for FamilyHistoryPanel orchestrator.
 *
 * Covers the list/load/refresh lifecycle and the join between family members
 * and their conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FamilyHistoryPanel } from '../index';
import { FamilyMemberHistoryService } from '../../../../../services/fhir/FamilyMemberHistoryService';
import { FamilyMemberHistoryConditionService } from '../../../../../services/fhir/FamilyMemberHistoryConditionService';
import { useOrderingProvider } from '../../../../../hooks/useOrderingProvider';

vi.mock('../../../../../services/fhir/FamilyMemberHistoryService', () => ({
  FamilyMemberHistoryService: { getByPatient: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../../../services/fhir/FamilyMemberHistoryConditionService', () => ({
  FamilyMemberHistoryConditionService: { getByPatient: vi.fn(), create: vi.fn() },
}));
vi.mock('../../../../../hooks/useOrderingProvider', () => ({
  useOrderingProvider: vi.fn(),
}));

const mockedGetMembers = vi.mocked(FamilyMemberHistoryService.getByPatient);
const mockedGetConditions = vi.mocked(FamilyMemberHistoryConditionService.getByPatient);
const mockedProvider = vi.mocked(useOrderingProvider);

const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetMembers.mockReset();
  mockedGetConditions.mockReset();
  mockedProvider.mockReturnValue({
    loading: false,
    error: null,
    tenant_id: 'tenant-x',
    user_id: 'user-x',
    display_name: 'Dr. X',
    practitioner_id: null,
  });
});

describe('FamilyHistoryPanel — list + refresh behavior', () => {
  it('renders empty-state copy when the patient has no family history', async () => {
    mockedGetMembers.mockResolvedValueOnce({ success: true, data: [] });
    mockedGetConditions.mockResolvedValueOnce({ success: true, data: [] });

    render(<FamilyHistoryPanel patientId={PATIENT_ID} />);

    expect(
      await screen.findByText(/no family health history on file/i)
    ).toBeInTheDocument();
    expect(mockedGetMembers).toHaveBeenCalledWith(PATIENT_ID);
    expect(mockedGetConditions).toHaveBeenCalledWith(PATIENT_ID);
  });

  it('renders each family member with its conditions joined in (condition + age at onset)', async () => {
    mockedGetMembers.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'fmh-1',
          patient_id: PATIENT_ID,
          status: 'completed',
          relationship_display: 'Mother',
          sex_display: 'Female',
          deceased_boolean: false,
        },
      ] as never,
    });
    mockedGetConditions.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'fmhc-1',
          patient_id: PATIENT_ID,
          family_member_history_id: 'fmh-1',
          condition_display: 'Type 2 diabetes mellitus',
          onset_age_string: '50 yr',
        },
      ] as never,
    });

    render(<FamilyHistoryPanel patientId={PATIENT_ID} />);

    expect(await screen.findByText(/mother/i)).toBeInTheDocument();
    expect(screen.getByText(/type 2 diabetes mellitus/i)).toBeInTheDocument();
    expect(screen.getByText(/onset age 50 yr/i)).toBeInTheDocument();
  });

  it('surfaces a load error from FamilyMemberHistoryService and tolerates a conditions-only failure', async () => {
    mockedGetMembers.mockResolvedValueOnce({ success: false, error: 'RLS bounced' });
    mockedGetConditions.mockResolvedValueOnce({ success: true, data: [] });

    render(<FamilyHistoryPanel patientId={PATIENT_ID} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/rls bounced/i);
  });

  it('opens the AddFamilyHistoryForm when "Add family member" is clicked, and closes it on cancel', async () => {
    mockedGetMembers.mockResolvedValueOnce({ success: true, data: [] });
    mockedGetConditions.mockResolvedValueOnce({ success: true, data: [] });

    render(<FamilyHistoryPanel patientId={PATIENT_ID} />);

    await waitFor(() => expect(mockedGetMembers).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add family member/i }));
    expect(await screen.findByRole('form', { name: /add family member/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('form', { name: /add family member/i })).not.toBeInTheDocument();
    });
  });
});
