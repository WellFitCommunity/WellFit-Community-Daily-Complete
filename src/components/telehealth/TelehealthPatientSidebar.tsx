/**
 * TelehealthPatientSidebar
 *
 * Displays patient information during telehealth video calls.
 * Shows: Patient Avatar, Vitals, Conditions, Medications, SDOH Complexity
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { PatientAvatar } from '../patient-avatar/PatientAvatar';
import { ObservationService } from '../../services/fhir/ObservationService';
import { ConditionService } from '../../services/fhir/ConditionService';
import { MedicationRequestService } from '../../services/fhir/MedicationRequestService';
import { SDOHBillingService } from '../../services/sdohBillingService';
import { auditLogger } from '../../services/auditLogger';

interface TelehealthPatientSidebarProps {
  patientId: string;
  patientName: string;
  isVisible: boolean;
  onToggle: () => void;
}

interface VitalsData {
  bloodPressure?: string;
  heartRate?: number;
  oxygenSaturation?: number;
  temperature?: number;
  weight?: number;
  lastUpdated?: string;
}

interface ClinicalSummary {
  activeConditions: number;
  activeMedications: number;
  sdohComplexity: number;
  ccmEligible: boolean;
}

export const TelehealthPatientSidebar: React.FC<TelehealthPatientSidebarProps> = ({
  patientId,
  patientName,
  isVisible,
  onToggle,
}) => {
  const [vitals, setVitals] = useState<VitalsData>({});
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummary>({
    activeConditions: 0,
    activeMedications: 0,
    sdohComplexity: 0,
    ccmEligible: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch patient clinical data
  const fetchPatientData = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      // Parallel fetch for performance
      const [vitalsData, conditionsData, medicationsData, sdohAssessment] = await Promise.all([
        ObservationService.getVitalSigns(patientId, 7).catch(() => null),
        ConditionService.getActive(patientId).catch(() => null),
        MedicationRequestService.getActive(patientId).catch(() => null),
        SDOHBillingService.assessSDOHComplexity(patientId).catch(() => null),
      ]);

      // Process vitals
      const processedVitals: VitalsData = {};
      if (vitalsData && Array.isArray(vitalsData)) {
        vitalsData.forEach((obs: { code?: string; value?: number | string; effective_date?: string }) => {
          const code = obs.code;
          const value = obs.value;

          if (code?.includes('8480-6') || code?.includes('8462-4')) {
            // Blood pressure
            if (!processedVitals.bloodPressure && typeof value === 'string') {
              processedVitals.bloodPressure = value;
            }
          } else if (code?.includes('8867-4') && typeof value === 'number') {
            processedVitals.heartRate = value;
          } else if ((code?.includes('2708-6') || code?.includes('59408-5')) && typeof value === 'number') {
            processedVitals.oxygenSaturation = value;
          } else if (code?.includes('8310-5') && typeof value === 'number') {
            processedVitals.temperature = value;
          } else if (code?.includes('29463-7') && typeof value === 'number') {
            processedVitals.weight = value;
          }

          if (obs.effective_date && !processedVitals.lastUpdated) {
            processedVitals.lastUpdated = obs.effective_date;
          }
        });
      }

      // Fallback to check_ins if no FHIR data
      if (!processedVitals.bloodPressure && !processedVitals.heartRate) {
        const { data: checkInData } = await supabase
          .from('check_ins')
          .select('bp_systolic, bp_diastolic, heart_rate, pulse_oximeter, created_at')
          .eq('user_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (checkInData) {
          if (checkInData.bp_systolic && checkInData.bp_diastolic) {
            processedVitals.bloodPressure = `${checkInData.bp_systolic}/${checkInData.bp_diastolic}`;
          }
          if (checkInData.heart_rate) {
            processedVitals.heartRate = checkInData.heart_rate;
          }
          if (checkInData.pulse_oximeter) {
            processedVitals.oxygenSaturation = checkInData.pulse_oximeter;
          }
          if (checkInData.created_at) {
            processedVitals.lastUpdated = checkInData.created_at;
          }
        }
      }

      setVitals(processedVitals);

      // Set clinical summary (FHIR services return FHIRApiResponse with .data array)
      setClinicalSummary({
        activeConditions: conditionsData?.data?.length || 0,
        activeMedications: medicationsData?.data?.length || 0,
        sdohComplexity: sdohAssessment?.overallComplexityScore || 0,
        ccmEligible: sdohAssessment?.ccmEligible || false,
      });

      auditLogger.info('Telehealth sidebar data loaded', { patientId });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load patient data';
      setError(errorMessage);
      auditLogger.error('Failed to load telehealth sidebar data', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  // Format vitals display
  const formatLastUpdated = (dateStr?: string) => {
    if (!dateStr) return 'No recent data';
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Updated just now';
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Updated ${diffDays}d ago`;
  };

  // Get SDOH risk color
  const getSDOHColor = (score: number) => {
    if (score >= 7) return 'text-red-400';
    if (score >= 4) return 'text-orange-400';
    return 'text-green-400';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between bg-gray-750">
        <h3 className="text-sm font-semibold text-white">Patient Info</h3>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          title="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Patient Avatar */}
        <div className="flex justify-center">
          <PatientAvatar
            patientId={patientId}
            patientName={patientName}
            initialMode="compact"
            editable={false}
            className="cursor-pointer"
          />
        </div>

        {/* Patient Name */}
        <div className="text-center">
          <h4 className="text-lg font-semibold text-white">{patientName}</h4>
          {clinicalSummary.ccmEligible && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
              CCM Eligible
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-20 bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-16 bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-16 bg-gray-700 rounded-lg animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={fetchPatientData}
              className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Vitals Grid */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-gray-400 uppercase mb-2">Vital Signs</h5>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-xs text-gray-400">BP</div>
                  <div className="text-sm font-semibold text-white">
                    {vitals.bloodPressure || '--'}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-xs text-gray-400">HR</div>
                  <div className="text-sm font-semibold text-white">
                    {vitals.heartRate ? `${vitals.heartRate} bpm` : '--'}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-xs text-gray-400">O₂ Sat</div>
                  <div className="text-sm font-semibold text-white">
                    {vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : '--'}
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2">
                  <div className="text-xs text-gray-400">Temp</div>
                  <div className="text-sm font-semibold text-white">
                    {vitals.temperature ? `${vitals.temperature}°F` : '--'}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center">
                {formatLastUpdated(vitals.lastUpdated)}
              </div>
            </div>

            {/* Clinical Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-gray-400 uppercase mb-2">Clinical Summary</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Active Conditions</span>
                  <span className="text-sm font-semibold text-white bg-blue-600/30 px-2 py-0.5 rounded">
                    {clinicalSummary.activeConditions}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-300">Medications</span>
                  <span className="text-sm font-semibold text-white bg-green-600/30 px-2 py-0.5 rounded">
                    {clinicalSummary.activeMedications}
                  </span>
                </div>
              </div>
            </div>

            {/* SDOH Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-gray-400 uppercase mb-2">Social Determinants</h5>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">SDOH Complexity</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getSDOHColor(clinicalSummary.sdohComplexity)}`}>
                    {clinicalSummary.sdohComplexity}
                  </span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              </div>
              {clinicalSummary.sdohComplexity >= 7 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  High social complexity
                </div>
              )}
            </div>

            {/* Refresh button */}
            <button
              onClick={fetchPatientData}
              className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh data
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TelehealthPatientSidebar;
