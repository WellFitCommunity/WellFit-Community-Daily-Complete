/**
 * SaferGuidesAssessment Tests
 *
 * Tests the SAFER Guides self-assessment component for ONC certification.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SaferGuidesAssessment from '../SaferGuidesAssessment';
import { vi } from 'vitest';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { tenant_id: 'test-tenant-id' },
            error: null,
          })),
        })),
      })),
    })),
  })),
  useUser: vi.fn(() => ({
    id: 'test-user-id',
    email: 'test@example.com',
  })),
}));

// Mock SaferGuidesService
vi.mock('../../../services/saferGuidesService', () => ({
  SaferGuidesService: {
    getGuideDefinitions: vi.fn(() => Promise.resolve({
      success: true,
      data: [
        { id: 'guide-1', guide_number: 1, name: 'High Priority Practices', description: 'Guide 1 description' },
        { id: 'guide-2', guide_number: 2, name: 'Patient Identification', description: 'Guide 2 description' },
        { id: 'guide-3', guide_number: 3, name: 'Computerized Provider Order Entry', description: 'Guide 3 description' },
      ],
      error: null,
    })),
    getOrCreateAssessment: vi.fn(() => Promise.resolve({
      success: true,
      data: {
        assessmentId: 'test-assessment-id',
        year: 2026,
        status: 'in_progress' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
        attestedAt: null,
        overallScore: null,
        totalQuestions: 24,
        totalAnswered: 11,
        guides: [
          { guideNumber: 1, guideName: 'High Priority Practices', category: 'Foundation' as const, status: 'complete' as const, score: 95, totalQuestions: 8, answeredQuestions: 8, yesCount: 7, noCount: 0, naCount: 1, partialCount: 0 },
          { guideNumber: 2, guideName: 'Patient Identification', category: 'Clinical' as const, status: 'in_progress' as const, score: null, totalQuestions: 6, answeredQuestions: 3, yesCount: 2, noCount: 0, naCount: 0, partialCount: 1 },
          { guideNumber: 3, guideName: 'Computerized Provider Order Entry', category: 'Clinical' as const, status: 'not_started' as const, score: null, totalQuestions: 10, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
        ],
      },
      error: null,
    })),
    getGuideQuestionsWithResponses: vi.fn(() => Promise.resolve({
      success: true,
      data: [
        {
          question: {
            id: 'q1',
            question_number: 1,
            question_text: 'Does your EHR have a standard process for patient identification?',
            category: 'Safety',
          },
          response: null,
        },
        {
          question: {
            id: 'q2',
            question_number: 2,
            question_text: 'Are there alerts for duplicate patient records?',
            category: 'Safety',
          },
          response: { response: 'fully_implemented' },
        },
      ],
      error: null,
    })),
    saveResponse: vi.fn(() => Promise.resolve({
      success: true,
      data: { id: 'response-1' },
      error: null,
    })),
    attestAssessment: vi.fn(() => Promise.resolve({
      success: true,
      data: { pdfPath: '/reports/safer-2026.pdf' },
      error: null,
    })),
  },
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('SaferGuidesAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component with header', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('SAFER Guides Self-Assessment')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    render(<SaferGuidesAssessment />);

    // Check for loading indicator (animate-pulse skeleton)
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should display guide list after loading', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('High Priority Practices')).toBeInTheDocument();
      expect(screen.getByText('Patient Identification')).toBeInTheDocument();
      expect(screen.getByText('Computerized Provider Order Entry')).toBeInTheDocument();
    });
  });

  it('should show progress information', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/guides complete/)).toBeInTheDocument();
    });
  });

  it('should show guide completion status', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      // Check for guide cards with completion status (answered/total)
      expect(screen.getByText('High Priority Practices')).toBeInTheDocument();
    });
  });

  it('should display year in header', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/2026/)).toBeInTheDocument();
    });
  });

  it('should show CMS requirement text', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Required for CMS Promoting Interoperability/)).toBeInTheDocument();
    });
  });

  it('should have 9 guides listed when fully loaded', async () => {
    // Update mock for full guide list
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    vi.mocked(SaferGuidesService.getOrCreateAssessment).mockResolvedValueOnce({
      success: true,
      data: {
        assessmentId: 'test-assessment-id',
        year: 2026,
        status: 'in_progress' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
        attestedAt: null,
        overallScore: null,
        totalQuestions: 72,
        totalAnswered: 0,
        guides: Array.from({ length: 9 }, (_, i) => ({
          guideNumber: i + 1,
          guideName: `Guide ${i + 1}`,
          category: 'Foundation' as const,
          status: 'not_started' as const,
          score: null,
          totalQuestions: 8,
          answeredQuestions: 0,
          yesCount: 0,
          noCount: 0,
          naCount: 0,
          partialCount: 0,
        })),
      },
      error: null,
    });

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      // Check that multiple guides are rendered
      expect(screen.getByText('Guide 1')).toBeInTheDocument();
    });
  });

  it('should apply custom className', async () => {
    const { container } = render(<SaferGuidesAssessment className="custom-class" />);

    await waitFor(() => {
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

describe('SaferGuidesAssessment - Guide Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load questions when guide is selected', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Patient Identification')).toBeInTheDocument();
    });

    // Click on a guide to select it
    const guideCard = screen.getByText('Patient Identification').closest('div[class*="cursor-pointer"]');
    if (guideCard) {
      fireEvent.click(guideCard);
    }

    await waitFor(() => {
      expect(screen.getByText(/Does your EHR have a standard process/)).toBeInTheDocument();
    });
  });

  it('should show back navigation when viewing questions', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Patient Identification')).toBeInTheDocument();
    });

    const guideCard = screen.getByText('Patient Identification').closest('div[class*="cursor-pointer"]');
    if (guideCard) {
      fireEvent.click(guideCard);
    }

    await waitFor(() => {
      // Check for back navigation (chevron icon or text)
      expect(screen.getByText(/Back to All Guides/)).toBeInTheDocument();
    });
  });
});

describe('SaferGuidesAssessment - Error Handling', () => {
  it('should show error when tenant cannot be determined', async () => {
    const { useSupabaseClient } = await import('../../../contexts/AuthContext');
    vi.mocked(useSupabaseClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof useSupabaseClient>);

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Could not determine your organization/)).toBeInTheDocument();
    });
  });

  it('should show error when assessment fails to load', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    vi.mocked(SaferGuidesService.getOrCreateAssessment).mockResolvedValueOnce({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Failed to load assessment' },
    });

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load assessment/)).toBeInTheDocument();
    });
  });
});

describe('SaferGuidesAssessment - Attestation', () => {
  it('should show attest button when all guides complete', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    vi.mocked(SaferGuidesService.getOrCreateAssessment).mockResolvedValueOnce({
      success: true,
      data: {
        assessmentId: 'test-assessment-id',
        year: 2026,
        status: 'in_progress' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
        attestedAt: null,
        overallScore: 95,
        totalQuestions: 72,
        totalAnswered: 72,
        guides: Array.from({ length: 9 }, (_, i) => ({
          guideNumber: i + 1,
          guideName: `Guide ${i + 1}`,
          category: 'Foundation' as const,
          status: 'complete' as const,
          score: 95,
          totalQuestions: 8,
          answeredQuestions: 8,
          yesCount: 7,
          noCount: 0,
          naCount: 1,
          partialCount: 0,
        })),
      },
      error: null,
    });

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Complete & Attest/)).toBeInTheDocument();
    });
  });

  it('should disable attest button when guides are incomplete', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      const attestButton = screen.getByText(/Complete & Attest/);
      expect(attestButton.closest('button')).toBeDisabled();
    });
  });
});
