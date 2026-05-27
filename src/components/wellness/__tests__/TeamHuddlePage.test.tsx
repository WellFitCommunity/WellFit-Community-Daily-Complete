/**
 * TeamHuddlePage tests
 *
 * Coverage:
 *   - Categorization logic (Deletion Test: would fail if categorize logic
 *     was deleted/inverted)
 *   - Page renders all three buckets correctly from a mock dataset
 *   - Quick-action buttons emit the expected audit events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { categorizeProvider } from '../team-huddle/types';
import { TeamHuddlePage } from '../TeamHuddlePage';
import { auditLogger } from '../../../services/auditLogger';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// Hold per-table fake data; we override supabase.from to return chainable
// builders whose final await resolves to { data, error: null }
interface FakeBuilder {
  select: () => FakeBuilder;
  eq: () => FakeBuilder;
  gte: () => FakeBuilder;
  in: () => FakeBuilder;
  order: () => FakeBuilder;
  single: () => FakeBuilder;
  maybeSingle: () => FakeBuilder;
  then: (onF: (v: { data: unknown; error: null }) => unknown) => Promise<unknown>;
}

function makeBuilder(data: unknown): FakeBuilder {
  const b: FakeBuilder = {
    select: () => b,
    eq: () => b,
    gte: () => b,
    in: () => b,
    order: () => b,
    single: () => b,
    maybeSingle: () => b,
    then: (onF) => Promise.resolve({ data, error: null }).then(onF),
  };
  return b;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const ymd = (d: Date) => d.toISOString().split('T')[0];

function setupSupabaseTables(): void {
  const todayStr = ymd(today);
  const eightDaysAgoStr = ymd(new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000));

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'fhir_practitioners') {
      return makeBuilder([
        { id: 'pr-1', user_id: 'user-urgent' },
        { id: 'pr-2', user_id: 'user-watch' },
        { id: 'pr-3', user_id: 'user-good' },
      ]) as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'provider_daily_checkins') {
      return makeBuilder([
        {
          user_id: 'user-urgent',
          stress_level: 9,
          energy_level: 3,
          mood_rating: 3,
          work_setting: 'hospital_shift',
          shift_type: 'night',
          unsafe_staffing: true,
          felt_overwhelmed: true,
          missed_break: true,
          checkin_date: todayStr,
        },
        {
          user_id: 'user-watch',
          stress_level: 6,
          energy_level: 5,
          mood_rating: 6,
          work_setting: 'office',
          shift_type: 'day',
          unsafe_staffing: false,
          felt_overwhelmed: false,
          missed_break: false,
          checkin_date: todayStr,
        },
        {
          user_id: 'user-good',
          stress_level: 2,
          energy_level: 9,
          mood_rating: 9,
          work_setting: 'remote',
          shift_type: 'day',
          unsafe_staffing: false,
          felt_overwhelmed: false,
          missed_break: false,
          checkin_date: todayStr,
        },
        // Decoy stale row to ensure date filtering does not break
        {
          user_id: 'user-stale',
          stress_level: 1,
          energy_level: 10,
          mood_rating: 10,
          work_setting: 'remote',
          shift_type: 'day',
          unsafe_staffing: false,
          felt_overwhelmed: false,
          missed_break: false,
          checkin_date: eightDaysAgoStr,
        },
      ]) as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'audit_logs') {
      return makeBuilder([]) as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'profiles') {
      return makeBuilder([
        {
          user_id: 'user-urgent',
          first_name: 'Alpha',
          last_name: 'Urgent',
          role: 'nurse',
          department: 'ICU',
        },
        {
          user_id: 'user-watch',
          first_name: 'Bravo',
          last_name: 'Watch',
          role: 'nurse',
          department: 'Med-Surg',
        },
        {
          user_id: 'user-good',
          first_name: 'Charlie',
          last_name: 'Good',
          role: 'nurse',
          department: 'Outpatient',
        },
      ]) as unknown as ReturnType<typeof supabase.from>;
    }
    return makeBuilder([]) as unknown as ReturnType<typeof supabase.from>;
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeamHuddlePage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSupabaseTables();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Categorization (pure-function deletion test)
// ---------------------------------------------------------------------------

describe('categorizeProvider', () => {
  it('returns urgent for stress >= 7 with fresh check-in', () => {
    const result = categorizeProvider(
      {
        user_id: 'x',
        stress_level: 8,
        energy_level: 7,
        mood_rating: 7,
        work_setting: null,
        shift_type: null,
        unsafe_staffing: false,
        felt_overwhelmed: false,
        missed_break: null,
        checkin_date: '2026-05-27',
      },
      0
    );
    expect(result).toBe('urgent');
  });

  it('returns urgent for unsafe_staffing flag even with mid-range scores', () => {
    const result = categorizeProvider(
      {
        user_id: 'x',
        stress_level: 5,
        energy_level: 6,
        mood_rating: 6,
        work_setting: null,
        shift_type: null,
        unsafe_staffing: true,
        felt_overwhelmed: false,
        missed_break: null,
        checkin_date: '2026-05-27',
      },
      0
    );
    expect(result).toBe('urgent');
  });

  it('returns urgent when daysSinceCheckin is null (never checked in)', () => {
    expect(categorizeProvider(null, null)).toBe('urgent');
  });

  it('returns urgent when last check-in is 7+ days old', () => {
    expect(categorizeProvider(null, 7)).toBe('urgent');
    expect(categorizeProvider(null, 10)).toBe('urgent');
  });

  it('returns watch for mid-range signals (stress 5-6)', () => {
    const result = categorizeProvider(
      {
        user_id: 'x',
        stress_level: 6,
        energy_level: 7,
        mood_rating: 7,
        work_setting: null,
        shift_type: null,
        unsafe_staffing: false,
        felt_overwhelmed: false,
        missed_break: null,
        checkin_date: '2026-05-27',
      },
      0
    );
    expect(result).toBe('watch');
  });

  it('returns good for low stress + high energy + recent check-in', () => {
    const result = categorizeProvider(
      {
        user_id: 'x',
        stress_level: 2,
        energy_level: 9,
        mood_rating: 9,
        work_setting: null,
        shift_type: null,
        unsafe_staffing: false,
        felt_overwhelmed: false,
        missed_break: null,
        checkin_date: '2026-05-27',
      },
      0
    );
    expect(result).toBe('good');
  });
});

// ---------------------------------------------------------------------------
// Page rendering and categorization integration
// ---------------------------------------------------------------------------

describe('TeamHuddlePage rendering', () => {
  it('renders the page title and back link after loading', async () => {
    renderPage();
    expect(
      await screen.findByText('Start-of-Shift Team Huddle')
    ).toBeInTheDocument();
    expect(screen.getByText(/Back to wellness radar/i)).toBeInTheDocument();
  });

  it('places each mock provider in the correct bucket', async () => {
    renderPage();
    // Urgent
    expect(await screen.findByText('Alpha Urgent')).toBeInTheDocument();
    // Watch
    expect(screen.getByText('Bravo Watch')).toBeInTheDocument();
    // Good
    expect(screen.getByText('Charlie Good')).toBeInTheDocument();

    // Section ordering: urgent header precedes watch header precedes good header
    const headers = screen.getAllByRole('heading', { level: 2 });
    const headerText = headers.map((h) => h.textContent);
    const urgentIdx = headerText.findIndex((t) => t?.includes('Needs attention'));
    const watchIdx = headerText.findIndex((t) => t?.includes('Watch list'));
    const goodIdx = headerText.findIndex((t) => t?.includes('Good'));
    expect(urgentIdx).toBeGreaterThan(-1);
    expect(watchIdx).toBeGreaterThan(urgentIdx);
    expect(goodIdx).toBeGreaterThan(watchIdx);
  });

  it('shows signal chips reflecting the urgent provider state', async () => {
    renderPage();
    await screen.findByText('Alpha Urgent');
    // Urgent row has stress 9, overwhelmed, unsafe_staffing
    expect(screen.getByText('Stress 9')).toBeInTheDocument();
    expect(screen.getByText('Unsafe staffing')).toBeInTheDocument();
    expect(screen.getByText('Overwhelmed')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Audit events on quick actions
// ---------------------------------------------------------------------------

describe('TeamHuddlePage actions', () => {
  it('logs HUDDLE_NUDGE_SENT when Send nudge is clicked', async () => {
    renderPage();
    await screen.findByText('Alpha Urgent');
    const nudgeBtn = screen.getByRole('button', {
      name: /Send check-in nudge to Alpha Urgent/i,
    });
    fireEvent.click(nudgeBtn);

    await waitFor(() => {
      expect(auditLogger.info).toHaveBeenCalledWith(
        'HUDDLE_NUDGE_SENT',
        expect.objectContaining({ nurse_id: 'user-urgent', bucket: 'urgent' })
      );
    });
  });

  it('logs HUDDLE_DISCUSSED and moves provider into the Discussed today section', async () => {
    renderPage();
    await screen.findByText('Alpha Urgent');
    const discussBtn = screen.getByRole('button', {
      name: /Mark Alpha Urgent as discussed/i,
    });
    fireEvent.click(discussBtn);

    await waitFor(() => {
      expect(auditLogger.info).toHaveBeenCalledWith(
        'HUDDLE_DISCUSSED',
        expect.objectContaining({ nurse_id: 'user-urgent', bucket: 'urgent' })
      );
    });

    // Should now appear in Discussed today section header
    expect(await screen.findByText('Discussed today')).toBeInTheDocument();
  });

  it('opens the 1:1 dialog and logs HUDDLE_1ON1_SCHEDULED on submit', async () => {
    renderPage();
    await screen.findByText('Alpha Urgent');
    fireEvent.click(
      screen.getByRole('button', { name: /Schedule 1:1 with Alpha Urgent/i })
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const dateInput = screen.getByLabelText('Date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-06-01' } });

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(() => {
      expect(auditLogger.info).toHaveBeenCalledWith(
        'HUDDLE_1ON1_SCHEDULED',
        expect.objectContaining({
          nurse_id: 'user-urgent',
          scheduled_for: '2026-06-01',
        })
      );
    });
  });
});
