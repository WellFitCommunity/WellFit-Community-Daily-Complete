import React, { useState, useEffect } from 'react';
import { admitPatient, type PatientAdmission } from '../../services/patientAdmissionService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';

interface PatientOption {
  id: string;
  name: string;
  careProtocolGeriatric: boolean;
  careProtocolDisability: boolean;
  careProtocolMentalHealth: boolean;
  careLevel: string;
}

interface PatientAdmissionFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Care protocol badge component
const CareProtocolBadges: React.FC<{ patient: PatientOption }> = ({ patient }) => {
  const badges: Array<{ label: string; title: string; bgColor: string; textColor: string }> = [];

  if (patient.careProtocolGeriatric) {
    badges.push({
      label: 'GER',
      title: 'Geriatric Protocol',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
    });
  }

  if (patient.careProtocolDisability) {
    badges.push({
      label: 'DIS',
      title: 'Disability Accommodations',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
    });
  }

  if (patient.careProtocolMentalHealth) {
    badges.push({
      label: 'MH',
      title: 'Mental Health Protocol',
      bgColor: 'bg-teal-100',
      textColor: 'text-teal-700',
    });
  }

  if (patient.careLevel === 'intensive') {
    badges.push({
      label: 'HIGH',
      title: 'Intensive Care Level',
      bgColor: 'bg-red-100',
      textColor: 'text-red-700',
    });
  } else if (patient.careLevel === 'elevated') {
    badges.push({
      label: 'ELEV',
      title: 'Elevated Care Level',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
    });
  }

  if (badges.length === 0) return null;

  return (
    <span className="ml-2 inline-flex gap-1">
      {badges.map((badge, idx) => (
        <span
          key={idx}
          className={`px-1.5 py-0.5 text-xs font-medium rounded ${badge.bgColor} ${badge.textColor}`}
          title={badge.title}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
};

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

  // Get selected patient for displaying badges
  const selectedPatient = patients.find(p => p.id === formData.patient_id);

  // Load unadmitted patients
  useEffect(() => {
    loadUnadmittedPatients();
  }, []);

  const loadUnadmittedPatients = async () => {
    try {
      // First, get all currently admitted patient IDs
      const { data: admittedData, error: admittedError } = await supabase
        .from('patient_admissions')
        .select('patient_id')
        .eq('is_active', true);

      if (admittedError) throw admittedError;

      const admittedPatientIds = (admittedData || []).map(a => a.patient_id);

      // Get all eligible patients (seniors and patients) with care protocol flags
      // role_id: 4=senior, 19=patient - both can be admitted to hospital
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          first_name,
          last_name,
          care_protocol_geriatric,
          care_protocol_disability,
          care_protocol_mental_health,
          care_level
        `)
        .in('role_id', [4, 19]);

      if (profilesError) throw profilesError;

      // Filter out already admitted patients
      const unadmittedPatients = (profilesData || []).filter(
        p => !admittedPatientIds.includes(p.user_id)
      );

      // Sort: patients with care protocols first, then alphabetically
      const sortedPatients = unadmittedPatients.sort((a, b) => {
        const aHasProtocol = a.care_protocol_geriatric || a.care_protocol_disability || a.care_protocol_mental_health;
        const bHasProtocol = b.care_protocol_geriatric || b.care_protocol_disability || b.care_protocol_mental_health;

        // Intensive care level first
        if (a.care_level === 'intensive' && b.care_level !== 'intensive') return -1;
        if (b.care_level === 'intensive' && a.care_level !== 'intensive') return 1;

        // Then elevated
        if (a.care_level === 'elevated' && b.care_level === 'standard') return -1;
        if (b.care_level === 'elevated' && a.care_level === 'standard') return 1;

        // Then any protocol vs no protocol
        if (aHasProtocol && !bHasProtocol) return -1;
        if (bHasProtocol && !aHasProtocol) return 1;

        // Finally alphabetical
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setPatients(
        sortedPatients.map(p => ({
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`,
          careProtocolGeriatric: p.care_protocol_geriatric || false,
          careProtocolDisability: p.care_protocol_disability || false,
          careProtocolMentalHealth: p.care_protocol_mental_health || false,
          careLevel: p.care_level || 'standard',
        }))
      );
    } catch (err: unknown) {
      await auditLogger.error(
        'LOAD_UNADMITTED_PATIENTS_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { component: 'PatientAdmissionForm' }
      );
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Build display text for option with inline badges
  const getPatientDisplayText = (patient: PatientOption): string => {
    const badges: string[] = [];
    if (patient.careProtocolGeriatric) badges.push('GER');
    if (patient.careProtocolDisability) badges.push('DIS');
    if (patient.careProtocolMentalHealth) badges.push('MH');
    if (patient.careLevel === 'intensive') badges.push('HIGH');
    else if (patient.careLevel === 'elevated') badges.push('ELEV');

    if (badges.length > 0) {
      return `${patient.name} [${badges.join('][')}]`;
    }
    return patient.name;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Admit Patient</h2>

        {/* Care Protocol Legend */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-xs">
          <div className="font-medium text-gray-700 mb-2">Care Protocol Badges:</div>
          <div className="flex flex-wrap gap-2">
            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">GER</span>
            <span className="text-gray-600">Geriatric</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">DIS</span>
            <span className="text-gray-600">Disability</span>
            <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700">MH</span>
            <span className="text-gray-600">Mental Health</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">HIGH</span>
            <span className="text-gray-600">Intensive</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">ELEV</span>
            <span className="text-gray-600">Elevated</span>
          </div>
        </div>

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
                  {getPatientDisplayText(p)}
                </option>
              ))}
            </select>

            {/* Selected patient badges display */}
            {selectedPatient && (
              <div className="mt-2 flex items-center">
                <span className="text-sm text-gray-600">Selected:</span>
                <span className="ml-2 font-medium">{selectedPatient.name}</span>
                <CareProtocolBadges patient={selectedPatient} />
              </div>
            )}
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
