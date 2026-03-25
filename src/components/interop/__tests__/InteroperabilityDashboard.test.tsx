/**
 * InteroperabilityDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/FhirAiDashboard', () => ({
  default: () => <div data-testid="fhir-analytics">FHIR Analytics Content</div>,
}));
vi.mock('../../admin/FHIRInteroperabilityDashboard', () => ({
  default: () => <div data-testid="fhir-connections">FHIR Connections Content</div>,
}));
vi.mock('../../admin/FHIRFormBuilderEnhanced', () => ({
  default: () => <div data-testid="form-builder">Form Builder Content</div>,
}));
vi.mock('../../admin/FHIRDataMapper', () => ({
  default: () => <div data-testid="data-mapper">Data Mapper Content</div>,
}));
vi.mock('../../admin/HL7MessageTestPanel', () => ({
  default: () => <div data-testid="hl7-testing">HL7 Testing Content</div>,
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

import { InteroperabilityDashboard } from '../InteroperabilityDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><InteroperabilityDashboard /></MemoryRouter>);

describe('InteroperabilityDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the Interoperability title', () => {
    renderDashboard();
    expect(screen.getByText('Interoperability')).toBeInTheDocument();
  });

  it('should render all 5 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /fhir analytics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /connections/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /form builder/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /data mapping/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /hl7 testing/i })).toBeInTheDocument();
  });

  it('should default to FHIR Analytics tab', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('fhir-analytics')).toBeInTheDocument();
    });
  });

  it('should switch to Connections tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /connections/i }));
    await waitFor(() => {
      expect(screen.getByTestId('fhir-connections')).toBeInTheDocument();
    });
  });

  it('should switch to Form Builder tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /form builder/i }));
    await waitFor(() => {
      expect(screen.getByTestId('form-builder')).toBeInTheDocument();
    });
  });

  it('should switch to Data Mapping tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /data mapping/i }));
    await waitFor(() => {
      expect(screen.getByTestId('data-mapper')).toBeInTheDocument();
    });
  });

  it('should switch to HL7 Testing tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /hl7 testing/i }));
    await waitFor(() => {
      expect(screen.getByTestId('hl7-testing')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);
  });
});
