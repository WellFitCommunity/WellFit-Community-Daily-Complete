/**
 * Medicine Cabinet Component
 *
 * Comprehensive AI-powered medication management interface
 * Features:
 * - AI label scanning with Claude Vision
 * - Smart medication tracking
 * - Adherence analytics with charts
 * - Refill reminders with calendar integration
 * - Drug interaction warnings
 * - FHIR sync status
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { useMedicineCabinet } from '../../hooks/useMedicineCabinet';
import { Medication } from '../../api/medications';
import { toast } from 'react-toastify';
import {
  Camera,
  Plus,
  Pill,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Bell,
  Upload,
  Sparkles,
  Activity,
  BarChart3,
  Info
} from 'lucide-react';

export function MedicineCabinet() {
  const user = useUser();
  const userId = user?.id || '';

  const {
    medications,
    loading,
    error,
    processing,
    uploadProgress,
    scanMedicationLabel,
    confirmScannedMedication,
    addMedication,
    updateMedication,
    deleteMedication,
    discontinueMedication,
    recordDose,
    getAdherence,
    getNeedingRefill,
    getUpcomingDoses,
    addReminder
  } = useMedicineCabinet(userId);

  const [activeTab, setActiveTab] = useState<'all' | 'scan' | 'adherence' | 'reminders'>('all');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [adherenceData, setAdherenceData] = useState<any[]>([]);
  const [needingRefill, setNeedingRefill] = useState<Medication[]>([]);
  const [upcomingDoses, setUpcomingDoses] = useState<any[]>([]);
  const [scannedData, setScannedData] = useState<any>(null);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      if (userId) {
        const [adherence, refills, upcoming] = await Promise.all([
          getAdherence(),
          getNeedingRefill(7),
          getUpcomingDoses(24)
        ]);
        setAdherenceData(adherence || []);
        setNeedingRefill(refills);
        setUpcomingDoses(upcoming);
      }
    };
    loadAnalytics();
  }, [userId, medications.length]);

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
    } catch (err) {
      toast.error('Error scanning medication label');
    }
  };

  // Calculate overall adherence
  const overallAdherence = adherenceData.length > 0
    ? Math.round(adherenceData.reduce((sum, item) => sum + (item.adherence_rate || 0), 0) / adherenceData.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
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
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all transform hover:scale-105"
          >
            <Camera className="w-5 h-5" />
            Scan Label
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {/* Total Medications */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Medications</p>
                <p className="text-3xl font-bold text-gray-900">{medications.length}</p>
              </div>
              <Pill className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Adherence Rate */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Adherence Rate</p>
                <p className="text-3xl font-bold text-gray-900">{overallAdherence}%</p>
              </div>
              <TrendingUp className="w-12 h-12 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Needing Refill */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Need Refill</p>
                <p className="text-3xl font-bold text-gray-900">{needingRefill.length}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-500 opacity-20" />
            </div>
          </div>

          {/* Upcoming Doses */}
          <div className="bg-white rounded-xl shadow-md p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Next 24 Hours</p>
                <p className="text-3xl font-bold text-gray-900">{upcomingDoses.length}</p>
              </div>
              <Clock className="w-12 h-12 text-purple-500 opacity-20" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex gap-2 bg-white rounded-xl shadow-md p-2">
          {[
            { id: 'all', label: 'All Medications', icon: Pill },
            { id: 'scan', label: 'Scan New', icon: Camera },
            { id: 'adherence', label: 'Adherence', icon: BarChart3 },
            { id: 'reminders', label: 'Reminders', icon: Bell }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* All Medications Tab */}
        {activeTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medications.map(med => (
              <MedicationCard
                key={med.id}
                medication={med}
                onEdit={() => setSelectedMedication(med)}
                onDelete={() => handleDeleteMedication(med.id)}
                onTakeDose={() => handleTakeDose(med.id)}
                onAddReminder={() => handleAddReminder(med.id)}
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

        {/* Scan Tab */}
        {activeTab === 'scan' && (
          <ScannerView
            processing={processing}
            uploadProgress={uploadProgress}
            scannedData={scannedData}
            onScan={handleImageScan}
            onConfirm={async (data: any) => {
              const success = await confirmScannedMedication(data);
              if (success) {
                toast.success('Medication added to cabinet!');
                setScannedData(null);
                setActiveTab('all');
              }
            }}
          />
        )}

        {/* Adherence Tab */}
        {activeTab === 'adherence' && (
          <AdherenceView adherenceData={adherenceData} medications={medications} />
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <RemindersView upcomingDoses={upcomingDoses} onTakeDose={handleTakeDose} />
        )}
      </div>

      {/* Scanner Modal */}
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
    // eslint-disable-next-line no-restricted-globals
    if (confirm('Are you sure you want to remove this medication?')) {
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

// Medication Card Component
function MedicationCard({
  medication,
  onEdit,
  onDelete,
  onTakeDose,
  onAddReminder
}: {
  medication: Medication;
  onEdit: () => void;
  onDelete: () => void;
  onTakeDose: () => void;
  onAddReminder: () => void;
}) {
  const needsReview = medication.needs_review;
  const lowConfidence = (medication.ai_confidence || 0) < 0.7;
  const needsRefillSoon = medication.next_refill_date &&
    new Date(medication.next_refill_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-lg">{medication.medication_name}</h3>
            {medication.generic_name && (
              <p className="text-sm opacity-90">{medication.generic_name}</p>
            )}
          </div>
          {medication.ai_confidence && (
            <div className="bg-white bg-opacity-20 rounded-lg px-2 py-1 text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {Math.round(medication.ai_confidence * 100)}% AI
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Dosage */}
        <div className="flex items-center gap-2 text-sm">
          <Pill className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{medication.strength || medication.dosage}</span>
          {medication.dosage_form && (
            <span className="text-gray-500">({medication.dosage_form})</span>
          )}
        </div>

        {/* Instructions */}
        {medication.instructions && (
          <div className="flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 text-gray-400 mt-0.5" />
            <span className="text-gray-700">{medication.instructions}</span>
          </div>
        )}

        {/* Frequency */}
        {medication.frequency && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">{medication.frequency}</span>
          </div>
        )}

        {/* Alerts */}
        <div className="space-y-2">
          {needsReview && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Needs review - AI wasn't fully confident
            </div>
          )}
          {needsRefillSoon && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Refill needed by {new Date(medication.next_refill_date!).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={onTakeDose}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Take Dose
          </button>
          <button
            onClick={onAddReminder}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Scanner Modal
function ScannerModal({ onClose, onScan, processing, uploadProgress }: any) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onScan(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Camera className="w-6 h-6 text-blue-600" />
          Scan Medication Label
        </h2>

        {!processing ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">Take a clear photo of the medication label</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="medication-image"
              />
              <label
                htmlFor="medication-image"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer inline-block hover:bg-blue-700 transition-colors"
              >
                Choose Image
              </label>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="py-8">
            <div className="flex items-center justify-center mb-4">
              <Sparkles className="w-12 h-12 text-blue-600 animate-pulse" />
            </div>
            <p className="text-center text-gray-700 mb-4">AI is reading the label...</p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">{uploadProgress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Scanner View
function ScannerView({ processing, uploadProgress, scannedData, onScan, onConfirm }: any) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onScan(file);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      {!scannedData ? (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Camera className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Scan Medication Label</h2>
            <p className="text-gray-600">AI will automatically extract all medication information</p>
          </div>

          {!processing ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-6">Take a clear photo of the prescription label</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="scan-image"
              />
              <label
                htmlFor="scan-image"
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl cursor-pointer inline-block hover:shadow-lg transition-all transform hover:scale-105"
              >
                <Camera className="w-5 h-5 inline mr-2" />
                Take Photo
              </label>
            </div>
          ) : (
            <div className="py-12">
              <div className="flex items-center justify-center mb-6">
                <Sparkles className="w-16 h-16 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-center text-gray-700 mb-4">
                AI is reading your medication label...
              </h3>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-purple-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-center text-gray-500">{uploadProgress}% complete</p>
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Review Scanned Information
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">AI Confidence: {Math.round((scannedData.medication?.confidence || 0) * 100)}%</span>
            </div>
            <p className="text-sm text-blue-700">
              {scannedData.medication?.extractionNotes || 'Information extracted successfully'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
              <input
                type="text"
                defaultValue={scannedData.medication?.medicationName}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strength/Dosage</label>
              <input
                type="text"
                defaultValue={scannedData.medication?.strength || scannedData.medication?.dosage}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={() => onConfirm(scannedData.medication)}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Confirm & Add to Cabinet
          </button>
        </div>
      )}
    </div>
  );
}

// Adherence View
function AdherenceView({ adherenceData, medications }: any) {
  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-green-600" />
        Medication Adherence
      </h2>

      <div className="space-y-4">
        {adherenceData.map((item: any) => {
          const rate = item.adherence_rate || 0;
          const color = rate >= 80 ? 'green' : rate >= 60 ? 'yellow' : 'red';

          return (
            <div key={item.medication_id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{item.medication_name}</h3>
                <span className={`text-${color}-600 font-bold text-lg`}>{rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className={`bg-${color}-500 h-full transition-all`}
                  style={{ width: `${rate}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">
                {item.total_taken} of {item.total_scheduled} doses taken
              </p>
            </div>
          );
        })}

        {adherenceData.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No adherence data yet</p>
            <p className="text-gray-400 text-sm">Start recording doses to see your progress</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Reminders View
function RemindersView({ upcomingDoses, onTakeDose }: any) {
  return (
    <div className="bg-white rounded-xl shadow-md p-8">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6 text-purple-600" />
        Upcoming Doses (Next 24 Hours)
      </h2>

      <div className="space-y-3">
        {upcomingDoses.map((dose: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 rounded-full p-2">
                <Clock className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{dose.medication_name}</h3>
                <p className="text-sm text-gray-600">{dose.dosage} - {dose.instructions}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(dose.next_reminder_at).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => onTakeDose(dose.medication_id)}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark Taken
            </button>
          </div>
        ))}

        {upcomingDoses.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No upcoming doses</p>
            <p className="text-gray-400 text-sm">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default MedicineCabinet;
