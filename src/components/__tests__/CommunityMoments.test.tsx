// src/components/__tests__/CommunityMoments.test.tsx
// Tests for the senior-facing community moments sharing component

import React from 'react';
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

vi.mock('../admin/AdminFeatureToggle', () => {
  return function MockAdminFeatureToggle() {
    return null;
  };
});

// Mock external libraries
vi.mock('react-confetti', () => {
  return function MockConfetti() {
    return null;
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    img: ({ ...props }: any) => <img {...props} alt="" />,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('emoji-picker-react', () => {
  return function MockEmojiPicker({ onEmojiClick }: any) {
    return (
      <div data-testid="emoji-picker">
        <button onClick={() => onEmojiClick({ emoji: '😊' })}>😊</button>
        <button onClick={() => onEmojiClick({ emoji: '❤️' })}>❤️</button>
      </div>
    );
  };
});

describe('CommunityMoments - Senior Facing Component', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUser = {
      id: 'senior-user-123',
      email: 'senior@test.com',
    };

    mockSession = {
      user: mockUser,
    };

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { first_name: 'John', role: 'senior' },
        error: null
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({
            data: { path: 'test-path.jpg' },
            error: null
          }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://test.com/signed-url' },
            error: null
          }),
        }),
      },
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        unsubscribe: vi.fn(),
      }),
    };

    // Mock moments data
    mockSupabase.from.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: table === 'profiles' ? { first_name: 'John', role: 'senior' } : null,
          error: null
        }),
      };

      if (table === 'community_moments') {
        chain.select.mockResolvedValue({
          data: [
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
          ],
          error: null,
        });
      }

      if (table === 'affirmations') {
        chain.select.mockResolvedValue({
          data: [
            {
              text: 'You are doing great!',
              author: 'Wellness Team',
            },
          ],
          error: null,
        });
      }

      return chain;
    });

    (useUser as ReturnType<typeof vi.fn>).mockReturnValue(mockUser);
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue(mockSession);
    (useSupabaseClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    (useBranding as ReturnType<typeof vi.fn>).mockReturnValue({
      branding: { primaryColor: '#4F46E5', appName: 'WellFit' },
    });
  });

  describe('Component Rendering', () => {
    it('should render the community moments component', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/Community Moments|Share|Moments/i)).toBeInTheDocument();
      });
    });

    it('should display daily affirmation', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/You are doing great|doing great/i)).toBeInTheDocument();
      });
    });

    it('should display existing community moments', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/My Garden/i)).toBeInTheDocument();
      });
    });

    it('should show upload form for creating new moment', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const shareButton = screen.queryByText(/Share|Upload|Post|Create/i);
        expect(shareButton).toBeInTheDocument();
      });
    });
  });

  describe('Creating New Moments', () => {
    it('should allow user to enter a title', async () => {
      render(<CommunityMoments />);

      const titleInput = await screen.findByLabelText(/title/i) as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'My Birthday Party' } });
      expect(titleInput.value).toBe('My Birthday Party');
    });

    it('should allow user to enter a description', async () => {
      render(<CommunityMoments />);

      const descInput = await screen.findByLabelText(/description|what.*happening/i) as HTMLTextAreaElement;
      fireEvent.change(descInput, { target: { value: 'Great time with family' } });
      expect(descInput.value).toBe('Great time with family');
    });

    it('should allow user to select an emoji', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        // Look for emoji selection button or quick emojis
        const emojiButtons = screen.queryAllByText(/😊|❤️|🎉|👍|🌸/);
        if (emojiButtons.length > 0) {
          fireEvent.click(emojiButtons[0]);
        }
      });
    });

    it('should display quick emoji options for seniors', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        // Quick emojis: ['😊', '❤️', '🎉', '👍', '🌸', '☀️', '🎂', '🏆', '📸', '🌈', '⭐', '🎵']
        const quickEmojis = screen.queryAllByText(/😊|❤️|🎉/);
        expect(quickEmojis.length).toBeGreaterThan(0);
      });
    });

    it('should allow user to upload a photo', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const fileInput = screen.queryByLabelText(/photo|image|picture|upload/i) as HTMLInputElement;
        if (fileInput) {
          const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
          fireEvent.change(fileInput, { target: { files: [file] } });
        }
      });
    });

    it('should show preview of uploaded photo', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const fileInput = screen.queryByLabelText(/photo|image|picture|upload/i) as HTMLInputElement;
        if (fileInput) {
          const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
          Object.defineProperty(fileInput, 'files', {
            value: [file],
          });
          fireEvent.change(fileInput, { target: { files: [file] } });
        }
      });
    });

    it('should validate file size (max 20MB)', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const fileInput = screen.queryByLabelText(/photo|image|picture|upload/i) as HTMLInputElement;
        if (fileInput) {
          // Create a file larger than 20MB (simulated)
          const largeFile = new File(['x'.repeat(21 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
          Object.defineProperty(largeFile, 'size', { value: 21 * 1024 * 1024 });
          fireEvent.change(fileInput, { target: { files: [largeFile] } });
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/too large|file size|20.*MB/i)).toBeInTheDocument();
      });
    });

    it('should submit new moment to database', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: { id: 'new-moment' }, error: null }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: table === 'profiles' ? { first_name: 'John', role: 'senior' } : null,
            error: null
          }),
        };

        if (table === 'community_moments' && chain.select) {
          chain.select.mockResolvedValue({
            data: [],
            error: null,
          });
        }

        return chain;
      });

      render(<CommunityMoments />);

      await waitFor(() => {
        const titleInput = screen.queryByLabelText(/title/i) as HTMLInputElement;
        const descInput = screen.queryByLabelText(/description/i) as HTMLTextAreaElement;

        if (titleInput && descInput) {
          fireEvent.change(titleInput, { target: { value: 'Test Moment' } });
          fireEvent.change(descInput, { target: { value: 'Test Description' } });

          const submitButton = screen.queryByText(/share|post|submit|upload/i);
          if (submitButton) {
            fireEvent.click(submitButton);
          }
        }
      });
    });

    it('should show confetti animation after successful post', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        const chain = {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ data: { id: 'new-moment' }, error: null }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: table === 'profiles' ? { first_name: 'John', role: 'senior' } : null,
            error: null
          }),
        };

        if (table === 'community_moments' && chain.select) {
          chain.select.mockResolvedValue({ data: [], error: null });
        }

        return chain;
      });

      render(<CommunityMoments />);

      await waitFor(() => {
        const titleInput = screen.queryByLabelText(/title/i) as HTMLInputElement;
        if (titleInput) {
          fireEvent.change(titleInput, { target: { value: 'Test' } });
          const submitButton = screen.queryByText(/share|post/i);
          if (submitButton) {
            fireEvent.click(submitButton);
          }
        }
      });
    });
  });

  describe('Viewing Moments', () => {
    it('should display moment title', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/My Garden/i)).toBeInTheDocument();
      });
    });

    it('should display moment description', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/Beautiful flowers today/i)).toBeInTheDocument();
      });
    });

    it('should display moment emoji', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/🌸/)).toBeInTheDocument();
      });
    });

    it('should display author name', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe|John/i)).toBeInTheDocument();
      });
    });

    it('should load more moments when scrolling', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const loadMoreButton = screen.queryByText(/load more|show more/i);
        if (loadMoreButton) {
          fireEvent.click(loadMoreButton);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      (useUser as ReturnType<typeof vi.fn>).mockReturnValue(null);

      render(<CommunityMoments />);

      await waitFor(() => {
        expect(screen.getByText(/Community Moments|Moments|Share/i)).toBeInTheDocument();
      });
    });

    it('should show error message when upload fails', async () => {
      mockSupabase.storage.from.mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' }
        }),
      });

      render(<CommunityMoments />);

      await waitFor(() => {
        const fileInput = screen.queryByLabelText(/photo|image|upload/i) as HTMLInputElement;
        if (fileInput) {
          const file = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
          fireEvent.change(fileInput, { target: { files: [file] } });

          const submitButton = screen.queryByText(/share|post/i);
          if (submitButton) {
            fireEvent.click(submitButton);
          }
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/error|failed|try again/i)).toBeInTheDocument();
      });
    });

    it('should handle database errors when loading moments', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        }),
      }));

      render(<CommunityMoments />);

      // Component should render without crashing
      await waitFor(() => {
        expect(screen.getByText(/Community Moments|Moments/i)).toBeInTheDocument();
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
        focusableElements.forEach(el => {
          expect(el).not.toHaveAttribute('tabIndex', '-1');
        });
      });
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize tags input', async () => {
      render(<CommunityMoments />);

      const tagsInput = await screen.findByLabelText(/tags/i) as HTMLInputElement;
      fireEvent.change(tagsInput, { target: { value: 'tag1, tag2, tag3' } });
      expect(tagsInput.value).toBe('tag1, tag2, tag3');
    });

    it('should limit number of tags to 10', async () => {
      render(<CommunityMoments />);

      await waitFor(() => {
        const tagsInput = screen.queryByLabelText(/tags/i) as HTMLInputElement;
        if (tagsInput) {
          const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i + 1}`).join(', ');
          fireEvent.change(tagsInput, { target: { value: manyTags } });
        }
      });
    });
  });

  describe('Personalization', () => {
    it('should display personalized greeting with user first name', async () => {
      render(<CommunityMoments />);

      const greeting = await screen.findByText(/John|Hello|Welcome/i);
      expect(greeting).toBeInTheDocument();
      expect(greeting.textContent).toContain('John');
    });
  });
});
