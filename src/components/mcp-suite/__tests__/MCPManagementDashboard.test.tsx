/**
 * MCPManagementDashboard - Tab navigation tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../../admin/MCPServerHealthPanel', () => ({
  default: () => <div data-testid="mcp-health">MCP Health Content</div>,
}));
vi.mock('../../admin/MCPKeyManagementPanel', () => ({
  default: () => <div data-testid="mcp-keys">MCP Keys Content</div>,
}));
vi.mock('../../admin/mcp-chains/MCPChainManagementPanel', () => ({
  default: () => <div data-testid="mcp-chains">MCP Chains Content</div>,
}));
vi.mock('../../admin/MCPChainCostPanel', () => ({
  default: () => <div data-testid="mcp-cost">MCP Cost Content</div>,
}));
vi.mock('../../admin/EdgeFunctionManagementPanel', () => ({
  default: () => <div data-testid="edge-functions">Edge Functions Content</div>,
}));
vi.mock('../../admin/medical-coding/MedicalCodingMCPPanel', () => ({
  default: () => <div data-testid="medical-coding">Medical Coding Content</div>,
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

import { MCPManagementDashboard } from '../MCPManagementDashboard';

const renderDashboard = () =>
  render(<MemoryRouter><MCPManagementDashboard /></MemoryRouter>);

describe('MCPManagementDashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should render the MCP Management title', () => {
    renderDashboard();
    expect(screen.getByText('MCP Management')).toBeInTheDocument();
  });

  it('should render all 6 main tabs', () => {
    renderDashboard();
    expect(screen.getByRole('tab', { name: /health/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /keys/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chains/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /cost/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /edge functions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /medical coding/i })).toBeInTheDocument();
  });

  it('should default to Health tab', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('mcp-health')).toBeInTheDocument();
    });
  });

  it('should switch to Keys tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /keys/i }));
    await waitFor(() => {
      expect(screen.getByTestId('mcp-keys')).toBeInTheDocument();
    });
  });

  it('should switch to Chains tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /chains/i }));
    await waitFor(() => {
      expect(screen.getByTestId('mcp-chains')).toBeInTheDocument();
    });
  });

  it('should switch to Cost tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /cost/i }));
    await waitFor(() => {
      expect(screen.getByTestId('mcp-cost')).toBeInTheDocument();
    });
  });

  it('should switch to Edge Functions tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /edge functions/i }));
    await waitFor(() => {
      expect(screen.getByTestId('edge-functions')).toBeInTheDocument();
    });
  });

  it('should switch to Medical Coding tab', async () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /medical coding/i }));
    await waitFor(() => {
      expect(screen.getByTestId('medical-coding')).toBeInTheDocument();
    });
  });

  it('should have proper tab ARIA roles', () => {
    renderDashboard();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(6);
  });
});
