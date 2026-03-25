/**
 * ClinicalQualityDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/quality-measures', () => ({
  default: () => <div data-testid="quality-measures">Quality Measures Content</div>,
}));
vi.mock('../../admin/clinical-validation', () => ({
  default: () => <div data-testid="clinical-validation">Clinical Validation Content</div>,
}));
vi.mock('../../admin/PublicHealthReportingDashboard', () => ({
  default: () => <div data-testid="public-health">Public Health Content</div>,
}));
vi.mock('../../admin/AdminHeader', () => ({
  default: () => <div data-testid="admin-header">Header</div>,
}));
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({ adminUser: { id: 'test' }, adminRole: 'super_admin' }),
}));
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ orgName: 'Test', primaryColor: '#00857a' }),
}));

import { ClinicalQualityDashboard } from '../ClinicalQualityDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><ClinicalQualityDashboard /></MemoryRouter>);

describe('ClinicalQualityDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the Clinical Quality title', () => {
    renderDashboard();
    expect(screen.getByText('Clinical Quality')).toBeInTheDocument();
  });

  it('should render all 3 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /quality measures/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /clinical validation/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /public health/i })).toBeInTheDocument();
  });

  it('should default to Quality Measures tab', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('quality-measures')).toBeInTheDocument();
    });
  });

  it('should switch to Clinical Validation tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /clinical validation/i }));
    await waitFor(() => {
      expect(screen.getByTestId('clinical-validation')).toBeInTheDocument();
    });
  });

  it('should switch to Public Health tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /public health/i }));
    await waitFor(() => {
      expect(screen.getByTestId('public-health')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    expect(screen.getAllByRole('tab').length).toBe(3);
  });
});
