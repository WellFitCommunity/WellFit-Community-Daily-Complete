import React, { useState, useEffect } from 'react';
import { admitPatient, type PatientAdmission } from '../../services/patientAdmissionService';
import { supabase } from '../../lib/supabaseClient';

interface PatientOption {
  id: string;
  name: string;
}

interface PatientAdmissionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const PatientAdmissionForm: React.FC<PatientAdmissionFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PatientAdmission>({
    patient_id: '',
    room_number: '',
    facility_unit: '',
    attending_physician_id: '',
    admission_diagnosis: '',
  });

  // Load unadmitted patients
  useEffect(() => {
    loadUnadmittedPatients();
  }, []);

  const loadUnadmittedPatients = async () => {
    try {
      // Get all seniors who don't have active admission
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .eq('role', 'senior')
        .not('user_id', 'in', `(
          SELECT patient_id FROM patient_admissions WHERE is_active = TRUE
        )`);

      if (error) throw error;

      setPatients(
        (data || []).map(p => ({
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
        }))
      );
    } catch (err) {

      setError('Failed to load patient list');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.patient_id || !formData.room_number) {
      setError('Patient and room number are required');
      return;
    }

    setLoading(true);
    try {
      await admitPatient(formData);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Admit Patient</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.patient_id}
              onChange={e =>
                setFormData({ ...formData, patient_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Select a patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.room_number}
              onChange={e =>
                setFormData({ ...formData, room_number: e.target.value })
              }
              placeholder="e.g., 301A"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          {/* Facility Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facility Unit
            </label>
            <input
              type="text"
              value={formData.facility_unit}
              onChange={e =>
                setFormData({ ...formData, facility_unit: e.target.value })
              }
              placeholder="e.g., ICU, Med-Surg, Cardiology"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Admission Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admission Diagnosis
            </label>
            <textarea
              value={formData.admission_diagnosis}
              onChange={e =>
                setFormData({ ...formData, admission_diagnosis: e.target.value })
              }
              placeholder="Primary reason for admission..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Admitting...' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
