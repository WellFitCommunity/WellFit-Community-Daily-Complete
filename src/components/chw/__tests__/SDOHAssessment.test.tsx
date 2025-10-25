/**
 * SDOH Assessment Component Tests
 * Tests PRAPARE-compliant social determinants screening, risk scoring, HIPAA compliance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SDOHAssessment } from '../SDOHAssessment';
import { chwService } from '../../../services/chwService';

jest.mock('../../../services/chwService');

describe('SDOHAssessment', () => {
  const mockProps = {
    visitId: 'visit-123',
    language: 'en' as const,
    onComplete: jest.fn(),
    onBack: jest.fn(),
    onSkip: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PRAPARE Questions Rendering', () => {
    it('should render all PRAPARE social determinants questions', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Check for section headers
      expect(screen.getByRole('heading', { name: /food/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /housing/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /transportation/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /utilities/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /safety/i })).toBeInTheDocument();
    });

    it('should use clear, patient-friendly language', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Should not use technical jargon
      expect(screen.getByText(/In the past year, have you worried about food/i)).toBeInTheDocument();
    });
  });

  describe('Food Insecurity Questions', () => {
    it('should ask about food insecurity', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/worried about food running out/i)).toBeInTheDocument();
    });

    it('should ask about food worry as separate question', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/food you bought not last.*didn't have money/i)).toBeInTheDocument();
    });

    it('should allow yes/no answers for food questions', () => {
      render(<SDOHAssessment {...mockProps} />);

      const yesButton = screen.getAllByRole('button', { name: /yes/i })[0];
      const noButton = screen.getAllByRole('button', { name: /no/i })[0];

      expect(yesButton).toBeInTheDocument();
      expect(noButton).toBeInTheDocument();
    });
  });

  describe('Housing Questions', () => {
    it('should ask about housing status', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/housing situation/i)).toBeInTheDocument();
    });

    it('should provide multiple housing status options', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByRole('button', { name: /I own my home/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /I rent/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Temporary housing/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /No stable housing/i })).toBeInTheDocument();
    });

    it('should ask about housing worry/instability', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/worried about losing your housing/i)).toBeInTheDocument();
    });
  });

  describe('Safety Questions', () => {
    it('should ask about safety concerns with sensitive language', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/feel safe/i)).toBeInTheDocument();
    });

    it('should indicate confidentiality for safety questions', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/answers are confidential/i)).toBeInTheDocument();
    });
  });

  describe('Response Collection', () => {
    it('should allow answering all questions', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Answer food insecurity question
      const foodYes = screen.getAllByRole('button', { name: /yes/i })[0];
      fireEvent.click(foodYes);

      expect(foodYes.className).toContain('selected');
    });

    it('should track all responses', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Answer multiple questions
      const allYesButtons = screen.getAllByRole('button', { name: /yes/i });

      allYesButtons.forEach(button => {
        fireEvent.click(button);
      });

      // All should be tracked
      allYesButtons.forEach(button => {
        expect(button.className).toContain('selected');
      });
    });

    it('should allow changing answers', () => {
      render(<SDOHAssessment {...mockProps} />);

      const yesButton = screen.getAllByRole('button', { name: /yes/i })[0];
      const noButton = screen.getAllByRole('button', { name: /no/i })[0];

      // Select yes
      fireEvent.click(yesButton);
      expect(yesButton.className).toContain('selected');

      // Change to no
      fireEvent.click(noButton);
      expect(noButton.className).toContain('selected');
      expect(yesButton.className).not.toContain('selected');
    });
  });

  describe('Form Submission', () => {
    it('should require all questions to be answered', () => {
      render(<SDOHAssessment {...mockProps} />);

      const submitButton = screen.getByText(/Complete Assessment/i);
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit when all questions answered', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      const housingButton = screen.getByRole('button', { name: /I own my home/i });
      fireEvent.click(housingButton);

      // Answer social isolation
      const neverButton = screen.getByRole('button', { name: /^Never$/i });
      fireEvent.click(neverButton);

      const submitButton = screen.getByText(/Complete Assessment/i);
      expect(submitButton).not.toBeDisabled();
    });

    it('should call chwService.recordSDOHAssessment on submission', async () => {
      (chwService.recordSDOHAssessment as jest.Mock).mockResolvedValue(undefined);

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        expect(chwService.recordSDOHAssessment).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            assessed_at: expect.any(String),
          })
        );
      }, { timeout: 2000 });
    });

    it('should call onComplete after successful submission', async () => {
      (chwService.recordSDOHAssessment as jest.Mock).mockResolvedValue(undefined);

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Risk Indication', () => {
    it('should show risk indicator when high-risk factors present', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Select high-risk answers
      const allYesButtons = screen.getAllByRole('button', { name: /yes/i });
      // Answer yes to food worry, food insecurity, housing worry, transportation, utility
      allYesButtons.slice(0, 5).forEach(button => fireEvent.click(button));

      // Answer safety as no (not feeling safe = high risk)
      const safetyNo = allYesButtons[5] ? screen.getAllByRole('button', { name: /no/i })[5] : null;
      if (safetyNo) fireEvent.click(safetyNo);

      // Complete remaining required fields
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Always$/i }));

      expect(screen.getByText(/High Risk/i)).toBeInTheDocument();
    });

    it('should calculate and display risk score', () => {
      render(<SDOHAssessment {...mockProps} />);

      // Answer questions to create moderate risk
      const someYesButtons = screen.getAllByRole('button', { name: /yes/i }).slice(0, 3);
      someYesButtons.forEach(button => fireEvent.click(button));

      // Complete remaining required answers
      const remainingNo = screen.getAllByRole('button', { name: /no/i }).slice(3);
      remainingNo.forEach(button => fireEvent.click(button));

      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      expect(screen.getByText(/Risk Score/i)).toBeInTheDocument();
      expect(screen.getByText(/\d+\/10/)).toBeInTheDocument();
    });
  });

  describe('Optional Notes Field', () => {
    it('should provide a notes field for additional context', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByLabelText(/Additional Notes/i)).toBeInTheDocument();
    });

    it('should include notes in submission', async () => {
      (chwService.recordSDOHAssessment as jest.Mock).mockResolvedValue(undefined);

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      // Add notes
      const notesField = screen.getByLabelText(/Additional Notes/i);
      fireEvent.change(notesField, { target: { value: 'Patient mentioned job loss' } });

      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        expect(chwService.recordSDOHAssessment).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            notes: 'Patient mentioned job loss',
          })
        );
      }, { timeout: 2000 });
    });
  });

  describe('Offline Support', () => {
    it('should work in offline mode', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();

      // Should still allow answering questions
      const yesButton = screen.getAllByRole('button', { name: /yes/i })[0];
      fireEvent.click(yesButton);

      expect(yesButton.className).toContain('selected');
    });
  });

  describe('Bilingual Support', () => {
    it('should support Spanish language option', () => {
      render(<SDOHAssessment {...mockProps} language="es" />);

      // Check for Spanish section headers
      expect(screen.getByRole('heading', { name: /alimentos/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /vivienda/i })).toBeInTheDocument();
    });

    it('should maintain question integrity across languages', () => {
      const { rerender } = render(<SDOHAssessment {...mockProps} language="en" />);

      const englishQuestionCount = screen.getAllByRole('button', { name: /yes/i }).length;

      rerender(<SDOHAssessment {...mockProps} language="es" />);

      const spanishQuestionCount = screen.getAllByRole('button', { name: /sí/i }).length;

      expect(englishQuestionCount).toBe(spanishQuestionCount);
    });
  });

  describe('Privacy and HIPAA Compliance', () => {
    it('should display privacy notice', () => {
      render(<SDOHAssessment {...mockProps} />);

      expect(screen.getByText(/information is confidential/i)).toBeInTheDocument();
    });

    it('should include timestamp for audit trail', async () => {
      (chwService.recordSDOHAssessment as jest.Mock).mockResolvedValue(undefined);

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        expect(chwService.recordSDOHAssessment).toHaveBeenCalledWith(
          'visit-123',
          expect.objectContaining({
            assessed_at: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          })
        );
      }, { timeout: 2000 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all questions', () => {
      render(<SDOHAssessment {...mockProps} />);

      const buttons = screen.getAllByRole('button', { name: /yes|no/i });
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('should support keyboard navigation', () => {
      render(<SDOHAssessment {...mockProps} />);

      const firstButton = screen.getAllByRole('button', { name: /yes|no/i })[0];
      firstButton.focus();

      expect(document.activeElement).toBe(firstButton);
    });
  });

  describe('Error Handling', () => {
    it('should display error if submission fails', async () => {
      (chwService.recordSDOHAssessment as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        const errorContainer = screen.getByText(/Failed to save assessment/i).parentElement;
        expect(errorContainer).toHaveTextContent(/Please try again/i);
      }, { timeout: 2000 });
    });

    it('should allow retry after error', async () => {
      (chwService.recordSDOHAssessment as jest.Mock)
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(undefined);

      render(<SDOHAssessment {...mockProps} />);

      // Answer all yes/no questions
      const allNoButtons = screen.getAllByRole('button', { name: /no/i });
      allNoButtons.forEach(button => fireEvent.click(button));

      // Answer housing status
      fireEvent.click(screen.getByRole('button', { name: /I own my home/i }));

      // Answer social isolation
      fireEvent.click(screen.getByRole('button', { name: /^Never$/i }));

      // First attempt fails
      fireEvent.click(screen.getByText(/Complete Assessment/i));

      await waitFor(() => {
        const errorContainer = screen.getByText(/Failed to save assessment/i).parentElement;
        expect(errorContainer).toHaveTextContent(/Please try again/i);
      }, { timeout: 2000 });

      // Retry succeeds
      fireEvent.click(screen.getByText(/Retry/i));

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });
});
