/**
 * SecurityRulesConfig — Configure automated security alert rules
 *
 * Purpose: Define thresholds that generate alerts (e.g., "alert on >5 PHI accesses in 1 hour")
 * Used by: TenantSecurityDashboard
 */

import React, { useState } from 'react';
import { Settings, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { EABadge } from '../../envision-atlus';
import type { SecurityRulesConfigProps, SecurityRule } from './types';

const METRIC_OPTIONS = [
  { value: 'phi_access', label: 'PHI Access Count' },
  { value: 'failed_logins', label: 'Failed Login Attempts' },
  { value: 'critical_alerts', label: 'Unresolved Critical Alerts' },
  { value: 'active_sessions', label: 'Concurrent Active Sessions' },
];

const OPERATOR_OPTIONS = [
  { value: '>', label: 'Greater than' },
  { value: '>=', label: 'Greater or equal' },
  { value: '<', label: 'Less than' },
  { value: '<=', label: 'Less or equal' },
  { value: '=', label: 'Equal to' },
];

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SEVERITY_BADGE_MAP: Record<string, 'critical' | 'high' | 'elevated' | 'info'> = {
  critical: 'critical',
  high: 'high',
  medium: 'elevated',
  low: 'info',
};

const createEmptyRule = (): SecurityRule => ({
  id: `rule-${Date.now()}`,
  name: '',
  description: '',
  metric: 'phi_access',
  operator: '>',
  threshold: 10,
  time_window_minutes: 60,
  severity: 'high',
  notify_roles: ['admin', 'super_admin'],
  is_active: true,
});

export const SecurityRulesConfig: React.FC<SecurityRulesConfigProps> = ({
  rules,
  saving,
  onSaveRule,
  onDeleteRule,
  onToggleRule,
}) => {
  const [editingRule, setEditingRule] = useState<SecurityRule | null>(null);
  const [validationError, setValidationError] = useState('');

  const handleAddRule = () => {
    setEditingRule(createEmptyRule());
    setValidationError('');
  };

  const handleSave = () => {
    if (!editingRule) return;
    if (!editingRule.name.trim()) {
      setValidationError('Rule name is required');
      return;
    }
    if (editingRule.threshold <= 0) {
      setValidationError('Threshold must be greater than 0');
      return;
    }
    if (editingRule.time_window_minutes < 1) {
      setValidationError('Time window must be at least 1 minute');
      return;
    }
    setValidationError('');
    onSaveRule(editingRule);
    setEditingRule(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-gray-900">Alert Rules</h3>
          <span className="text-xs text-gray-400">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={handleAddRule}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
        >
          <Plus className="w-3 h-3" /> Add Rule
        </button>
      </div>

      {/* Existing rules list */}
      <div className="divide-y divide-gray-100">
        {rules.length === 0 && !editingRule && (
          <div className="p-6 text-center text-gray-500">
            <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No alert rules configured</p>
            <p className="text-xs text-gray-400 mt-1">Add a rule to automate security alerts</p>
          </div>
        )}

        {rules.map(rule => (
          <div key={rule.id} className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                <EABadge variant={SEVERITY_BADGE_MAP[rule.severity] || 'info'} size="sm">
                  {rule.severity}
                </EABadge>
                {!rule.is_active && (
                  <EABadge variant="neutral" size="sm">Disabled</EABadge>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {rule.description || `Alert when ${rule.metric.replace('_', ' ')} ${rule.operator} ${rule.threshold} in ${rule.time_window_minutes}min`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onToggleRule(rule.id, !rule.is_active)}
                disabled={saving}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={rule.is_active ? 'Disable rule' : 'Enable rule'}
              >
                {rule.is_active
                  ? <ToggleRight className="w-5 h-5 text-green-600" />
                  : <ToggleLeft className="w-5 h-5 text-gray-400" />
                }
              </button>
              <button
                onClick={() => { setEditingRule({ ...rule }); setValidationError(''); }}
                disabled={saving}
                className="px-2 py-1 text-xs text-[var(--ea-primary)] hover:text-[var(--ea-primary-hover)]"
              >
                Edit
              </button>
              <button
                onClick={() => onDeleteRule(rule.id)}
                disabled={saving}
                className="p-1 text-gray-400 hover:text-red-600"
                title="Delete rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit/Add form */}
      {editingRule && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">
            {rules.some(r => r.id === editingRule.id) ? 'Edit Rule' : 'New Rule'}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rule-name" className="block text-xs font-medium text-gray-600 mb-1">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                id="rule-name"
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="e.g., PHI Access Burst"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="rule-severity" className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
              <select
                id="rule-severity"
                value={editingRule.severity}
                onChange={(e) => setEditingRule({ ...editingRule, severity: e.target.value as SecurityRule['severity'] })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              >
                {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="rule-metric" className="block text-xs font-medium text-gray-600 mb-1">Metric</label>
              <select
                id="rule-metric"
                value={editingRule.metric}
                onChange={(e) => setEditingRule({ ...editingRule, metric: e.target.value as SecurityRule['metric'] })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              >
                {METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rule-operator" className="block text-xs font-medium text-gray-600 mb-1">Operator</label>
              <select
                id="rule-operator"
                value={editingRule.operator}
                onChange={(e) => setEditingRule({ ...editingRule, operator: e.target.value as SecurityRule['operator'] })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              >
                {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="rule-threshold" className="block text-xs font-medium text-gray-600 mb-1">Threshold</label>
              <input
                id="rule-threshold"
                type="number"
                min={1}
                value={editingRule.threshold}
                onChange={(e) => setEditingRule({ ...editingRule, threshold: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label htmlFor="rule-window" className="block text-xs font-medium text-gray-600 mb-1">
              Time Window (minutes)
            </label>
            <input
              id="rule-window"
              type="number"
              min={1}
              max={1440}
              value={editingRule.time_window_minutes}
              onChange={(e) => setEditingRule({ ...editingRule, time_window_minutes: Number(e.target.value) })}
              className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>

          <div>
            <label htmlFor="rule-description" className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <input
              id="rule-description"
              type="text"
              value={editingRule.description}
              onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
              placeholder="Optional description of what this rule detects"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
              disabled={saving}
            />
          </div>

          {validationError && (
            <p className="text-xs text-red-600">{validationError}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setEditingRule(null); setValidationError(''); }}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
