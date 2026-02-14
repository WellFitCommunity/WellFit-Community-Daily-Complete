/**
 * MedicationManager — Main orchestrator
 *
 * Enterprise-grade administrative medication management dashboard.
 * Decomposed from a 902-line god file into focused sub-modules.
 *
 * @module components/admin/medication-manager
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { useSupabaseClient, useUser } from '../../../contexts/AuthContext';
import { usePatientContextSafe, SelectedPatient } from '../../../contexts/PatientContext';
import { auditLogger } from '../../../services/auditLogger';
import {
  Pill, AlertTriangle, Users, TrendingUp, Shield, RefreshCw,
  Clock, Activity, FileText, Zap,
} from 'lucide-react';

import type {
  MedicationOverview, PatientMedication, MedicationRecord,
  ReconciliationTask, MedicationManagerProps,
} from './MedicationManager.types';
import { HIGH_RISK_CATEGORIES } from './MedicationManagerHelpers';
import { PatientMedicationTab } from './PatientMedicationTab';
import { ReconciliationTab } from './ReconciliationTab';
import { DrugInteractionsTab } from './DrugInteractionsTab';
import { HighRiskMonitoringTab } from './HighRiskMonitoringTab';
import type { DrugInteraction } from './MedicationManager.types';

const MedicationManager: React.FC<MedicationManagerProps> = ({ tenantId }) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const patientContext = usePatientContextSafe();
  const contextPatient = patientContext?.selectedPatient;
  const selectPatientFromContext = patientContext?.selectPatient;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const [overview, setOverview] = useState<MedicationOverview>({
    totalPatients: 0, totalMedications: 0, activePrescriptions: 0,
    pendingRefills: 0, highRiskCount: 0, polypharmacyCount: 0,
    interactionsDetected: 0, reconciliationPending: 0,
  });
  const [patientMedications, setPatientMedications] = useState<PatientMedication[]>([]);
  const [interactions, _setInteractions] = useState<DrugInteraction[]>([]);
  const [reconciliationTasks, setReconciliationTasks] = useState<ReconciliationTask[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientMedication | null>(null);

  // ATLUS Unity: Sync local selection with global patient context
  useEffect(() => {
    if (contextPatient && patientMedications.length > 0) {
      const matchingPatient = patientMedications.find(p => p.patientId === contextPatient.id);
      if (matchingPatient) {
        setSelectedPatient(matchingPatient);
        setActiveTab('overview');
      }
    }
  }, [contextPatient, patientMedications]);

  const handlePatientSelect = useCallback((patient: PatientMedication) => {
    setSelectedPatient(patient);
    if (selectPatientFromContext) {
      const globalPatient: SelectedPatient = {
        id: patient.patientId,
        firstName: patient.patientName.split(' ')[0] || 'Patient',
        lastName: patient.patientName.split(' ').slice(1).join(' ') || '',
        riskLevel: patient.riskLevel === 'CRITICAL' ? 'critical' :
                   patient.riskLevel === 'HIGH' ? 'high' :
                   patient.riskLevel === 'MODERATE' ? 'medium' : 'low',
        snapshot: {
          primaryDiagnosis: `${patient.medicationCount} active medications`,
          unit: 'Medication Manager',
        },
      };
      selectPatientFromContext(globalPatient);
    }
    auditLogger.info('MEDICATION_PATIENT_SELECTED', {
      userId: user?.id, patientId: patient.patientId, medicationCount: patient.medicationCount,
    });
  }, [selectPatientFromContext, user?.id]);

  const canManageMedications = useMemo(() => {
    const role = user?.role || '';
    return ['admin', 'healthcare_provider', 'nurse', 'pharmacist', 'physician'].includes(role);
  }, [user?.role]);

  const loadData = useCallback(async () => {
    if (!canManageMedications) {
      setError('Insufficient permissions to view medication data');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: patientsData, error: patientsError } = await supabase
        .from('profiles').select('user_id, first_name, last_name, phone').eq('role', 'senior');
      if (patientsError) throw patientsError;

      const { data: medicationsData, error: medicationsError } = await supabase
        .from('medication_requests').select('*').order('created_at', { ascending: false });
      if (medicationsError) throw medicationsError;

      const patients: PatientMedication[] = (patientsData || []).map(patient => {
        const patientMeds = (medicationsData || []).filter(m => m.patient_id === patient.user_id);
        const activeMeds = patientMeds.filter(m => m.status === 'active');
        const highRiskMeds = activeMeds.filter(m =>
          HIGH_RISK_CATEGORIES.some(cat =>
            (m.medication_display || '').toLowerCase().includes(cat) ||
            (m.drug_class || '').toLowerCase().includes(cat)
          )
        );
        let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (highRiskMeds.length >= 2 || activeMeds.length >= 10) riskLevel = 'CRITICAL';
        else if (highRiskMeds.length >= 1 || activeMeds.length >= 7) riskLevel = 'HIGH';
        else if (activeMeds.length >= 5) riskLevel = 'MODERATE';

        const medications: MedicationRecord[] = patientMeds.map(m => ({
          id: m.id, name: m.medication_display || 'Unknown',
          dosage: m.dosage_text || `${m.dosage_dose_quantity || ''} ${m.dosage_dose_unit || ''}`.trim(),
          frequency: m.dosage_timing_frequency ? `${m.dosage_timing_frequency}x daily` : 'As directed',
          status: m.status, prescribedDate: m.authored_on || m.created_at,
          lastDispensedDate: m.dispense_valid_from || null,
          refillsRemaining: m.dispense_number_of_repeats || 0,
          isHighRisk: HIGH_RISK_CATEGORIES.some(cat => (m.medication_display || '').toLowerCase().includes(cat)),
          drugClass: m.drug_class || 'unclassified', interactions: [],
        }));

        return {
          patientId: patient.user_id,
          patientName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown',
          medicationCount: activeMeds.length, riskLevel, lastReviewDate: null,
          needsReconciliation: activeMeds.length >= 5 || highRiskMeds.length > 0, medications,
        };
      });

      const stats: MedicationOverview = {
        totalPatients: patients.length,
        totalMedications: (medicationsData || []).length,
        activePrescriptions: (medicationsData || []).filter(m => m.status === 'active').length,
        pendingRefills: (medicationsData || []).filter(m =>
          m.status === 'active' && (m.dispense_number_of_repeats || 0) <= 1
        ).length,
        highRiskCount: patients.filter(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL').length,
        polypharmacyCount: patients.filter(p => p.medicationCount >= 5).length,
        interactionsDetected: 0,
        reconciliationPending: patients.filter(p => p.needsReconciliation).length,
      };

      const tasks: ReconciliationTask[] = patients
        .filter(p => p.needsReconciliation).slice(0, 10)
        .map((p, index) => ({
          id: `recon-${p.patientId}`, patientId: p.patientId, patientName: p.patientName,
          reason: index % 3 === 0 ? 'routine' : index % 2 === 0 ? 'new_prescription' : 'admission',
          status: index < 2 ? 'in_progress' : 'pending',
          assignedTo: index < 2 ? user?.id || null : null,
          dueDate: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(), medicationChanges: Math.floor(Math.random() * 5) + 1,
          priority: p.riskLevel === 'CRITICAL' ? 'URGENT' : p.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
        }));

      setPatientMedications(patients);
      setOverview(stats);
      setReconciliationTasks(tasks);
      auditLogger.info('MEDICATION_MANAGER_DATA_LOADED', {
        userId: user?.id, totalPatients: stats.totalPatients, totalMedications: stats.totalMedications, tenantId,
      });
    } catch (err) {
      auditLogger.error('MEDICATION_MANAGER_LOAD_FAILED',
        err instanceof Error ? err : new Error(String(err)), { userId: user?.id, tenantId });
      setError(err instanceof Error ? err.message : 'Failed to load medication data');
    } finally {
      setLoading(false);
    }
  }, [supabase, user?.id, tenantId, canManageMedications]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredPatients = useMemo(() => {
    return patientMedications.filter(patient => {
      const matchesSearch = searchTerm === '' || patient.patientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = filterRisk === 'all' || patient.riskLevel === filterRisk;
      return matchesSearch && matchesRisk;
    });
  }, [patientMedications, searchTerm, filterRisk]);

  const handleReconciliationAction = async (taskId: string, action: 'start' | 'complete' | 'escalate') => {
    const task = reconciliationTasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = action === 'start' ? 'in_progress' : action === 'complete' ? 'completed' : 'escalated';
    setReconciliationTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, assignedTo: user?.id || null } : t));
    auditLogger.info('MEDICATION_RECONCILIATION_ACTION', {
      userId: user?.id, taskId, patientId: task.patientId, action, newStatus,
    });
  };

  if (loading) {
    return (
      <Card><CardContent className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <div>Loading medication management data...</div>
      </CardContent></Card>
    );
  }

  if (error) {
    return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (!canManageMedications) {
    return <Alert><Shield className="h-4 w-4" /><AlertDescription>You do not have permission to access the Medication Manager. Contact your administrator for access.</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medication Manager</h1>
          <p className="text-gray-600">Population-level medication oversight and reconciliation</p>
        </div>
        <Button onClick={loadData} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { icon: <Users className="h-6 w-6 mx-auto mb-2 text-blue-600" />, value: overview.totalPatients, label: 'Total Patients' },
          { icon: <Pill className="h-6 w-6 mx-auto mb-2 text-green-600" />, value: overview.activePrescriptions, label: 'Active Rx' },
          { icon: <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />, value: overview.pendingRefills, label: 'Pending Refills' },
          { icon: <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600" />, value: overview.highRiskCount, label: 'High Risk' },
          { icon: <Activity className="h-6 w-6 mx-auto mb-2 text-purple-600" />, value: overview.polypharmacyCount, label: 'Polypharmacy' },
          { icon: <Zap className="h-6 w-6 mx-auto mb-2 text-orange-600" />, value: overview.interactionsDetected, label: 'Interactions' },
          { icon: <FileText className="h-6 w-6 mx-auto mb-2 text-indigo-600" />, value: overview.reconciliationPending, label: 'Need Review' },
          { icon: <TrendingUp className="h-6 w-6 mx-auto mb-2 text-teal-600" />, value: overview.totalMedications, label: 'Total Meds' },
        ].map((stat, idx) => (
          <Card key={idx}><CardContent className="p-4 text-center">
            {stat.icon}
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs text-gray-600">{stat.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Patient Overview</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="interactions">Drug Interactions</TabsTrigger>
          <TabsTrigger value="high-risk">High-Risk Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PatientMedicationTab
            filteredPatients={filteredPatients}
            selectedPatient={selectedPatient}
            searchTerm={searchTerm}
            filterRisk={filterRisk}
            onSearchChange={setSearchTerm}
            onFilterChange={setFilterRisk}
            onPatientSelect={handlePatientSelect}
          />
        </TabsContent>

        <TabsContent value="reconciliation">
          <ReconciliationTab tasks={reconciliationTasks} onAction={handleReconciliationAction} />
        </TabsContent>

        <TabsContent value="interactions">
          <DrugInteractionsTab interactions={interactions} tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="high-risk">
          <HighRiskMonitoringTab patientMedications={patientMedications} onPatientSelect={handlePatientSelect} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MedicationManager;
