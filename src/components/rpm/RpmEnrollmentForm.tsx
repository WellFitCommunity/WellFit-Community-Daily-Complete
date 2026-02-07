/**
 * RpmEnrollmentForm - Enroll a patient in Remote Patient Monitoring
 *
 * Collects patient ID, diagnosis code, monitoring reason, device types,
 * and ordering provider for RPM enrollment.
 *
 * Used by: RpmDashboard when "Enroll Patient" is clicked
 */

import React, { useState } from 'react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../envision-atlus';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { rpmDashboardService } from '../../services/rpmDashboardService';
import { auditLogger } from '../../services/auditLogger';

interface RpmEnrollmentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const DEVICE_OPTIONS = [
  { value: 'blood_pressure_cuff', label: 'Blood Pressure Cuff' },
  { value: 'pulse_oximeter', label: 'Pulse Oximeter' },
  { value: 'glucometer', label: 'Glucometer' },
  { value: 'weight_scale', label: 'Weight Scale' },
  { value: 'thermometer', label: 'Thermometer' },
  { value: 'activity_tracker', label: 'Activity Tracker' },
];

const RpmEnrollmentForm: React.FC<RpmEnrollmentFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [patientId, setPatientId] = useState('');
  const [diagnosisCode, setDiagnosisCode] = useState('');
  const [monitoringReason, setMonitoringReason] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeviceToggle = (device: string) => {
    setSelectedDevices((prev) =>
      prev.includes(device)
        ? prev.filter((d) => d !== device)
        : [...prev, device]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!patientId.trim()) {
      setError('Patient ID is required');
      return;
    }

    setSubmitting(true);
    try {
      const result = await rpmDashboardService.enrollPatient({
        patientId: patientId.trim(),
        diagnosisCode: diagnosisCode.trim() || undefined,
        monitoringReason: monitoringReason.trim() || undefined,
        deviceTypes: selectedDevices,
      });

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error.message);
      }
    } catch (err: unknown) {
      await auditLogger.error(
        'RPM_ENROLLMENT_FORM_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { patientId }
      );
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 min-h-[44px] min-w-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Enroll Patient in RPM</h1>
      </div>

      <EACard>
        <EACardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" style={{ color: '#00857a' }} />
            <h2 className="text-lg font-semibold text-gray-900">Enrollment Details</h2>
          </div>
        </EACardHeader>
        <EACardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Patient ID */}
            <div>
              <label htmlFor="rpm-patient-id" className="block text-sm font-medium text-gray-700 mb-1">
                Patient ID <span className="text-red-500">*</span>
              </label>
              <input
                id="rpm-patient-id"
                type="text"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="Enter patient UUID"
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
            </div>

            {/* Diagnosis Code */}
            <div>
              <label htmlFor="rpm-diagnosis" className="block text-sm font-medium text-gray-700 mb-1">
                Primary Diagnosis (ICD-10)
              </label>
              <input
                id="rpm-diagnosis"
                type="text"
                value={diagnosisCode}
                onChange={(e) => setDiagnosisCode(e.target.value)}
                placeholder="e.g., I10 (Essential Hypertension)"
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Monitoring Reason */}
            <div>
              <label htmlFor="rpm-reason" className="block text-sm font-medium text-gray-700 mb-1">
                Monitoring Reason
              </label>
              <textarea
                id="rpm-reason"
                value={monitoringReason}
                onChange={(e) => setMonitoringReason(e.target.value)}
                placeholder="Clinical justification for RPM monitoring"
                rows={3}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Device Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monitoring Devices
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DEVICE_OPTIONS.map((device) => (
                  <button
                    key={device.value}
                    type="button"
                    onClick={() => handleDeviceToggle(device.value)}
                    className={`px-4 py-3 text-sm font-medium rounded-lg border text-left min-h-[44px] transition-colors ${
                      selectedDevices.includes(device.value)
                        ? 'border-teal-500 bg-teal-50 text-teal-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {device.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 text-sm font-medium text-white rounded-lg min-h-[44px] disabled:opacity-50"
                style={{ backgroundColor: '#00857a' }}
              >
                {submitting ? 'Enrolling...' : 'Enroll Patient'}
              </button>
            </div>
          </form>
        </EACardContent>
      </EACard>
    </div>
  );
};

export default RpmEnrollmentForm;
