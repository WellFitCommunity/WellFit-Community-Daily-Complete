/**
 * BedManagementPanel — Orchestrator for the hospital bed management dashboard.
 *
 * Manages state, data fetching, voice commands, and action handlers.
 * All rendering is delegated to sub-components in ./bed-board/.
 *
 * Features:
 * - Real-time bed board visualization
 * - Unit capacity monitoring
 * - Bed assignment and discharge workflows
 * - ML learning feedback for prediction improvement
 * - Forecast visualization and accuracy tracking
 * - Voice commands for hands-free operation (ATLUS aligned)
 * - Positive affirmations for healthcare worker support
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bed as BedIcon, Brain, Sparkles } from 'lucide-react';
import { XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { BedManagementService } from '../../services/bedManagementService';
import { bedOptimizer, type OptimizationReport } from '../../services/ai';
import { EAAlert } from '../envision-atlus';
import { EAAffirmationToast } from '../envision-atlus/EAAffirmationToast';
import { METRICS_TEMPLATES } from '../../services/providerAffirmations';
import type {
  BedBoardEntry,
  UnitCapacity,
  BedStatus,
  BedForecast,
  PredictionAccuracySummary,
  HospitalUnit,
} from '../../types/bed';
import { calculateOccupancy } from '../../types/bed';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { SearchResult } from '../../contexts/VoiceActionContext';
import { auditLogger } from '../../services/auditLogger';
import { usePresence } from '../../hooks/usePresence';
import { ActivityFeed, useActivityBroadcast } from '../collaboration';
import {
  BedBoardHeader,
  BedBoardMetricCards,
  BedBoardRealTimeTab,
  BedBoardForecastsTab,
  BedBoardLearningTab,
  BedDetailModal,
  BedDischargeModal,
  UNIT_TYPE_CATEGORIES,
  BED_VOICE_COMMANDS,
  getAffirmation,
} from './bed-board';
import type {
  TabType,
  UnitTypeCategory,
  BedAffirmationType,
  BedUnitGroup,
  WindowWithSpeechRecognition,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionInstance,
} from './bed-board';

// ============================================================================
// COMPONENT
// ============================================================================

const BedManagementPanel: React.FC = () => {
  const navigate = useNavigate();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('real-time');

  // Voice command state (ATLUS: Intuitive Technology)
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<WebSpeechRecognitionInstance | null>(null);

  // Real-time presence tracking (ATLUS: Leading)
  const { otherUsers, setEditing } = usePresence({
    roomId: 'dashboard:bed-management',
    componentName: 'BedManagementPanel',
  });
  const { broadcast } = useActivityBroadcast('dashboard:bed-management');

  // Affirmation toast state (ATLUS: Service)
  const [affirmationToast, setAffirmationToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Data state
  const [bedBoard, setBedBoard] = useState<BedBoardEntry[]>([]);
  const [unitCapacity, setUnitCapacity] = useState<UnitCapacity[]>([]);
  const [units, setUnits] = useState<HospitalUnit[]>([]);
  const [forecasts, setForecasts] = useState<BedForecast[]>([]);
  const [accuracy, setAccuracy] = useState<PredictionAccuracySummary | null>(null);

  // Filter state
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<BedStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitTypeCategory, setSelectedUnitTypeCategory] = useState<UnitTypeCategory>('all');

  // UI state
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedBoardEntry | null>(null);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeDisposition, setDischargeDisposition] = useState<string>('');
  const [discharging, setDischarging] = useState(false);

  // Learning feedback state
  const [feedbackUnit, setFeedbackUnit] = useState<string>('');
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualCensus, setActualCensus] = useState<string>('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // AI Optimization state
  const [aiReport, setAiReport] = useState<OptimizationReport | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Completed actions counter for milestone affirmations
  const [actionsCompleted, setActionsCompleted] = useState(0);

  // ============================================================================
  // VOICE SEARCH (ATLUS: Intuitive Technology)
  // ============================================================================

  const handleBedSelected = useCallback((result: SearchResult) => {
    auditLogger.info('VOICE_BED_SELECTED', { bedId: result.id, bedName: result.primaryText });
    const bedId = result.metadata?.bedId as string;
    const matchingBed = bedBoard.find(b => b.bed_id === bedId || b.bed_id === result.id);
    if (matchingBed) {
      setSelectedBed(matchingBed);
      setExpandedUnit(matchingBed.unit_id);
      const bedElement = document.getElementById(`bed-${matchingBed.bed_id}`);
      if (bedElement) {
        bedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bedElement.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2');
        setTimeout(() => {
          bedElement.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2');
        }, 3000);
      }
    }
    setSearchQuery(bedId || result.primaryText);
  }, [bedBoard]);

  useVoiceSearch({
    entityTypes: ['bed', 'room'],
    onBedSelected: handleBedSelected,
    onRoomSelected: handleBedSelected,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bedBoardResult, capacityResult, unitsResult] = await Promise.all([
        BedManagementService.getBedBoard({ unitId: selectedUnit || undefined }),
        BedManagementService.getUnitCapacity(),
        BedManagementService.getHospitalUnits(),
      ]);
      if (bedBoardResult.success) setBedBoard(bedBoardResult.data);
      if (capacityResult.success) setUnitCapacity(capacityResult.data);
      if (unitsResult.success) setUnits(unitsResult.data);

      if (selectedUnit) {
        const accuracyResult = await BedManagementService.getPredictionAccuracy(selectedUnit);
        if (accuracyResult.success) setAccuracy(accuracyResult.data);
      }
    } catch (err: unknown) {
      auditLogger.error('BED_MANAGEMENT_LOAD_FAILED', err instanceof Error ? err : new Error(String(err)), { selectedUnit, context: 'loadData' });
      setError('Failed to load bed management data');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => { loadData(); }, [loadData]);

  // ============================================================================
  // VOICE RECOGNITION SETUP
  // ============================================================================

  useEffect(() => {
    const speechWindow = window as unknown as WindowWithSpeechRecognition;
    const SpeechRecognitionAPI = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognitionAPI);

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI() as unknown as WebSpeechRecognitionInstance;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: WebSpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((result: SpeechRecognitionResult) => result[0].transcript)
          .join('');
        setVoiceTranscript(transcript);
        if (event.results[event.results.length - 1].isFinal) {
          processVoiceCommand(transcript);
        }
      };
      recognition.onend = () => { setIsVoiceListening(false); };
      recognition.onerror = () => { setIsVoiceListening(false); setVoiceTranscript(''); };
      recognitionRef.current = recognition;
    }

    return () => { if (recognitionRef.current) recognitionRef.current.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Setup voice recognition once on mount
  }, []);

  // ============================================================================
  // AFFIRMATION TOAST (ATLUS: Service)
  // ============================================================================

  const showAffirmation = useCallback((type: BedAffirmationType) => {
    const newCount = actionsCompleted + 1;
    setActionsCompleted(newCount);
    const message = (newCount > 0 && newCount % 5 === 0)
      ? METRICS_TEMPLATES.tasksCompleted(newCount)
      : getAffirmation(type);
    setAffirmationToast({ message, type: 'success' });
    setTimeout(() => { setAffirmationToast(null); }, 4000);
  }, [actionsCompleted]);

  // ============================================================================
  // VOICE COMMAND PROCESSING
  // ============================================================================

  const processVoiceCommand = useCallback((transcript: string) => {
    const lower = transcript.toLowerCase().trim();
    for (const cmd of BED_VOICE_COMMANDS) {
      const match = lower.match(cmd.pattern);
      if (match) {
        switch (cmd.action) {
          case 'mark_ready': {
            const label = match[1]?.toUpperCase();
            const bed = bedBoard.find(b => b.bed_label.toUpperCase().includes(label) || b.room_number.toUpperCase().includes(label));
            if (bed && bed.status === 'cleaning') {
              handleUpdateStatus(bed.bed_id, 'available');
              showAffirmation('bed_ready');
              broadcast('update', 'bed', `Marked bed ${bed.bed_label} as ready`, bed.bed_id, `Bed ${bed.bed_label}`);
            }
            break;
          }
          case 'start_cleaning': {
            const label = match[1]?.toUpperCase();
            const bed = bedBoard.find(b => b.bed_label.toUpperCase().includes(label) || b.room_number.toUpperCase().includes(label));
            if (bed && bed.status === 'dirty') {
              handleUpdateStatus(bed.bed_id, 'cleaning');
              showAffirmation('cleaning_started');
              broadcast('update', 'bed', `Started cleaning bed ${bed.bed_label}`, bed.bed_id, `Bed ${bed.bed_label}`);
            }
            break;
          }
          case 'filter_available': {
            setSelectedStatus('available');
            if (match[1]) {
              const unitType = match[1].toLowerCase();
              const category = UNIT_TYPE_CATEGORIES.find(c => c.label.toLowerCase().includes(unitType));
              if (category) setSelectedUnitTypeCategory(category.id);
            }
            break;
          }
          case 'refresh': { loadData(); break; }
        }
        setVoiceTranscript('');
        return;
      }
    }
    setVoiceTranscript('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- broadcast and handleUpdateStatus are stable functions
  }, [bedBoard, loadData, showAffirmation]);

  const toggleVoiceListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isVoiceListening) {
      recognitionRef.current.stop();
      setIsVoiceListening(false);
      setVoiceTranscript('');
    } else {
      recognitionRef.current.start();
      setIsVoiceListening(true);
    }
  }, [isVoiceListening]);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredBeds = bedBoard.filter((bed) => {
    if (selectedUnitTypeCategory !== 'all') {
      const category = UNIT_TYPE_CATEGORIES.find((c) => c.id === selectedUnitTypeCategory);
      if (category && category.types.length > 0 && !category.types.includes(bed.unit_type)) return false;
    }
    if (selectedStatus && bed.status !== selectedStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        bed.bed_label.toLowerCase().includes(query) ||
        bed.room_number.toLowerCase().includes(query) ||
        bed.patient_name?.toLowerCase().includes(query) ||
        bed.unit_name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const bedsByUnit = filteredBeds.reduce((acc, bed) => {
    if (!acc[bed.unit_id]) {
      acc[bed.unit_id] = { unitId: bed.unit_id, unitName: bed.unit_name, unitCode: bed.unit_code, beds: [] };
    }
    acc[bed.unit_id].beds.push(bed);
    return acc;
  }, {} as Record<string, BedUnitGroup>);

  // ============================================================================
  // ACTION HANDLERS
  // ============================================================================

  const handleUpdateStatus = async (bedId: string, newStatus: BedStatus) => {
    const result = await BedManagementService.updateBedStatus(bedId, newStatus);
    if (result.success) {
      await loadData();
      if (newStatus === 'available') showAffirmation('bed_ready');
      else if (newStatus === 'cleaning') showAffirmation('cleaning_started');
    } else {
      setError(result.error.message);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackUnit || !actualCensus) { setError('Please select a unit and enter actual census'); return; }
    setSubmittingFeedback(true);
    try {
      const unitCap = unitCapacity.find((u) => u.unit_id === feedbackUnit);
      const predictedCensus = unitCap?.occupied ?? 0;
      const actualValue = parseInt(actualCensus);
      const result = await BedManagementService.submitLearningFeedback({
        tenant_id: '', unit_id: feedbackUnit, feedback_date: feedbackDate,
        feedback_type: 'census_prediction', predicted_value: predictedCensus,
        actual_value: actualValue, variance: actualValue - predictedCensus,
        variance_percentage: predictedCensus > 0 ? ((actualValue - predictedCensus) / predictedCensus) * 100 : 0,
        staff_notes: feedbackNotes, submitted_by: '',
      });
      if (result.success) { setActualCensus(''); setFeedbackNotes(''); await loadData(); }
      else setError(result.error.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleGenerateForecast = async (unitId: string) => {
    const result = await BedManagementService.generateForecast(unitId);
    if (result.success) setForecasts((prev) => [...prev, result.data]);
    else setError(result.error.message);
  };

  const handleDischargePatient = async () => {
    if (!selectedBed?.patient_id || !dischargeDisposition) { setError('Please select a discharge disposition'); return; }
    setDischarging(true);
    try {
      const result = await BedManagementService.dischargePatient(selectedBed.patient_id, dischargeDisposition);
      if (result.success) {
        showAffirmation('discharge_complete');
        broadcast('update', 'bed', `Discharged patient from ${selectedBed.bed_label}`, selectedBed.bed_id, `Bed ${selectedBed.bed_label}`);
        const postAcuteDispositions = ['Skilled Nursing Facility', 'Inpatient Rehab', 'Long-Term Acute Care', 'Hospice'];
        if (postAcuteDispositions.includes(dischargeDisposition)) {
          navigate('/transfer-logs', {
            state: {
              createTransfer: true,
              patientId: selectedBed.patient_id,
              patientName: selectedBed.patient_name,
              patientMrn: selectedBed.patient_mrn,
              disposition: dischargeDisposition,
              fromBedManagement: true,
            },
          });
        } else {
          await loadData();
        }
        setShowDischargeModal(false);
        setSelectedBed(null);
        setDischargeDisposition('');
      } else {
        setError(result.error.message);
      }
    } finally {
      setDischarging(false);
    }
  };

  const handleGenerateAiReport = async () => {
    setLoadingAiReport(true);
    setAiError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error('Not authenticated');
      const tenantId = '2b902657-6a20-4435-a78a-576f397517ca';
      const result = await bedOptimizer.generateOptimizationReport(tenantId);
      if (result.success && result.data) setAiReport(result.data);
      else setAiError(result.error?.message || 'Failed to generate report');
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate AI report');
    } finally {
      setLoadingAiReport(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalBeds = unitCapacity.reduce((sum, u) => sum + (u.total_beds ?? 0), 0);
  const occupiedBeds = unitCapacity.reduce((sum, u) => sum + (u.occupied ?? 0), 0);
  const availableBeds = unitCapacity.reduce((sum, u) => sum + (u.available ?? 0), 0);
  const pendingClean = unitCapacity.reduce((sum, u) => sum + (u.pending_clean ?? 0), 0);
  const overallOccupancy = calculateOccupancy(occupiedBeds, totalBeds);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading && bedBoard.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded-sm w-1/3 mb-4" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-700 rounded-lg" />
            ))}
          </div>
          <div className="h-96 bg-slate-700 rounded-lg" />
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Affirmation Toast */}
      {affirmationToast && (
        <EAAffirmationToast
          message={affirmationToast.message}
          type={affirmationToast.type === 'success' ? 'success' : 'info'}
          onDismiss={() => setAffirmationToast(null)}
          autoDismiss={4000}
          position="top-right"
        />
      )}

      {/* Header */}
      <BedBoardHeader
        isVoiceListening={isVoiceListening}
        voiceSupported={voiceSupported}
        voiceTranscript={voiceTranscript}
        loading={loading}
        otherUsers={otherUsers}
        onToggleVoice={toggleVoiceListening}
        onRefresh={loadData}
        onNavigateTransferLogs={() => navigate('/transfer-logs')}
      />

      {/* Error Banner */}
      {error && (
        <EAAlert variant="critical">
          {error}
          <button onClick={() => setError(null)} className="float-right text-red-400 hover:text-red-300">
            <XCircle className="w-4 h-4" />
          </button>
        </EAAlert>
      )}

      {/* Summary Metrics */}
      <BedBoardMetricCards
        totalBeds={totalBeds}
        occupiedBeds={occupiedBeds}
        availableBeds={availableBeds}
        pendingClean={pendingClean}
        overallOccupancy={overallOccupancy}
      />

      {/* Tab Selector */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit">
        {([
          { id: 'real-time' as const, label: 'Real-Time', icon: BedIcon, description: 'Bed board & capacity' },
          { id: 'forecasts-ai' as const, label: 'Forecasts & AI', icon: Sparkles, description: 'Predictions & optimization' },
          { id: 'learning' as const, label: 'ML Feedback', icon: Brain, description: 'Train the algorithm' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={tab.description}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'real-time' && (
        <BedBoardRealTimeTab
          bedBoard={bedBoard}
          bedsByUnit={bedsByUnit}
          unitCapacity={unitCapacity}
          units={units}
          selectedUnit={selectedUnit}
          selectedStatus={selectedStatus}
          searchQuery={searchQuery}
          selectedUnitTypeCategory={selectedUnitTypeCategory}
          expandedUnit={expandedUnit}
          onSetUnit={setSelectedUnit}
          onSetStatus={setSelectedStatus}
          onSetSearch={setSearchQuery}
          onSetUnitTypeCategory={setSelectedUnitTypeCategory}
          onSetExpandedUnit={setExpandedUnit}
          onSelectBed={setSelectedBed}
          onUpdateStatus={handleUpdateStatus}
          onGenerateForecast={handleGenerateForecast}
          onSetEditing={setEditing}
        />
      )}

      {activeTab === 'forecasts-ai' && (
        <BedBoardForecastsTab
          forecasts={forecasts}
          aiReport={aiReport}
          loadingAiReport={loadingAiReport}
          aiError={aiError}
          onGenerateAiReport={handleGenerateAiReport}
        />
      )}

      {activeTab === 'learning' && (
        <BedBoardLearningTab
          accuracy={accuracy}
          units={units}
          feedbackUnit={feedbackUnit}
          feedbackDate={feedbackDate}
          actualCensus={actualCensus}
          feedbackNotes={feedbackNotes}
          submittingFeedback={submittingFeedback}
          onSetFeedbackUnit={setFeedbackUnit}
          onSetFeedbackDate={setFeedbackDate}
          onSetActualCensus={setActualCensus}
          onSetFeedbackNotes={setFeedbackNotes}
          onSubmitFeedback={handleSubmitFeedback}
        />
      )}

      {/* Bed Detail Modal */}
      {selectedBed && !showDischargeModal && (
        <BedDetailModal
          bed={selectedBed}
          onClose={() => setSelectedBed(null)}
          onUpdateStatus={handleUpdateStatus}
          onDischarge={() => setShowDischargeModal(true)}
          onSetEditing={setEditing}
        />
      )}

      {/* Discharge Modal */}
      {showDischargeModal && selectedBed && (
        <BedDischargeModal
          bed={selectedBed}
          dischargeDisposition={dischargeDisposition}
          discharging={discharging}
          onSetDisposition={setDischargeDisposition}
          onDischarge={handleDischargePatient}
          onClose={() => { setShowDischargeModal(false); setDischargeDisposition(''); }}
        />
      )}

      {/* Activity Feed */}
      <ActivityFeed roomId="dashboard:bed-management" floating maxEvents={15} />
    </div>
  );
};

export default BedManagementPanel;
