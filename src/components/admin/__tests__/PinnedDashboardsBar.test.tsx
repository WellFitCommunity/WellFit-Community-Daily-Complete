/**
 * PinnedDashboardsBar Tests
 *
 * Tests pinned section rendering, expand/collapse, unpin behavior,
 * empty/loading states, and section count display.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockTogglePin = vi.fn().mockResolvedValue(undefined);
let mockPinnedIds: string[] = [];
let mockIsLoading = false;

vi.mock('../../../contexts/PinnedSectionsContext', () => ({
  usePinnedSections: () => ({
    pinnedIds: mockPinnedIds,
    isPinned: (id: string) => mockPinnedIds.includes(id),
    togglePin: mockTogglePin,
    isLoading: mockIsLoading,
  }),
}));

const MOCK_SECTIONS = [
  {
    id: 'sec-billing',
    title: 'Billing Dashboard',
    subtitle: 'Revenue tracking',
    icon: '💰',
    headerColor: 'text-green-600',
    component: <div data-testid="billing-content">Billing Content</div>,
  },
  {
    id: 'sec-patients',
    title: 'Patient Care',
    subtitle: 'Active patients',
    icon: '🏥',
    headerColor: 'text-blue-600',
    component: <div data-testid="patient-content">Patient Content</div>,
  },
  {
    id: 'sec-security',
    title: 'Security',
    icon: '🔒',
    headerColor: 'text-red-600',
    component: <div data-testid="security-content">Security Content</div>,
  },
];

vi.mock('../sections/sectionDefinitions', () => ({
  getAllSections: () => MOCK_SECTIONS,
  SectionLoadingFallback: () => <div>Loading...</div>,
}));

vi.mock('../sections/types', () => ({}));

vi.mock('lucide-react', () => ({
  Pin: ({ className }: { className?: string }) => (
    <span data-testid="pin-icon" className={className}>Pin</span>
  ),
  X: ({ className }: { className?: string }) => (
    <span data-testid="x-icon" className={className}>X</span>
  ),
}));

// Import AFTER mocks
import PinnedDashboardsBar from '../PinnedDashboardsBar';

// ============================================================================
// HELPERS
// ============================================================================

function renderBar() {
  return render(<PinnedDashboardsBar />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('PinnedDashboardsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinnedIds = [];
    mockIsLoading = false;
  });

  // --- Empty / Loading States ---

  it('returns null when loading', () => {
    mockIsLoading = true;
    mockPinnedIds = ['sec-billing'];
    const { container } = renderBar();
    expect(container.innerHTML).toBe('');
  });

  it('returns null when no sections are pinned', () => {
    mockPinnedIds = [];
    const { container } = renderBar();
    expect(container.innerHTML).toBe('');
  });

  // --- Header ---

  it('shows "Pinned Dashboards" header when sections are pinned', () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    expect(screen.getByText('Pinned Dashboards')).toBeInTheDocument();
  });

  it('shows pin count "1/6" for 1 pinned section', () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    expect(screen.getByText('1/6')).toBeInTheDocument();
  });

  it('shows pin count "2/6" for 2 pinned sections', () => {
    mockPinnedIds = ['sec-billing', 'sec-patients'];
    renderBar();
    expect(screen.getByText('2/6')).toBeInTheDocument();
  });

  it('shows pin count "3/6" for 3 pinned sections', () => {
    mockPinnedIds = ['sec-billing', 'sec-patients', 'sec-security'];
    renderBar();
    expect(screen.getByText('3/6')).toBeInTheDocument();
  });

  // --- Section Rendering ---

  it('renders section title for each pinned section', () => {
    mockPinnedIds = ['sec-billing', 'sec-patients'];
    renderBar();
    expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Patient Care')).toBeInTheDocument();
  });

  it('renders section icon for each pinned section', () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders "Pinned" badge on each section', () => {
    mockPinnedIds = ['sec-billing', 'sec-patients'];
    renderBar();
    const badges = screen.getAllByText('Pinned');
    expect(badges).toHaveLength(2);
  });

  it('renders subtitle when present', () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    expect(screen.getByText('Revenue tracking')).toBeInTheDocument();
  });

  it('does not render subtitle when absent', () => {
    mockPinnedIds = ['sec-security'];
    renderBar();
    expect(screen.queryByText('Revenue tracking')).not.toBeInTheDocument();
    // Security section has no subtitle
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  // --- Expand / Collapse ---

  it('shows section content by default (expanded)', () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    expect(screen.getByTestId('billing-content')).toBeInTheDocument();
  });

  it('clicking header collapses section content', async () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    const user = userEvent.setup();

    // Content is visible initially
    expect(screen.getByTestId('billing-content')).toBeInTheDocument();

    // Click the header button (has aria-expanded)
    const expandBtn = screen.getByRole('button', { expanded: true });
    await user.click(expandBtn);

    // Content should be hidden
    expect(screen.queryByTestId('billing-content')).not.toBeInTheDocument();
  });

  it('clicking header again re-expands section content', async () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    const user = userEvent.setup();

    // Collapse
    const expandBtn = screen.getByRole('button', { expanded: true });
    await user.click(expandBtn);
    expect(screen.queryByTestId('billing-content')).not.toBeInTheDocument();

    // Re-expand
    const collapsedBtn = screen.getByRole('button', { expanded: false });
    await user.click(collapsedBtn);
    expect(screen.getByTestId('billing-content')).toBeInTheDocument();
  });

  // --- Unpin ---

  it('unpin button calls togglePin with correct section id', async () => {
    mockPinnedIds = ['sec-billing'];
    renderBar();
    const user = userEvent.setup();

    const unpinBtn = screen.getByRole('button', { name: /unpin billing dashboard/i });
    await user.click(unpinBtn);

    expect(mockTogglePin).toHaveBeenCalledWith('sec-billing');
  });

  it('unpin button has correct aria-label', () => {
    mockPinnedIds = ['sec-patients'];
    renderBar();
    expect(screen.getByRole('button', { name: /unpin patient care/i })).toBeInTheDocument();
  });

  // --- Filtering ---

  it('only renders sections that match pinnedIds', () => {
    mockPinnedIds = ['sec-security'];
    renderBar();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.queryByText('Billing Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Patient Care')).not.toBeInTheDocument();
  });

  it('ignores pinnedIds that do not match any section', () => {
    mockPinnedIds = ['sec-billing', 'sec-nonexistent'];
    renderBar();
    expect(screen.getByText('Billing Dashboard')).toBeInTheDocument();
    // pinnedSections filters unmatched IDs, so only 1 valid section remains → shows 1/6
    expect(screen.getByText('1/6')).toBeInTheDocument();
  });

  it('renders sections in pinnedIds order', () => {
    mockPinnedIds = ['sec-security', 'sec-billing'];
    renderBar();
    const titles = screen.getAllByRole('heading', { level: 2 });
    expect(titles[0]).toHaveTextContent('Security');
    expect(titles[1]).toHaveTextContent('Billing Dashboard');
  });

  // --- Multiple Sections ---

  it('multiple sections render independently', async () => {
    mockPinnedIds = ['sec-billing', 'sec-patients'];
    renderBar();
    const user = userEvent.setup();

    // Both contents visible
    expect(screen.getByTestId('billing-content')).toBeInTheDocument();
    expect(screen.getByTestId('patient-content')).toBeInTheDocument();

    // Collapse only the first section (Billing)
    const expandBtns = screen.getAllByRole('button', { expanded: true });
    await user.click(expandBtns[0]);

    // Billing collapsed, Patient still visible
    expect(screen.queryByTestId('billing-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('patient-content')).toBeInTheDocument();
  });
});
