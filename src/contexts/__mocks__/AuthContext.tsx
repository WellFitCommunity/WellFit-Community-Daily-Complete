/**
 * AuthContext Mock for Jest Tests
 *
 * Provides consistent mock implementations for all AuthContext exports.
 * Tests can override these mocks as needed using vi.mocked().
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
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: mockSession }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: mockSession, user: mockUser }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.url' } }),
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
  signInEmailPassword: vi.fn().mockResolvedValue(undefined),
  sendPhoneOtp: vi.fn().mockResolvedValue(undefined),
  verifyPhoneOtp: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  handleAuthError: vi.fn().mockResolvedValue(false),
};

// AuthProvider mock - just renders children
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Hook mocks
export const useSupabaseClient = vi.fn(() => mockSupabaseClient);
export const useSession = vi.fn(() => mockSession);
export const useUser = vi.fn(() => mockUser);
export const useAuth = vi.fn(() => mockAuthContextValue);
export const useAuthErrorHandler = vi.fn(() => ({
  handleError: vi.fn().mockResolvedValue(false),
}));

// Helper to reset all mocks
export const resetAuthMocks = () => {
  useSupabaseClient.mockReturnValue(mockSupabaseClient);
  useSession.mockReturnValue(mockSession);
  useUser.mockReturnValue(mockUser);
  useAuth.mockReturnValue(mockAuthContextValue);
  useAuthErrorHandler.mockReturnValue({ handleError: vi.fn().mockResolvedValue(false) });
};

// Utility function mock
export function withAuthErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T {
  return fn;
}
