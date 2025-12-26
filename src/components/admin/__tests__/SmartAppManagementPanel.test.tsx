/**
 * SmartAppManagementPanel Tests
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SmartAppManagementPanel from '../SmartAppManagementPanel';
import { vi } from 'vitest';

// Mock supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
    },
  },
}));

describe('SmartAppManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the panel with header', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('SMART on FHIR Apps')).toBeInTheDocument();
    });
  });

  it('should show register app button', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });
  });

  it('should show empty state when no apps', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('No apps found')).toBeInTheDocument();
    });
  });

  it('should show filter dropdowns', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('All Statuses')).toBeInTheDocument();
      expect(screen.getByText('All Types')).toBeInTheDocument();
    });
  });

  it('should show stats cards', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Approved Apps')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('Active Authorizations')).toBeInTheDocument();
      expect(screen.getByText('Total Authorizations')).toBeInTheDocument();
    });
  });

  it('should open registration modal on button click', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Register SMART App')).toBeInTheDocument();
    });
  });

  it('should show required fields in registration modal', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('App Name *')).toBeInTheDocument();
      expect(screen.getByText('App Type')).toBeInTheDocument();
      expect(screen.getByText('Redirect URIs *')).toBeInTheDocument();
    });
  });

  it('should show scope options in registration modal', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Allowed Scopes')).toBeInTheDocument();
      expect(screen.getByText('OpenID Connect')).toBeInTheDocument();
      expect(screen.getByText('FHIR User')).toBeInTheDocument();
    });
  });

  it('should show developer contact section', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Developer Contact')).toBeInTheDocument();
    });
  });

  it('should close modal on cancel', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Register SMART App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Register SMART App')).not.toBeInTheDocument();
    });
  });
});
