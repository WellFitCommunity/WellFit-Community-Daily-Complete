/**
 * MedicationRequestManager Component
 * Enterprise-grade UI for managing medication requests (prescriptions, refills)
 * FHIR R4 / US Core compliant with allergy checking
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  useMedicationRequests,
  useActiveMedicationRequests,
  useMedicationRequestHistory,
  useCreateMedicationRequest,
  useUpdateMedicationRequest,
  useCancelMedicationRequest,
} from '../../hooks/useFhirData';
import type { MedicationRequest, CreateMedicationRequest } from '../../types/fhir';

// Intent options
const INTENT_OPTIONS = [
  { value: 'order', label: 'Order', description: 'Prescription order' },
  { value: 'plan', label: 'Plan', description: 'Planned medication' },
  { value: 'proposal', label: 'Proposal', description: 'Proposed medication' },
  { value: 'original-order', label: 'Original Order', description: 'Original prescription' },
  { value: 'reflex-order', label: 'Reflex Order', description: 'Automatic refill' },
];

// Status options
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'on-hold', label: 'On Hold', color: 'yellow' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
  { value: 'completed', label: 'Completed', color: 'blue' },
  { value: 'entered-in-error', label: 'Error', color: 'red' },
  { value: 'stopped', label: 'Stopped', color: 'orange' },
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'unknown', label: 'Unknown', color: 'gray' },
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'asap', label: 'ASAP' },
  { value: 'stat', label: 'STAT' },
];

interface MedicationRequestManagerProps {
  patientId: string;
  readOnly?: boolean;
  onMedicationUpdate?: (medications: MedicationRequest[]) => void;
}

export const MedicationRequestManager: React.FC<MedicationRequestManagerProps> = ({
  patientId,
  readOnly = false,
  onMedicationUpdate,
}) => {
  const [allergyWarning, setAllergyWarning] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'history'>('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<CreateMedicationRequest>>({
    patient_id: patientId,
    status: 'active',
    intent: 'order',
    priority: 'routine',
    authored_on: new Date().toISOString(),
  });

  // React Query hooks for different filter types (automatically cached)
  const allMedicationsQuery = useMedicationRequests(patientId);
  const activeMedicationsQuery = useActiveMedicationRequests(patientId);
  const historyMedicationsQuery = useMedicationRequestHistory(patientId);

  // Select the appropriate query based on current filter
  const currentQuery = useMemo(() => {
    switch (filter) {
      case 'active':
        return activeMedicationsQuery;
      case 'history':
        return historyMedicationsQuery;
      default:
        return allMedicationsQuery;
    }
  }, [filter, allMedicationsQuery, activeMedicationsQuery, historyMedicationsQuery]);

  const medications = currentQuery.data || [];
  const loading = currentQuery.isLoading;
  const error = currentQuery.error?.message || null;

  // Mutations for create, update, cancel
  const createMutation = useCreateMedicationRequest();
  const updateMutation = useUpdateMedicationRequest();
  const cancelMutation = useCancelMedicationRequest();

  // Notify parent component when medications change
  useEffect(() => {
    if (medications.length > 0) {
      onMedicationUpdate?.(medications);
    }
  }, [medications, onMedicationUpdate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllergyWarning(null);

    if (!formData.medication_code || !formData.medication_display) {
      alert('Please enter medication code and name');
      return;
    }

    try {
      if (editingId) {
        // Update existing medication request
        await updateMutation.mutateAsync({
          id: editingId,
          updates: formData as Partial<MedicationRequest>,
        });
        resetForm();
      } else {
        // Create new medication request (includes allergy check)
        try {
          await createMutation.mutateAsync(formData as CreateMedicationRequest);
          resetForm();
        } catch (err: unknown) {
          // Check if it's an allergy warning
          const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
          if (errorMessage.includes('ALLERGY ALERT')) {
            setAllergyWarning(errorMessage);
          } else {
            throw err;
          }
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const handleEdit = (medication: MedicationRequest) => {
    setFormData({
      patient_id: medication.patient_id,
      medication_code: medication.medication_code,
      medication_display: medication.medication_display,
      status: medication.status,
      intent: medication.intent,
      priority: medication.priority,
      dosage_text: medication.dosage_text,
      dosage_route: medication.dosage_route,
      dosage_timing_frequency: medication.dosage_timing_frequency,
      dosage_timing_period: medication.dosage_timing_period,
      dosage_timing_period_unit: medication.dosage_timing_period_unit,
      dispense_quantity: medication.dispense_quantity,
      dispense_quantity_unit: medication.dispense_quantity_unit,
      dispense_number_of_repeats: medication.dispense_number_of_repeats,
      note: medication.note,
      authored_on: medication.authored_on,
    });
    setEditingId(medication.id);
    setIsAddingNew(true);
  };

  const handleCancel = async (medicationId: string) => {
    const reason = prompt('Please provide a reason for cancellation:');
    if (!reason) return;

    try {
      await cancelMutation.mutateAsync({ id: medicationId, reason });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  const resetForm = () => {
    setFormData({
      patient_id: patientId,
      status: 'active',
      intent: 'order',
      priority: 'routine',
      authored_on: new Date().toISOString(),
    });
    setIsAddingNew(false);
    setEditingId(null);
    setAllergyWarning(null);
  };

  // Filter medications by search term
  const filteredMedications = useMemo(() => {
    if (!searchTerm) return medications;
    const lower = searchTerm.toLowerCase();
    return medications.filter(
      (m) =>
        m.medication_display?.toLowerCase().includes(lower) ||
        m.medication_code?.toLowerCase().includes(lower) ||
        m.dosage_text?.toLowerCase().includes(lower)
    );
  }, [medications, searchTerm]);

  // Get status color
  const getStatusColor = (status: string): string => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    return option?.color || 'gray';
  };

  // Statistics
  const stats = useMemo(() => {
    const active = medications.filter((m) => m.status === 'active').length;
    const completed = medications.filter((m) => m.status === 'completed').length;
    const cancelled = medications.filter((m) => m.status === 'cancelled').length;
    return { active, completed, cancelled, total: medications.length };
  }, [medications]);

  if (loading && medications.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading medications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Medication Requests</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage prescriptions and medication orders with allergy checking
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={() => setIsAddingNew(true)}
            disabled={isAddingNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            + New Prescription
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Prescriptions</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-green-600 mt-1">{stats.active}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{stats.completed}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Cancelled</div>
          <div className="text-2xl font-bold text-gray-600 mt-1">{stats.cancelled}</div>
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

      {/* Allergy Warning */}
      {allergyWarning && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">Allergy Alert</h3>
              <p className="text-sm text-yellow-700 mt-1">{allergyWarning}</p>
              <p className="text-xs text-yellow-600 mt-2">
                This medication was NOT prescribed due to a documented allergy. Please consult with the patient or
                review allergy records before proceeding.
              </p>
            </div>
            <button onClick={() => setAllergyWarning(null)} className="text-yellow-600 hover:text-yellow-800">
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
            {editingId ? 'Edit Medication Request' : 'New Medication Request'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Medication Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RxNorm Code <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.medication_code || ''}
                  onChange={(e) => setFormData({ ...formData, medication_code: e.target.value })}
                  placeholder="e.g., 197361"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Medication Display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.medication_display || ''}
                  onChange={(e) => setFormData({ ...formData, medication_display: e.target.value })}
                  placeholder="e.g., Lisinopril 10mg tablet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status || ''}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Intent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intent</label>
                <select
                  value={formData.intent || ''}
                  onChange={(e) => setFormData({ ...formData, intent: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {INTENT_OPTIONS.map((intent) => (
                    <option key={intent.value} value={intent.value}>
                      {intent.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={formData.priority || ''}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority.value} value={priority.value}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dosage Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage Instructions</label>
                <input
                  type="text"
                  value={formData.dosage_text || ''}
                  onChange={(e) => setFormData({ ...formData, dosage_text: e.target.value })}
                  placeholder="e.g., Take 1 tablet by mouth daily"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Route */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                <input
                  type="text"
                  value={formData.dosage_route || ''}
                  onChange={(e) => setFormData({ ...formData, dosage_route: e.target.value })}
                  placeholder="e.g., oral, IV, topical"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <input
                  type="number"
                  value={formData.dosage_timing_frequency || ''}
                  onChange={(e) => setFormData({ ...formData, dosage_timing_frequency: parseInt(e.target.value) })}
                  placeholder="e.g., 1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Period */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.dosage_timing_period || ''}
                    onChange={(e) => setFormData({ ...formData, dosage_timing_period: parseFloat(e.target.value) })}
                    placeholder="1"
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={formData.dosage_timing_period_unit || ''}
                    onChange={(e) => setFormData({ ...formData, dosage_timing_period_unit: e.target.value as any })}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Unit</option>
                    <option value="d">day</option>
                    <option value="h">hour</option>
                    <option value="wk">week</option>
                    <option value="mo">month</option>
                  </select>
                </div>
              </div>

              {/* Dispense Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dispense Quantity</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={formData.dispense_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, dispense_quantity: parseFloat(e.target.value) })}
                    placeholder="30"
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={formData.dispense_quantity_unit || ''}
                    onChange={(e) => setFormData({ ...formData, dispense_quantity_unit: e.target.value })}
                    placeholder="tablets"
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Number of Refills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Refills</label>
                <input
                  type="number"
                  value={formData.dispense_number_of_repeats || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, dispense_number_of_repeats: parseInt(e.target.value) })
                  }
                  placeholder="0"
                  min="0"
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
                placeholder="Additional notes..."
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
                {loading ? 'Saving...' : editingId ? 'Update Prescription' : 'Create Prescription'}
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
            placeholder="Search medications..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'history'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Medications List */}
      <div className="space-y-3">
        {filteredMedications.length === 0 ? (
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
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'No medications match your search' : 'No medications found'}
            </p>
          </div>
        ) : (
          filteredMedications.map((medication) => (
            <div
              key={medication.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{medication.medication_display}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(
                        medication.status
                      )}-100 text-${getStatusColor(medication.status)}-800`}
                    >
                      {medication.status}
                    </span>
                    {medication.priority !== 'routine' && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                        {medication.priority?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Code: <span className="font-mono font-medium">{medication.medication_code}</span>
                  </p>
                  {medication.dosage_text && (
                    <p className="text-sm text-gray-700 mt-2">
                      <strong>Dosage:</strong> {medication.dosage_text}
                    </p>
                  )}
                  {medication.dispense_quantity && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Dispense:</strong> {medication.dispense_quantity} {medication.dispense_quantity_unit}
                      {medication.dispense_number_of_repeats !== undefined &&
                        ` (${medication.dispense_number_of_repeats} refills)`}
                    </p>
                  )}
                  {medication.note && (
                    <p className="text-sm text-gray-700 mt-2 italic">{medication.note}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Ordered: {new Date(medication.authored_on).toLocaleDateString()}
                  </p>
                </div>

                {!readOnly && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(medication)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit prescription"
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
                    {medication.status === 'active' && (
                      <button
                        onClick={() => handleCancel(medication.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Cancel prescription"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
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
  );
};

export default MedicationRequestManager;
