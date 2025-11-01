// Coordinated Response Dashboard
// Shows all departments dispatched for an EMS handoff and their readiness status
// Real-time updates as departments acknowledge and prepare

import React from 'react';
import {
  getCoordinatedResponseStatus,
  acknowledgeDepartmentDispatch,
  markDepartmentReady,
  getDepartmentReadinessSummary,
  type CoordinatedResponseStatus,
} from '../../services/emsNotificationService';
import useRealtimeSubscription from '../../hooks/useRealtimeSubscription';

interface CoordinatedResponseDashboardProps {
  handoffId: string;
  chiefComplaint: string;
  etaMinutes: number;
}

const CoordinatedResponseDashboard: React.FC<CoordinatedResponseDashboardProps> = ({
  handoffId,
  chiefComplaint,
  etaMinutes,
}) => {
  // Enterprise-grade subscription with automatic cleanup
  const { data: dispatches, loading, error: subscriptionError, refresh } = useRealtimeSubscription<CoordinatedResponseStatus>({
    table: 'ems_department_dispatches',
    event: '*',
    schema: 'public',
    filter: `handoff_id=eq.${handoffId}`,
    componentName: 'CoordinatedResponseDashboard',
    initialFetch: async () => {
      const { data } = await getCoordinatedResponseStatus(handoffId);
      return data || [];
    }
  });

  const error = subscriptionError ? subscriptionError.message : null;

  const handleAcknowledge = async (dispatchId: string, departmentName: string) => {
    const userName = prompt(`Confirm you are acknowledging for ${departmentName}.\n\nEnter your name:`);
    if (!userName) return;

    const role = prompt('Enter your role (e.g., RN, MD, Tech):');

    const { error: err } = await acknowledgeDepartmentDispatch(dispatchId, userName, role ?? undefined);

    if (err) {
      alert(`Error: ${err.message}`);
    } else {
      alert(`✅ ${departmentName} acknowledged!`);
      refresh();
    }
  };

  const handleMarkReady = async (dispatchId: string, departmentName: string, requiredActions: any) => {
    const actions = requiredActions || [];
    const completedActions: string[] = [];

    // Ask user to confirm each action
    for (const action of actions) {
      const confirmed = window.confirm(`${departmentName} - Mark as complete?\n\n${action}`);
      if (confirmed) {
        completedActions.push(action);
      }
    }

    if (completedActions.length === 0) {
      alert('Please complete at least one action before marking ready.');
      return;
    }

    const { error: err } = await markDepartmentReady(dispatchId, completedActions);

    if (err) {
      alert(`Error: ${err.message}`);
    } else {
      alert(`✅ ${departmentName} is READY!`);
      refresh();
    }
  };

  const summary = getDepartmentReadinessSummary(dispatches || []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading coordinated response...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '8px' }}>
        Error: {error}
      </div>
    );
  }

  if (!dispatches || dispatches.length === 0) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#f3f4f6', borderRadius: '8px', textAlign: 'center' }}>
        No departments dispatched for this handoff.
        <div style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#6b7280' }}>
          (This is a routine transfer - no critical alerts)
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🚨 Coordinated Response Dashboard
        </h2>
        <div style={{ fontSize: '1rem' }}>
          {chiefComplaint} • ETA: {etaMinutes} minutes
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <StatCard
          label="Dispatched"
          value={summary.totalDispatched}
          color="#3b82f6"
        />
        <StatCard
          label="Acknowledged"
          value={summary.acknowledged}
          color="#f59e0b"
        />
        <StatCard
          label="Ready"
          value={summary.ready}
          color="#10b981"
        />
        <StatCard
          label="Pending"
          value={summary.pending}
          color="#ef4444"
        />
      </div>

      {/* Department List */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {dispatches.map((dispatch) => (
          <DepartmentCard
            key={dispatch.department_code}
            dispatch={dispatch}
            onAcknowledge={handleAcknowledge}
            onMarkReady={handleMarkReady}
          />
        ))}
      </div>

      {/* Response Time */}
      {summary.averageResponseTime > 0 && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Average Response Time</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
            {Math.round(summary.averageResponseTime / 60)} minutes
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    border: `2px solid ${color}`,
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{label}</div>
  </div>
);

// Department Card Component
const DepartmentCard: React.FC<{
  dispatch: CoordinatedResponseStatus;
  onAcknowledge: (id: string, name: string) => void;
  onMarkReady: (id: string, name: string, actions: any) => void;
}> = ({ dispatch, onAcknowledge, onMarkReady }) => {
  const statusColors: Record<string, string> = {
    pending: '#ef4444',
    notified: '#f59e0b',
    acknowledged: '#3b82f6',
    mobilized: '#8b5cf6',
    ready: '#10b981',
    completed: '#6b7280',
  };

  const statusEmojis: Record<string, string> = {
    pending: '⏳',
    notified: '📢',
    acknowledged: '👀',
    mobilized: '🏃',
    ready: '✅',
    completed: '✔️',
  };

  const getAlertIcon = (alertType: string): string => {
    const icons: Record<string, string> = {
      stroke: '🧠',
      stemi: '❤️',
      trauma: '🏥',
      sepsis: '🦠',
      cardiac_arrest: '🚨',
      general: '📡',
    };
    return icons[alertType] || '📡';
  };

  const requiredActions = Array.isArray(dispatch.required_actions)
    ? dispatch.required_actions
    : [];

  const completedActions = Array.isArray(dispatch.completed_actions)
    ? dispatch.completed_actions
    : [];

  return (
    <div style={{
      backgroundColor: 'white',
      border: `3px solid ${statusColors[dispatch.dispatch_status]}`,
      borderRadius: '8px',
      padding: '1.5rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{getAlertIcon(dispatch.alert_type)}</span>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {dispatch.department_name}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
              {dispatch.alert_type.toUpperCase()} Alert
            </div>
          </div>
        </div>
        <div style={{
          backgroundColor: statusColors[dispatch.dispatch_status],
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '20px',
          fontSize: '0.875rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          <span>{statusEmojis[dispatch.dispatch_status]}</span>
          {dispatch.dispatch_status.toUpperCase()}
        </div>
      </div>

      {/* Timing */}
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
        <div>Dispatched: {new Date(dispatch.dispatched_at).toLocaleTimeString()}</div>
        {dispatch.acknowledged_at && (
          <div>
            Acknowledged: {new Date(dispatch.acknowledged_at).toLocaleTimeString()} by {dispatch.acknowledged_by_name}
          </div>
        )}
        {dispatch.ready_at && (
          <div style={{ color: '#10b981', fontWeight: 'bold' }}>
            ✅ Ready: {new Date(dispatch.ready_at).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Required Actions Checklist */}
      {requiredActions.length > 0 && (
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Required Actions:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
            {requiredActions.map((action: string, idx: number) => {
              const isCompleted = completedActions.includes(action);
              return (
                <li
                  key={idx}
                  style={{
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    color: isCompleted ? '#10b981' : '#374151',
                    marginBottom: '0.25rem'
                  }}
                >
                  {isCompleted && '✅ '}{action}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {!dispatch.acknowledged_at && (
          <button
            onClick={() => onAcknowledge(dispatch.department_code, dispatch.department_name)}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            👀 Acknowledge
          </button>
        )}

        {dispatch.acknowledged_at && !dispatch.ready_at && (
          <button
            onClick={() => onMarkReady(dispatch.department_code, dispatch.department_name, dispatch.required_actions)}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ✅ Mark Ready
          </button>
        )}

        {dispatch.ready_at && (
          <div style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            ✅ READY FOR PATIENT
          </div>
        )}
      </div>
    </div>
  );
};

export default CoordinatedResponseDashboard;
