// src/components/user/__tests__/DataManagementPanel.test.tsx
// Tests for the DataManagementPanel - patient data export and account management

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataManagementPanel from '../DataManagementPanel';
import { supabase } from '../../../lib/supabaseClient';

// Mock supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      signOut: vi.fn(),
    },
  },
}));

// Mock window.open for PDF export
const mockWindowOpen = vi.fn();
const originalOpen = window.open;

// Mock URL methods
const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
const mockRevokeObjectURL = vi.fn();
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

// Mock alert
const mockAlert = vi.fn();
const originalAlert = window.alert;

describe('DataManagementPanel', () => {
  const mockDataStatus = {
    dataSummary: {
      checkIns: 45,
      communityMoments: 12,
      alerts: 3,
      profileStatus: 'complete',
      accountCreated: '2024-01-15T00:00:00Z',
      consentGiven: true,
    },
    totalRecords: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
    window.alert = mockAlert;
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    // Default: status loads successfully
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockDataStatus,
      error: null,
    });
  });

  afterEach(() => {
    window.open = originalOpen;
    window.alert = originalAlert;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('Rendering', () => {
    it('should render the main heading', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Your Data & Privacy Controls/i)).toBeInTheDocument();
      });
    });

    it('should render all three export format buttons', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('PDF Summary')).toBeInTheDocument();
        expect(screen.getByText('C-CDA Record')).toBeInTheDocument();
        expect(screen.getByText('JSON Data')).toBeInTheDocument();
      });
    });

    it('should render the 21st Century Cures Act notice', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Your Right to Your Data/i)).toBeInTheDocument();
        expect(screen.getByText(/21st Century Cures Act/i)).toBeInTheDocument();
      });
    });

    it('should render delete account section', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete My Account/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading text while fetching data status', async () => {
      // Make the promise hang
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockImplementation(
        () => new Promise(() => {})
      );

      render(<DataManagementPanel />);

      expect(screen.getByText(/Loading your data information/i)).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display data summary when loaded', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('45')).toBeInTheDocument(); // checkIns
        expect(screen.getByText('12')).toBeInTheDocument(); // communityMoments
        expect(screen.getByText('3')).toBeInTheDocument();  // alerts
      });
    });

    it('should display account creation date', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Account created:/i)).toBeInTheDocument();
      });
    });

    it('should display consent status', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Consent status: Given/i)).toBeInTheDocument();
      });
    });

    it('should display total records count', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText(/Total records: 60/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when data status fails to load', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to load data status. Please try again.');
      });
    });

    it('should show error alert when JSON export fails', async () => {
      // First call succeeds (status), second fails (export)
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Export failed' } });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Download JSON')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download JSON'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to export data. Please try again.');
      });
    });

    it('should show error alert when PDF export fails', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'PDF failed' } });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Print/Save PDF')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Print/Save PDF'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to generate PDF. Please try again.');
      });
    });

    it('should show error alert when C-CDA export fails', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'C-CDA failed' } });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Download C-CDA')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download C-CDA'));

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to export C-CDA. Please try again.');
      });
    });
  });

  describe('Export Functionality', () => {
    it('should invoke JSON export when clicking Download JSON', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: { profile: {}, checkIns: [] }, error: null });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Download JSON')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download JSON'));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('user-data-management', {
          body: { action: 'export' },
        });
      });
    });

    it('should invoke PDF export when clicking Print/Save PDF', async () => {
      mockWindowOpen.mockReturnValue({
        document: {
          write: vi.fn(),
          close: vi.fn(),
        },
        onload: null,
        print: vi.fn(),
      });

      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: { html: '<html></html>' }, error: null });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Print/Save PDF')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Print/Save PDF'));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('pdf-health-summary', {});
      });
    });

    it('should invoke C-CDA export when clicking Download C-CDA', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: { xml: '<?xml version="1.0"?>' }, error: null });

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Download C-CDA')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download C-CDA'));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('ccda-export', {});
      });
    });

    it('should disable all export buttons while one export is in progress', async () => {
      // Make export hang
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockImplementationOnce(() => new Promise(() => {}));

      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Download JSON')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Download JSON'));

      await waitFor(() => {
        // All buttons should be disabled
        const pdfButton = screen.getByText('Print/Save PDF').closest('button');
        const ccdaButton = screen.getByText('Download C-CDA').closest('button');
        expect(pdfButton).toBeDisabled();
        expect(ccdaButton).toBeDisabled();
      });
    });
  });

  describe('Account Deletion', () => {
    it('should show confirmation dialog when clicking delete button', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Delete My Account/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('DELETE MY ACCOUNT')).toBeInTheDocument();
      });
    });

    it('should show warning list in deletion confirmation', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Your profile and personal information/i)).toBeInTheDocument();
        expect(screen.getByText(/All health check-ins and vital signs/i)).toBeInTheDocument();
        expect(screen.getByText(/Community posts and photos you've shared/i)).toBeInTheDocument();
      });
    });

    it('should require exact confirmation text for deletion', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));
      });

      const input = await screen.findByPlaceholderText('DELETE MY ACCOUNT');
      const deleteButton = screen.getByRole('button', { name: /Permanently Delete Account/i });

      // Type wrong text
      fireEvent.change(input, { target: { value: 'delete' } });
      expect(deleteButton).toBeDisabled();

      // Type correct text
      fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });
      expect(deleteButton).not.toBeDisabled();
    });

    it('should hide confirmation dialog when clicking cancel', async () => {
      render(<DataManagementPanel />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));
      });

      await waitFor(() => {
        expect(screen.getByText(/Confirm Account Deletion/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Confirm Account Deletion/i)).not.toBeInTheDocument();
      });
    });

    it('should invoke delete endpoint when confirmed', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockDataStatus, error: null })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      (supabase.auth.signOut as ReturnType<typeof vi.fn>).mockResolvedValue({});

      // Mock location
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { href: '' },
        writable: true,
      });

      render(<DataManagementPanel />);

      await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: /Delete My Account/i }));
      });

      const input = await screen.findByPlaceholderText('DELETE MY ACCOUNT');
      fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

      fireEvent.click(screen.getByRole('button', { name: /Permanently Delete Account/i }));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('user-data-management', {
          body: { action: 'delete', confirmDeletion: true },
        });
      });

      // Restore location
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
      });
    });
  });
});
