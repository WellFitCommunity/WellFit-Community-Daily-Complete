/**
 * TrainingComplianceDashboard Tests
 *
 * Tests compliance rate display, overdue items highlighting,
 * training status list, and empty state.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockGetTenantComplianceRate = vi.fn();
const mockGetTrainingStatus = vi.fn();

const mockListCourses = vi.fn();

vi.mock('../../../services/trainingTrackingService', () => ({
  trainingTrackingService: {
    getTenantComplianceRate: (...args: unknown[]) => mockGetTenantComplianceRate(...args),
    getTrainingStatus: (...args: unknown[]) => mockGetTrainingStatus(...args),
    listCourses: (...args: unknown[]) => mockListCourses(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockComplianceRate = {
  total_employees: 10,
  compliant_employees: 7,
  compliance_rate: 70,
  overdue_count: 3,
  expiring_soon_count: 2,
};

const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const futureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
const soonDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

const mockStatuses = [
  {
    employee_id: 'emp-1',
    employee_name: 'Alice Johnson',
    course_id: 'c-1',
    course_name: 'HIPAA Security Awareness',
    category: 'hipaa_security',
    last_completed: '2026-01-15T10:00:00Z',
    expires_at: futureDate,
    is_overdue: false,
    is_expiring_soon: false,
  },
  {
    employee_id: 'emp-2',
    employee_name: 'Bob Williams',
    course_id: 'c-1',
    course_name: 'HIPAA Security Awareness',
    category: 'hipaa_security',
    last_completed: pastDate,
    expires_at: pastDate,
    is_overdue: true,
    is_expiring_soon: false,
  },
  {
    employee_id: 'emp-3',
    employee_name: 'Carol Davis',
    course_id: 'c-2',
    course_name: 'Cybersecurity Basics',
    category: 'cybersecurity',
    last_completed: '2026-01-01T10:00:00Z',
    expires_at: soonDate,
    is_overdue: false,
    is_expiring_soon: true,
  },
];

describe('TrainingComplianceDashboard', () => {
  let TrainingComplianceDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetTenantComplianceRate.mockResolvedValue({
      success: true,
      data: mockComplianceRate,
    });
    mockGetTrainingStatus.mockResolvedValue({
      success: true,
      data: mockStatuses,
    });
    mockListCourses.mockResolvedValue({
      success: true,
      data: [],
    });
    const mod = await import('../TrainingComplianceDashboard');
    TrainingComplianceDashboard = mod.default;
  });

  it('displays compliance rate after loading', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('70%')).toBeInTheDocument();
    });
    expect(screen.getByText('Overall Compliance Rate')).toBeInTheDocument();
  });

  it('displays total employees and overdue count', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Overdue Items')).toBeInTheDocument();
  });

  it('shows employee names and course names in the list', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Williams')).toBeInTheDocument();
    expect(screen.getByText('Carol Davis')).toBeInTheDocument();
    // Two employees have HIPAA Security Awareness course
    expect(screen.getAllByText('HIPAA Security Awareness')).toHaveLength(2);
    expect(screen.getByText('Cybersecurity Basics')).toBeInTheDocument();
  });

  it('highlights overdue items with red styling', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Bob Williams')).toBeInTheDocument();
    });
    // Overdue status should display "Overdue" text
    const overdueLabels = screen.getAllByText('Overdue');
    expect(overdueLabels.length).toBeGreaterThan(0);
  });

  it('shows expiring soon status for items near expiration', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Carol Davis')).toBeInTheDocument();
    });
    // "Expiring Soon" appears in the stats card label and in the status badge
    const expiringSoonElements = screen.getAllByText('Expiring Soon');
    expect(expiringSoonElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows current status for compliant items', async () => {
    render(<TrainingComplianceDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows empty state when no training data available', async () => {
    mockGetTenantComplianceRate.mockResolvedValue({
      success: true,
      data: {
        total_employees: 0,
        compliant_employees: 0,
        compliance_rate: 0,
        overdue_count: 0,
        expiring_soon_count: 0,
      },
    });
    mockGetTrainingStatus.mockResolvedValue({
      success: true,
      data: [],
    });
    vi.resetModules();
    const mod = await import('../TrainingComplianceDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByText(/No training data available/)).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGetTenantComplianceRate.mockImplementation(() => new Promise(() => {}));
    mockGetTrainingStatus.mockImplementation(() => new Promise(() => {}));
    render(<TrainingComplianceDashboard />);
    expect(screen.getByText('Loading training data...')).toBeInTheDocument();
  });

  it('shows error state when loading fails', async () => {
    mockGetTenantComplianceRate.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Access denied' },
    });
    vi.resetModules();
    const mod = await import('../TrainingComplianceDashboard');
    const Component = mod.default;

    render(<Component />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
