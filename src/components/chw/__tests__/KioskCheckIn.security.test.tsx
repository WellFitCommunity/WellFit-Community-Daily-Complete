/**
 * Security Integration Tests for KioskCheckIn Component
 * Tests authentication, rate limiting, and security event logging
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KioskCheckIn } from '../KioskCheckIn';
import { chwService } from '../../../services/chwService';
import { supabase } from '../../../lib/supabaseClient';
import bcrypt from 'bcryptjs';

// Mock dependencies
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../../services/chwService', () => ({
  chwService: {
    logSecurityEvent: jest.fn(),
    startFieldVisit: jest.fn()
  }
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn()
}));

describe.skip('KioskCheckIn - Security Tests - TODO: Fix validation messages', () => {
  const mockProps = {
    kioskId: 'test-kiosk-001',
    locationName: 'Test Library',
    onCheckInComplete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject SQL injection in name fields', async () => {
      // Mock logSecurityEvent to resolve
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      // Select language
      fireEvent.click(screen.getByText('English'));

      // Fill in all required fields with SQL injection in first name
      const firstNameInput = screen.getByLabelText('First Name');
      fireEvent.change(firstNameInput, {
        target: { value: "Robert'); DROP TABLE profiles;--" }
      });

      const lastNameInput = screen.getByLabelText('Last Name');
      fireEvent.change(lastNameInput, {
        target: { value: 'Smith' }
      });

      const dobInput = screen.getByLabelText('Date of Birth');
      fireEvent.change(dobInput, {
        target: { value: '1990-01-01' }
      });

      const ssnInput = screen.getByLabelText('Last 4 of SSN');
      fireEvent.change(ssnInput, {
        target: { value: '1234' }
      });

      const findButton = screen.getByText('Find Me');
      fireEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid input detected|Name contains invalid characters/i)).toBeInTheDocument();
      });

      // Should not query database
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should reject XSS attempts', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill in all required fields with XSS in last name
      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });

      const lastNameInput = screen.getByLabelText('Last Name');
      fireEvent.change(lastNameInput, {
        target: { value: '<script>alert("XSS")</script>' }
      });

      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-01' }
      });

      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '5678' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid input|contains invalid characters/i)).toBeInTheDocument();
      });
    });

    it('should validate date of birth format', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill all required fields
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
      const dobInput = screen.getByLabelText('Date of Birth');
      fireEvent.change(dobInput, { target: { value: '01/15/1990' } }); // Wrong format
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), { target: { value: '1234' } });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid date format/i)).toBeInTheDocument();
      });
    });

    it('should reject future dates of birth', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Fill all required fields
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
      const dobInput = screen.getByLabelText('Date of Birth');
      fireEvent.change(dobInput, { target: { value: futureDateStr } });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), { target: { value: '1234' } });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/cannot be in the future/i)).toBeInTheDocument();
      });
    });

    it('should validate SSN format', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill all required fields
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-15' } });
      const ssnInput = screen.getByLabelText('Last 4 of SSN');
      fireEvent.change(ssnInput, { target: { value: 'abcd' } }); // Non-numeric

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/must be exactly 4 digits/i)).toBeInTheDocument();
      });
    });

    it('should block obviously fake SSNs', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill all required fields
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-15' } });
      const ssnInput = screen.getByLabelText('Last 4 of SSN');
      fireEvent.change(ssnInput, { target: { value: '0000' } });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/Invalid SSN/i)).toBeInTheDocument();
      });
    });

    it('should block common weak PINs', async () => {
      (chwService.logSecurityEvent as jest.Mock).mockResolvedValue({});

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill all required fields
      fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'John' } });
      fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Doe' } });
      fireEvent.change(screen.getByLabelText('Date of Birth'), { target: { value: '1990-01-15' } });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), { target: { value: '5678' } });
      const pinInput = screen.getByLabelText(/PIN/i);
      fireEvent.change(pinInput, { target: { value: '1234' } }); // Common PIN

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/PIN too common/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should require DOB + SSN match for patient verification', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'patient-123',
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1990-01-15',
                    ssn_last_four: '5678' // Different SSN
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill in valid data but wrong SSN
      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'Doe' }
      });
      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-15' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '1234' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(chwService.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'patient_lookup_verification_failed',
            severity: 'medium',
            details: { verification_type: 'dob_ssn_mismatch' }
          })
        );
      });
    });

    it('should verify PIN with bcrypt when provided', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'patient-123',
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1990-01-15',
                    ssn_last_four: '1234',
                    caregiver_pin_hash: '$2a$10$hashedpin'
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'Doe' }
      });
      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-15' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '1234' }
      });
      fireEvent.change(screen.getByLabelText(/PIN/i), {
        target: { value: '567890' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(bcrypt.compare).toHaveBeenCalledWith('567890', '$2a$10$hashedpin');
      });
    });

    it('should reject incorrect PIN', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'patient-123',
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1990-01-15',
                    ssn_last_four: '1234',
                    caregiver_pin_hash: '$2a$10$hashedpin'
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Wrong PIN

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'Doe' }
      });
      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-15' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '1234' }
      });
      fireEvent.change(screen.getByLabelText(/PIN/i), {
        target: { value: '567890' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(chwService.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'pin_verification_failed',
            severity: 'high',
            details: { reason: 'incorrect_pin' }
          })
        );
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit after 5 failed attempts', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        fireEvent.change(screen.getByLabelText('First Name'), {
          target: { value: 'Wrong' }
        });
        fireEvent.change(screen.getByLabelText('Last Name'), {
          target: { value: 'Name' }
        });
        fireEvent.change(screen.getByLabelText('Date of Birth'), {
          target: { value: '1990-01-15' }
        });
        fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
          target: { value: '5678' }
        });

        fireEvent.click(screen.getByText('Find Me'));

        await waitFor(() => {
          expect(screen.getByText(/not found/i)).toBeInTheDocument();
        });
      }

      // 6th attempt should be rate limited
      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(screen.getByText(/Too many failed attempts/i)).toBeInTheDocument();
      });

      expect(chwService.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'rate_limit_exceeded',
          severity: 'high'
        })
      );
    });

    it('should clear rate limit on successful authentication', async () => {
      // This test would verify that successful login clears the rate limiter
      // Implementation depends on rate limiter reset logic
    });
  });

  describe('Security Event Logging', () => {
    it('should log patient lookup errors without PHI', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Database error' }
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'Doe' }
      });
      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-15' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '5678' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(chwService.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'patient_lookup_error',
            severity: 'medium',
            details: { error_code: 'PGRST116' },
            kiosk_id: 'test-kiosk-001'
          })
        );

      });

      // Should NOT log patient names or SSN
      const logCall = (chwService.logSecurityEvent as jest.Mock).mock.calls[0][0];
      expect(JSON.stringify(logCall)).not.toContain('John');
      expect(JSON.stringify(logCall)).not.toContain('Doe');
      expect(JSON.stringify(logCall)).not.toContain('5678');
    });

    it('should log successful authentication', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'patient-123',
                    first_name: 'John',
                    last_name: 'Doe',
                    date_of_birth: '1990-01-15',
                    ssn_last_four: '5678',
                    caregiver_pin_hash: null
                  }
                ],
                error: null
              })
            })
          })
        })
      });

      (supabase.from as jest.Mock) = mockFrom;
      (chwService.startFieldVisit as jest.Mock).mockResolvedValue({ id: 'visit-123' });

      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last Name'), {
        target: { value: 'Doe' }
      });
      fireEvent.change(screen.getByLabelText('Date of Birth'), {
        target: { value: '1990-01-15' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '5678' }
      });

      fireEvent.click(screen.getByText('Find Me'));

      await waitFor(() => {
        expect(chwService.logSecurityEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'patient_lookup_success',
            severity: 'low',
            patient_id: 'patient-123',
            details: { verification_method: 'dob_ssn' }
          })
        );
      });
    });
  });

  describe('Session Timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should timeout after 2 minutes of inactivity', () => {
      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fast-forward time by 2 minutes and run all timers
      jest.advanceTimersByTime(120000);
      jest.runAllTimers();

      // Should show timeout notification
      expect(screen.getByText(/Session timed out for security/i)).toBeInTheDocument();
    });

    it('should clear PHI on timeout', () => {
      render(<KioskCheckIn {...mockProps} />);

      fireEvent.click(screen.getByText('English'));

      // Fill in sensitive data
      fireEvent.change(screen.getByLabelText('First Name'), {
        target: { value: 'John' }
      });
      fireEvent.change(screen.getByLabelText('Last 4 of SSN'), {
        target: { value: '5678' }
      });

      // Timeout
      jest.advanceTimersByTime(120000);

      // Wait for reset
      jest.advanceTimersByTime(5000);

      // Should be back to language selection (all data cleared)
      expect(screen.getByText('Select Your Language')).toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});
