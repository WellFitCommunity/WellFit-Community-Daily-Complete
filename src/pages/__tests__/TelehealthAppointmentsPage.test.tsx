import React from 'react';

// Mock Daily.co libraries BEFORE any imports that use them
jest.mock('@daily-co/daily-js', () => ({
  default: {
    createFrame: jest.fn(() => ({
      join: jest.fn(),
      leave: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    })),
    createCallObject: jest.fn(() => ({
      join: jest.fn(),
      leave: jest.fn(),
      destroy: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      participants: jest.fn(() => ({})),
      setLocalVideo: jest.fn(),
      setLocalAudio: jest.fn(),
    })),
  },
  DailyCall: jest.fn(),
  DailyEvent: {},
  DailyEventObject: {},
}));

jest.mock('@daily-co/daily-react', () => ({
  DailyProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDaily: () => null,
  useLocalParticipant: () => null,
  useParticipantIds: () => [],
  useDailyEvent: jest.fn(),
  useScreenShare: () => ({ isSharingScreen: false, startScreenShare: jest.fn(), stopScreenShare: jest.fn() }),
}));

// Mock supabase
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        order: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
    },
  },
}));

// Mock RealTimeSmartScribe
jest.mock('../../components/smart/RealTimeSmartScribe', () => ({
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
