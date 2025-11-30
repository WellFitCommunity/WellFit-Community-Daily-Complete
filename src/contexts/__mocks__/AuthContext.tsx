/**
 * AuthContext Mock for Jest Tests
 *
 * Provides consistent mock implementations for all AuthContext exports.
 * Tests can override these mocks as needed using jest.mocked().
 */
import React from 'react';

// Default mock user
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  phone: '+15551234567',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

// Default mock session
export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
};

// Default mock supabase client
export const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    getUser: jest.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
  },
  functions: {
    invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://test.url' } }),
    }),
  },
};

// Mock auth context value
export const mockAuthContextValue = {
  supabase: mockSupabaseClient,
  session: mockSession,
  user: mockUser,
  loading: false,
  error: null,
  isAdmin: false,
  signInEmailPassword: jest.fn().mockResolvedValue(undefined),
  sendPhoneOtp: jest.fn().mockResolvedValue(undefined),
  verifyPhoneOtp: jest.fn().mockResolvedValue(undefined),
  signIn: jest.fn().mockResolvedValue(undefined),
  signUp: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  handleAuthError: jest.fn().mockResolvedValue(false),
};

// AuthProvider mock - just renders children
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Hook mocks
export const useSupabaseClient = jest.fn(() => mockSupabaseClient);
export const useSession = jest.fn(() => mockSession);
export const useUser = jest.fn(() => mockUser);
export const useAuth = jest.fn(() => mockAuthContextValue);
export const useAuthErrorHandler = jest.fn(() => ({
  handleError: jest.fn().mockResolvedValue(false),
}));

// Helper to reset all mocks
export const resetAuthMocks = () => {
  useSupabaseClient.mockReturnValue(mockSupabaseClient);
  useSession.mockReturnValue(mockSession);
  useUser.mockReturnValue(mockUser);
  useAuth.mockReturnValue(mockAuthContextValue);
  useAuthErrorHandler.mockReturnValue({ handleError: jest.fn().mockResolvedValue(false) });
};

// Utility function mock
export function withAuthErrorHandling<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return fn;
}
