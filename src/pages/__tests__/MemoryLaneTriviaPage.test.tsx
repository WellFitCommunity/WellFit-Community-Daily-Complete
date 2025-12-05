import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MemoryLaneTriviaPage from '../MemoryLaneTriviaPage';

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  }),
  useUser: () => ({ id: 'test-user-id' }),
}));

// Mock BrandingContext
jest.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

describe('MemoryLaneTriviaPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <MemoryLaneTriviaPage />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
