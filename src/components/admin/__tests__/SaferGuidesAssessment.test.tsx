/**
 * SaferGuidesAssessment Tests (Upgraded — Tier 1-3)
 *
 * Tests the SAFER Guides self-assessment component for ONC certification.
 * Every test validates user-visible behavior and would fail if the component
 * were replaced with an empty <div />.
 *
 * Deletion Test: loading skeleton, 9 guide cards with names, attestation button
 * state, PDF download, error alerts — all fail for an empty div.
 *
 * ONC Requirement: CMS Promoting Interoperability Program
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SaferGuidesAssessment from '../SaferGuidesAssessment';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({
              data: { tenant_id: 'test-tenant-id' },
              error: null,
            })
          ),
        })),
      })),
    })),
  })),
  useUser: vi.fn(() => ({
    id: 'test-user-id',
    email: 'test@example.com',
  })),
}));

const { mockGenerateAttestationPdf } = vi.hoisted(() => ({
  mockGenerateAttestationPdf: vi.fn(),
}));

vi.mock('../../../services/saferGuidesService', () => ({
  SaferGuidesService: {
    getGuideDefinitions: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: Array.from({ length: 9 }, (_, i) => ({
          id: `guide-${i + 1}`,
          guide_number: i + 1,
          name: `Guide ${i + 1} Name`,
          description: `Description for guide ${i + 1}`,
        })),
        error: null,
      })
    ),
    getOrCreateAssessment: vi.fn(() =>
      Promise.resolve({
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
          totalAnswered: 20,
          guides: [
            { guideNumber: 1, guideName: 'High Priority Practices', category: 'Foundation' as const, status: 'complete' as const, score: 95, totalQuestions: 8, answeredQuestions: 8, yesCount: 7, noCount: 0, naCount: 1, partialCount: 0 },
            { guideNumber: 2, guideName: 'Patient Identification', category: 'Clinical' as const, status: 'in_progress' as const, score: null, totalQuestions: 8, answeredQuestions: 4, yesCount: 2, noCount: 1, naCount: 0, partialCount: 1 },
            { guideNumber: 3, guideName: 'Computerized Provider Order Entry', category: 'Clinical' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
            { guideNumber: 4, guideName: 'Communication', category: 'Operations' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
            { guideNumber: 5, guideName: 'Test Results', category: 'Clinical' as const, status: 'complete' as const, score: 88, totalQuestions: 8, answeredQuestions: 8, yesCount: 6, noCount: 1, naCount: 0, partialCount: 1 },
            { guideNumber: 6, guideName: 'Clinician Order Entry', category: 'Clinical' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
            { guideNumber: 7, guideName: 'System Configuration', category: 'Technical' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
            { guideNumber: 8, guideName: 'System Interfaces', category: 'Technical' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
            { guideNumber: 9, guideName: 'Contingency Planning', category: 'Governance' as const, status: 'not_started' as const, score: null, totalQuestions: 8, answeredQuestions: 0, yesCount: 0, noCount: 0, naCount: 0, partialCount: 0 },
          ],
        },
        error: null,
      })
    ),
    getGuideQuestionsWithResponses: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: [
          {
            question: { id: 'q1', question_number: 1, question_text: 'Does your EHR have a standard process for patient identification?', category: 'Safety' },
            response: null,
          },
          {
            question: { id: 'q2', question_number: 2, question_text: 'Are there alerts for duplicate patient records?', category: 'Safety' },
            response: { response: 'fully_implemented' },
          },
        ],
        error: null,
      })
    ),
    saveResponse: vi.fn(() =>
      Promise.resolve({ success: true, data: { id: 'response-1' }, error: null })
    ),
    attestAssessment: vi.fn(() =>
      Promise.resolve({ success: true, data: { pdfPath: '/reports/safer-2026.pdf' }, error: null })
    ),
  },
  generateAttestationPdf: mockGenerateAttestationPdf,
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Tests — Loading State
// ---------------------------------------------------------------------------

describe('SaferGuidesAssessment - Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton initially before data loads', () => {
    render(<SaferGuidesAssessment />);

    // The loading skeleton renders animate-pulse divs, not real guide content
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    // Guide names should NOT be visible yet
    expect(screen.queryByText('High Priority Practices')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Guide Grid
// ---------------------------------------------------------------------------

describe('SaferGuidesAssessment - Guide Grid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 9 guide cards with guide names after loading', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('High Priority Practices')).toBeInTheDocument();
    });

    expect(screen.getByText('Patient Identification')).toBeInTheDocument();
    expect(screen.getByText('Computerized Provider Order Entry')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Test Results')).toBeInTheDocument();
    expect(screen.getByText('Clinician Order Entry')).toBeInTheDocument();
    expect(screen.getByText('System Configuration')).toBeInTheDocument();
    expect(screen.getByText('System Interfaces')).toBeInTheDocument();
    expect(screen.getByText('Contingency Planning')).toBeInTheDocument();
  });

  it('displays guide progress counts (answered/total)', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('High Priority Practices')).toBeInTheDocument();
    });

    // Guide 1 and Guide 5 both have 8/8 questions (2 matches expected)
    expect(screen.getAllByText('8/8 questions')).toHaveLength(2);
    // Guide 2: 4/8 questions (unique)
    expect(screen.getByText('4/8 questions')).toBeInTheDocument();
    // Guides 3-4, 6-9 all have 0/8 questions
    expect(screen.getAllByText('0/8 questions').length).toBeGreaterThanOrEqual(1);
  });

  it('displays overall progress summary', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/guides complete/)).toBeInTheDocument();
    });

    // 2 of 9 guides complete, 20 of 72 questions answered
    expect(screen.getByText(/2 of 9 guides complete/)).toBeInTheDocument();
    expect(screen.getByText(/20 of 72 questions answered/)).toBeInTheDocument();
  });

  it('shows score percentage for completed guides', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('shows Yes/No/Partial/N/A breakdown for answered guides', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('High Priority Practices')).toBeInTheDocument();
    });

    // Guide 1 has 7 Yes and 1 N/A
    expect(screen.getByText('7 Yes')).toBeInTheDocument();
    expect(screen.getByText('1 N/A')).toBeInTheDocument();
  });

  it('displays CMS Promoting Interoperability requirement text', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Required for CMS Promoting Interoperability/)).toBeInTheDocument();
    });
  });

  it('displays assessment year', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/2026 Annual Assessment/)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Attestation
// ---------------------------------------------------------------------------

describe('SaferGuidesAssessment - Attestation Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Complete & Attest button when not all guides are complete', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      const attestButton = screen.getByText(/Complete & Attest/);
      expect(attestButton.closest('button')).toBeDisabled();
    });
  });

  it('enables Complete & Attest button when all 9 guides are complete', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    vi.mocked(SaferGuidesService.getOrCreateAssessment).mockResolvedValueOnce({
      success: true,
      data: {
        assessmentId: 'test-id',
        year: 2026,
        status: 'in_progress' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
        attestedAt: null,
        overallScore: 92,
        totalQuestions: 72,
        totalAnswered: 72,
        guides: Array.from({ length: 9 }, (_, i) => ({
          guideNumber: i + 1,
          guideName: `Guide ${i + 1}`,
          category: 'Foundation' as const,
          status: 'complete' as const,
          score: 92,
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
      const attestButton = screen.getByText(/Complete & Attest/);
      expect(attestButton.closest('button')).not.toBeDisabled();
    });
  });

  it('shows Download Attestation button when assessment status is "attested"', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    const attestedData = {
      success: true as const,
      data: {
        assessmentId: 'test-id',
        year: 2026,
        status: 'attested' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-15T00:00:00Z',
        attestedAt: '2026-01-16T00:00:00Z',
        overallScore: 90,
        totalQuestions: 72,
        totalAnswered: 72,
        guides: Array.from({ length: 9 }, (_, i) => ({
          guideNumber: i + 1,
          guideName: `Guide ${i + 1}`,
          category: 'Foundation' as const,
          status: 'complete' as const,
          score: 90,
          totalQuestions: 8,
          answeredQuestions: 8,
          yesCount: 7,
          noCount: 0,
          naCount: 1,
          partialCount: 0,
        })),
      },
      error: null,
    };
    // Stack multiple mockResolvedValueOnce to cover initial load + any re-fetches
    vi.mocked(SaferGuidesService.getOrCreateAssessment)
      .mockResolvedValueOnce(attestedData)
      .mockResolvedValueOnce(attestedData)
      .mockResolvedValueOnce(attestedData);

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Download Attestation')).toBeInTheDocument();
    });

    // The Complete & Attest button should NOT be present when attested
    expect(screen.queryByText(/Complete & Attest/)).not.toBeInTheDocument();
  });

  it('Download Attestation button calls generateAttestationPdf and opens print window', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    const attestedData = {
      success: true as const,
      data: {
        assessmentId: 'test-id',
        year: 2026,
        status: 'attested' as const,
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-15T00:00:00Z',
        attestedAt: '2026-01-16T00:00:00Z',
        overallScore: 90,
        totalQuestions: 72,
        totalAnswered: 72,
        guides: Array.from({ length: 9 }, (_, i) => ({
          guideNumber: i + 1,
          guideName: `Guide ${i + 1}`,
          category: 'Foundation' as const,
          status: 'complete' as const,
          score: 90,
          totalQuestions: 8,
          answeredQuestions: 8,
          yesCount: 7,
          noCount: 0,
          naCount: 1,
          partialCount: 0,
        })),
      },
      error: null,
    };
    vi.mocked(SaferGuidesService.getOrCreateAssessment)
      .mockResolvedValueOnce(attestedData)
      .mockResolvedValueOnce(attestedData)
      .mockResolvedValueOnce(attestedData);

    const mockPrintWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(
      mockPrintWindow as unknown as Window
    );

    mockGenerateAttestationPdf.mockResolvedValueOnce({
      success: true,
      data: { html: '<html><body>Attestation Report</body></html>' },
      error: null,
    });

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Download Attestation')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Download Attestation'));

    await waitFor(() => {
      expect(mockGenerateAttestationPdf).toHaveBeenCalledWith(
        'test-id',
        'test-tenant-id'
      );
    });

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith('', '_blank');
      expect(mockPrintWindow.document.write).toHaveBeenCalledWith(
        '<html><body>Attestation Report</body></html>'
      );
      expect(mockPrintWindow.print).toHaveBeenCalled();
    });

    windowOpenSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Tests — Error Handling
// ---------------------------------------------------------------------------

describe('SaferGuidesAssessment - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays error alert when assessment fails to load', async () => {
    const { SaferGuidesService } = await import('../../../services/saferGuidesService');
    vi.mocked(SaferGuidesService.getOrCreateAssessment).mockResolvedValueOnce({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Connection refused' },
    });

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Connection refused')).toBeInTheDocument();
    });
  });

  it('displays error when tenant cannot be determined', async () => {
    const { useSupabaseClient } = await import('../../../contexts/AuthContext');
    vi.mocked(useSupabaseClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof useSupabaseClient>);

    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText(/Could not determine your organization/)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Guide Selection (Integration)
// ---------------------------------------------------------------------------

describe('SaferGuidesAssessment - Guide Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays questions when a guide card is clicked', async () => {
    render(<SaferGuidesAssessment />);

    await waitFor(() => {
      expect(screen.getByText('Patient Identification')).toBeInTheDocument();
    });

    // Click on guide 2 card
    const guideCard = screen.getByText('Patient Identification').closest('div[class*="cursor-pointer"]');
    if (guideCard) {
      fireEvent.click(guideCard);
    }

    await waitFor(() => {
      expect(screen.getByText(/Does your EHR have a standard process/)).toBeInTheDocument();
      expect(screen.getByText(/Are there alerts for duplicate patient records/)).toBeInTheDocument();
    });
  });
});
