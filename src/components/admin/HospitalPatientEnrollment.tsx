import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Hospital, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

// ============================================================================
// TYPES
// ============================================================================

interface HospitalPatient {
  firstName: string;
  lastName: string;
  dob: string;
  gender?: string;
  roomNumber?: string;
  mrn?: string;
  phone?: string;
  email?: string;
  emergencyContactName?: string;
  caregiverPhone?: string;
  enrollmentNotes?: string;
}

interface EnrollmentResult {
  patientId: string | null;
  patientName: string;
  roomNumber: string;
  status: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const HospitalPatientEnrollment: React.FC = () => {
  const [enrollmentMode, setEnrollmentMode] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [hospitalPatients, setHospitalPatients] = useState<any[]>([]);
  const [enrollmentResult, setEnrollmentResult] = useState<EnrollmentResult[] | null>(null);

  // Single patient form state
  const [formData, setFormData] = useState<HospitalPatient>({
    firstName: '',
    lastName: '',
    dob: '',
    gender: '',
    roomNumber: '',
    mrn: '',
    phone: '',
    email: '',
    emergencyContactName: '',
    caregiverPhone: '',
    enrollmentNotes: ''
  });

  // Load existing hospital patients
  const loadHospitalPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('hospital_patients')
        .select('*')
        .order('room_number', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setHospitalPatients(data || []);
    } catch (error) {
      console.error('Error loading hospital patients:', error);
    }
  };

  useEffect(() => {
    loadHospitalPatients();
  }, []);

  // Handle single patient enrollment
  const handleSingleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEnrollmentResult(null);

    try {
      const { data, error } = await supabase.rpc('enroll_hospital_patient', {
        p_first_name: formData.firstName,
        p_last_name: formData.lastName,
        p_dob: formData.dob,
        p_gender: formData.gender || null,
        p_room_number: formData.roomNumber || null,
        p_mrn: formData.mrn || null,
        p_phone: formData.phone || null,
        p_email: formData.email || null,
        p_emergency_contact_name: formData.emergencyContactName || null,
        p_caregiver_phone: formData.caregiverPhone || null,
        p_enrollment_notes: formData.enrollmentNotes || null
      });

      if (error) throw error;

      setEnrollmentResult([{
        patientId: data,
        patientName: `${formData.firstName} ${formData.lastName}`,
        roomNumber: formData.roomNumber || 'N/A',
        status: 'success'
      }]);

      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        dob: '',
        gender: '',
        roomNumber: '',
        mrn: '',
        phone: '',
        email: '',
        emergencyContactName: '',
        caregiverPhone: '',
        enrollmentNotes: ''
      });

      // Reload patients list
      await loadHospitalPatients();
    } catch (error: any) {
      setEnrollmentResult([{
        patientId: null,
        patientName: `${formData.firstName} ${formData.lastName}`,
        roomNumber: formData.roomNumber || 'N/A',
        status: `error: ${error.message}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk enrollment (quick test data)
  const handleBulkEnrollment = async () => {
    setLoading(true);
    setEnrollmentResult(null);

    const testPatients = [
      {
        first_name: 'John',
        last_name: 'Doe',
        dob: '1950-01-15',
        gender: 'Male',
        room_number: '101',
        mrn: 'MRN001',
        enrollment_notes: 'Post-surgery monitoring'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        dob: '1945-03-22',
        gender: 'Female',
        room_number: '102',
        mrn: 'MRN002',
        enrollment_notes: 'Diabetes management'
      },
      {
        first_name: 'Robert',
        last_name: 'Johnson',
        dob: '1960-07-10',
        gender: 'Male',
        room_number: '103',
        mrn: 'MRN003',
        enrollment_notes: 'CHF monitoring'
      },
      {
        first_name: 'Mary',
        last_name: 'Williams',
        dob: '1948-09-05',
        gender: 'Female',
        room_number: '104',
        mrn: 'MRN004',
        enrollment_notes: 'Post-stroke rehabilitation'
      },
      {
        first_name: 'David',
        last_name: 'Brown',
        dob: '1955-11-18',
        gender: 'Male',
        room_number: '105',
        mrn: 'MRN005',
        enrollment_notes: 'COPD exacerbation'
      }
    ];

    try {
      const { data, error } = await supabase.rpc('bulk_enroll_hospital_patients', {
        patients: testPatients
      });

      if (error) throw error;

      setEnrollmentResult(data || []);
      await loadHospitalPatients();
    } catch (error: any) {
      alert(`Bulk enrollment failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Hospital className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Hospital Patient Enrollment</h2>
        </div>
        <p className="text-blue-100">
          Enroll patients for backend testing - no login required. Perfect for testing physician/nurse panels, handoffs, and clinical workflows.
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-3">
        <button
          onClick={() => setEnrollmentMode('single')}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
            enrollmentMode === 'single'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <UserPlus className="w-5 h-5 inline mr-2" />
          Single Patient
        </button>
        <button
          onClick={() => setEnrollmentMode('bulk')}
          className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
            enrollmentMode === 'bulk'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Users className="w-5 h-5 inline mr-2" />
          Bulk Test Data
        </button>
      </div>

      {/* Single Patient Enrollment Form */}
      {enrollmentMode === 'single' && (
        <form onSubmit={handleSingleEnrollment} className="bg-white rounded-lg shadow-lg p-6 space-y-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Patient Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Hospital-Specific Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                placeholder="e.g., 101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MRN (Medical Record Number)</label>
              <input
                type="text"
                value={formData.mrn}
                onChange={(e) => setFormData({ ...formData, mrn: e.target.value })}
                placeholder="e.g., MRN12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Contact Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
              <input
                type="text"
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
              <input
                type="tel"
                value={formData.caregiverPhone}
                onChange={(e) => setFormData({ ...formData, caregiverPhone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Notes</label>
            <textarea
              value={formData.enrollmentNotes}
              onChange={(e) => setFormData({ ...formData, enrollmentNotes: e.target.value })}
              rows={3}
              placeholder="e.g., ICU admission, post-surgery monitoring..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Enrolling...' : 'Enroll Hospital Patient'}
          </button>
        </form>
      )}

      {/* Bulk Test Data */}
      {enrollmentMode === 'bulk' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Test Data Generator</h3>
          <p className="text-gray-600 mb-4">
            This will create 5 test hospital patients with realistic data for testing physician/nurse panels, handoffs, and clinical workflows.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Test Patients Include:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>John Doe (Room 101) - Post-surgery monitoring</li>
                  <li>Jane Smith (Room 102) - Diabetes management</li>
                  <li>Robert Johnson (Room 103) - CHF monitoring</li>
                  <li>Mary Williams (Room 104) - Post-stroke rehabilitation</li>
                  <li>David Brown (Room 105) - COPD exacerbation</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={handleBulkEnrollment}
            disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating Test Patients...' : 'Create 5 Test Hospital Patients'}
          </button>
        </div>
      )}

      {/* Enrollment Results */}
      {enrollmentResult && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Enrollment Results
          </h3>

          <div className="space-y-2">
            {enrollmentResult.map((result, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.status === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{result.patientName}</div>
                    <div className="text-sm text-gray-600">Room: {result.roomNumber}</div>
                  </div>
                </div>
                <div className={`text-sm font-medium ${result.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                  {result.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Hospital Patients */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Current Hospital Patients
          </span>
          <span className="text-sm font-normal text-gray-600">({hospitalPatients.length} total)</span>
        </h3>

        {hospitalPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hospital patients enrolled yet. Use the form above to add test patients.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Room</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Age</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">MRN</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Notes</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Enrolled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {hospitalPatients.map((patient) => (
                  <tr key={patient.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{patient.room_number || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {patient.last_name}, {patient.first_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{patient.age}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{patient.mrn || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{patient.enrollment_notes || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(patient.enrollment_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HospitalPatientEnrollment;
