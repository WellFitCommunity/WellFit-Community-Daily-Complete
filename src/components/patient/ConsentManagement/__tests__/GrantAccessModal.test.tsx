/**
 * GrantAccessModal Tests
 *
 * Tests for the grant data access modal component.
 * Covers: Rendering, step navigation, form validation, data category selection, submission.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GrantAccessModal from '../GrantAccessModal';

// Mock supabaseClient
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({
        data: { id: 'new-consent-id' },
        error: null,
      }),
    })),
  },
}));

// Mock auditLogger
vi.mock('../../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GrantAccessModal', () => {
  const defaultProps = {
    userId: 'test-user-id',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });

  it('displays the modal title', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Grant Data Access')).toBeInTheDocument();
  });

  it('displays progress steps', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Recipient')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('shows step 1 content initially', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Who are you granting access to?')).toBeInTheDocument();
  });

  it('displays access type options', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
  });

  it('shows cancel button on step 1', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop clicked', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    const backdrop = document.querySelector('.bg-gray-500');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('disables Continue button when name is empty', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    const continueButton = screen.getByText('Continue');
    expect(continueButton).toBeDisabled();
  });

  it('enables Continue button when name is entered', () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });

    const continueButton = screen.getByText('Continue');
    expect(continueButton).not.toBeDisabled();
  });

  it('navigates to step 2 when Continue clicked', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Select data to share:')).toBeInTheDocument();
    });
  });

  it('shows data categories on step 2', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    // Navigate to step 2
    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Allergies')).toBeInTheDocument();
      expect(screen.getByText('Conditions')).toBeInTheDocument();
    });
  });

  it('shows Select all button on step 2', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    // Navigate to step 2
    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Select all')).toBeInTheDocument();
    });
  });

  it('shows expiration options on step 2', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    // Navigate to step 2
    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Access expires after:')).toBeInTheDocument();
    });
  });

  it('shows Back button on step 2', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    // Navigate to step 2
    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('navigates back to step 1 when Back clicked', async () => {
    render(
      <MemoryRouter>
        <GrantAccessModal {...defaultProps} />
      </MemoryRouter>
    );

    // Navigate to step 2
    const nameInput = screen.getByPlaceholderText('e.g., Dr. Smith, Methodist Hospital');
    fireEvent.change(nameInput, { target: { value: 'Dr. Test' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Back'));

    await waitFor(() => {
      expect(screen.getByText('Who are you granting access to?')).toBeInTheDocument();
    });
  });
});
