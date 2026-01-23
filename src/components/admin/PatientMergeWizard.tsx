/**
 * Patient Merge Wizard - Step-by-step patient merge workflow
 *
 * Purpose: Guide users through merging duplicate patient records safely
 * Features:
 * - Step-by-step wizard interface
 * - Side-by-side comparison with field selection
 * - Preview of merged record
 * - Rollback capability display
 * - Audit trail creation
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  GitMerge,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Undo2,
  FileText,
  History,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { mpiMergeService, type MergeResult } from '../../services/mpiMergeService';
import { auditLogger } from '../../services/auditLogger';
import { supabase } from '../../lib/supabaseClient';

// =============================================================================
// TYPES
// =============================================================================

interface PatientInfo {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  mrn: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  gender: string | null;
  ethnicity: string | null;
  health_conditions: string[] | null;
  medications: string[] | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  tenant_id: string | null;
  created_at: string | null;
}

interface RelatedDataCounts {
  encounters: number;
  notes: number;
  vitals: number;
  medications: number;
  labOrders: number;
  appointments: number;
}

type WizardStep = 'select' | 'compare' | 'preview' | 'confirm' | 'complete';

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface StepIndicatorProps {
  currentStep: WizardStep;
  steps: { key: WizardStep; label: string }[];
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.key}>
            {index > 0 && (
              <div
                className={`h-1 w-16 mx-2 ${
                  isComplete ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-blue-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white ring-4 ring-blue-200'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {isComplete ? <CheckCircle className="w-5 h-5" /> : index + 1}
              </div>
              <div
                className={`mt-2 text-xs font-medium ${
                  isCurrent ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {step.label}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface PatientCardProps {
  patient: PatientInfo;
  relatedData: RelatedDataCounts;
  isSelected?: boolean;
  onSelect?: () => void;
  label: string;
}

const PatientCard: React.FC<PatientCardProps> = ({
  patient,
  relatedData,
  isSelected,
  onSelect,
  label,
}) => {
  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
      } ${onSelect ? 'cursor-pointer' : ''}`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {isSelected && (
          <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
            Surviving Record
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {patient.first_name} {patient.middle_name} {patient.last_name}
          </div>
          <div className="text-sm text-gray-500">
            MRN: {patient.mrn || 'N/A'} • DOB: {patient.dob || 'N/A'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Phone:</span>{' '}
            <span className="text-gray-900">{patient.phone || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>{' '}
            <span className="text-gray-900">{patient.email || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Gender:</span>{' '}
            <span className="text-gray-900">{patient.gender || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{' '}
            <span className="text-gray-900">
              {patient.created_at
                ? new Date(patient.created_at).toLocaleDateString()
                : '—'}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="text-sm font-medium text-gray-700 mb-2">Related Records</div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.encounters}</div>
              <div className="text-xs text-gray-500">Encounters</div>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.notes}</div>
              <div className="text-xs text-gray-500">Notes</div>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.vitals}</div>
              <div className="text-xs text-gray-500">Vitals</div>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.medications}</div>
              <div className="text-xs text-gray-500">Meds</div>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.labOrders}</div>
              <div className="text-xs text-gray-500">Lab Orders</div>
            </div>
            <div className="bg-gray-100 rounded px-2 py-1 text-center">
              <div className="font-medium text-gray-900">{relatedData.appointments}</div>
              <div className="text-xs text-gray-500">Appts</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const PatientMergeWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const candidateId = searchParams.get('candidateId');
  const patientAId = searchParams.get('patientA');
  const patientBId = searchParams.get('patientB');

  // State
  const [step, setStep] = useState<WizardStep>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientA, setPatientA] = useState<PatientInfo | null>(null);
  const [patientB, setPatientB] = useState<PatientInfo | null>(null);
  const [relatedDataA, setRelatedDataA] = useState<RelatedDataCounts>({
    encounters: 0,
    notes: 0,
    vitals: 0,
    medications: 0,
    labOrders: 0,
    appointments: 0,
  });
  const [relatedDataB, setRelatedDataB] = useState<RelatedDataCounts>({
    encounters: 0,
    notes: 0,
    vitals: 0,
    medications: 0,
    labOrders: 0,
    appointments: 0,
  });
  const [survivingPatientId, setSurvivingPatientId] = useState<string | null>(null);
  const [mergeReason, setMergeReason] = useState('Confirmed duplicate patient records');
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [merging, setMerging] = useState(false);

  const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
    { key: 'select', label: 'Select Surviving' },
    { key: 'compare', label: 'Compare' },
    { key: 'preview', label: 'Preview' },
    { key: 'confirm', label: 'Confirm' },
    { key: 'complete', label: 'Complete' },
  ];

  // Fetch related data counts
  const fetchRelatedDataCounts = async (patientId: string): Promise<RelatedDataCounts> => {
    const [encounters, notes, vitals, medications, labOrders, appointments] = await Promise.all([
      supabase.from('encounters').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('clinical_notes').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('patient_vitals').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('patient_medications').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('lab_orders').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
    ]);

    return {
      encounters: encounters.count || 0,
      notes: notes.count || 0,
      vitals: vitals.count || 0,
      medications: medications.count || 0,
      labOrders: labOrders.count || 0,
      appointments: appointments.count || 0,
    };
  };

  // Load patient data
  const loadPatientData = useCallback(async () => {
    if (!patientAId || !patientBId) {
      setError('Missing patient IDs in URL parameters');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [patientAResult, patientBResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', patientAId).single(),
        supabase.from('profiles').select('*').eq('user_id', patientBId).single(),
      ]);

      if (patientAResult.error || !patientAResult.data) {
        setError('Failed to load Patient A');
        return;
      }

      if (patientBResult.error || !patientBResult.data) {
        setError('Failed to load Patient B');
        return;
      }

      setPatientA(patientAResult.data as PatientInfo);
      setPatientB(patientBResult.data as PatientInfo);

      // Fetch related data counts
      const [countsA, countsB] = await Promise.all([
        fetchRelatedDataCounts(patientAId),
        fetchRelatedDataCounts(patientBId),
      ]);

      setRelatedDataA(countsA);
      setRelatedDataB(countsB);

      // Default to patient with more data as surviving
      const totalA = Object.values(countsA).reduce((sum, count) => sum + count, 0);
      const totalB = Object.values(countsB).reduce((sum, count) => sum + count, 0);
      setSurvivingPatientId(totalA >= totalB ? patientAId : patientBId);

      await auditLogger.phi('READ', patientAId, {
        resourceType: 'patient',
        operation: 'merge_wizard_view',
      });
      await auditLogger.phi('READ', patientBId, {
        resourceType: 'patient',
        operation: 'merge_wizard_view',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      await auditLogger.error('MERGE_WIZARD_LOAD_FAILED', error, { patientAId, patientBId });
    } finally {
      setLoading(false);
    }
  }, [patientAId, patientBId]);

  useEffect(() => {
    loadPatientData();
  }, [loadPatientData]);

  // Execute merge
  const executeMerge = async () => {
    if (!survivingPatientId || !patientA || !patientB) return;

    setMerging(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to perform a merge');
        return;
      }

      const deprecatedPatientId = survivingPatientId === patientAId ? patientBId : patientAId;
      const tenantId = patientA.tenant_id || patientB.tenant_id;

      if (!deprecatedPatientId || !tenantId) {
        setError('Missing required data for merge');
        return;
      }

      const result = await mpiMergeService.mergePatients({
        survivingPatientId,
        deprecatedPatientId,
        tenantId,
        performedBy: user.id,
        reason: mergeReason,
        matchCandidateId: candidateId || undefined,
      });

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setMergeResult(result.data);
      setStep('complete');

      await auditLogger.info('PATIENT_MERGE_COMPLETED', {
        survivingPatientId,
        deprecatedPatientId,
        mergeHistoryId: result.data.mergeHistoryId,
        performedBy: user.id,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      await auditLogger.error('PATIENT_MERGE_FAILED', error, {
        survivingPatientId,
        deprecatedPatientId: survivingPatientId === patientAId ? patientBId : patientAId,
      });
    } finally {
      setMerging(false);
    }
  };

  // Navigation
  const goToNextStep = () => {
    const steps: WizardStep[] = ['select', 'compare', 'preview', 'confirm', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const steps: WizardStep[] = ['select', 'compare', 'preview', 'confirm', 'complete'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="mt-4 text-gray-500">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (!patientA || !patientB) {
    return (
      <EACard className="max-w-lg mx-auto mt-12">
        <EACardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Patients</h2>
          <p className="text-gray-500 mb-4">{error || 'Patient data could not be loaded.'}</p>
          <EAButton variant="secondary" onClick={() => navigate('/admin/mpi')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to MPI Queue
          </EAButton>
        </EACardContent>
      </EACard>
    );
  }

  const survivingPatient = survivingPatientId === patientAId ? patientA : patientB;
  const deprecatedPatient = survivingPatientId === patientAId ? patientB : patientA;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/admin/mpi')}
          className="flex items-center text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to MPI Queue
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitMerge className="w-7 h-7 text-blue-600" />
          Patient Merge Wizard
        </h1>
        <p className="text-gray-500 mt-1">
          Carefully merge two patient records into one authoritative record
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <EAAlert variant="critical" className="mb-6" onDismiss={() => setError(null)} dismissible>
          {error}
        </EAAlert>
      )}

      {/* Step Indicator */}
      <StepIndicator currentStep={step} steps={WIZARD_STEPS} />

      {/* Step Content */}
      <EACard className="mb-6">
        <EACardContent className="p-6">
          {/* Step 1: Select Surviving Record */}
          {step === 'select' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Select the Surviving Record
              </h2>
              <p className="text-gray-500 mb-6">
                Choose which patient record should be kept. All data from the other record will be
                merged into this one.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <PatientCard
                  patient={patientA}
                  relatedData={relatedDataA}
                  isSelected={survivingPatientId === patientAId}
                  onSelect={() => setSurvivingPatientId(patientAId || null)}
                  label="Patient A"
                />
                <PatientCard
                  patient={patientB}
                  relatedData={relatedDataB}
                  isSelected={survivingPatientId === patientBId}
                  onSelect={() => setSurvivingPatientId(patientBId || null)}
                  label="Patient B"
                />
              </div>
            </div>
          )}

          {/* Step 2: Compare */}
          {step === 'compare' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Compare Patient Records
              </h2>
              <p className="text-gray-500 mb-6">
                Review the differences between the two records. Non-null values from the deprecated
                record will fill empty fields in the surviving record.
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 bg-gray-50 text-left text-sm font-medium text-gray-500">
                        Field
                      </th>
                      <th className="px-4 py-3 bg-blue-50 text-left text-sm font-medium text-blue-700">
                        Surviving Record
                      </th>
                      <th className="px-4 py-3 bg-gray-50 text-left text-sm font-medium text-gray-500">
                        Deprecated Record
                      </th>
                      <th className="px-4 py-3 bg-green-50 text-left text-sm font-medium text-green-700">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[
                      { key: 'first_name', label: 'First Name' },
                      { key: 'last_name', label: 'Last Name' },
                      { key: 'middle_name', label: 'Middle Name' },
                      { key: 'dob', label: 'Date of Birth' },
                      { key: 'gender', label: 'Gender' },
                      { key: 'phone', label: 'Phone' },
                      { key: 'email', label: 'Email' },
                      { key: 'mrn', label: 'MRN' },
                      { key: 'address', label: 'Address' },
                      { key: 'city', label: 'City' },
                      { key: 'state', label: 'State' },
                      { key: 'zip', label: 'ZIP' },
                    ].map((field) => {
                      const survValue = survivingPatient[field.key as keyof PatientInfo];
                      const depValue = deprecatedPatient[field.key as keyof PatientInfo];
                      const resultValue = survValue || depValue;
                      const willMerge = !survValue && depValue;

                      return (
                        <tr key={field.key} className={willMerge ? 'bg-yellow-50' : ''}>
                          <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                            {field.label}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {String(survValue) || '—'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500">
                            {String(depValue) || '—'}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={willMerge ? 'text-green-600 font-medium' : 'text-gray-900'}>
                              {String(resultValue) || '—'}
                              {willMerge && ' ← merged'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Preview Data Migration
              </h2>
              <p className="text-gray-500 mb-6">
                The following data will be reassigned from the deprecated patient to the surviving
                patient.
              </p>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Surviving Patient</span>
                  </div>
                  <div className="text-blue-800">
                    {survivingPatient.first_name} {survivingPatient.last_name} (MRN:{' '}
                    {survivingPatient.mrn || 'N/A'})
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Data to be Reassigned</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                    {[
                      { label: 'Encounters', count: survivingPatientId === patientAId ? relatedDataB.encounters : relatedDataA.encounters },
                      { label: 'Clinical Notes', count: survivingPatientId === patientAId ? relatedDataB.notes : relatedDataA.notes },
                      { label: 'Vitals', count: survivingPatientId === patientAId ? relatedDataB.vitals : relatedDataA.vitals },
                      { label: 'Medications', count: survivingPatientId === patientAId ? relatedDataB.medications : relatedDataA.medications },
                      { label: 'Lab Orders', count: survivingPatientId === patientAId ? relatedDataB.labOrders : relatedDataA.labOrders },
                      { label: 'Appointments', count: survivingPatientId === patientAId ? relatedDataB.appointments : relatedDataA.appointments },
                    ].map((item) => (
                      <div key={item.label} className="bg-white rounded border px-3 py-2">
                        <div className="text-lg font-semibold text-gray-900">{item.count}</div>
                        <div className="text-sm text-gray-500">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Confirm Merge
              </h2>
              <p className="text-gray-500 mb-6">
                Please review and confirm the merge operation. This action can be rolled back if
                needed.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-900">Important</div>
                    <ul className="text-sm text-yellow-800 mt-1 list-disc list-inside">
                      <li>All data from the deprecated patient will be reassigned to the surviving patient</li>
                      <li>The deprecated patient's identity record will be deactivated</li>
                      <li>A complete audit trail will be created</li>
                      <li>This operation can be reversed using the unmerge function</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Merge Reason
                  </label>
                  <textarea
                    value={mergeReason}
                    onChange={(e) => setMergeReason(e.target.value)}
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter the reason for this merge..."
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Undo2 className="w-4 h-4" />
                  <span>This merge can be rolled back from the MPI Merge History</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && mergeResult && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Merge Complete
              </h2>
              <p className="text-gray-500 mb-6">
                The patient records have been successfully merged.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Merge ID:</span>
                    <span className="font-mono text-gray-900">{mergeResult.mergeHistoryId.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Batch ID:</span>
                    <span className="font-mono text-gray-900">{mergeResult.mergeBatchId.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Surviving Patient:</span>
                    <span className="text-gray-900">{mergeResult.survivingPatientId.slice(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Records Migrated:</span>
                    <span className="text-gray-900">
                      {mergeResult.dataMigrations.filter((m) => m.status === 'completed').length} tables
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <EAButton variant="secondary" onClick={() => navigate('/admin/mpi')}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Queue
                </EAButton>
                <EAButton
                  variant="primary"
                  onClick={() => navigate(`/admin/patients/${mergeResult.survivingPatientId}`)}
                >
                  View Patient Record
                  <ArrowRight className="w-4 h-4 ml-2" />
                </EAButton>
              </div>
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Navigation Buttons */}
      {step !== 'complete' && (
        <div className="flex justify-between">
          <EAButton
            variant="secondary"
            onClick={goToPreviousStep}
            disabled={step === 'select'}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </EAButton>

          {step === 'confirm' ? (
            <EAButton
              variant="primary"
              onClick={executeMerge}
              disabled={merging || !mergeReason.trim()}
            >
              {merging ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="w-4 h-4 mr-2" />
                  Execute Merge
                </>
              )}
            </EAButton>
          ) : (
            <EAButton
              variant="primary"
              onClick={goToNextStep}
              disabled={!survivingPatientId}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </EAButton>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientMergeWizard;
