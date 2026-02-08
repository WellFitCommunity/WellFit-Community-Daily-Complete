/**
 * Star Ratings Dashboard Tab Tests
 *
 * Tests star visualization, domain breakdown, trend display, and calculation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../services/qualityMeasures/star/starRatingsService', () => ({
  getStarRatings: vi.fn(),
  calculateStarRatings: vi.fn(),
  getDomainSummaries: vi.fn(),
}));

import { StarRatingsDashboardTab } from '../quality-measures/StarRatingsDashboardTab';
import { getStarRatings, calculateStarRatings, getDomainSummaries } from '../../../services/qualityMeasures/star/starRatingsService';

describe('StarRatingsDashboardTab', () => {
  const mockScore = {
    id: 'star-1', tenantId: 'tenant-1', reportingYear: 2026, ratingType: 'part_c' as const,
    domainScores: { 'Managing Chronic Conditions': 4.5, 'Staying Healthy': 4.0 },
    domainWeights: { 'Managing Chronic Conditions': 0.40, 'Staying Healthy': 0.35 },
    overallStarRating: 4.5,
    measureStarDetails: [
      { measureId: 'CMS122v12', cmsId: 'CMS122', title: 'HbA1c', domain: 'Managing Chronic Conditions', performanceRate: 0.13, starRating: 5, cutPoints: { '1': 1, '2': 0.6, '3': 0.4, '4': 0.25, '5': 0.15 }, isInverse: true, weight: 1 },
      { measureId: 'CMS165v12', cmsId: 'CMS165', title: 'BP Control', domain: 'Managing Chronic Conditions', performanceRate: 0.865, starRating: 5, cutPoints: { '1': 0, '2': 0.5, '3': 0.65, '4': 0.75, '5': 0.85 }, isInverse: false, weight: 1 },
      { measureId: 'CMS130v12', cmsId: 'CMS130', title: 'Colorectal Screening', domain: 'Staying Healthy', performanceRate: 0.786, starRating: 4, cutPoints: { '1': 0, '2': 0.45, '3': 0.6, '4': 0.72, '5': 0.82 }, isInverse: false, weight: 1 },
    ],
    previousYearRating: 4.0, trendDirection: 'up' as const,
    totalMeasuresRated: 3, measuresAt4Plus: 2, measuresBelow3: 0,
    calculatedAt: '2026-01-15', notes: null,
  };

  const mockDomains = [
    {
      domain: 'Managing Chronic Conditions', score: 4.5, weight: 0.40, measureCount: 2,
      measures: mockScore.measureStarDetails.filter(d => d.domain === 'Managing Chronic Conditions'),
    },
    {
      domain: 'Staying Healthy', score: 4.0, weight: 0.35, measureCount: 1,
      measures: mockScore.measureStarDetails.filter(d => d.domain === 'Staying Healthy'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStarRatings).mockResolvedValue({
      success: true, data: mockScore, error: null,
    });
    vi.mocked(getDomainSummaries).mockReturnValue(mockDomains);
    vi.mocked(calculateStarRatings).mockResolvedValue({
      success: true, data: mockScore, error: null,
    });
  });

  it('should display overall star rating value', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText('Overall Star Rating')).toBeInTheDocument();
    });
  });

  it('should display upward trend indicator', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText(/Up from 4.0/)).toBeInTheDocument();
    });
  });

  it('should display summary counts (total rated, 4+, below 3)', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('Total Rated')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4+ Stars')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Below 3')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should display domain breakdown cards', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('Managing Chronic Conditions')).toBeInTheDocument();
      expect(screen.getByText('Staying Healthy')).toBeInTheDocument();
    });
  });

  it('should display individual measure names within domains', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('HbA1c')).toBeInTheDocument();
      expect(screen.getByText('BP Control')).toBeInTheDocument();
      expect(screen.getByText('Colorectal Screening')).toBeInTheDocument();
    });
  });

  it('should have Calculate Stars button', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Calculate Stars/i })).toBeInTheDocument();
    });
  });

  it('should trigger star calculation on button click', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Calculate Stars/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Calculate Stars/i }));
    await waitFor(() => {
      expect(calculateStarRatings).toHaveBeenCalledWith({ tenantId: 'tenant-1', reportingYear: 2026 });
    });
  });

  it('should show empty state when no ratings exist', async () => {
    vi.mocked(getStarRatings).mockResolvedValue({ success: true, data: null, error: null });
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('No star ratings calculated')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(getStarRatings).mockImplementation(() => new Promise(() => {}));
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    expect(screen.getByText('Loading star ratings...')).toBeInTheDocument();
  });

  it('should display reporting year in header', async () => {
    render(<StarRatingsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText(/CMS Star Ratings.*2026/)).toBeInTheDocument();
    });
  });
});
