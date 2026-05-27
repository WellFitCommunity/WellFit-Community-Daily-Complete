/**
 * WellnessReportPage tests
 *
 * Coverage:
 *   - Page renders with title, timeframe radios, and embedded radar
 *   - Timeframe toggle updates aria-checked state
 *   - CSV download creates a Blob via URL.createObjectURL and triggers
 *     anchor click + audit log
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { WellnessReportPage } from '../WellnessReportPage';
import { auditLogger } from '../../../services/auditLogger';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the embedded radar to keep this test focused on the report page
vi.mock('../AdminBurnoutRadar', () => ({
  AdminBurnoutRadar: () => <div data-testid="mock-radar">[radar]</div>,
  default: () => <div data-testid="mock-radar">[radar]</div>,
}));

interface FakeBuilder {
  select: () => FakeBuilder;
  eq: () => FakeBuilder;
  gte: () => FakeBuilder;
  single: () => FakeBuilder;
  maybeSingle: () => FakeBuilder;
  then: (onF: (v: { data: unknown; error: null }) => unknown) => Promise<unknown>;
}

function makeBuilder(data: unknown): FakeBuilder {
  const b: FakeBuilder = {
    select: () => b,
    eq: () => b,
    gte: () => b,
    single: () => b,
    maybeSingle: () => b,
    then: (onF) => Promise.resolve({ data, error: null }).then(onF),
  };
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { id: 'mgr-1' } },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    if (table === 'profiles') {
      return makeBuilder({ tenant_id: 'tenant-x' }) as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'provider_daily_checkins') {
      return makeBuilder([
        {
          checkin_date: '2026-05-25',
          stress_level: 6,
          energy_level: 6,
          mood_rating: 7,
          missed_break: false,
        },
        {
          checkin_date: '2026-05-25',
          stress_level: 8,
          energy_level: 4,
          mood_rating: 5,
          missed_break: true,
        },
        {
          checkin_date: '2026-05-26',
          stress_level: 3,
          energy_level: 8,
          mood_rating: 8,
          missed_break: false,
        },
      ]) as unknown as ReturnType<typeof supabase.from>;
    }
    if (table === 'provider_burnout_assessments') {
      return makeBuilder([
        { assessment_date: '2026-05-25T10:00:00Z', risk_level: 'high' },
        { assessment_date: '2026-05-26T10:00:00Z', risk_level: 'low' },
      ]) as unknown as ReturnType<typeof supabase.from>;
    }
    return makeBuilder([]) as unknown as ReturnType<typeof supabase.from>;
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <WellnessReportPage />
    </MemoryRouter>
  );
}

describe('WellnessReportPage rendering', () => {
  it('renders title, description, timeframe radio group, and embedded radar', async () => {
    renderPage();
    expect(screen.getByText('Wellness Report')).toBeInTheDocument();
    expect(
      screen.getByText(/Aggregate, anonymized wellness signals for export/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /Report timeframe/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('mock-radar')).toBeInTheDocument();
  });

  it('renders all three timeframe options with 30 days selected by default', () => {
    renderPage();
    const r30 = screen.getByRole('radio', { name: 'Last 30 days' });
    const r60 = screen.getByRole('radio', { name: 'Last 60 days' });
    const r90 = screen.getByRole('radio', { name: 'Last 90 days' });
    expect(r30).toHaveAttribute('aria-checked', 'true');
    expect(r60).toHaveAttribute('aria-checked', 'false');
    expect(r90).toHaveAttribute('aria-checked', 'false');
  });

  it('updates aria-checked when a different timeframe is selected', () => {
    renderPage();
    const r60 = screen.getByRole('radio', { name: 'Last 60 days' });
    fireEvent.click(r60);
    expect(r60).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('radio', { name: 'Last 30 days' })
    ).toHaveAttribute('aria-checked', 'false');
  });
});

describe('WellnessReportPage CSV export', () => {
  it('creates a Blob URL, clicks an anchor, and logs the audit event when CSV is clicked', async () => {
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fake-url');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    renderPage();
    const csvBtn = screen.getByRole('button', {
      name: /Download wellness report as CSV/i,
    });

    // Tenant resolution is async; wait one microtask cycle so the audit log
    // includes the resolved tenant_id.
    await waitFor(() => {
      expect(vi.mocked(supabase.auth.getUser)).toHaveBeenCalled();
    });
    // Flush one more tick to let the profile fetch settle.
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(csvBtn);

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    // The Blob argument should look like a CSV (header + at least one row).
    // jsdom does not implement Blob.text(), so read via FileReader.
    const blobArg = createObjectURLSpy.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    const blob = blobArg as Blob;
    expect(blob.type).toContain('text/csv');
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsText(blob);
    });
    expect(text).toContain('date,checkin_count,avg_stress');
    // Assert there's at least one ISO date row in the body (not hardcoding
    // specific dates so the test stays stable as wall-clock time advances).
    expect(text).toMatch(/\n\d{4}-\d{2}-\d{2},/);

    await waitFor(() => {
      expect(auditLogger.info).toHaveBeenCalledWith(
        'WELLNESS_REPORT_EXPORTED',
        expect.objectContaining({
          format: 'csv',
          timeframe: 30,
          tenantId: 'tenant-x',
        })
      );
    });

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:fake-url');
  });
});

describe('WellnessReportPage PDF export', () => {
  it('calls window.print() and logs the audit event when PDF is clicked', async () => {
    const printSpy = vi
      .spyOn(window, 'print')
      .mockImplementation(() => undefined);

    renderPage();
    const pdfBtn = screen.getByRole('button', {
      name: /Download wellness report as PDF/i,
    });
    fireEvent.click(pdfBtn);

    await waitFor(() => {
      expect(auditLogger.info).toHaveBeenCalledWith(
        'WELLNESS_REPORT_EXPORTED',
        expect.objectContaining({
          format: 'pdf',
          timeframe: 30,
        })
      );
    });
    expect(printSpy).toHaveBeenCalledTimes(1);
  });
});
