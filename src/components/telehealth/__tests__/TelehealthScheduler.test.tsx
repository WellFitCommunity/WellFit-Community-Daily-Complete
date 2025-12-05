import React from 'react';
import { render, screen } from '@testing-library/react';
import TelehealthScheduler from '../TelehealthScheduler';

// Mock AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
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

// Mock InputValidator
jest.mock('../../../services/inputValidator', () => ({
  InputValidator: {
    sanitize: jest.fn((val) => val),
    validate: jest.fn(() => ({ isValid: true })),
  },
}));

describe('TelehealthScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TelehealthScheduler />);
    expect(document.body).toBeInTheDocument();
  });
});
