/**
 * TenantBrandingManager tests — validates tenant selector, form population,
 * live preview, color validation, save/reset workflows, logo upload, and error states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ============================================================================
// MOCKS
// ============================================================================

const mockFetchAllActiveTenants = vi.fn();
const mockFetchTenantBrandingById = vi.fn();
const mockUpdateTenantBranding = vi.fn();
const mockUploadTenantLogo = vi.fn();
const mockGenerateGradient = vi.fn(
  (_p?: string, _s?: string) => 'linear-gradient(to bottom right, #003865, #8cc63f)'
);
const mockIsValidHexColor = vi.fn((_color?: string) => true);

vi.mock('../../../services/tenantBrandingService', () => ({
  fetchAllActiveTenants: (...args: unknown[]) =>
    mockFetchAllActiveTenants(...args),
  fetchTenantBrandingById: (...args: unknown[]) =>
    mockFetchTenantBrandingById(...args),
  updateTenantBranding: (...args: unknown[]) =>
    mockUpdateTenantBranding(...args),
  uploadTenantLogo: (...args: unknown[]) => mockUploadTenantLogo(...args),
  generateGradient: (p: string, s: string) => mockGenerateGradient(p, s),
  isValidHexColor: (c: string) => mockIsValidHexColor(c),
}));

// ============================================================================
// TEST FIXTURES — synthetic data only
// ============================================================================

const makeTenantList = () => [
  {
    id: 'tenant-001',
    name: 'Test Org Alpha',
    subdomain: 'alpha',
    appName: 'Alpha App',
    logoUrl: '',
    primaryColor: '#003865',
    secondaryColor: '#8cc63f',
    isActive: true,
  },
  {
    id: 'tenant-002',
    name: 'Test Org Beta',
    subdomain: 'beta',
    appName: 'Beta App',
    logoUrl: '',
    primaryColor: '#112233',
    secondaryColor: '#445566',
    isActive: true,
  },
];

const makeBranding = (overrides: Record<string, unknown> = {}) => ({
  id: 'tenant-001',
  name: 'Test Org Alpha',
  subdomain: 'alpha',
  appName: 'Alpha App',
  logoUrl: 'https://example.test/logo.png',
  primaryColor: '#003865',
  secondaryColor: '#8cc63f',
  accentColor: '#FF6B35',
  textColor: '#ffffff',
  gradient: 'linear-gradient(to bottom right, #003865, #8cc63f)',
  contactInfo: 'Test Contact Info',
  customFooter: 'Test Footer Text',
  isActive: true,
  ...overrides,
});

// ============================================================================
// HELPERS
// ============================================================================

function setupHappyPath() {
  mockFetchAllActiveTenants.mockResolvedValue(makeTenantList());
  mockFetchTenantBrandingById.mockResolvedValue(makeBranding());
  mockUpdateTenantBranding.mockResolvedValue({ success: true });
  mockUploadTenantLogo.mockResolvedValue({
    success: true,
    url: 'https://example.test/new-logo.png',
  });
  // Reset color validation — vi.clearAllMocks() does NOT restore mockImplementation
  mockIsValidHexColor.mockImplementation(() => true);
  mockGenerateGradient.mockImplementation(
    () => 'linear-gradient(to bottom right, #003865, #8cc63f)'
  );
}

async function renderComponent() {
  const mod = await import('../TenantBrandingManager');
  return render(<mod.default />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('TenantBrandingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // --------------------------------------------------------------------------
  // 1–2. Loading states
  // --------------------------------------------------------------------------

  it('shows loading spinner while tenants load', async () => {
    // Make tenant fetch hang so loading state is visible
    mockFetchAllActiveTenants.mockReturnValue(new Promise(() => {}));
    await renderComponent();

    expect(screen.getByText('Loading branding...')).toBeInTheDocument();
  });

  it('shows "Loading branding..." text during data fetch', async () => {
    mockFetchAllActiveTenants.mockReturnValue(new Promise(() => {}));
    await renderComponent();

    const loadingText = screen.getByText('Loading branding...');
    expect(loadingText).toBeInTheDocument();
    expect(loadingText.tagName).toBe('P');
  });

  // --------------------------------------------------------------------------
  // 3–4. Header content
  // --------------------------------------------------------------------------

  it('renders the "Tenant Branding Manager" title', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(
        screen.getByText('Tenant Branding Manager')
      ).toBeInTheDocument();
    });
  });

  it('renders the subtitle describing the panel purpose', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(
        screen.getByText(
          'Customize colors, logos, and themes for each tenant'
        )
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 5–6. Tenant selector
  // --------------------------------------------------------------------------

  it('populates tenant selector with all active tenants', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(
        screen.getByText('Test Org Alpha (alpha)')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Test Org Beta (beta)')
      ).toBeInTheDocument();
    });
  });

  it('auto-selects first tenant on mount and loads its branding', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(mockFetchTenantBrandingById).toHaveBeenCalledWith('tenant-001');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Form populated from branding data
  // --------------------------------------------------------------------------

  it('populates form fields with loaded branding data', async () => {
    await renderComponent();
    await waitFor(() => {
      const appNameInput = screen.getByPlaceholderText('WellFit Houston');
      expect(appNameInput).toHaveValue('Alpha App');

      const contactInput = screen.getByPlaceholderText(
        'Houston Senior Services'
      );
      expect(contactInput).toHaveValue('Test Contact Info');
    });
  });

  // --------------------------------------------------------------------------
  // 8–10. Live Preview section
  // --------------------------------------------------------------------------

  it('renders the "Live Preview" section heading', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Live Preview')).toBeInTheDocument();
    });
  });

  it('shows app name in live preview area', async () => {
    await renderComponent();
    await waitFor(() => {
      // The preview heading uses h2 with the app name
      const previewAppNames = screen.getAllByText('Alpha App');
      // Should appear in both the form and the preview
      expect(previewAppNames.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows contact info in live preview area', async () => {
    await renderComponent();
    await waitFor(() => {
      const contactTexts = screen.getAllByText('Test Contact Info');
      // Appears in both preview and form
      expect(contactTexts.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // 11–14. Color inputs
  // --------------------------------------------------------------------------

  it('renders Primary Color text input with loaded color value', async () => {
    await renderComponent();
    await waitFor(() => {
      const primaryInputs = screen.getAllByPlaceholderText('#003865');
      // There is a text input with this placeholder
      expect(primaryInputs.length).toBeGreaterThanOrEqual(1);
      expect(primaryInputs[0]).toHaveValue('#003865');
    });
  });

  it('renders Secondary Color text input with loaded color value', async () => {
    await renderComponent();
    await waitFor(() => {
      const secondaryInputs = screen.getAllByPlaceholderText('#8cc63f');
      expect(secondaryInputs.length).toBeGreaterThanOrEqual(1);
      expect(secondaryInputs[0]).toHaveValue('#8cc63f');
    });
  });

  it('renders Accent Color text input with loaded color value', async () => {
    await renderComponent();
    await waitFor(() => {
      const accentInputs = screen.getAllByPlaceholderText('#FF6B35');
      expect(accentInputs.length).toBeGreaterThanOrEqual(1);
      expect(accentInputs[0]).toHaveValue('#FF6B35');
    });
  });

  it('renders Text Color text input with loaded color value', async () => {
    await renderComponent();
    await waitFor(() => {
      const textColorInputs = screen.getAllByPlaceholderText('#ffffff');
      expect(textColorInputs.length).toBeGreaterThanOrEqual(1);
      expect(textColorInputs[0]).toHaveValue('#ffffff');
    });
  });

  // --------------------------------------------------------------------------
  // 15–17. Text form fields
  // --------------------------------------------------------------------------

  it('renders Application Name input and allows changes', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('WellFit Houston')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('WellFit Houston');
    fireEvent.change(input, { target: { value: 'New App Name' } });
    expect(input).toHaveValue('New App Name');
  });

  it('renders Contact Information input and allows changes', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Houston Senior Services')
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Houston Senior Services');
    fireEvent.change(input, { target: { value: 'Updated Contact' } });
    expect(input).toHaveValue('Updated Contact');
  });

  it('renders Custom Footer Text textarea with loaded value', async () => {
    await renderComponent();
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(
        /Powered by Houston Senior Services/
      );
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('Test Footer Text');
    });
  });

  // --------------------------------------------------------------------------
  // 18. Logo Upload
  // --------------------------------------------------------------------------

  it('renders Logo Upload file input accepting image types', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Logo Upload')).toBeInTheDocument();
    });

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe('image/png,image/jpeg,image/svg+xml');
  });

  // --------------------------------------------------------------------------
  // 19–21. Color validation errors
  // --------------------------------------------------------------------------

  it('shows error for invalid primary color on save', async () => {
    // isValidHexColor returns false for primary, true for secondary
    mockIsValidHexColor.mockImplementation((color: unknown) => {
      if (color === '#003865') return false;
      return true;
    });
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Invalid primary color format. Use hex format like #003865'
        )
      ).toBeInTheDocument();
    });
  });

  it('shows error for invalid secondary color on save', async () => {
    // First call (primary) passes, second call (secondary) fails
    let callCount = 0;
    mockIsValidHexColor.mockImplementation(() => {
      callCount += 1;
      // First call is primary -> valid, second call is secondary -> invalid
      return callCount !== 2;
    });

    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Invalid secondary color format. Use hex format like #8cc63f'
        )
      ).toBeInTheDocument();
    });
  });

  it('shows error for invalid accent color on save', async () => {
    // Primary and secondary pass, accent fails
    let callCount = 0;
    mockIsValidHexColor.mockImplementation(() => {
      callCount += 1;
      // Calls 1-2 pass (primary, secondary), call 3 (accent) fails
      return callCount <= 2;
    });

    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Invalid accent color format. Use hex format like #FF6B35'
        )
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 22–23. Successful save
  // --------------------------------------------------------------------------

  it('shows success message after saving branding', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(
        screen.getByText('Branding updated successfully!')
      ).toBeInTheDocument();
    });
  });

  it('calls updateTenantBranding with form data on save', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(mockUpdateTenantBranding).toHaveBeenCalledWith(
        'tenant-001',
        expect.objectContaining({
          appName: 'Alpha App',
          primaryColor: '#003865',
          secondaryColor: '#8cc63f',
          textColor: '#ffffff',
          contactInfo: 'Test Contact Info',
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 24. Logo upload during save
  // --------------------------------------------------------------------------

  it('calls uploadTenantLogo when a file is selected before save', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    // Simulate file selection
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const testFile = new File(['test-content'], 'test-logo.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(mockUploadTenantLogo).toHaveBeenCalledWith(
        'tenant-001',
        expect.any(File)
      );
    });
  });

  // --------------------------------------------------------------------------
  // 25–26. Error states during save
  // --------------------------------------------------------------------------

  it('shows error when logo upload fails', async () => {
    mockUploadTenantLogo.mockResolvedValue({
      success: false,
      error: 'Upload quota exceeded',
    });

    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    // Select a file to trigger upload path
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const testFile = new File(['data'], 'logo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(screen.getByText('Upload quota exceeded')).toBeInTheDocument();
    });
  });

  it('shows error when updateTenantBranding fails', async () => {
    mockUpdateTenantBranding.mockResolvedValue({
      success: false,
      error: 'Database write failed',
    });

    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(screen.getByText('Database write failed')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 27. Saving state
  // --------------------------------------------------------------------------

  it('shows "Saving..." on the button during save operation', async () => {
    // Make updateTenantBranding hang to keep saving state
    mockUpdateTenantBranding.mockReturnValue(new Promise(() => {}));

    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 28. Reset button
  // --------------------------------------------------------------------------

  it('reloads branding for current tenant when Reset is clicked', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    // Clear the mock to count fresh calls
    mockFetchTenantBrandingById.mockClear();
    mockFetchTenantBrandingById.mockResolvedValue(makeBranding());

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(mockFetchTenantBrandingById).toHaveBeenCalledWith('tenant-001');
    });
  });

  // --------------------------------------------------------------------------
  // 29. Tenant switching
  // --------------------------------------------------------------------------

  it('loads new branding when a different tenant is selected', async () => {
    const betaBranding = makeBranding({
      id: 'tenant-002',
      name: 'Test Org Beta',
      subdomain: 'beta',
      appName: 'Beta App',
      contactInfo: 'Beta Contact Info',
    });

    await renderComponent();
    // Wait for form to load (branding populated)
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    mockFetchTenantBrandingById.mockResolvedValue(betaBranding);

    // Switch to the second tenant via the select dropdown
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    fireEvent.change(select, { target: { value: 'tenant-002' } });

    await waitFor(() => {
      expect(mockFetchTenantBrandingById).toHaveBeenCalledWith('tenant-002');
    });

    await waitFor(() => {
      const appNameInput = screen.getByPlaceholderText('WellFit Houston');
      expect(appNameInput).toHaveValue('Beta App');
    });
  });

  // --------------------------------------------------------------------------
  // 30. Save without logo file skips upload
  // --------------------------------------------------------------------------

  it('does not call uploadTenantLogo when no file is selected', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Save Branding')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save Branding'));

    await waitFor(() => {
      expect(mockUpdateTenantBranding).toHaveBeenCalled();
    });

    expect(mockUploadTenantLogo).not.toHaveBeenCalled();
  });
});
