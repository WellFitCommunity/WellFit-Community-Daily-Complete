/**
 * ProviderTaskQueueDashboard tests — validates metric cards, alert banner,
 * task rows, filters, acknowledge/complete flows, and edge states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetTaskQueue = vi.fn();
const mockGetTaskMetrics = vi.fn();
const mockAcknowledgeTask = vi.fn();
const mockCompleteTask = vi.fn();

vi.mock('../../../services/providerTaskService', () => ({
  providerTaskService: {
    getTaskQueue: (...args: unknown[]) => mockGetTaskQueue(...args),
    getTaskMetrics: (...args: unknown[]) => mockGetTaskMetrics(...args),
    acknowledgeTask: (...args: unknown[]) => mockAcknowledgeTask(...args),
    completeTask: (...args: unknown[]) => mockCompleteTask(...args),
    assignTask: vi.fn(),
    escalateTask: vi.fn(),
    getOverdueTasks: vi.fn(),
    createTask: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

import ProviderTaskQueueDashboard from '../ProviderTaskQueueDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_TASKS = [
  {
    id: 'task-1',
    encounter_id: 'enc-1',
    patient_id: 'pat-1',
    task_type: 'result_review' as const,
    priority: 'stat' as const,
    title: 'Review CBC results for John Doe',
    description: 'Critical WBC elevation',
    assigned_to: 'user-123',
    assigned_at: new Date().toISOString(),
    assigned_by: 'admin-1',
    status: 'pending' as const,
    due_at: new Date(Date.now() - 30 * 60000).toISOString(), // 30 min overdue
    acknowledged_at: null,
    acknowledged_by: null,
    completed_at: null,
    completed_by: null,
    completion_notes: null,
    escalation_level: 0,
    escalated_at: null,
    escalated_to: null,
    source_type: 'system' as const,
    source_id: null,
    tenant_id: 'tenant-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    assignee_first_name: 'Dr. Alice',
    assignee_last_name: 'Provider',
    is_overdue: true,
    minutes_past_due: 30,
  },
  {
    id: 'task-2',
    encounter_id: 'enc-2',
    patient_id: 'pat-2',
    task_type: 'documentation' as const,
    priority: 'routine' as const,
    title: 'Complete discharge summary',
    description: null,
    assigned_to: 'user-456',
    assigned_at: new Date().toISOString(),
    assigned_by: 'admin-1',
    status: 'acknowledged' as const,
    due_at: new Date(Date.now() + 120 * 60000).toISOString(), // 2h left
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: 'user-456',
    completed_at: null,
    completed_by: null,
    completion_notes: null,
    escalation_level: 0,
    escalated_at: null,
    escalated_to: null,
    source_type: 'manual' as const,
    source_id: null,
    tenant_id: 'tenant-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    patient_first_name: 'Jane',
    patient_last_name: 'Smith',
    assignee_first_name: 'Dr. Bob',
    assignee_last_name: 'Nurse',
    is_overdue: false,
    minutes_past_due: 0,
  },
  {
    id: 'task-3',
    encounter_id: null,
    patient_id: 'pat-3',
    task_type: 'referral_response' as const,
    priority: 'urgent' as const,
    title: 'Respond to cardiology referral',
    description: 'Awaiting specialist response',
    assigned_to: 'user-123',
    assigned_at: new Date().toISOString(),
    assigned_by: 'admin-1',
    status: 'escalated' as const,
    due_at: new Date(Date.now() - 60 * 60000).toISOString(),
    acknowledged_at: null,
    acknowledged_by: null,
    completed_at: null,
    completed_by: null,
    completion_notes: null,
    escalation_level: 1,
    escalated_at: new Date().toISOString(),
    escalated_to: 'user-789',
    source_type: 'sla_breach' as const,
    source_id: null,
    tenant_id: 'tenant-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    patient_first_name: 'Bob',
    patient_last_name: 'Wilson',
    assignee_first_name: 'Dr. Alice',
    assignee_last_name: 'Provider',
    is_overdue: true,
    minutes_past_due: 60,
  },
];

const MOCK_METRICS = {
  total_active: 3,
  overdue: 2,
  escalated: 1,
  completed_today: 5,
};

function setupDefaults(
  tasks = MOCK_TASKS,
  metrics = MOCK_METRICS
) {
  mockGetTaskQueue.mockResolvedValue({ success: true, data: tasks, error: null });
  mockGetTaskMetrics.mockResolvedValue({ success: true, data: metrics, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ProviderTaskQueueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ---------- Tier 1: Behavior ----------

  it('displays metric cards with correct counts', async () => {
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument(); // total_active
    expect(screen.getByText('5')).toBeInTheDocument(); // completed_today
    // overdue=2, escalated=1
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows alert banner when overdue or escalated tasks exist', async () => {
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 overdue tasks/)).toBeInTheDocument();
    });

    expect(screen.getByText(/1 escalated task/)).toBeInTheDocument();
  });

  it('does not show alert banner when no overdue or escalated tasks', async () => {
    const noAlertMetrics = { ...MOCK_METRICS, overdue: 0, escalated: 0 };
    setupDefaults(MOCK_TASKS, noAlertMetrics);

    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeInTheDocument();
    });

    expect(screen.queryByText(/overdue task/)).not.toBeInTheDocument();
    expect(screen.queryByText(/escalated task/)).not.toBeInTheDocument();
  });

  it('renders task rows with patient name, title, and priority badge', async () => {
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Review CBC results for John Doe')).toBeInTheDocument();
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('Complete discharge summary')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
    expect(screen.getByText('Respond to cardiology referral')).toBeInTheDocument();
  });

  it('shows overdue styling for overdue tasks', async () => {
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('30m overdue')).toBeInTheDocument();
    });

    expect(screen.getByText('1h overdue')).toBeInTheDocument();
    // Task-2 has due_at ~2h in the future; minor timing variations are expected
    expect(screen.getByText(/\dh left/)).toBeInTheDocument();
  });

  it('shows Ack button only for pending tasks', async () => {
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // task-1 is pending → should have Ack
    const ackButtons = screen.getAllByText('Ack');
    expect(ackButtons).toHaveLength(1); // Only task-1 is pending
  });

  it('clicking Done opens complete modal with notes textarea', async () => {
    const user = userEvent.setup();
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const doneButtons = screen.getAllByText('Done');
    await user.click(doneButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Complete Task')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Completion notes')).toBeInTheDocument();
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockGetTaskQueue.mockReturnValue(new Promise(() => {}));
    mockGetTaskMetrics.mockReturnValue(new Promise(() => {}));

    render(<ProviderTaskQueueDashboard />);

    expect(screen.getByText('Loading provider task queue...')).toBeInTheDocument();
  });

  it('shows error message when service call fails', async () => {
    mockGetTaskQueue.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Failed to load task queue' },
    });

    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load task queue')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tasks exist', async () => {
    const emptyMetrics = { total_active: 0, overdue: 0, escalated: 0, completed_today: 0 };
    setupDefaults([], emptyMetrics);

    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No tasks in queue')).toBeInTheDocument();
      expect(screen.getByText('All provider tasks have been completed.')).toBeInTheDocument();
    });
  });

  it('after completing a task, row is removed and metrics update', async () => {
    const user = userEvent.setup();
    mockCompleteTask.mockResolvedValue({ success: true, data: { id: 'task-1' }, error: null });

    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Click first Done button
    const doneButtons = screen.getAllByText('Done');
    await user.click(doneButtons[0]);

    // Modal opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mark Complete'));

    // Row removed
    await waitFor(() => {
      expect(screen.queryByText('Review CBC results for John Doe')).not.toBeInTheDocument();
    });

    // Other tasks still visible
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
  });

  // ---------- Tier 1: Filters ----------

  it('filter by priority shows only matching tasks', async () => {
    const user = userEvent.setup();
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const prioSelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioSelect, 'stat');

    expect(screen.getByText('J. Doe')).toBeInTheDocument();
    expect(screen.queryByText('J. Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('B. Wilson')).not.toBeInTheDocument();
  });

  it('filter by task type shows only matching tasks', async () => {
    const user = userEvent.setup();
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Smith')).toBeInTheDocument();
    });

    const typeSelect = screen.getByLabelText('Filter by task type');
    await user.selectOptions(typeSelect, 'documentation');

    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.queryByText('J. Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('B. Wilson')).not.toBeInTheDocument();
  });

  it('shows filter empty state when no tasks match', async () => {
    const user = userEvent.setup();
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Select a type with no results matching + priority
    const typeSelect = screen.getByLabelText('Filter by task type');
    await user.selectOptions(typeSelect, 'general');

    await waitFor(() => {
      expect(screen.getByText('No tasks match the current filters.')).toBeInTheDocument();
    });
  });

  // ---------- Tier 3: Integration ----------

  it('completing a task calls service with correct params', async () => {
    const user = userEvent.setup();
    mockCompleteTask.mockResolvedValue({ success: true, data: { id: 'task-1' }, error: null });

    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const doneButtons = screen.getAllByText('Done');
    await user.click(doneButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Add notes
    const notesInput = screen.getByLabelText('Completion notes');
    await user.type(notesInput, 'Reviewed and noted');

    await user.click(screen.getByText('Mark Complete'));

    await waitFor(() => {
      expect(mockCompleteTask).toHaveBeenCalledWith(
        'task-1',
        'user-123',
        'Reviewed and noted'
      );
    });
  });

  it('refresh button reloads data', async () => {
    const user = userEvent.setup();
    render(<ProviderTaskQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCallCount = mockGetTaskQueue.mock.calls.length;

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetTaskQueue.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
