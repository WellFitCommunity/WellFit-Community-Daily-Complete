/**
 * Bed Management Panel
 *
 * Comprehensive hospital bed management dashboard with:
 * - Real-time bed board visualization
 * - Unit capacity monitoring
 * - Bed assignment and discharge workflows
 * - ML learning feedback for prediction improvement
 * - Forecast visualization and accuracy tracking
 * - VOICE COMMANDS for hands-free operation (ATLUS aligned)
 * - Positive affirmations for healthcare worker support
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bed as BedIcon,
  Building2,
  AlertTriangle,
  RefreshCw,
  Package,
  Search,
  TrendingUp,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  BarChart3,
  UserMinus,
  FileText,
  ArrowRight,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { BedManagementService } from '../../services/bedManagementService';
import { bedOptimizer, type OptimizationReport } from '../../services/ai';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EAAlert,
} from '../envision-atlus';
import { EAAffirmationToast } from '../envision-atlus/EAAffirmationToast';
import { getProviderAffirmation, AffirmationCategory, METRICS_TEMPLATES } from '../../services/providerAffirmations';
import type {
  BedBoardEntry,
  UnitCapacity,
  BedStatus,
  BedForecast,
  PredictionAccuracySummary,
  HospitalUnit,
  UnitType,
} from '../../types/bed';
import {
  getBedStatusLabel,
  getBedStatusColor,
  getUnitTypeLabel,
  getAcuityColor,
  calculateOccupancy,
  getOccupancyColor,
} from '../../types/bed';
import { useVoiceSearch } from '../../hooks/useVoiceSearch';
import { SearchResult } from '../../contexts/VoiceActionContext';
import { auditLogger } from '../../services/auditLogger';
import { usePresence } from '../../hooks/usePresence';
import { PresenceAvatars, ActivityFeed, useActivityBroadcast } from '../collaboration';

// Web Speech API types (browser API boundary)
interface WebSpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface WebSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WebSpeechRecognitionConstructor {
  new(): WebSpeechRecognitionInstance;
}

type WindowWithSpeechRecognition = Window & {
  webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  SpeechRecognition?: WebSpeechRecognitionConstructor;
};

// Tab type - SIMPLIFIED from 5 tabs to 3 (ATLUS: reduce cognitive load)
type TabType = 'real-time' | 'forecasts-ai' | 'learning';

// Voice command patterns for bed management
const BED_VOICE_COMMANDS = [
  { pattern: /mark\s+(?:bed\s+)?(.+?)\s+(?:as\s+)?ready/i, action: 'mark_ready' },
  { pattern: /start\s+cleaning\s+(?:bed\s+)?(.+)/i, action: 'start_cleaning' },
  { pattern: /discharge\s+(?:bed\s+)?(.+?)\s+(?:to\s+)?(.+)?/i, action: 'discharge' },
  { pattern: /show\s+(?:me\s+)?available\s+(?:beds\s+)?(?:in\s+)?(.+)?/i, action: 'filter_available' },
  { pattern: /show\s+(?:me\s+)?(?:all\s+)?(.+?)\s+beds/i, action: 'filter_unit' },
  { pattern: /refresh|update/i, action: 'refresh' },
];

// Map bed actions to shared affirmation categories (ATLUS: Service)
// This ensures BedManagement uses the centralized providerAffirmations service
type BedAffirmationType = 'bed_ready' | 'cleaning_started' | 'discharge_complete' | 'admit_complete' | 'bulk_action';

const BED_AFFIRMATION_MAP: Record<BedAffirmationType, AffirmationCategory> = {
  bed_ready: 'task_completed',
  cleaning_started: 'task_completed',
  discharge_complete: 'discharge_complete',
  admit_complete: 'admission_complete',
  bulk_action: 'milestone_reached',
};

// Helper to get affirmation using shared service
const getAffirmation = (type: BedAffirmationType): string => {
  const category = BED_AFFIRMATION_MAP[type];
  return getProviderAffirmation(category);
};

// Unit type categories for quick filtering
type UnitTypeCategory = 'all' | 'icu' | 'step_down' | 'telemetry' | 'med_surg' | 'emergency' | 'labor_delivery' | 'pediatric' | 'specialty' | 'other';

const UNIT_TYPE_CATEGORIES: { id: UnitTypeCategory; label: string; types: UnitType[] }[] = [
  { id: 'all', label: 'All Beds', types: [] },
  { id: 'icu', label: 'ICU', types: ['icu', 'picu', 'nicu'] },
  { id: 'step_down', label: 'Step Down', types: ['step_down'] },
  { id: 'telemetry', label: 'Telemetry', types: ['telemetry'] },
  { id: 'med_surg', label: 'Med-Surg', types: ['med_surg'] },
  { id: 'emergency', label: 'ER', types: ['ed', 'ed_holding'] },
  { id: 'labor_delivery', label: 'L&D', types: ['labor_delivery', 'postpartum', 'nursery'] },
  { id: 'pediatric', label: 'Peds', types: ['peds', 'picu', 'nicu'] },
  { id: 'specialty', label: 'Specialty', types: ['cardiac', 'neuro', 'oncology', 'ortho', 'rehab', 'psych'] },
  { id: 'other', label: 'Other', types: ['or', 'pacu', 'observation', 'other'] },
];

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

  // Real-time presence tracking (ATLUS: Leading - team awareness)
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
  const [_showAssignModal, _setShowAssignModal] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedBoardEntry | null>(null);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeDisposition, setDischargeDisposition] = useState<string>('');
  const [discharging, setDischarging] = useState(false);

  // Learning feedback state
  const [feedbackUnit, setFeedbackUnit] = useState<string>('');
  const [feedbackDate, setFeedbackDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [actualCensus, setActualCensus] = useState<string>('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // AI Optimization state
  const [aiReport, setAiReport] = useState<OptimizationReport | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ATLUS: Intuitive Technology - Global voice search for beds
  // When user says "bed 205A" or "room 302", this handles the search and result selection
  const handleBedSelected = useCallback((result: SearchResult) => {
    auditLogger.info('VOICE_BED_SELECTED', {
      bedId: result.id,
      bedName: result.primaryText,
    });

    // Find the bed in our data and select it
    const bedId = result.metadata?.bedId as string;
    const matchingBed = bedBoard.find(b => b.bed_id === bedId || b.bed_id === result.id);
    if (matchingBed) {
      setSelectedBed(matchingBed);
      // Expand the unit containing this bed
      setExpandedUnit(matchingBed.unit_id);
      // Scroll to the bed
      const bedElement = document.getElementById(`bed-${matchingBed.bed_id}`);
      if (bedElement) {
        bedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        bedElement.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2');
        setTimeout(() => {
          bedElement.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2');
        }, 3000);
      }
    }

    // Set search query to highlight
    setSearchQuery(bedId || result.primaryText);
  }, [bedBoard]);

  // Register voice search for beds and rooms
  useVoiceSearch({
    entityTypes: ['bed', 'room'],
    onBedSelected: handleBedSelected,
    onRoomSelected: handleBedSelected, // Rooms route to bed selection too
  });

  /**
   * Load all data
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load in parallel
      const [bedBoardResult, capacityResult, unitsResult] = await Promise.all([
        BedManagementService.getBedBoard({ unitId: selectedUnit || undefined }),
        BedManagementService.getUnitCapacity(),
        BedManagementService.getHospitalUnits(),
      ]);

      if (bedBoardResult.success) {
        setBedBoard(bedBoardResult.data);
      }

      if (capacityResult.success) {
        setUnitCapacity(capacityResult.data);
      }

      if (unitsResult.success) {
        setUnits(unitsResult.data);
      }

      // Load accuracy for learning tab
      if (selectedUnit) {
        const accuracyResult = await BedManagementService.getPredictionAccuracy(
          selectedUnit
        );
        if (accuracyResult.success) {
          setAccuracy(accuracyResult.data);
        }
      }
    } catch (err) {
      auditLogger.error('BED_MANAGEMENT_LOAD_FAILED', err instanceof Error ? err : new Error(String(err)), { selectedUnit, context: 'loadData' });
      setError('Failed to load bed management data');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initialize voice recognition (ATLUS: Intuitive Technology)
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

        // Check if final result
        if (event.results[event.results.length - 1].isFinal) {
          processVoiceCommand(transcript);
        }
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
        setVoiceTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Track completed actions for metrics (ATLUS: Service)
  const [actionsCompleted, setActionsCompleted] = useState(0);

  // Show affirmation toast (ATLUS: Service - positive feedback via shared service)
  const showAffirmation = useCallback((type: BedAffirmationType) => {
    // Increment action counter
    const newCount = actionsCompleted + 1;
    setActionsCompleted(newCount);

    // Every 5 actions, show a metrics-based message using METRICS_TEMPLATES
    let message: string;
    if (newCount > 0 && newCount % 5 === 0) {
      message = METRICS_TEMPLATES.tasksCompleted(newCount);
    } else {
      message = getAffirmation(type);
    }

    setAffirmationToast({ message, type: 'success' });

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setAffirmationToast(null);
    }, 4000);
  }, [actionsCompleted]);

  // Process voice commands (ATLUS: Intuitive Technology)
  const processVoiceCommand = useCallback((transcript: string) => {
    const lowerTranscript = transcript.toLowerCase().trim();

    for (const cmd of BED_VOICE_COMMANDS) {
      const match = lowerTranscript.match(cmd.pattern);
      if (match) {
        switch (cmd.action) {
          case 'mark_ready': {
            const bedLabel = match[1]?.toUpperCase();
            const bed = bedBoard.find(b =>
              b.bed_label.toUpperCase().includes(bedLabel) ||
              b.room_number.toUpperCase().includes(bedLabel)
            );
            if (bed && bed.status === 'cleaning') {
              handleUpdateStatus(bed.bed_id, 'available');
              showAffirmation('bed_ready');
              // Broadcast to team (ATLUS: Leading)
              broadcast('update', 'bed', `Marked bed ${bed.bed_label} as ready`, bed.bed_id, `Bed ${bed.bed_label}`);
            }
            break;
          }
          case 'start_cleaning': {
            const bedLabel = match[1]?.toUpperCase();
            const bed = bedBoard.find(b =>
              b.bed_label.toUpperCase().includes(bedLabel) ||
              b.room_number.toUpperCase().includes(bedLabel)
            );
            if (bed && bed.status === 'dirty') {
              handleUpdateStatus(bed.bed_id, 'cleaning');
              showAffirmation('cleaning_started');
              // Broadcast to team (ATLUS: Leading)
              broadcast('update', 'bed', `Started cleaning bed ${bed.bed_label}`, bed.bed_id, `Bed ${bed.bed_label}`);
            }
            break;
          }
          case 'filter_available': {
            setSelectedStatus('available');
            if (match[1]) {
              // Try to match unit type
              const unitType = match[1].toLowerCase();
              const category = UNIT_TYPE_CATEGORIES.find(c =>
                c.label.toLowerCase().includes(unitType)
              );
              if (category) {
                setSelectedUnitTypeCategory(category.id);
              }
            }
            break;
          }
          case 'refresh': {
            loadData();
            break;
          }
        }
        setVoiceTranscript('');
        return;
      }
    }

    // No match found
    setVoiceTranscript('');
  }, [bedBoard, loadData, showAffirmation]);

  // Toggle voice listening
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

  /**
   * Filter beds based on search, status, and unit type category
   */
  const filteredBeds = bedBoard.filter((bed) => {
    // Filter by unit type category
    if (selectedUnitTypeCategory !== 'all') {
      const category = UNIT_TYPE_CATEGORIES.find((c) => c.id === selectedUnitTypeCategory);
      if (category && category.types.length > 0 && !category.types.includes(bed.unit_type)) {
        return false;
      }
    }
    // Filter by status
    if (selectedStatus && bed.status !== selectedStatus) return false;
    // Filter by search query
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

  /**
   * Group beds by unit for bed board view
   */
  const bedsByUnit = filteredBeds.reduce((acc, bed) => {
    if (!acc[bed.unit_id]) {
      acc[bed.unit_id] = {
        unitId: bed.unit_id,
        unitName: bed.unit_name,
        unitCode: bed.unit_code,
        beds: [],
      };
    }
    acc[bed.unit_id].beds.push(bed);
    return acc;
  }, {} as Record<string, { unitId: string; unitName: string; unitCode: string; beds: BedBoardEntry[] }>);

  /**
   * Update bed status with positive affirmation (ATLUS: Service)
   */
  const handleUpdateStatus = async (bedId: string, newStatus: BedStatus) => {
    const result = await BedManagementService.updateBedStatus(bedId, newStatus);
    if (result.success) {
      await loadData();
      // Show affirmation based on status change (ATLUS: Service)
      if (newStatus === 'available') {
        showAffirmation('bed_ready');
      } else if (newStatus === 'cleaning') {
        showAffirmation('cleaning_started');
      }
    } else {
      setError(result.error.message);
    }
  };

  /**
   * Submit ML learning feedback
   */
  const handleSubmitFeedback = async () => {
    if (!feedbackUnit || !actualCensus) {
      setError('Please select a unit and enter actual census');
      return;
    }

    setSubmittingFeedback(true);
    try {
      // Find predicted value for this unit/date
      const unitCap = unitCapacity.find((u) => u.unit_id === feedbackUnit);
      const predictedCensus = unitCap?.occupied ?? 0;
      const actualValue = parseInt(actualCensus);

      const result = await BedManagementService.submitLearningFeedback({
        tenant_id: '', // Will be set by RLS
        unit_id: feedbackUnit,
        feedback_date: feedbackDate,
        feedback_type: 'census_prediction',
        predicted_value: predictedCensus,
        actual_value: actualValue,
        variance: actualValue - predictedCensus,
        variance_percentage:
          predictedCensus > 0
            ? ((actualValue - predictedCensus) / predictedCensus) * 100
            : 0,
        staff_notes: feedbackNotes,
        submitted_by: '', // Will be set by service
      });

      if (result.success) {
        setActualCensus('');
        setFeedbackNotes('');
        await loadData();
      } else {
        setError(result.error.message);
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };

  /**
   * Generate forecast for unit
   */
  const handleGenerateForecast = async (unitId: string) => {
    const result = await BedManagementService.generateForecast(unitId);
    if (result.success) {
      setForecasts((prev) => [...prev, result.data]);
    } else {
      setError(result.error.message);
    }
  };

  /**
   * Handle patient discharge
   */
  const handleDischargePatient = async () => {
    if (!selectedBed?.patient_id || !dischargeDisposition) {
      setError('Please select a discharge disposition');
      return;
    }

    setDischarging(true);
    try {
      const result = await BedManagementService.dischargePatient(
        selectedBed.patient_id,
        dischargeDisposition
      );

      if (result.success) {
        // Show affirmation (ATLUS: Service)
        showAffirmation('discharge_complete');

        // Broadcast activity to team (ATLUS: Leading)
        broadcast(
          'update',
          'bed',
          `Discharged patient from ${selectedBed.bed_label}`,
          selectedBed.bed_id,
          `Bed ${selectedBed.bed_label}`
        );

        // Check if this is a post-acute disposition that needs a transfer packet
        const postAcuteDispositions = [
          'Skilled Nursing Facility',
          'Inpatient Rehab',
          'Long-Term Acute Care',
          'Hospice',
        ];

        if (postAcuteDispositions.includes(dischargeDisposition)) {
          // Navigate to transfer portal to create handoff packet
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
          // Simple discharge - just reload the bed board
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

  // Discharge disposition options
  const DISCHARGE_DISPOSITIONS = [
    { value: 'Home', label: 'Home', isPostAcute: false },
    { value: 'Home with Home Health', label: 'Home with Home Health', isPostAcute: false },
    { value: 'Skilled Nursing Facility', label: 'Skilled Nursing Facility (SNF)', isPostAcute: true },
    { value: 'Inpatient Rehab', label: 'Inpatient Rehabilitation', isPostAcute: true },
    { value: 'Long-Term Acute Care', label: 'Long-Term Acute Care (LTAC)', isPostAcute: true },
    { value: 'Hospice', label: 'Hospice Care', isPostAcute: true },
    { value: 'Against Medical Advice', label: 'Against Medical Advice (AMA)', isPostAcute: false },
    { value: 'Expired', label: 'Expired', isPostAcute: false },
    { value: 'Transfer to Another Hospital', label: 'Transfer to Another Hospital', isPostAcute: true },
  ];

  // Calculate summary metrics
  const totalBeds = unitCapacity.reduce((sum, u) => sum + (u.total_beds ?? 0), 0);
  const occupiedBeds = unitCapacity.reduce((sum, u) => sum + (u.occupied ?? 0), 0);
  const availableBeds = unitCapacity.reduce((sum, u) => sum + (u.available ?? 0), 0);
  const pendingClean = unitCapacity.reduce((sum, u) => sum + (u.pending_clean ?? 0), 0);
  const overallOccupancy = calculateOccupancy(occupiedBeds, totalBeds);

  if (loading && bedBoard.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-700 rounded-sm w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-slate-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Affirmation Toast (ATLUS: Service - using shared EAAffirmationToast component) */}
      {affirmationToast && (
        <EAAffirmationToast
          message={affirmationToast.message}
          type={affirmationToast.type === 'success' ? 'success' : 'info'}
          onDismiss={() => setAffirmationToast(null)}
          autoDismiss={4000}
          position="top-right"
        />
      )}

      {/* Voice Command Feedback (ATLUS: Intuitive Technology) */}
      {isVoiceListening && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border border-teal-500 rounded-lg shadow-lg">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-white font-medium">
              {voiceTranscript || 'Listening... Try "Mark bed 205A ready"'}
            </span>
            <Volume2 className="w-4 h-4 text-teal-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <BedIcon className="w-6 h-6 text-teal-400" />
              Bed Management
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Real-time bed tracking with predictive analytics
            </p>
          </div>
          {/* Real-time team presence (ATLUS: Leading) */}
          <PresenceAvatars users={otherUsers} maxDisplay={4} size="sm" />
        </div>
        <div className="flex items-center gap-3">
          {/* Voice Command Button (ATLUS: Intuitive Technology) */}
          {voiceSupported && (
            <button
              onClick={toggleVoiceListening}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isVoiceListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
              title={isVoiceListening ? 'Stop listening' : 'Voice commands: "Mark bed ready", "Start cleaning", "Show available ICU beds"'}
            >
              {isVoiceListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
              <span className="text-sm hidden sm:inline">
                {isVoiceListening ? 'Stop' : 'Voice'}
              </span>
            </button>
          )}
          <EAButton
            onClick={() => navigate('/transfer-logs')}
            icon={<Package className="w-4 h-4" />}
            variant="secondary"
          >
            Transfer Logs
          </EAButton>
          <EAButton
            onClick={loadData}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            variant="secondary"
          >
            Refresh
          </EAButton>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <EAAlert variant="critical">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </EAAlert>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Beds</p>
                <p className="text-2xl font-bold text-white">{totalBeds}</p>
              </div>
              <BedIcon className="w-8 h-8 text-teal-400 opacity-50" />
            </div>
          </EACardContent>
        </EACard>

        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Occupancy</p>
                <p className={`text-2xl font-bold ${getOccupancyColor(overallOccupancy)}`}>
                  {overallOccupancy}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
            <div className="mt-2 w-full bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  overallOccupancy >= 90 ? 'bg-red-500' : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(overallOccupancy, 100)}%` }}
              />
            </div>
          </EACardContent>
        </EACard>

        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Available</p>
                <p className="text-2xl font-bold text-green-400">{availableBeds}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </EACardContent>
        </EACard>

        <EACard>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Pending Clean</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingClean}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400 opacity-50" />
            </div>
          </EACardContent>
        </EACard>
      </div>

      {/* Main Tabs - SIMPLIFIED from 5 to 3 (ATLUS: Unity - reduce cognitive load) */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit">
        {[
          { id: 'real-time', label: 'Real-Time', icon: BedIcon, description: 'Bed board & capacity' },
          { id: 'forecasts-ai', label: 'Forecasts & AI', icon: Sparkles, description: 'Predictions & optimization' },
          { id: 'learning', label: 'ML Feedback', icon: Brain, description: 'Train the algorithm' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title={tab.description}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unit Type Quick Filter Tabs - Only visible on Real-Time tab */}
      {activeTab === 'real-time' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Quick Filter by Unit Type</p>
          <div className="flex flex-wrap gap-2">
            {UNIT_TYPE_CATEGORIES.map((category) => {
              // Count beds in this category
              const bedCount = category.id === 'all'
                ? bedBoard.length
                : bedBoard.filter((b) => category.types.includes(b.unit_type)).length;

              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedUnitTypeCategory(category.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    selectedUnitTypeCategory === category.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {category.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedUnitTypeCategory === category.id
                      ? 'bg-teal-700 text-teal-100'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {bedCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      {activeTab === 'real-time' && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search beds, rooms, patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Units</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.unit_name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as BedStatus | '')}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="dirty">Needs Cleaning</option>
            <option value="cleaning">Being Cleaned</option>
            <option value="blocked">Blocked</option>
            <option value="maintenance">Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>
        </div>
      )}

      {/* Tab Content */}
      {/* REAL-TIME TAB: Combines Bed Board + Capacity (ATLUS: Unity) */}
      {activeTab === 'real-time' && (
        <div className="space-y-4">
          {Object.values(bedsByUnit).length === 0 ? (
            <EACard>
              <EACardContent className="p-8 text-center">
                <BedIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400">No beds found</p>
                <p className="text-sm text-slate-500 mt-1">
                  Try adjusting your filters or add beds to units
                </p>
              </EACardContent>
            </EACard>
          ) : (
            Object.values(bedsByUnit).map((unitGroup) => (
              <EACard key={unitGroup.unitId}>
                <EACardHeader
                  icon={<Building2 className="w-5 h-5" />}
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedUnit(
                      expandedUnit === unitGroup.unitId ? null : unitGroup.unitId
                    )
                  }
                >
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <span className="font-semibold">{unitGroup.unitName}</span>
                      <span className="text-sm text-slate-400 ml-2">
                        ({unitGroup.unitCode})
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-400">
                        {unitGroup.beds.filter((b) => b.status === 'occupied').length}/
                        {unitGroup.beds.length} occupied
                      </span>
                      {expandedUnit === unitGroup.unitId ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </EACardHeader>

                {(expandedUnit === unitGroup.unitId || !expandedUnit) && (
                  <EACardContent className="p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {unitGroup.beds.map((bed) => (
                        <div
                          key={bed.bed_id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:ring-2 hover:ring-teal-500 ${getBedStatusColor(
                            bed.status
                          )}`}
                          onClick={() => {
                            setSelectedBed(bed);
                            // Track editing presence for other users (ATLUS: Leading)
                            setEditing(true, `bed-${bed.bed_label}`);
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-sm">{bed.bed_label}</span>
                            {bed.has_telemetry && (
                              <Activity className="w-3 h-3 text-blue-500" />
                            )}
                          </div>
                          <div className="text-xs">
                            {bed.status === 'occupied' && bed.patient_name ? (
                              <>
                                <p className="truncate font-medium">{bed.patient_name}</p>
                                {bed.patient_acuity && (
                                  <span
                                    className={`inline-block px-1.5 py-0.5 rounded text-xs mt-1 ${getAcuityColor(
                                      bed.patient_acuity
                                    )}`}
                                  >
                                    {bed.patient_acuity}
                                  </span>
                                )}
                              </>
                            ) : (
                              <p className="capitalize">{getBedStatusLabel(bed.status)}</p>
                            )}
                          </div>
                          {bed.status === 'dirty' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(bed.bed_id, 'cleaning');
                              }}
                              className="mt-2 w-full text-xs bg-orange-500 text-white py-1 rounded-sm hover:bg-orange-600 transition-colors"
                            >
                              Start Cleaning
                            </button>
                          )}
                          {bed.status === 'cleaning' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(bed.bed_id, 'available');
                              }}
                              className="mt-2 w-full text-xs bg-green-500 text-white py-1 rounded-sm hover:bg-green-600 transition-colors"
                            >
                              Mark Ready
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </EACardContent>
                )}
              </EACard>
            ))
          )}
        </div>
      )}

      {/* Unit Capacity Table - shown in real-time tab below bed board */}
      {activeTab === 'real-time' && unitCapacity.length > 0 && (
        <div className="space-y-4 mt-6">
          <EACard>
            <EACardHeader icon={<Building2 className="w-5 h-5" />}>
              Unit Capacity Overview
            </EACardHeader>
            <EACardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-4 text-slate-400 font-medium">Unit</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Type</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Total</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Occupied</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Available</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Pending</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Occupancy</th>
                    <th className="text-center p-4 text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {unitCapacity.map((unit) => (
                    <tr
                      key={unit.unit_id}
                      className="border-b border-slate-800 hover:bg-slate-800/50"
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-white">{unit.unit_name}</p>
                          <p className="text-sm text-slate-400">{unit.unit_code}</p>
                        </div>
                      </td>
                      <td className="p-4 text-center text-slate-300">
                        {getUnitTypeLabel(unit.unit_type)}
                      </td>
                      <td className="p-4 text-center text-white font-medium">
                        {unit.total_beds}
                      </td>
                      <td className="p-4 text-center text-blue-400">{unit.occupied}</td>
                      <td className="p-4 text-center text-green-400">{unit.available}</td>
                      <td className="p-4 text-center text-yellow-400">
                        {unit.pending_clean}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                (unit.occupancy_pct ?? 0) >= 90 ? 'bg-red-500' : 'bg-teal-500'
                              }`}
                              style={{
                                width: `${Math.min(unit.occupancy_pct ?? 0, 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            className={`text-sm ${getOccupancyColor(unit.occupancy_pct ?? 0)}`}
                          >
                            {(unit.occupancy_pct ?? 0).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleGenerateForecast(unit.unit_id)}
                          className="text-teal-400 hover:text-teal-300 text-sm"
                        >
                          <TrendingUp className="w-4 h-4 inline mr-1" />
                          Forecast
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* FORECASTS & AI TAB: Combines Forecasts + AI Optimization (ATLUS: Unity) */}
      {activeTab === 'forecasts-ai' && (
        <div className="space-y-4">
          <EACard>
            <EACardHeader icon={<TrendingUp className="w-5 h-5" />}>
              Bed Availability Forecasts
            </EACardHeader>
            <EACardContent className="p-4">
              {forecasts.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No forecasts generated yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Generate forecasts from the Unit Capacity tab
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {forecasts.map((forecast) => (
                    <div
                      key={forecast.id}
                      className="p-4 bg-slate-800 rounded-lg border border-slate-700"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium text-white">
                            Forecast for {forecast.forecast_date}
                          </p>
                          <p className="text-sm text-slate-400">
                            Generated: {new Date(forecast.generated_at).toLocaleString()}
                          </p>
                        </div>
                        {forecast.confidence_level && (
                          <span className="px-2 py-1 bg-teal-500/20 text-teal-400 rounded-sm text-sm">
                            {Math.round((forecast.confidence_level ?? 0) * 100)}% confidence
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-sm text-slate-400">Predicted Census</p>
                          <p className="text-xl font-bold text-white">
                            {forecast.predicted_census}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Predicted Available</p>
                          <p className="text-xl font-bold text-green-400">
                            {forecast.predicted_available}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Expected Discharges</p>
                          <p className="text-xl font-bold text-blue-400">
                            {forecast.predicted_discharges ?? '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Expected Admissions</p>
                          <p className="text-xl font-bold text-orange-400">
                            {forecast.predicted_admissions ?? '-'}
                          </p>
                        </div>
                      </div>
                      {forecast.actual_census !== null && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-slate-400">Actual Census:</span>
                            <span className="font-bold text-white">
                              {forecast.actual_census}
                            </span>
                            <span
                              className={`text-sm ${
                                Math.abs(forecast.forecast_error ?? 0) <= 2
                                  ? 'text-green-400'
                                  : 'text-orange-400'
                              }`}
                            >
                              ({(forecast.forecast_error ?? 0) > 0 ? '+' : ''}
                              {forecast.forecast_error} variance)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* AI Optimization - now part of forecasts-ai tab */}
      {activeTab === 'forecasts-ai' && (
        <div className="space-y-6 mt-6">
          {/* Header with Generate Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-400" />
                AI-Powered Capacity Optimization
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Using Claude Sonnet for intelligent bed management and capacity forecasting
              </p>
            </div>
            <EAButton
              onClick={async () => {
                setLoadingAiReport(true);
                setAiError(null);
                try {
                  const { data: session } = await supabase.auth.getSession();
                  if (!session?.session?.user) {
                    throw new Error('Not authenticated');
                  }
                  // Get tenant ID from user metadata or use default
                  const tenantId = '2b902657-6a20-4435-a78a-576f397517ca'; // WF-0001 default
                  const result = await bedOptimizer.generateOptimizationReport(tenantId);
                  if (result.success && result.data) {
                    setAiReport(result.data);
                  } else {
                    setAiError(result.error?.message || 'Failed to generate report');
                  }
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : 'Failed to generate AI report';
                  setAiError(message);
                } finally {
                  setLoadingAiReport(false);
                }
              }}
              disabled={loadingAiReport}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {loadingAiReport ? 'Generating AI Report...' : 'Generate AI Report'}
            </EAButton>
          </div>

          {aiError && (
            <EAAlert variant="critical">
              {aiError}
            </EAAlert>
          )}

          {!aiReport && !loadingAiReport && (
            <EACard>
              <EACardContent className="p-12 text-center">
                <Sparkles className="w-16 h-16 text-teal-400/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  AI Optimization Ready
                </h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Click "Generate AI Report" to analyze current bed utilization and receive
                  AI-powered recommendations for capacity optimization using Claude Sonnet.
                </p>
              </EACardContent>
            </EACard>
          )}

          {loadingAiReport && (
            <EACard>
              <EACardContent className="p-12 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Analyzing Capacity Data...
                </h3>
                <p className="text-slate-400">
                  Claude Sonnet is analyzing bed utilization patterns and generating recommendations
                </p>
              </EACardContent>
            </EACard>
          )}
        </div>
      )}

      {activeTab === 'learning' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy Dashboard */}
          <EACard>
            <EACardHeader icon={<Target className="w-5 h-5" />}>
              Prediction Accuracy
            </EACardHeader>
            <EACardContent className="p-4">
              {accuracy ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <p className="text-sm text-slate-400">Accuracy</p>
                      <p className="text-3xl font-bold text-teal-400">
                        {accuracy.accuracy_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-800 rounded-lg text-center">
                      <p className="text-sm text-slate-400">Mean Absolute Error</p>
                      <p className="text-3xl font-bold text-white">
                        {accuracy.mean_absolute_error.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-400">Trend</span>
                    <span
                      className={`flex items-center gap-1 ${
                        accuracy.improving_trend ? 'text-green-400' : 'text-orange-400'
                      }`}
                    >
                      {accuracy.improving_trend ? (
                        <>
                          <TrendingUp className="w-4 h-4" />
                          Improving
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          Needs Attention
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                    <span className="text-slate-400">Sample Size</span>
                    <span className="text-white">
                      {accuracy.total_predictions} predictions
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">Select a unit to view accuracy</p>
                </div>
              )}
            </EACardContent>
          </EACard>

          {/* Feedback Form */}
          <EACard>
            <EACardHeader icon={<Sparkles className="w-5 h-5" />}>
              Submit Learning Feedback
            </EACardHeader>
            <EACardContent className="p-4">
              <p className="text-sm text-slate-400 mb-4">
                Help the algorithm learn by providing actual census data. This improves
                future predictions.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Unit</label>
                  <select
                    value={feedbackUnit}
                    onChange={(e) => setFeedbackUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.unit_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={feedbackDate}
                    onChange={(e) => setFeedbackDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Actual Census (End of Day)
                  </label>
                  <input
                    type="number"
                    value={actualCensus}
                    onChange={(e) => setActualCensus(e.target.value)}
                    placeholder="Enter actual patient count"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={feedbackNotes}
                    onChange={(e) => setFeedbackNotes(e.target.value)}
                    placeholder="Any factors that affected census (e.g., staff shortage, unexpected admissions)"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>

                <EAButton
                  onClick={handleSubmitFeedback}
                  disabled={submittingFeedback || !feedbackUnit || !actualCensus}
                  className="w-full"
                  icon={<Brain className="w-4 h-4" />}
                >
                  {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </EAButton>
              </div>
            </EACardContent>
          </EACard>

          {/* Learning Tips */}
          <EACard className="lg:col-span-2">
            <EACardHeader icon={<Brain className="w-5 h-5" />}>
              How the Algorithm Learns
            </EACardHeader>
            <EACardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-teal-400 font-bold">1</span>
                  </div>
                  <h4 className="font-medium text-white mb-1">Data Collection</h4>
                  <p className="text-sm text-slate-400">
                    Every prediction and actual outcome is recorded for analysis
                  </p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-teal-400 font-bold">2</span>
                  </div>
                  <h4 className="font-medium text-white mb-1">Pattern Recognition</h4>
                  <p className="text-sm text-slate-400">
                    The model identifies factors that affect census (day of week, season,
                    etc.)
                  </p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg">
                  <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-teal-400 font-bold">3</span>
                  </div>
                  <h4 className="font-medium text-white mb-1">Continuous Improvement</h4>
                  <p className="text-sm text-slate-400">
                    Your feedback helps refine predictions specific to your hospital
                  </p>
                </div>
              </div>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* AI Report Display - shown in forecasts-ai tab when report exists */}
      {activeTab === 'forecasts-ai' && aiReport && (
        <div className="space-y-6 mt-6">
          {/* Score Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <EACard>
                  <EACardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Capacity Score</p>
                    <p className={`text-3xl font-bold ${
                      aiReport.overallCapacityScore >= 80 ? 'text-green-400' :
                      aiReport.overallCapacityScore >= 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {aiReport.overallCapacityScore}
                    </p>
                    <p className="text-xs text-slate-500">Out of 100</p>
                  </EACardContent>
                </EACard>
                <EACard>
                  <EACardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Efficiency Score</p>
                    <p className={`text-3xl font-bold ${
                      aiReport.overallEfficiencyScore >= 80 ? 'text-green-400' :
                      aiReport.overallEfficiencyScore >= 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {aiReport.overallEfficiencyScore}
                    </p>
                    <p className="text-xs text-slate-500">Out of 100</p>
                  </EACardContent>
                </EACard>
                <EACard>
                  <EACardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">Current Occupancy</p>
                    <p className="text-3xl font-bold text-white">
                      {Math.round(aiReport.currentOccupancyRate * 100)}%
                    </p>
                    <p className="text-xs text-slate-500">Target: {Math.round(aiReport.targetOccupancyRate * 100)}%</p>
                  </EACardContent>
                </EACard>
                <EACard>
                  <EACardContent className="p-4 text-center">
                    <p className="text-sm text-slate-400">AI Cost</p>
                    <p className="text-3xl font-bold text-teal-400">
                      ${aiReport.totalAiCost.toFixed(3)}
                    </p>
                    <p className="text-xs text-slate-500">This report</p>
                  </EACardContent>
                </EACard>
              </div>

              {/* Capacity Insights */}
              {aiReport.insights.length > 0 && (
                <EACard>
                  <EACardHeader icon={<AlertTriangle className="w-5 h-5" />}>
                    Capacity Insights & Alerts
                  </EACardHeader>
                  <EACardContent className="p-4 space-y-3">
                    {aiReport.insights.map((insight, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-lg border ${
                          insight.severity === 'critical'
                            ? 'bg-red-500/10 border-red-500/30'
                            : insight.severity === 'warning'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-blue-500/10 border-blue-500/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className={`font-medium ${
                              insight.severity === 'critical' ? 'text-red-400' :
                              insight.severity === 'warning' ? 'text-yellow-400' :
                              'text-blue-400'
                            }`}>
                              {insight.title}
                            </h4>
                            <p className="text-sm text-slate-300 mt-1">
                              {insight.description}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs uppercase ${
                            insight.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                            insight.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {insight.insightType}
                          </span>
                        </div>
                        {insight.recommendations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {insight.recommendations.map((rec, j) => (
                              <div key={j} className="flex items-center gap-2 text-sm">
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <span className="text-slate-300">{rec.action}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                  rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-slate-600 text-slate-400'
                                }`}>
                                  {rec.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </EACardContent>
                </EACard>
              )}

              {/* Shift Forecasts */}
              {aiReport.forecasts.length > 0 && (
                <EACard>
                  <EACardHeader icon={<TrendingUp className="w-5 h-5" />}>
                    AI Capacity Forecasts (Next 3 Shifts)
                  </EACardHeader>
                  <EACardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {aiReport.forecasts.map((forecast, i) => (
                        <div
                          key={i}
                          className={`p-4 rounded-lg border ${
                            forecast.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                            forecast.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                            forecast.riskLevel === 'moderate' ? 'bg-yellow-500/10 border-yellow-500/30' :
                            'bg-green-500/10 border-green-500/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium text-white capitalize">
                              {forecast.shiftPeriod} Shift
                            </span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              forecast.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                              forecast.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                              forecast.riskLevel === 'moderate' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {forecast.riskLevel} risk
                            </span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Predicted Census</span>
                              <span className="text-white font-medium">{forecast.predictedCensus}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Expected Discharges</span>
                              <span className="text-green-400">{forecast.predictedDischarges}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Expected Admissions</span>
                              <span className="text-blue-400">{forecast.predictedAdmissions}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Available Beds</span>
                              <span className="text-teal-400 font-medium">{forecast.predictedAvailableBeds}</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-700">
                            <p className="text-xs text-slate-500">
                              Confidence: {Math.round(forecast.confidenceLevel * 100)}%
                            </p>
                          </div>
                          {forecast.recommendations.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-slate-400 mb-1">Recommendations:</p>
                              <ul className="text-xs text-slate-300 space-y-1">
                                {forecast.recommendations.slice(0, 2).map((rec, j) => (
                                  <li key={j}>• {rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </EACardContent>
                </EACard>
              )}

              {/* Unit Breakdown */}
              {aiReport.unitBreakdown.length > 0 && (
                <EACard>
                  <EACardHeader icon={<BarChart3 className="w-5 h-5" />}>
                    Unit-by-Unit Analysis
                  </EACardHeader>
                  <EACardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400 border-b border-slate-700">
                            <th className="pb-3 pr-4">Unit</th>
                            <th className="pb-3 pr-4">Occupancy</th>
                            <th className="pb-3 pr-4">Efficiency</th>
                            <th className="pb-3 pr-4">Bottlenecks</th>
                            <th className="pb-3">Opportunities</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiReport.unitBreakdown.map((unit, i) => (
                            <tr key={i} className="border-b border-slate-700/50">
                              <td className="py-3 pr-4 font-medium text-white">
                                {unit.unitName}
                              </td>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        unit.occupancy > 0.95 ? 'bg-red-500' :
                                        unit.occupancy > 0.85 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(100, unit.occupancy * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-slate-300">
                                    {Math.round(unit.occupancy * 100)}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`${
                                  unit.efficiency >= 80 ? 'text-green-400' :
                                  unit.efficiency >= 60 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {Math.round(unit.efficiency)}%
                                </span>
                              </td>
                              <td className="py-3 pr-4">
                                {unit.bottlenecks.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {unit.bottlenecks.map((b, j) => (
                                      <span key={j} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-sm text-xs">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500">None</span>
                                )}
                              </td>
                              <td className="py-3">
                                {unit.opportunities.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {unit.opportunities.map((o, j) => (
                                      <span key={j} className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-sm text-xs">
                                        {o}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </EACardContent>
                </EACard>
              )}

              {/* Discharge Recommendations */}
              {aiReport.dischargeRecommendations.length > 0 && (
                <EACard>
                  <EACardHeader icon={<UserMinus className="w-5 h-5" />}>
                    AI Discharge Recommendations
                  </EACardHeader>
                  <EACardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-400 border-b border-slate-700">
                            <th className="pb-3 pr-4">Patient</th>
                            <th className="pb-3 pr-4">Bed</th>
                            <th className="pb-3 pr-4">LOS</th>
                            <th className="pb-3 pr-4">Readiness</th>
                            <th className="pb-3 pr-4">Confidence</th>
                            <th className="pb-3">Rationale</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiReport.dischargeRecommendations.slice(0, 10).map((rec, i) => (
                            <tr key={i} className="border-b border-slate-700/50">
                              <td className="py-3 pr-4 font-medium text-white">
                                {rec.patientName}
                              </td>
                              <td className="py-3 pr-4 text-slate-300">
                                {rec.bedLabel}
                              </td>
                              <td className="py-3 pr-4 text-slate-300">
                                {rec.currentLOS} days
                              </td>
                              <td className="py-3 pr-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  rec.dischargeReadiness === 'ready' ? 'bg-green-500/20 text-green-400' :
                                  rec.dischargeReadiness === 'likely_today' ? 'bg-teal-500/20 text-teal-400' :
                                  rec.dischargeReadiness === 'likely_tomorrow' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-slate-600 text-slate-400'
                                }`}>
                                  {rec.dischargeReadiness.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-slate-300">
                                {Math.round(rec.confidence * 100)}%
                              </td>
                              <td className="py-3 text-slate-400 text-xs max-w-xs truncate">
                                {rec.aiRationale}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </EACardContent>
                </EACard>
              )}

          {/* Report Footer */}
          <div className="text-center text-sm text-slate-500">
            Report generated at {new Date(aiReport.generatedAt).toLocaleString()} •
            Model: {aiReport.aiModel}
          </div>
        </div>
      )}

      {/* Bed Detail Modal */}
      {selectedBed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-lg w-full mx-4 border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Bed {selectedBed.bed_label}
                </h3>
                <button
                  onClick={() => {
                    setSelectedBed(null);
                    setEditing(false);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Unit</p>
                  <p className="text-white">{selectedBed.unit_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Room</p>
                  <p className="text-white">{selectedBed.room_number}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Status</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-sm ${getBedStatusColor(
                      selectedBed.status
                    )}`}
                  >
                    {getBedStatusLabel(selectedBed.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Type</p>
                  <p className="text-white capitalize">{selectedBed.bed_type}</p>
                </div>
              </div>

              {selectedBed.patient_name && (
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">Current Patient</p>
                  <p className="text-white font-medium">{selectedBed.patient_name}</p>
                  {selectedBed.patient_mrn && (
                    <p className="text-sm text-slate-400">MRN: {selectedBed.patient_mrn}</p>
                  )}
                  {selectedBed.expected_discharge_date && (
                    <p className="text-sm text-slate-400 mt-2">
                      Expected Discharge: {selectedBed.expected_discharge_date}
                    </p>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBed.has_telemetry && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-sm text-sm">
                      Telemetry
                    </span>
                  )}
                  {selectedBed.has_isolation_capability && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded-sm text-sm">
                      Isolation
                    </span>
                  )}
                  {selectedBed.has_negative_pressure && (
                    <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-sm text-sm">
                      Negative Pressure
                    </span>
                  )}
                  {!selectedBed.has_telemetry &&
                    !selectedBed.has_isolation_capability &&
                    !selectedBed.has_negative_pressure && (
                      <span className="text-slate-500 text-sm">Standard bed</span>
                    )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <EAButton variant="secondary" onClick={() => {
                setSelectedBed(null);
                setEditing(false);
              }}>
                Close
              </EAButton>
              {selectedBed.status === 'occupied' && selectedBed.patient_id && (
                <EAButton
                  onClick={() => setShowDischargeModal(true)}
                  icon={<UserMinus className="w-4 h-4" />}
                  variant="secondary"
                >
                  Discharge Patient
                </EAButton>
              )}
              {selectedBed.status === 'dirty' && (
                <EAButton
                  onClick={() => {
                    handleUpdateStatus(selectedBed.bed_id, 'cleaning');
                    setSelectedBed(null);
                    setEditing(false);
                  }}
                >
                  Start Cleaning
                </EAButton>
              )}
              {selectedBed.status === 'cleaning' && (
                <EAButton
                  onClick={() => {
                    handleUpdateStatus(selectedBed.bed_id, 'available');
                    setSelectedBed(null);
                    setEditing(false);
                  }}
                >
                  Mark Available
                </EAButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {showDischargeModal && selectedBed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-lg w-full mx-4 border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <UserMinus className="w-5 h-5 text-orange-400" />
                  Discharge Patient
                </h3>
                <button
                  onClick={() => {
                    setShowDischargeModal(false);
                    setDischargeDisposition('');
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Patient</p>
                <p className="text-white font-medium">{selectedBed.patient_name}</p>
                {selectedBed.patient_mrn && (
                  <p className="text-sm text-slate-400">MRN: {selectedBed.patient_mrn}</p>
                )}
                <p className="text-sm text-slate-400 mt-2">
                  Bed: {selectedBed.bed_label} | Room: {selectedBed.room_number}
                </p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Discharge Disposition
                </label>
                <select
                  value={dischargeDisposition}
                  onChange={(e) => setDischargeDisposition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select disposition...</option>
                  {DISCHARGE_DISPOSITIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show transfer notice for post-acute dispositions */}
              {dischargeDisposition &&
                DISCHARGE_DISPOSITIONS.find((d) => d.value === dischargeDisposition)?.isPostAcute && (
                  <div className="p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-teal-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-teal-400 font-medium">
                          Transfer Packet Required
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          This discharge type requires a clinical handoff packet. After
                          confirming discharge, you will be redirected to create the
                          transfer documentation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <EAButton
                variant="secondary"
                onClick={() => {
                  setShowDischargeModal(false);
                  setDischargeDisposition('');
                }}
              >
                Cancel
              </EAButton>
              <EAButton
                onClick={handleDischargePatient}
                disabled={!dischargeDisposition || discharging}
                icon={
                  DISCHARGE_DISPOSITIONS.find((d) => d.value === dischargeDisposition)
                    ?.isPostAcute ? (
                    <ArrowRight className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )
                }
              >
                {discharging
                  ? 'Processing...'
                  : DISCHARGE_DISPOSITIONS.find((d) => d.value === dischargeDisposition)
                      ?.isPostAcute
                  ? 'Discharge & Create Transfer'
                  : 'Confirm Discharge'}
              </EAButton>
            </div>
          </div>
        </div>
      )}

      {/* Real-time activity feed (ATLUS: Leading - team awareness) */}
      <ActivityFeed
        roomId="dashboard:bed-management"
        floating
        maxEvents={15}
      />
    </div>
  );
};

export default BedManagementPanel;
