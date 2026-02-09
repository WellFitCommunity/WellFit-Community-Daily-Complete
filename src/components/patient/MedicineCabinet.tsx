/**
 * MedicineCabinet — Orchestrator
 *
 * Comprehensive AI-powered medication management interface.
 * Sub-components live in ./medicine-cabinet/ for modularity.
 *
 * Features:
 * - AI label scanning with Claude Vision
 * - Smart medication tracking
 * - Adherence analytics with charts
 * - Refill reminders with calendar integration
 * - Drug interaction warnings
 * - FHIR sync status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { useMedicineCabinet } from '../../hooks/useMedicineCabinet';
import { Medication } from '../../api/medications';
import { toast } from 'react-toastify';
import { MedicationInfo, LabelExtractionResult } from '../../services/medicationLabelReader';
import { usePhiAccessLogging, PHI_RESOURCE_TYPES } from '../../hooks/usePhiAccessLogging';
import { Pill, Camera, AlertTriangle, Sparkles, Info, CheckCircle } from 'lucide-react';
import { PillIdentifier } from './PillIdentifier';

import {
  MedicationCard,
  ScannerView,
  ScannerModal,
  AdherenceView,
  RemindersView,
  PsychMedAlert,
  StatsCards,
  TabNavigation,
} from './medicine-cabinet';
import type { TabId, AdherenceDataItem, UpcomingDose } from './medicine-cabinet';

export function MedicineCabinet() {
  const user = useUser();
  const userId = user?.id || '';

  // HIPAA §164.312(b): Log PHI access on component mount
  usePhiAccessLogging({
    resourceType: PHI_RESOURCE_TYPES.MEDICATION_LIST,
    resourceId: userId || undefined,
    action: 'VIEW',
    skip: !userId,
  });

  const {
    medications,
    loading,
    error,
    processing,
    uploadProgress,
    psychMedAlert,
    psychAlerts,
    scanMedicationLabel,
    confirmScannedMedication,
    addMedication: _addMedication,
    updateMedication: _updateMedication,
    deleteMedication,
    discontinueMedication: _discontinueMedication,
    recordDose,
    getAdherence,
    getNeedingRefill,
    getUpcomingDoses,
    addReminder,
    acknowledgePsychAlert
  } = useMedicineCabinet(userId);

  // Suppress unused variable warnings for future-use methods
  void _addMedication;
  void _updateMedication;
  void _discontinueMedication;

  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [adherenceData, setAdherenceData] = useState<AdherenceDataItem[]>([]);
  const [needingRefill, setNeedingRefill] = useState<Medication[]>([]);
  const [upcomingDoses, setUpcomingDoses] = useState<UpcomingDose[]>([]);
  const [scannedData, setScannedData] = useState<LabelExtractionResult | null>(null);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    if (userId) {
      const [adherence, refills, upcoming] = await Promise.all([
        getAdherence(),
        getNeedingRefill(7),
        getUpcomingDoses(24)
      ]);
      setAdherenceData((adherence || []) as AdherenceDataItem[]);
      setNeedingRefill(refills);
      setUpcomingDoses(upcoming as UpcomingDose[]);
    }
  }, [userId, getAdherence, getNeedingRefill, getUpcomingDoses]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Handle image scan
  const handleImageScan = async (file: File) => {
    try {
      const result = await scanMedicationLabel(file);
      if (result?.success && result.medication) {
        setScannedData(result);

        if (result.medication.confidence >= 0.8) {
          toast.success('Medication scanned and added automatically!', {
            icon: <Sparkles className="w-5 h-5" />
          });
          setShowScanner(false);
        } else {
          toast.info('Please review the scanned information', {
            icon: <Info className="w-5 h-5" />
          });
        }
      } else {
        toast.error(result?.error || 'Failed to scan medication');
      }
    } catch {
      toast.error('Error scanning medication label');
    }
  };

  // Calculate overall adherence
  const overallAdherence = adherenceData.length > 0
    ? Math.round(adherenceData.reduce((sum, item) => sum + (item.adherence_rate || 0), 0) / adherenceData.length)
    : 0;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Pill className="w-10 h-10 text-blue-600" />
              Medicine Cabinet
            </h1>
            <p className="text-gray-600 mt-2">AI-powered medication management</p>
          </div>

          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
          >
            <Camera className="w-5 h-5" />
            Scan Label
          </button>
        </div>

        <StatsCards
          medicationCount={medications.length}
          overallAdherence={overallAdherence}
          needingRefillCount={needingRefill.length}
          upcomingDosesCount={upcomingDoses.length}
        />
      </div>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content Area */}
      <div className="max-w-7xl mx-auto">
        {psychMedAlert && (
          <PsychMedAlert
            psychMedAlert={psychMedAlert}
            psychAlerts={psychAlerts}
            onAcknowledge={acknowledgePsychAlert}
          />
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {activeTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medications.map(med => (
              <MedicationCard
                key={med.id}
                medication={med}
                onDelete={() => handleDeleteMedication(med.id)}
                onTakeDose={() => handleTakeDose(med.id)}
                onAddReminder={() => handleAddReminder(med.id)}
                onVerifyPill={() => {
                  setSelectedMedication(med);
                  setActiveTab('verify');
                }}
              />
            ))}

            {medications.length === 0 && !loading && (
              <div className="col-span-full text-center py-12">
                <Pill className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No medications yet</p>
                <p className="text-gray-400">Scan a medication label to get started</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scan' && (
          <ScannerView
            processing={processing}
            uploadProgress={uploadProgress}
            scannedData={scannedData}
            onScan={handleImageScan}
            onConfirm={async (medicationInfo: MedicationInfo) => {
              const success = await confirmScannedMedication(medicationInfo);
              if (success) {
                toast.success('Medication added to cabinet!');
                setScannedData(null);
                setActiveTab('all');
              }
            }}
          />
        )}

        {activeTab === 'identify' && (
          <PillIdentifier
            userId={userId}
            medications={medications}
            mode="identify"
            onComplete={() => setActiveTab('all')}
          />
        )}

        {activeTab === 'verify' && (
          <PillIdentifier
            userId={userId}
            medications={medications}
            mode="verify"
            selectedMedication={selectedMedication || undefined}
            onComplete={() => setActiveTab('all')}
          />
        )}

        {activeTab === 'adherence' && (
          <AdherenceView adherenceData={adherenceData} medications={medications} />
        )}

        {activeTab === 'reminders' && (
          <RemindersView upcomingDoses={upcomingDoses} onTakeDose={handleTakeDose} />
        )}
      </div>

      {showScanner && (
        <ScannerModal
          onClose={() => setShowScanner(false)}
          onScan={handleImageScan}
          processing={processing}
          uploadProgress={uploadProgress}
        />
      )}
    </div>
  );

  async function handleDeleteMedication(id: string) {
    if (window.confirm('Are you sure you want to remove this medication?')) {
      const success = await deleteMedication(id);
      if (success) {
        toast.success('Medication removed');
      }
    }
  }

  async function handleTakeDose(medicationId: string) {
    const success = await recordDose(medicationId, {
      taken_at: new Date().toISOString(),
      status: 'taken'
    });
    if (success) {
      toast.success('Dose recorded!', { icon: <CheckCircle className="w-5 h-5" /> });
    }
  }

  async function handleAddReminder(medicationId: string) {
    const time = prompt('Enter time (HH:MM format, e.g., 08:00)');
    if (time) {
      const success = await addReminder({
        medication_id: medicationId,
        time_of_day: time,
        enabled: true,
        notification_method: 'push'
      });
      if (success) {
        toast.success('Reminder added!');
      }
    }
  }
}

export default MedicineCabinet;
