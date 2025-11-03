// EMS Metrics Dashboard for Hospital Administrators
// Shows door-to-treatment times, department response metrics, and ROI
// Critical for demonstrating value to hospital leadership

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface MetricsData {
  totalHandoffs: number;
  criticalHandoffs: number;
  avgDoorToTreatmentMinutes: number;
  avgDepartmentResponseMinutes: number;
  handoffsLast30Days: number;
  doorToTreatmentByAlertType: Array<{
    alertType: string;
    avgMinutes: number;
    count: number;
  }>;
  departmentResponseTimes: Array<{
    departmentName: string;
    avgResponseMinutes: number;
    totalDispatches: number;
  }>;
  handoffsOverTime: Array<{
    date: string;
    count: number;
  }>;
}

const EMSMetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const dateFilter = getDateFilter(dateRange);

      // Total handoffs
      const { count: totalHandoffs } = await supabase
        .from('prehospital_handoffs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFilter);

      // Critical handoffs (any alert)
      const { count: criticalHandoffs } = await supabase
        .from('prehospital_handoffs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFilter)
        .or('stroke_alert.eq.true,stemi_alert.eq.true,trauma_alert.eq.true,sepsis_alert.eq.true,cardiac_arrest.eq.true');

      // Average door-to-treatment time
      const { data: doorToTreatmentData } = await supabase
        .from('prehospital_handoffs')
        .select('time_arrived_hospital, transferred_at')
        .gte('created_at', dateFilter)
        .not('time_arrived_hospital', 'is', null)
        .not('transferred_at', 'is', null);

      const avgDoorToTreatmentMinutes = doorToTreatmentData && doorToTreatmentData.length > 0
        ? doorToTreatmentData.reduce((sum, h) => {
            const arrived = new Date(h.time_arrived_hospital).getTime();
            const transferred = new Date(h.transferred_at).getTime();
            return sum + (transferred - arrived) / 60000; // milliseconds to minutes
          }, 0) / doorToTreatmentData.length
        : 0;

      // Average department response time
      const { data: deptResponseData } = await supabase
        .from('ems_department_dispatches')
        .select('dispatched_at, acknowledged_at')
        .gte('dispatched_at', dateFilter)
        .not('acknowledged_at', 'is', null);

      const avgDepartmentResponseMinutes = deptResponseData && deptResponseData.length > 0
        ? deptResponseData.reduce((sum, d) => {
            const dispatched = new Date(d.dispatched_at).getTime();
            const acknowledged = new Date(d.acknowledged_at).getTime();
            return sum + (acknowledged - dispatched) / 60000;
          }, 0) / deptResponseData.length
        : 0;

      // Door-to-treatment by alert type
      const doorToTreatmentByAlertType = await calculateDoorToTreatmentByAlert(dateFilter);

      // Department response times
      const departmentResponseTimes = await calculateDepartmentResponseTimes(dateFilter);

      // Handoffs over time (daily trend)
      const handoffsOverTime = await calculateHandoffsOverTime(dateFilter);

      setMetrics({
        totalHandoffs: totalHandoffs || 0,
        criticalHandoffs: criticalHandoffs || 0,
        avgDoorToTreatmentMinutes: Math.round(avgDoorToTreatmentMinutes),
        avgDepartmentResponseMinutes: Math.round(avgDepartmentResponseMinutes),
        handoffsLast30Days: totalHandoffs || 0,
        doorToTreatmentByAlertType,
        departmentResponseTimes,
        handoffsOverTime,
      });
    } catch (err) {

    } finally {
      setLoading(false);
    }
  };

  const calculateDoorToTreatmentByAlert = async (dateFilter: string) => {
    const alertTypes = [
      { type: 'stroke_alert', label: 'Stroke' },
      { type: 'stemi_alert', label: 'STEMI' },
      { type: 'trauma_alert', label: 'Trauma' },
      { type: 'sepsis_alert', label: 'Sepsis' },
      { type: 'cardiac_arrest', label: 'Cardiac Arrest' },
    ];

    const results = [];

    for (const alert of alertTypes) {
      const { data } = await supabase
        .from('prehospital_handoffs')
        .select('time_arrived_hospital, transferred_at')
        .eq(alert.type, true)
        .gte('created_at', dateFilter)
        .not('time_arrived_hospital', 'is', null)
        .not('transferred_at', 'is', null);

      if (data && data.length > 0) {
        const avgMinutes = data.reduce((sum, h) => {
          const arrived = new Date(h.time_arrived_hospital).getTime();
          const transferred = new Date(h.transferred_at).getTime();
          return sum + (transferred - arrived) / 60000;
        }, 0) / data.length;

        results.push({
          alertType: alert.label,
          avgMinutes: Math.round(avgMinutes),
          count: data.length,
        });
      }
    }

    return results;
  };

  const calculateDepartmentResponseTimes = async (dateFilter: string) => {
    const { data } = await supabase
      .from('ems_department_dispatches')
      .select('department_name, dispatched_at, acknowledged_at')
      .gte('dispatched_at', dateFilter)
      .not('acknowledged_at', 'is', null);

    if (!data) return [];

    const deptMap = new Map<string, { totalTime: number; count: number }>();

    data.forEach((d) => {
      const dispatched = new Date(d.dispatched_at).getTime();
      const acknowledged = new Date(d.acknowledged_at).getTime();
      const minutes = (acknowledged - dispatched) / 60000;

      if (!deptMap.has(d.department_name)) {
        deptMap.set(d.department_name, { totalTime: 0, count: 0 });
      }

      const dept = deptMap.get(d.department_name);
      dept.totalTime += minutes;
      dept.count++;
    });

    return Array.from(deptMap.entries())
      .map(([departmentName, stats]) => ({
        departmentName,
        avgResponseMinutes: Math.round(stats.totalTime / stats.count),
        totalDispatches: stats.count,
      }))
      .sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes);
  };

  const calculateHandoffsOverTime = async (dateFilter: string) => {
    const { data } = await supabase
      .from('prehospital_handoffs')
      .select('created_at')
      .gte('created_at', dateFilter)
      .order('created_at', { ascending: true });

    if (!data) return [];

    const dateMap = new Map<string, number>();

    data.forEach((h) => {
      const date = new Date(h.created_at).toISOString().split('T')[0];
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    });

    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  const getDateFilter = (range: string): string => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return '2020-01-01T00:00:00Z'; // All time
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <div>Loading metrics...</div>
      </div>
    );
  }

  if (!metrics) {
    return <div style={{ padding: '2rem' }}>Failed to load metrics</div>;
  }

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
          📊 EMS Metrics Dashboard
        </h1>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as any)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            border: '2px solid #d1d5db',
            borderRadius: '8px',
          }}
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Metrics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard
          title="Total Handoffs"
          value={metrics.totalHandoffs}
          icon="🚑"
          color="#3b82f6"
        />
        <MetricCard
          title="Critical Alerts"
          value={metrics.criticalHandoffs}
          subtitle={`${Math.round((metrics.criticalHandoffs / metrics.totalHandoffs) * 100)}% critical`}
          icon="🚨"
          color="#ef4444"
        />
        <MetricCard
          title="Avg Door-to-Treatment"
          value={`${metrics.avgDoorToTreatmentMinutes} min`}
          subtitle="Target: <10 min"
          icon="⏱️"
          color={metrics.avgDoorToTreatmentMinutes < 10 ? '#10b981' : '#f59e0b'}
        />
        <MetricCard
          title="Avg Dept Response"
          value={`${metrics.avgDepartmentResponseMinutes} min`}
          subtitle="Time to acknowledge"
          icon="⚡"
          color="#8b5cf6"
        />
      </div>

      {/* Door-to-Treatment by Alert Type */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Door-to-Treatment Time by Alert Type
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {metrics.doorToTreatmentByAlertType.map((alert) => (
            <div key={alert.alertType} style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                {alert.alertType}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>
                {alert.avgMinutes} min
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                {alert.count} cases
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Department Response Times */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Department Response Times
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold' }}>Department</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Avg Response Time</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>Total Dispatches</th>
            </tr>
          </thead>
          <tbody>
            {metrics.departmentResponseTimes.map((dept, idx) => (
              <tr key={dept.departmentName} style={{
                backgroundColor: idx % 2 === 0 ? 'white' : '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
              }}>
                <td style={{ padding: '0.75rem' }}>{dept.departmentName}</td>
                <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold' }}>
                  {dept.avgResponseMinutes} minutes
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  {dept.totalDispatches}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Handoffs Over Time */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '2px solid #e5e7eb',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Handoffs Over Time (Daily)
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', height: '200px' }}>
          {metrics.handoffsOverTime.map((day) => {
            const maxCount = Math.max(...metrics.handoffsOverTime.map(d => d.count));
            const heightPercent = (day.count / maxCount) * 100;
            return (
              <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  {day.count}
                </div>
                <div style={{
                  width: '100%',
                  height: `${heightPercent}%`,
                  backgroundColor: '#3b82f6',
                  borderRadius: '4px 4px 0 0',
                }} />
                <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginTop: '0.5rem', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROI Calculation */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        backgroundColor: '#ecfdf5',
        border: '2px solid #10b981',
        borderRadius: '12px',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#065f46', marginBottom: '1rem' }}>
          💰 Estimated Value Generated
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#065f46' }}>Time Saved per Patient</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#047857' }}>
              {Math.round((30 - metrics.avgDoorToTreatmentMinutes))} min
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>vs. traditional handoff (30 min avg)</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#065f46' }}>Better Outcomes</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#047857' }}>
              {Math.round(((30 - metrics.avgDoorToTreatmentMinutes) / 30) * 100)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>faster treatment = better outcomes</div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', color: '#065f46' }}>Monthly Handoffs</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#047857' }}>
              {metrics.handoffsLast30Days}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669' }}>coordinated responses</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => (
  <div style={{
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '12px',
    border: `2px solid ${color}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
      <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 'bold' }}>{title}</div>
      <div style={{ fontSize: '1.5rem' }}>{icon}</div>
    </div>
    <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
    {subtitle && (
      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>{subtitle}</div>
    )}
  </div>
);

export default EMSMetricsDashboard;
