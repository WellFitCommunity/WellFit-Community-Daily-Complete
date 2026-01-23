/**
 * Medication Management Page - Clinical E-Prescribing
 * Envision Atlus - Physician Workflow
 *
 * FHIR R4 compliant medication management with:
 * - E-prescribing (RxNorm coded)
 * - Allergy checking
 * - Drug interaction alerts
 * - Medication reconciliation
 *
 * ATLUS Unity: Falls back to PatientContext when URL param is missing
 */

import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pill, AlertTriangle } from 'lucide-react';
import { MedicationRequestManager } from '../components/patient/MedicationRequestManager';
import AdminHeader from '../components/admin/AdminHeader';
import { usePatientContext } from '../contexts/PatientContext';

const MedicationManagementPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedPatient } = usePatientContext();

  // ATLUS Unity: Fall back to PatientContext when URL param is missing
  const patientId = searchParams.get('patientId') || selectedPatient?.id || null;

  if (!patientId) {
    return (
      <div className="min-h-screen bg-slate-900">
        <AdminHeader title="Medication Management" />
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Patient Selection Required</h2>
            <p className="text-yellow-200 mb-6">
              Please select a patient from the Physician Dashboard to manage their medications.
            </p>
            <button
              onClick={() => navigate('/physician-dashboard')}
              className="px-6 py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors"
            >
              Go to Physician Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <AdminHeader title="Medication Management" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-teal-400 hover:text-teal-300 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Patient
        </button>

        {/* Header */}
        <div className="bg-linear-to-r from-teal-900/50 to-cyan-900/50 rounded-xl border border-teal-700 p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-600 rounded-lg">
              <Pill className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Clinical Medication Management</h1>
              <p className="text-teal-200">
                FHIR R4 compliant e-prescribing with allergy checking and drug interaction alerts
              </p>
            </div>
          </div>
        </div>

        {/* Medication Manager */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <MedicationRequestManager
            patientId={patientId}
            readOnly={false}
          />
        </div>

        {/* Clinical Notes */}
        <div className="mt-6 bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Clinical Notes</h3>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• All prescriptions are coded using RxNorm terminology</li>
            <li>• Allergy checking is performed automatically against patient's documented allergies</li>
            <li>• Drug interactions are checked against current active medications</li>
            <li>• EPCS (Electronic Prescribing for Controlled Substances) requires additional authentication</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MedicationManagementPage;
