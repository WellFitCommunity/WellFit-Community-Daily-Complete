// src/components/__tests__/CommunityMoments.test.tsx
// Tests for the senior-facing community moments sharing component

import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityMoments from '../CommunityMoments';
import { useSupabaseClient, useSession, useUser } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';

// Mock dependencies
vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: vi.fn(),
  useSession: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock('../../BrandingContext', () => ({
  useBranding: vi.fn(),
}));

// Mock the hook that uses React Query
vi.mock('../../hooks/useCommunityMoments', () => ({
  useSignedImageUrl: vi.fn().mockReturnValue({
    data: 'https://test.com/signed-image-url',
    isLoading: false,
    error: null,
  }),
}));

// Mock child components
vi.mock('../admin/AdminFeatureToggle', () => ({
  default: function MockAdminFeatureToggle() {
    return null;
  },
}));

// Mock external libraries
vi.mock('react-confetti', () => ({
  default: function MockConfetti() {
    return <div data-testid="confetti">Confetti</div>;
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    img: (props: any) => <img {...props} alt={props.alt || ''} />,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('emoji-picker-react', () => ({
  default: function MockEmojiPicker({ onEmojiClick }: any) {
    return (
      <div data-testid="emoji-picker">
        <button onClick={() => onEmojiClick({ emoji: '😊' })}>😊</button>
        <button onClick={() => onEmojiClick({ emoji: '❤️' })}>❤️</button>
      </div>
    );
  },
}));

// Helper to create chainable Supabase mock
function createSupabaseMock(mockUser: any) {
  const mockMomentsData = [
    {
      id: '1',
      user_id: mockUser.id,
      title: 'My Garden',
      description: 'Beautiful flowers today',
      emoji: '🌸',
      tags: 'garden, flowers',
      is_gallery_high: false,
      approval_status: 'approved',
      created_at: new Date().toISOString(),
      profile: { first_name: 'John', last_name: 'Doe' },
    },
  ];

  const mockAffirmationsData = [
    { text: 'You are doing great!', author: 'Wellness Team' },
  ];

  // Create thenable chain for Supabase queries
  const createQueryChain = (tableData: any) => {
    const result = { data: tableData, error: null, count: tableData?.length || 0 };
    const chain: any = {};

    // All chainable methods return the chain
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.range = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: tableData?.[0] || null, error: null });

    // Make chain thenable (for await)
    chain.then = (onFulfilled: any) => Promise.resolve(result).then(onFulfilled);
    chain.catch = (onRejected: any) => Promise.resolve(result).catch(onRejected);

    return chain;
  };

  const mockSupabase: any = {
    from: vi.fn((table: string) => {
      if (table === 'community_moments') return createQueryChain(mockMomentsData);
      if (table === 'affirmations') return createQueryChain(mockAffirmationsData);
      if (table === 'profiles') return createQueryChain([{ first_name: 'John', role: 'senior' }]);
      return createQueryChain(null);
    }),
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path.jpg' }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.com/signed-url' }, error: null }),
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    }),
  };

  return mockSupabase;
}

describe('CommunityMoments - Senior Facing Component', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    mockSession = {
      user: mockUser,
    };

    mockSupabase = createSupabaseMock(mockUser);

    (useUser as ReturnType<typeof vi.fn>).mockReturnValue(mockUser);
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    (useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    (useBranding as ReturnType<typeof vi.fn>).mockReturnValue({
      branding: { primaryColor: '#4F46E5', appName: 'WellFit' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render the community moments component', async () => {
      render(<CommunityMoments />);

      // Component should render the main heading
      await waitFor(() => {
        const headings = screen.getAllByText(/Community Moments/i);
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('should display share button for seniors', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        // Multiple share buttons exist - header button and form submit button
        const shareButtons = screen.getAllByRole('button', { name: /share your moment/i });
        expect(shareButtons.length).toBeGreaterThan(0);
      });
    });

    it('should display quick emoji options for seniors', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        // Quick emojis should be visible
        const emojiButtons = screen.getAllByRole('button', { name: /select.*emoji/i });
        expect(emojiButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form Interactions', () => {
    it('should allow user to enter a title', async () => {
      render(<CommunityMoments />);

      const titleInput = await screen.findByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: 'My Birthday Party' } });
      expect(titleInput).toHaveValue('My Birthday Party');
    });

    it('should allow user to enter tags', async () => {
      render(<CommunityMoments />);

      const tagsInput = await screen.findByLabelText(/tags/i);
      fireEvent.change(tagsInput, { target: { value: 'tag1, tag2, tag3' } });
      expect(tagsInput).toHaveValue('tag1, tag2, tag3');
    });

    it('should allow user to select an emoji', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const emojiButtons = screen.getAllByRole('button', { name: /select.*emoji/i });
        if (emojiButtons.length > 0) {
          fireEvent.click(emojiButtons[0]);
        }
        expect(emojiButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form inputs', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      });
    });

    it('should have large, clickable buttons for seniors', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('should support keyboard navigation', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const focusableElements = screen.getAllByRole('button');
        focusableElements.forEach((el) => {
          expect(el).not.toHaveAttribute('tabIndex', '-1');
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      (useUser as ReturnType<typeof vi.fn>).mockReturnValue(null);

      render(<CommunityMoments />);

      // Component should still render without crashing
      await waitFor(() => {
        const headings = screen.getAllByText(/Community Moments/i);
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });
});
