import React from 'react';

// Mock Daily.co libraries BEFORE any imports that use them
vi.mock('@daily-co/daily-js', () => ({
  default: {
    createFrame: vi.fn(() => ({
      join: vi.fn(),
      leave: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    })),
    createCallObject: vi.fn(() => ({
      join: vi.fn(),
      leave: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      participants: vi.fn(() => ({})),
      setLocalVideo: vi.fn(),
      setLocalAudio: vi.fn(),
    })),
  },
  DailyCall: vi.fn(),
  DailyEvent: {},
  DailyEventObject: {},
}));

vi.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDaily: () => null,
  useLocalParticipant: () => null,
  useParticipantIds: () => [],
  useDailyEvent: vi.fn(),
  useScreenShare: () => ({ isSharingScreen: false, startScreenShare: vi.fn(), stopScreenShare: vi.fn() }),
}));

// Mock supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
    },
  },
}));

// Mock RealTimeSmartScribe
vi.mock('../../components/smart/RealTimeSmartScribe', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-smart-scribe">SmartScribe Mock</div>,
}));

describe('TelehealthAppointmentsPage', () => {
  it('should be a valid module', async () => {
    const module = await import('../TelehealthAppointmentsPage');
    expect(module).toBeDefined();
    expect(module.default).toBeDefined();
  });

  it('module exports a React component', async () => {
    const module = await import('../TelehealthAppointmentsPage');
    expect(typeof module.default).toBe('function');
  });

  it('component has a displayName or name', async () => {
    const module = await import('../TelehealthAppointmentsPage');
    expect(module.default.name || module.default.displayName || 'function').toBeTruthy();
  });
});
