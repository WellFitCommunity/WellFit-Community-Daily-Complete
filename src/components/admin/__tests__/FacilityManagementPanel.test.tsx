/**
 * FacilityManagementPanel tests
 *
 * Validates the admin interface for managing healthcare facilities: loading states,
 * facility card display (name, type, code, address, contact, badges), search filtering,
 * show-inactive toggle, empty state, modal open/close for add/edit, form validation,
 * CRUD operations (create, update, deactivate, reactivate, set-primary), error banners,
 * and refresh behavior.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Each test asserts specific text, elements, or service calls that require the real
 * component implementation.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Facility, FacilityType } from '../../../types/facility';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetFacilities = vi.fn();
const mockGetAllFacilities = vi.fn();
const mockCreateFacility = vi.fn();
const mockUpdateFacility = vi.fn();
const mockDeactivateFacility = vi.fn();
const mockReactivateFacility = vi.fn();

vi.mock('../../../services/facilityService', () => ({
  FacilityService: {
    getFacilities: (...args: unknown[]) => mockGetFacilities(...args),
    getAllFacilities: (...args: unknown[]) => mockGetAllFacilities(...args),
    createFacility: (...args: unknown[]) => mockCreateFacility(...args),
    updateFacility: (...args: unknown[]) => mockUpdateFacility(...args),
    deactivateFacility: (...args: unknown[]) => mockDeactivateFacility(...args),
    reactivateFacility: (...args: unknown[]) => mockReactivateFacility(...args),
  },
}));

let mockProfileTenantId: string | null = 'tenant-test-001';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-test-001' } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: { tenant_id: mockProfileTenantId },
              error: null,
            })
          ),
        })),
      })),
    })),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

// ============================================================================
// FIXTURES — Synthetic test data only (no realistic PHI)
// ============================================================================

const makeFacility = (overrides: Partial<Facility> = {}): Facility => ({
  id: 'fac-001',
  tenant_id: 'tenant-test-001',
  name: 'Test Facility Alpha',
  facility_code: 'TFA-01',
  facility_type: 'hospital' as FacilityType,
  address_line1: '123 Test Street',
  address_line2: null,
  city: 'Test City',
  state: 'TX',
  zip_code: '00000',
  county: null,
  country: 'US',
  phone: '555-0100',
  fax: null,
  email: 'test@facility.test',
  npi: '1234567890',
  tax_id: null,
  taxonomy_code: null,
  clia_number: null,
  medicare_provider_number: null,
  medicaid_provider_number: null,
  place_of_service_code: '21',
  is_active: true,
  is_primary: true,
  timezone: 'America/Chicago',
  bed_count: 50,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  created_by: null,
  ...overrides,
});

const FACILITY_ALPHA = makeFacility();

const FACILITY_BETA = makeFacility({
  id: 'fac-002',
  name: 'Test Facility Beta',
  facility_code: 'TFB-02',
  facility_type: 'clinic',
  city: 'Beta Town',
  state: 'CA',
  phone: '555-0200',
  email: 'beta@facility.test',
  npi: '0987654321',
  is_primary: false,
});

const FACILITY_INACTIVE = makeFacility({
  id: 'fac-003',
  name: 'Test Facility Gamma',
  facility_code: 'TFG-03',
  facility_type: 'urgent_care',
  city: 'Gamma Village',
  state: 'NY',
  phone: '555-0300',
  email: 'gamma@facility.test',
  npi: '1111111111',
  is_active: false,
  is_primary: false,
});

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaultMocks(facilities: Facility[] = [FACILITY_ALPHA, FACILITY_BETA]) {
  mockGetFacilities.mockResolvedValue({ success: true, data: facilities });
  mockGetAllFacilities.mockResolvedValue({
    success: true,
    data: [...facilities, FACILITY_INACTIVE],
  });
}

async function renderPanel() {
  const mod = await import('../FacilityManagementPanel');
  render(<mod.default />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('FacilityManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileTenantId = 'tenant-test-001';
    setupDefaultMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Loading state
  // --------------------------------------------------------------------------
  it('shows loading spinner with animate-spin class while fetching facilities', async () => {
    // Make getFacilities hang so loading state persists
    mockGetFacilities.mockReturnValue(new Promise(() => {}));

    await renderPanel();

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 2. Header title
  // --------------------------------------------------------------------------
  it('displays the "Facilities" heading after load', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3. Subtitle
  // --------------------------------------------------------------------------
  it('displays the management subtitle', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText('Manage hospitals, clinics, and other healthcare locations')
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Add Facility button
  // --------------------------------------------------------------------------
  it('renders the "Add Facility" button in the header', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Add Facility')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Facility name display
  // --------------------------------------------------------------------------
  it('displays each facility name in a card', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 6. Facility type label via getFacilityTypeLabel
  // --------------------------------------------------------------------------
  it('shows the facility type label derived from facility_type', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Hospital/)).toBeInTheDocument();
      expect(screen.getByText(/Clinic/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 7. Facility code display
  // --------------------------------------------------------------------------
  it('shows facility code on the card', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/TFA-01/)).toBeInTheDocument();
      expect(screen.getByText(/TFB-02/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 8. City/State display
  // --------------------------------------------------------------------------
  it('shows city and state for each facility', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test City, TX')).toBeInTheDocument();
      expect(screen.getByText('Beta Town, CA')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 9. Phone display
  // --------------------------------------------------------------------------
  it('shows phone number for facilities', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('555-0100')).toBeInTheDocument();
      expect(screen.getByText('555-0200')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 10. Email display
  // --------------------------------------------------------------------------
  it('shows email addresses for facilities', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('test@facility.test')).toBeInTheDocument();
      expect(screen.getByText('beta@facility.test')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 11. NPI display
  // --------------------------------------------------------------------------
  it('shows NPI numbers prefixed with "NPI:"', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('NPI: 1234567890')).toBeInTheDocument();
      expect(screen.getByText('NPI: 0987654321')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 12. Primary badge
  // --------------------------------------------------------------------------
  it('shows "Primary" badge for the primary facility', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 13. Inactive badge with opacity
  // --------------------------------------------------------------------------
  it('shows "Inactive" badge and applies opacity-60 for inactive facilities', async () => {
    setupDefaultMocks([FACILITY_INACTIVE]);

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    // The card container should have opacity-60
    const card = screen.getByText('Test Facility Gamma').closest('.bg-white');
    expect(card?.className).toContain('opacity-60');
  });

  // --------------------------------------------------------------------------
  // 14. Search filtering by name
  // --------------------------------------------------------------------------
  it('filters facilities by name when searching', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search facilities...');
    await user.type(searchInput, 'Beta');

    expect(screen.queryByText('Test Facility Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 15. Search filtering by city
  // --------------------------------------------------------------------------
  it('filters facilities by city when searching', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search facilities...');
    await user.type(searchInput, 'Beta Town');

    expect(screen.queryByText('Test Facility Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 16. Show inactive toggle calls getAllFacilities
  // --------------------------------------------------------------------------
  it('calls getAllFacilities when "Show inactive" checkbox is checked', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const showInactiveCheckbox = screen.getByLabelText('Show inactive');
    await user.click(showInactiveCheckbox);

    await waitFor(() => {
      expect(mockGetAllFacilities).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 17. Empty state message
  // --------------------------------------------------------------------------
  it('shows "No facilities found" when there are no facilities', async () => {
    setupDefaultMocks([]);

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('No facilities found')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 18. Empty state "Add your first facility" link
  // --------------------------------------------------------------------------
  it('shows "Add your first facility" link in empty state', async () => {
    setupDefaultMocks([]);

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Add your first facility')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 19. Modal opens with "Add Facility" title
  // --------------------------------------------------------------------------
  it('opens modal with "Add Facility" title when clicking the Add button', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));

    expect(screen.getByText('Add Facility', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('Create Facility')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 20. Modal opens with "Edit Facility" title when editing
  // --------------------------------------------------------------------------
  it('opens modal with "Edit Facility" title when clicking the Edit button', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Facility')).toBeInTheDocument();
    expect(screen.getByText('Update Facility')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 21. Form fields present in modal
  // --------------------------------------------------------------------------
  it('shows required form fields in the add modal', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));

    expect(screen.getByText('Facility Name *')).toBeInTheDocument();
    expect(screen.getByText('Facility Code')).toBeInTheDocument();
    expect(screen.getByText('Facility Type')).toBeInTheDocument();
    expect(screen.getByText('Primary facility')).toBeInTheDocument();
    expect(screen.getByText('Bed count:')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 22. Save validation -- empty name shows error
  // --------------------------------------------------------------------------
  it('shows "Facility name is required" when saving with empty name', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));
    await user.click(screen.getByText('Create Facility'));

    await waitFor(() => {
      expect(screen.getByText('Facility name is required')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 23. Save validation -- no tenant context error
  // --------------------------------------------------------------------------
  it('shows "No tenant context" error when tenant_id is not resolved', async () => {
    mockProfileTenantId = null;

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));

    const nameInput = screen.getByPlaceholderText('Houston Methodist Sugar Land');
    await user.type(nameInput, 'Test New Facility');

    await user.click(screen.getByText('Create Facility'));

    await waitFor(() => {
      expect(screen.getByText('No tenant context')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 24. Successful create calls createFacility
  // --------------------------------------------------------------------------
  it('calls FacilityService.createFacility with form data on successful save', async () => {
    mockCreateFacility.mockResolvedValue({
      success: true,
      data: makeFacility({ id: 'fac-new', name: 'Test New Facility' }),
    });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));

    const nameInput = screen.getByPlaceholderText('Houston Methodist Sugar Land');
    await user.type(nameInput, 'Test New Facility');

    await user.click(screen.getByText('Create Facility'));

    await waitFor(() => {
      expect(mockCreateFacility).toHaveBeenCalledTimes(1);
      const createArg = mockCreateFacility.mock.calls[0][0] as Record<string, unknown>;
      expect(createArg.name).toBe('Test New Facility');
      expect(createArg.tenant_id).toBe('tenant-test-001');
    });
  });

  // --------------------------------------------------------------------------
  // 25. Successful update calls updateFacility
  // --------------------------------------------------------------------------
  it('calls FacilityService.updateFacility with updated data when editing', async () => {
    mockUpdateFacility.mockResolvedValue({
      success: true,
      data: makeFacility({ name: 'Updated Facility Alpha' }),
    });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit Facility')).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Test Facility Alpha');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Facility Alpha');

    await user.click(screen.getByText('Update Facility'));

    await waitFor(() => {
      expect(mockUpdateFacility).toHaveBeenCalledTimes(1);
      expect(mockUpdateFacility).toHaveBeenCalledWith(
        'fac-001',
        expect.objectContaining({ name: 'Updated Facility Alpha' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 26. Deactivate calls confirm then deactivateFacility
  // --------------------------------------------------------------------------
  it('calls window.confirm then deactivateFacility when clicking Deactivate', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeactivateFacility.mockResolvedValue({ success: true, data: undefined });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
    });

    // Beta facility (non-primary, active) has a Deactivate button
    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deactivate')
    );

    await waitFor(() => {
      expect(mockDeactivateFacility).toHaveBeenCalledTimes(1);
    });

    confirmSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 26b. Deactivate does NOT call service when confirm is cancelled
  // --------------------------------------------------------------------------
  it('does not call deactivateFacility when confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
    });

    const deactivateButtons = screen.getAllByTitle('Deactivate');
    await user.click(deactivateButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDeactivateFacility).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  // --------------------------------------------------------------------------
  // 27. Reactivate calls reactivateFacility
  // --------------------------------------------------------------------------
  it('calls FacilityService.reactivateFacility when clicking Reactivate on inactive facility', async () => {
    setupDefaultMocks([FACILITY_INACTIVE]);
    mockReactivateFacility.mockResolvedValue({ success: true, data: undefined });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Gamma')).toBeInTheDocument();
    });

    const reactivateButton = screen.getByTitle('Reactivate');
    await user.click(reactivateButton);

    await waitFor(() => {
      expect(mockReactivateFacility).toHaveBeenCalledWith('fac-003');
    });
  });

  // --------------------------------------------------------------------------
  // 28. Set primary calls updateFacility with is_primary
  // --------------------------------------------------------------------------
  it('calls FacilityService.updateFacility with is_primary when clicking Set as primary', async () => {
    mockUpdateFacility.mockResolvedValue({
      success: true,
      data: makeFacility({ id: 'fac-002', is_primary: true }),
    });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
    });

    const setPrimaryButton = screen.getByTitle('Set as primary');
    await user.click(setPrimaryButton);

    await waitFor(() => {
      expect(mockUpdateFacility).toHaveBeenCalledWith('fac-002', { is_primary: true });
    });
  });

  // --------------------------------------------------------------------------
  // 29. Error banner shows service error
  // --------------------------------------------------------------------------
  it('shows error banner when FacilityService returns an error', async () => {
    mockGetFacilities.mockResolvedValue({
      success: false,
      error: { message: 'Database connection failed' },
    });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 30. Refresh button triggers loadFacilities
  // --------------------------------------------------------------------------
  it('calls loadFacilities again when clicking the Refresh button', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    // Clear calls from initial load
    mockGetFacilities.mockClear();

    const refreshButton = screen.getByTitle('Refresh');
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockGetFacilities).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // 31. Modal closes after successful create
  // --------------------------------------------------------------------------
  it('closes the modal and refreshes list after successful create', async () => {
    mockCreateFacility.mockResolvedValue({
      success: true,
      data: makeFacility({ id: 'fac-new', name: 'Test Created Facility' }),
    });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));
    expect(screen.getByText('Add Facility', { selector: 'h3' })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('Houston Methodist Sugar Land');
    await user.type(nameInput, 'Test Created Facility');
    await user.click(screen.getByText('Create Facility'));

    await waitFor(() => {
      // Modal title should be gone after close
      expect(screen.queryByText('Add Facility', { selector: 'h3' })).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 32. Edit modal pre-fills form with facility data
  // --------------------------------------------------------------------------
  it('pre-fills the edit form with the selected facility data', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle('Edit');
    await user.click(editButtons[0]);

    expect(screen.getByDisplayValue('Test Facility Alpha')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TFA-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test City')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TX')).toBeInTheDocument();
    expect(screen.getByDisplayValue('555-0100')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@facility.test')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 33. Cancel button closes modal without saving
  // --------------------------------------------------------------------------
  it('closes the modal without saving when clicking Cancel', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));
    expect(screen.getByText('Add Facility', { selector: 'h3' })).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Add Facility', { selector: 'h3' })).not.toBeInTheDocument();
    expect(mockCreateFacility).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // 34. Error banner from createFacility failure
  // --------------------------------------------------------------------------
  it('shows error banner when createFacility returns failure', async () => {
    mockCreateFacility.mockResolvedValue({
      success: false,
      error: { message: 'Duplicate facility code' },
    });

    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Facilities')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Facility'));

    const nameInput = screen.getByPlaceholderText('Houston Methodist Sugar Land');
    await user.type(nameInput, 'Test Duplicate Facility');
    await user.click(screen.getByText('Create Facility'));

    await waitFor(() => {
      expect(screen.getByText('Duplicate facility code')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 35. Search by facility code
  // --------------------------------------------------------------------------
  it('filters facilities by facility_code when searching', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Test Facility Alpha')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search facilities...');
    await user.type(searchInput, 'TFB-02');

    expect(screen.queryByText('Test Facility Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Test Facility Beta')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 36. "Add your first facility" opens modal
  // --------------------------------------------------------------------------
  it('opens the Add Facility modal when clicking "Add your first facility"', async () => {
    setupDefaultMocks([]);
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Add your first facility')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add your first facility'));

    expect(screen.getByText('Add Facility', { selector: 'h3' })).toBeInTheDocument();
  });
});
