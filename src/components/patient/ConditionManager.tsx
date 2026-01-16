/**
 * ConditionManager Component
 * Enterprise-grade UI for managing patient conditions (diagnoses, problems, health concerns)
 * FHIR R4 / US Core compliant
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  useConditions,
  useActiveConditions,
  useChronicConditions,
  useProblemList,
  useConditionsByEncounter,
  useCreateCondition,
  useUpdateCondition,
  useResolveCondition,
} from '../../hooks/useFhirData';
import type { Condition, CreateCondition } from '../../types/fhir';
import { useToast } from '../../hooks/useToast';
import { usePhiAccessLogging, PHI_RESOURCE_TYPES } from '../../hooks/usePhiAccessLogging';

// Category options based on FHIR ValueSet
const CONDITION_CATEGORIES = [
  { value: 'problem-list-item', label: 'Problem List Item', description: 'Ongoing health concerns' },
  { value: 'encounter-diagnosis', label: 'Encounter Diagnosis', description: 'Visit-specific diagnosis' },
  { value: 'health-concern', label: 'Health Concern', description: 'General health concern' },
];

// Clinical status options
const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'red' },
  { value: 'recurrence', label: 'Recurrence', color: 'orange' },
  { value: 'relapse', label: 'Relapse', color: 'orange' },
  { value: 'inactive', label: 'Inactive', color: 'gray' },
  { value: 'remission', label: 'Remission', color: 'blue' },
  { value: 'resolved', label: 'Resolved', color: 'green' },
];

// Severity options
const SEVERITY_OPTIONS = [
  { value: 'severe', label: 'Severe', color: 'red' },
  { value: 'moderate', label: 'Moderate', color: 'yellow' },
  { value: 'mild', label: 'Mild', color: 'green' },
];

interface ConditionManagerProps {
  patientId: string;
  readOnly?: boolean;
  showEncounterDiagnoses?: boolean;
  encounterId?: string;
  onConditionUpdate?: (conditions: Condition[]) => void;
}

export const ConditionManager: React.FC<ConditionManagerProps> = ({
  patientId,
  readOnly = false,
  showEncounterDiagnoses = false,
  encounterId,
  onConditionUpdate,
}) => {
  // HIPAA §164.312(b): Log PHI access on component mount
  usePhiAccessLogging({
    resourceType: PHI_RESOURCE_TYPES.CONDITION_LIST,
    resourceId: patientId,
    action: 'VIEW',
  });

  const { showToast, ToastContainer } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'chronic' | 'problem-list'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state for adding/editing - FHIR R4 native
  const [formData, setFormData] = useState<Partial<CreateCondition>>({
    patient_id: patientId,
    clinical_status: 'active',
    verification_status: 'confirmed',
    category: ['problem-list-item'], // FHIR R4 array
    severity_code: 'moderate',
    recorded_date: new Date().toISOString().split('T')[0],
  });

  // React Query hooks for different filter types (automatically cached)
  const allConditionsQuery = useConditions(patientId);
  const activeConditionsQuery = useActiveConditions(patientId);
  const chronicConditionsQuery = useChronicConditions(patientId);
  const problemListQuery = useProblemList(patientId);
  const encounterConditionsQuery = useConditionsByEncounter(encounterId || '');

  // Select the appropriate query based on current filter
  const currentQuery = useMemo(() => {
    if (showEncounterDiagnoses && encounterId) {
      return encounterConditionsQuery;
    }
    switch (filter) {
      case 'active':
        return activeConditionsQuery;
      case 'chronic':
        return chronicConditionsQuery;
      case 'problem-list':
        return problemListQuery;
      default:
        return allConditionsQuery;
    }
  }, [filter, showEncounterDiagnoses, encounterId, allConditionsQuery, activeConditionsQuery, chronicConditionsQuery, problemListQuery, encounterConditionsQuery]);

  const conditions = useMemo(() => currentQuery.data || [], [currentQuery.data]);
  const loading = currentQuery.isLoading;
  const error = currentQuery.error?.message || null;

  // Mutations for create, update, resolve
  const createMutation = useCreateCondition();
  const updateMutation = useUpdateCondition();
  const resolveMutation = useResolveCondition();

  // Notify parent component when conditions change
  useEffect(() => {
    if (conditions.length > 0) {
      onConditionUpdate?.(conditions);
    }
  }, [conditions, onConditionUpdate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.code_display) {
      showToast('warning', 'Please enter a condition code and description');
      return;
    }

    try {
      if (editingId) {
        // Update existing condition
        await updateMutation.mutateAsync({
          id: editingId,
          updates: formData as Partial<Condition>,
        });
        resetForm();
      } else {
        // Create new condition
        await createMutation.mutateAsync(formData as CreateCondition);
        resetForm();
        showToast('success', 'Condition added successfully.');
      }
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const handleEdit = (condition: Condition) => {
    setFormData({
      patient_id: condition.patient_id,
      code: condition.code, // FHIR R4 native
      code_display: condition.code_display,
      clinical_status: condition.clinical_status,
      verification_status: condition.verification_status,
      category: condition.category || ['problem-list-item'], // FHIR R4 array
      severity_code: condition.severity_code,
      onset_datetime: condition.onset_datetime,
      recorded_date: condition.recorded_date,
      note: condition.note,
    });
    setEditingId(condition.id);
    setIsAddingNew(true);
  };

  const handleResolve = async (conditionId: string) => {
    if (!window.confirm('Mark this condition as resolved?')) return;

    try {
      await resolveMutation.mutateAsync(conditionId);
      showToast('success', 'Condition marked as resolved.');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const resetForm = () => {
    setFormData({
      patient_id: patientId,
      clinical_status: 'active',
      verification_status: 'confirmed',
      category: ['problem-list-item'], // FHIR R4 array
      severity_code: 'moderate',
      recorded_date: new Date().toISOString().split('T')[0],
    });
    setIsAddingNew(false);
    setEditingId(null);
  };

  // Filter conditions by search term
  const filteredConditions = useMemo(() => {
    if (!searchTerm) return conditions;
    const lower = searchTerm.toLowerCase();
    return conditions.filter(
      (c) =>
        c.code_display?.toLowerCase().includes(lower) ||
        c.code?.toLowerCase().includes(lower) || // FHIR R4 native
        c.note?.toLowerCase().includes(lower)
    );
  }, [conditions, searchTerm]);

  // Get status color
  const getStatusColor = (status: string): string => {
    const option = CLINICAL_STATUS_OPTIONS.find((o) => o.value === status);
    return option?.color || 'gray';
  };

  // Get severity badge color
  const getSeverityColor = (severity: string | undefined): string => {
    if (!severity) return 'gray';
    const option = SEVERITY_OPTIONS.find((o) => o.value === severity);
    return option?.color || 'gray';
  };

  // Statistics
  const stats = useMemo(() => {
    const active = conditions.filter((c) => c.clinical_status === 'active').length;
    const chronic = conditions.filter((c) => c.category?.includes('chronic')).length; // FHIR R4 array
    const resolved = conditions.filter((c) => c.clinical_status === 'resolved').length;
    return { active, chronic, resolved, total: conditions.length };
  }, [conditions]);

  if (loading && conditions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading conditions...</span>
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Conditions & Diagnoses</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage patient health conditions, diagnoses, and health concerns
            </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + Add Condition
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Conditions</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-red-600 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Chronic</div>
          <div className="text-2xl font-bold text-orange-600 mt-1">{stats.chronic}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Resolved</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.resolved}</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button onClick={() => currentQuery.refetch()} className="text-red-600 hover:text-red-800" title="Retry">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {isAddingNew && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Condition' : 'Add New Condition'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ICD-10 Code <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., I10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code_display || ''}
                  onChange={(e) => setFormData({ ...formData, code_display: e.target.value })}
                  placeholder="e.g., Essential hypertension"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category?.[0] || ''}
                  onChange={(e) => setFormData({ ...formData, category: [e.target.value] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CONDITION_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clinical Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Status</label>
                <select
                  value={formData.clinical_status || ''}
                  onChange={(e) => {
                    const value = e.target.value as Condition['clinical_status'];
                    setFormData({ ...formData, clinical_status: value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {CLINICAL_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={formData.severity_code || ''}
                  onChange={(e) => setFormData({ ...formData, severity_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Not specified</option>
                  {SEVERITY_OPTIONS.map((sev) => (
                    <option key={sev.value} value={sev.value}>
                      {sev.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Onset Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
                <input
                  type="date"
                  value={formData.onset_datetime?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, onset_datetime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Recorded Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recorded Date</label>
                <input
                  type="date"
                  value={formData.recorded_date?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, recorded_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                rows={3}
                placeholder="Additional notes about this condition..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : editingId ? 'Update Condition' : 'Add Condition'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conditions..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'chronic', 'problem-list'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'problem-list' ? 'Problem List' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions List */}
      <div className="space-y-3">
        {filteredConditions.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'No conditions match your search' : 'No conditions recorded'}
            </p>
          </div>
        ) : (
          filteredConditions.map((condition) => (
            <div
              key={condition.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{condition.code_display}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(
                        condition.clinical_status
                      )}-100 text-${getStatusColor(condition.clinical_status)}-800`}
                    >
                      {condition.clinical_status}
                    </span>
                    {condition.severity_code && (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full bg-${getSeverityColor(
                          condition.severity_code
                        )}-100 text-${getSeverityColor(condition.severity_code)}-800`}
                      >
                        {condition.severity_code}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Code: <span className="font-mono font-medium">{condition.code}</span>
                  </p>
                  {condition.onset_datetime && (
                    <p className="text-sm text-gray-500 mt-1">
                      Onset: {new Date(condition.onset_datetime).toLocaleDateString()}
                    </p>
                  )}
                  {condition.note && (
                    <p className="text-sm text-gray-700 mt-2 italic">{condition.note}</p>
                  )}
                  {condition.recorded_date && (
                    <p className="text-xs text-gray-400 mt-2">
                      Recorded: {new Date(condition.recorded_date).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(condition)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit condition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    {condition.clinical_status === 'active' && (
                      <button
                        onClick={() => handleResolve(condition.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Mark as resolved"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
    </>
  );
};

export default ConditionManager;
