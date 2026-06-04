import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionnaireStatsPanel } from '../QuestionnaireStatsPanel';

// Matches FHIRQuestionnaireService.getQuestionnaireStats so the mock is assignable
// to the panel's fhirService prop under the full (test-inclusive) typecheck.
type GetStatsFn = (questionnaireId: number) => Promise<Record<string, unknown>>;

const renderPanel = (
  getQuestionnaireStats: ReturnType<typeof vi.fn<GetStatsFn>>,
  onClose = vi.fn(),
  id = 42
) =>
  render(
    <QuestionnaireStatsPanel
      questionnaireId={id}
      questionnaireTitle="PHQ-9 Depression Screen"
      fhirService={{ getQuestionnaireStats }}
      onClose={onClose}
    />
  );

describe('QuestionnaireStatsPanel', () => {
  it('fetches stats for the given questionnaire id and renders the values', async () => {
    const getQuestionnaireStats = vi.fn<GetStatsFn>().mockResolvedValue({
      total_responses: 10,
      completed_responses: 8,
      completion_rate: 80,
      average_score: 12.5,
      high_risk_count: 2,
    });

    renderPanel(getQuestionnaireStats, vi.fn(), 42);

    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(getQuestionnaireStats).toHaveBeenCalledWith(42);
    expect(screen.getByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('Total responses')).toBeInTheDocument();
    expect(screen.getByText('High-risk responses')).toBeInTheDocument();
    expect(screen.queryByText('No responses collected yet for this questionnaire.')).toBeNull();
  });

  it('shows an empty-state note and dashes when there are no responses', async () => {
    const getQuestionnaireStats = vi.fn<GetStatsFn>().mockResolvedValue({
      total_responses: 0,
      completed_responses: 0,
      completion_rate: null,
      average_score: null,
      high_risk_count: 0,
    });

    renderPanel(getQuestionnaireStats);

    expect(
      await screen.findByText('No responses collected yet for this questionnaire.')
    ).toBeInTheDocument();
    // completion_rate and average_score render as em dashes when null
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces an error with a working Retry that refetches', async () => {
    const getQuestionnaireStats = vi
      .fn<GetStatsFn>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        total_responses: 3,
        completed_responses: 3,
        completion_rate: 100,
        average_score: 5,
        high_risk_count: 0,
      });

    renderPanel(getQuestionnaireStats);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(getQuestionnaireStats).toHaveBeenCalledTimes(2);
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const getQuestionnaireStats = vi.fn<GetStatsFn>().mockResolvedValue({
      total_responses: 1,
      completed_responses: 1,
      completion_rate: 100,
      average_score: 1,
      high_risk_count: 0,
    });

    renderPanel(getQuestionnaireStats, onClose);

    await screen.findByText('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Close statistics panel' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
