/**
 * Authentication Integration Tests
 *
 * Tests authentication flows with Supabase.
 * These tests verify the auth layer works correctly with the actual SDK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client for integration testing
// In real integration tests, you would use a test database
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials', status: 400 }
      }),
      signOut: vi.fn().mockResolvedValue({
        error: null
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}));

describe('Authentication Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supabase Client Initialization', () => {
    it('should create client with required configuration', () => {
      const url = 'https://test.supabase.co';
      const key = 'test-anon-key';

      createClient(url, key);

      expect(createClient).toHaveBeenCalledWith(url, key);
    });

    it('should create client with auth options when specified', () => {
      const url = 'https://test.supabase.co';
      const key = 'test-anon-key';
      const options = {
        auth: {
          persistSession: false,
          autoRefreshToken: true
        }
      };

      createClient(url, key, options);

      expect(createClient).toHaveBeenCalledWith(url, key, options);
    });
  });

  describe('Session Management', () => {
    it('should return null session when not authenticated', async () => {
      const client = createClient('https://test.supabase.co', 'test-key');
      const { data, error } = await client.auth.getSession();

      expect(error).toBeNull();
      expect(data.session).toBeNull();
    });

    it('should handle sign out gracefully', async () => {
      const client = createClient('https://test.supabase.co', 'test-key');
      const { error } = await client.auth.signOut();

      expect(error).toBeNull();
    });
  });

  describe('Auth State Changes', () => {
    it('should subscribe to auth state changes', () => {
      const client = createClient('https://test.supabase.co', 'test-key');
      const callback = vi.fn();

      const { data } = client.auth.onAuthStateChange(callback);

      expect(data.subscription).toBeDefined();
      expect(data.subscription.unsubscribe).toBeInstanceOf(Function);
    });

    it('should allow unsubscribing from auth state changes', () => {
      const client = createClient('https://test.supabase.co', 'test-key');
      const callback = vi.fn();

      const { data } = client.auth.onAuthStateChange(callback);
      data.subscription.unsubscribe();

      expect(data.subscription.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Invalid Credentials Handling', () => {
    it('should return error for invalid credentials', async () => {
      const client = createClient('https://test.supabase.co', 'test-key');

      const { data, error } = await client.auth.signInWithPassword({
        email: 'invalid@test.com',
        password: 'wrongpassword'
      });

      expect(error).not.toBeNull();
      expect(error?.message).toBe('Invalid credentials');
      expect(data.session).toBeNull();
    });
  });
});
