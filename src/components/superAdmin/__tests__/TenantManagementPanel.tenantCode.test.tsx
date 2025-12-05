import React from 'react';
import { render, screen } from '@testing-library/react';
import TenantManagementPanel from '../TenantManagementPanel';

// Mock AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
}));

// Mock auditLogger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('TenantManagementPanel - Tenant Code', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TenantManagementPanel />);
    expect(document.body).toBeInTheDocument();
  });
});
