import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SystemAdminDashboard } from '../SystemAdminDashboard';

// Mock AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
}));

// Mock AdminAuthContext
jest.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: true,
    adminRole: 'admin',
    hasAccess: jest.fn(() => true),
  }),
}));

// Mock auditLogger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SystemAdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <SystemAdminDashboard />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
