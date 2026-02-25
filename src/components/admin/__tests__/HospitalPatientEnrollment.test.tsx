/**
 * HospitalPatientEnrollment tests — validates enrollment form behavior,
 * bulk test data generation, patient table rendering, and supabase RPC calls.
 *
 * All test data is synthetic (PHI-safe per CLAUDE.md).
 * Every test passes the Deletion Test: would fail for an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockOrder = vi.fn();
const mockSelect = vi.fn((_cols?: string) => ({ order: mockOrder }));
const mockFrom = vi.fn((_table?: string) => ({ select: mockSelect }));
const mockRpc = vi.fn((_fn?: string, _params?: unknown) => ({}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, params?: unknown) => mockRpc(fn, params),
  },
}));

vi.mock('lucide-react', () => ({
  UserPlus: () => <span data-testid="user-plus-icon">UserPlus</span>,
  Users: () => <span data-testid="users-icon">Users</span>,
  Hospital: () => <span data-testid="hospital-icon">Hospital</span>,
  FileText: () => <span data-testid="file-text-icon">FileText</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">CheckCircle</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">AlertCircle</span>,
}));

// ============================================================================
// SYNTHETIC TEST DATA (PHI-safe per CLAUDE.md)
// ============================================================================

const makeHospitalPatients = () => [
  {
    user_id: 'patient-001',
    first_name: 'Test',
    last_name: 'Alpha',
    age: 75,
    room_number: '101',
    mrn: 'MRN-T001',
    enrollment_notes: 'Test monitoring',
    enrollment_date: '2026-02-01',
  },
  {
    user_id: 'patient-002',
    first_name: 'Test',
    last_name: 'Beta',
    age: 68,
    room_number: '102',
    mrn: 'MRN-T002',
    enrollment_notes: 'Test rehab',
    enrollment_date: '2026-02-01',
  },
];

const makePatientNoRoom = () => [
  {
    user_id: 'patient-003',
    first_name: 'Test',
    last_name: 'Gamma',
    age: 80,
    room_number: null,
    mrn: null,
    enrollment_notes: null,
    enrollment_date: '2026-02-01',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function setupLoadPatients(patients: unknown[] = []) {
  mockOrder.mockResolvedValue({ data: patients, error: null });
}

async function renderComponent() {
  const mod = await import('../HospitalPatientEnrollment');
  return render(<mod.default />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('HospitalPatientEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupLoadPatients([]);
  });

  // --------------------------------------------------------------------------
  // 1. Header and branding
  // --------------------------------------------------------------------------

  it('renders the HOSPITAL Patient Enrollment header', async () => {
    await renderComponent();
    expect(screen.getByText('HOSPITAL Patient Enrollment')).toBeInTheDocument();
  });

  it('displays the INPATIENT badge', async () => {
    await renderComponent();
    expect(screen.getByText('INPATIENT')).toBeInTheDocument();
  });

  it('shows Hospital Mode info text', async () => {
    await renderComponent();
    expect(
      screen.getByText(/Hospital Mode: Patients enrolled here will appear/)
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 2. Mode selector
  // --------------------------------------------------------------------------

  it('renders Single Patient and Bulk Test Data mode buttons', async () => {
    await renderComponent();
    expect(screen.getByText('Single Patient')).toBeInTheDocument();
    expect(screen.getByText('Bulk Test Data')).toBeInTheDocument();
  });

  it('highlights the active mode button with blue styling', async () => {
    await renderComponent();
    const singleBtn = screen.getByText('Single Patient').closest('button') as HTMLButtonElement;
    expect(singleBtn.className).toContain('bg-blue-600');

    const bulkBtn = screen.getByText('Bulk Test Data').closest('button') as HTMLButtonElement;
    expect(bulkBtn.className).not.toContain('bg-blue-600');
  });

  it('switches from single mode to bulk mode when Bulk Test Data is clicked', async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));

    // Bulk description should appear
    expect(
      screen.getByText(/This will create 5 test hospital patients/)
    ).toBeInTheDocument();

    // Single form should be gone
    expect(screen.queryByText('Patient Information')).not.toBeInTheDocument();
  });

  it('switches from bulk mode back to single mode', async () => {
    const user = userEvent.setup();
    await renderComponent();

    // Go to bulk first
    await user.click(screen.getByText('Bulk Test Data'));
    expect(screen.queryByText('Patient Information')).not.toBeInTheDocument();

    // Go back to single
    await user.click(screen.getByText('Single Patient'));
    expect(screen.getByText('Patient Information')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 3. Single Patient form
  // --------------------------------------------------------------------------

  it('shows the single patient form with required fields in single mode', async () => {
    await renderComponent();
    expect(screen.getByText('Patient Information')).toBeInTheDocument();

    // Required field labels (with asterisk indicators)
    expect(screen.getByText('First Name')).toBeInTheDocument();
    expect(screen.getByText('Last Name')).toBeInTheDocument();
    expect(screen.getByText('Date of Birth')).toBeInTheDocument();
  });

  it('marks First Name, Last Name, and Date of Birth as required with asterisks', async () => {
    await renderComponent();

    // Each required label has a red asterisk span
    const requiredMarkers = screen.getAllByText('*');
    expect(requiredMarkers.length).toBeGreaterThanOrEqual(3);
  });

  it('renders optional fields: Gender, Room Number, MRN, Phone, Email, Emergency contacts', async () => {
    await renderComponent();
    expect(screen.getByText('Gender')).toBeInTheDocument();
    expect(screen.getByText('Room Number')).toBeInTheDocument();
    expect(screen.getByText('MRN (Medical Record Number)')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact Name')).toBeInTheDocument();
    expect(screen.getByText('Emergency Contact Phone')).toBeInTheDocument();
  });

  it('renders the Enrollment Notes textarea', async () => {
    await renderComponent();
    expect(screen.getByText('Enrollment Notes')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/ICU admission, post-surgery monitoring/)
    ).toBeInTheDocument();
  });

  it('shows the Enroll Hospital Patient submit button', async () => {
    await renderComponent();
    expect(
      screen.getByRole('button', { name: /Enroll Hospital Patient/i })
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 4. Single enrollment submission
  // --------------------------------------------------------------------------

  it('calls supabase.rpc with enroll_hospital_patient on single form submit', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: 'new-patient-id-001', error: null });
    // reload patients after success
    mockOrder.mockResolvedValue({ data: [], error: null });

    await renderComponent();

    // Fill required fields
    const firstNameInput = screen.getByLabelText(/First Name/);
    const lastNameInput = screen.getByLabelText(/Last Name/);
    const dobInput = screen.getByLabelText(/Date of Birth/);

    await user.type(firstNameInput, 'Test');
    await user.type(lastNameInput, 'Patient');
    await user.type(dobInput, '2000-01-01');

    await user.click(screen.getByRole('button', { name: /Enroll Hospital Patient/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('enroll_hospital_patient', expect.objectContaining({
        p_first_name: 'Test',
        p_last_name: 'Patient',
        p_dob: '2000-01-01',
      }));
    });
  });

  it('shows success result after successful single enrollment', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: 'new-patient-id-001', error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    await renderComponent();

    await user.type(screen.getByLabelText(/First Name/), 'Test');
    await user.type(screen.getByLabelText(/Last Name/), 'Omega');
    await user.type(screen.getByLabelText(/Date of Birth/), '2000-01-01');

    await user.click(screen.getByRole('button', { name: /Enroll Hospital Patient/i }));

    await waitFor(() => {
      expect(screen.getByText('Enrollment Results')).toBeInTheDocument();
      expect(screen.getByText('Test Omega')).toBeInTheDocument();
      expect(screen.getByText(/Successfully Enrolled/)).toBeInTheDocument();
    });
  });

  it('shows error result when single enrollment fails', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Duplicate MRN' } });

    await renderComponent();

    await user.type(screen.getByLabelText(/First Name/), 'Test');
    await user.type(screen.getByLabelText(/Last Name/), 'Fail');
    await user.type(screen.getByLabelText(/Date of Birth/), '2000-01-01');

    await user.click(screen.getByRole('button', { name: /Enroll Hospital Patient/i }));

    await waitFor(() => {
      expect(screen.getByText(/Failed: Duplicate MRN/)).toBeInTheDocument();
    });
  });

  it('resets form fields after successful enrollment', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: 'new-patient-id-001', error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    await renderComponent();

    const firstNameInput = screen.getByLabelText(/First Name/) as HTMLInputElement;
    const lastNameInput = screen.getByLabelText(/Last Name/) as HTMLInputElement;

    await user.type(firstNameInput, 'Test');
    await user.type(lastNameInput, 'Reset');
    await user.type(screen.getByLabelText(/Date of Birth/), '2000-01-01');

    await user.click(screen.getByRole('button', { name: /Enroll Hospital Patient/i }));

    await waitFor(() => {
      expect(firstNameInput.value).toBe('');
      expect(lastNameInput.value).toBe('');
    });
  });

  it('shows Enrolling... loading state on submit button during single enrollment', async () => {
    const user = userEvent.setup();
    // Never resolve to keep loading state
    mockRpc.mockReturnValue(new Promise(() => {}));

    await renderComponent();

    await user.type(screen.getByLabelText(/First Name/), 'Test');
    await user.type(screen.getByLabelText(/Last Name/), 'Loading');
    await user.type(screen.getByLabelText(/Date of Birth/), '2000-01-01');

    await user.click(screen.getByRole('button', { name: /Enroll Hospital Patient/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enrolling\.\.\./i })).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Bulk mode
  // --------------------------------------------------------------------------

  it('shows the bulk enrollment description when in bulk mode', async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));

    expect(
      screen.getByText(/This will create 5 test hospital patients with realistic data/)
    ).toBeInTheDocument();
  });

  it('displays the 5 test patient names in bulk mode', async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));

    expect(screen.getByText(/John Doe \(Room 101\)/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith \(Room 102\)/)).toBeInTheDocument();
    expect(screen.getByText(/Robert Johnson \(Room 103\)/)).toBeInTheDocument();
    expect(screen.getByText(/Mary Williams \(Room 104\)/)).toBeInTheDocument();
    expect(screen.getByText(/David Brown \(Room 105\)/)).toBeInTheDocument();
  });

  it('shows the Create 5 Test Hospital Patients button in bulk mode', async () => {
    const user = userEvent.setup();
    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));

    expect(
      screen.getByRole('button', { name: /Create 5 Test Hospital Patients/i })
    ).toBeInTheDocument();
  });

  it('calls supabase.rpc with bulk_enroll_hospital_patients on bulk submit', async () => {
    const user = userEvent.setup();
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));
    await user.click(screen.getByRole('button', { name: /Create 5 Test Hospital Patients/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('bulk_enroll_hospital_patients', {
        patients: expect.arrayContaining([
          expect.objectContaining({ first_name: 'John', last_name: 'Doe', room_number: '101' }),
          expect.objectContaining({ first_name: 'Jane', last_name: 'Smith', room_number: '102' }),
        ]),
      });
    });
  });

  it('shows Creating Test Patients... loading state during bulk enrollment', async () => {
    const user = userEvent.setup();
    // Never resolve to keep loading state
    mockRpc.mockReturnValue(new Promise(() => {}));

    await renderComponent();

    await user.click(screen.getByText('Bulk Test Data'));
    await user.click(screen.getByRole('button', { name: /Create 5 Test Hospital Patients/i }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Creating Test Patients\.\.\./i })
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Current Hospital Patients table
  // --------------------------------------------------------------------------

  it('renders the Current Hospital Patients section header', async () => {
    await renderComponent();
    expect(screen.getByText('Current Hospital Patients')).toBeInTheDocument();
  });

  it('shows empty state message when no patients are enrolled', async () => {
    setupLoadPatients([]);
    await renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText(/No hospital patients enrolled yet/)
      ).toBeInTheDocument();
    });
  });

  it('renders table column headers when patients exist', async () => {
    setupLoadPatients(makeHospitalPatients());
    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Room')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('MRN')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Enrolled')).toBeInTheDocument();
    });
  });

  it('displays patient data rows with correct values', async () => {
    setupLoadPatients(makeHospitalPatients());
    await renderComponent();

    await waitFor(() => {
      // Room numbers
      expect(screen.getByText('101')).toBeInTheDocument();
      expect(screen.getByText('102')).toBeInTheDocument();

      // Ages
      expect(screen.getByText('75')).toBeInTheDocument();
      expect(screen.getByText('68')).toBeInTheDocument();

      // MRNs
      expect(screen.getByText('MRN-T001')).toBeInTheDocument();
      expect(screen.getByText('MRN-T002')).toBeInTheDocument();

      // Notes
      expect(screen.getByText('Test monitoring')).toBeInTheDocument();
      expect(screen.getByText('Test rehab')).toBeInTheDocument();
    });
  });

  it('formats patient names as "Last, First" in the table', async () => {
    setupLoadPatients(makeHospitalPatients());
    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Alpha, Test')).toBeInTheDocument();
      expect(screen.getByText('Beta, Test')).toBeInTheDocument();
    });
  });

  it('shows N/A for room number when not set', async () => {
    setupLoadPatients(makePatientNoRoom());
    await renderComponent();

    await waitFor(() => {
      // The table should contain N/A for both room and MRN (both null)
      const rows = screen.getAllByRole('row');
      // First row is header, second is data
      const dataRow = rows[1];
      // Patient has null room_number AND null mrn → two N/A cells
      const naCells = within(dataRow).getAllByText('N/A');
      expect(naCells.length).toBe(2);
    });
  });

  it('shows the total patient count', async () => {
    setupLoadPatients(makeHospitalPatients());
    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('(2 total)')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Data loading on mount
  // --------------------------------------------------------------------------

  it('calls supabase.from hospital_patients on mount to load patients', async () => {
    await renderComponent();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('hospital_patients');
      expect(mockSelect).toHaveBeenCalledWith(
        'user_id, first_name, last_name, age, room_number, mrn, enrollment_notes, enrollment_date'
      );
      expect(mockOrder).toHaveBeenCalledWith('room_number', { ascending: true, nullsFirst: false });
    });
  });
});
