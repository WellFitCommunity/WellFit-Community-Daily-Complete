/**
 * Constable Dispatch Dashboard
 *
 * Real-time dashboard for constables monitoring senior welfare checks
 * Shows missed check-ins prioritized by urgency
 *
 * Design: Envision Atlus Clinical Design System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LawEnforcementService } from '../../services/lawEnforcementService';
import type { MissedCheckInAlert, WelfareCheckInfo, EmergencyContact } from '../../types/lawEnforcement';
import { WelfareCheckReportModal } from './WelfareCheckReportModal';
import { WelfareCheckReportHistory } from './WelfareCheckReportHistory';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EARiskIndicator,
} from '../envision-atlus';
import {
  Shield,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Home,
  Heart,
  RefreshCw,
  Navigation,
  Users,
  Key,
  Activity,
  FileText,
} from 'lucide-react';

export const ConstableDispatchDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<MissedCheckInAlert[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [welfareCheckInfo, setWelfareCheckInfo] = useState<WelfareCheckInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportHistoryKey, setReportHistoryKey] = useState(0);

  useEffect(() => {
    loadAlerts();

    // Auto-refresh every 2 minutes
    const interval = setInterval(loadAlerts, 2 * 60 * 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadWelfareCheckInfo(selectedPatient);
    }
  }, [selectedPatient]);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await LawEnforcementService.getMissedCheckInAlerts();
    setAlerts(data);
    setLoading(false);
  };

  const loadWelfareCheckInfo = async (patientId: string) => {
    const info = await LawEnforcementService.getWelfareCheckInfo(patientId);
    setWelfareCheckInfo(info);
  };

  const handleReportSaved = useCallback(() => {
    loadAlerts();
    // Force re-render of report history by changing key
    setReportHistoryKey((prev) => prev + 1);
  }, []);

  const getRiskLevel = (urgency: number): 'critical' | 'high' | 'elevated' | 'normal' => {
    if (urgency >= 100) return 'critical';
    if (urgency >= 75) return 'high';
    if (urgency >= 50) return 'elevated';
    return 'normal';
  };

  const getPriorityRisk = (priority: string): 'critical' | 'high' | 'elevated' | 'normal' => {
    if (priority === 'critical') return 'critical';
    if (priority === 'high') return 'high';
    return 'elevated';
  };

  return (
    <div className="flex h-screen bg-linear-to-br from-slate-900 to-slate-800">
      {/* Left Panel - Alerts List */}
      <div className="w-[380px] bg-slate-900/50 border-r border-slate-700 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/90 backdrop-blur-xs border-b border-slate-700 p-4 z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#00857a]/20 rounded-lg">
              <Shield className="h-6 w-6 text-[#00857a]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Welfare Check Queue</h2>
              <p className="text-sm text-slate-400">
                {alerts.length} seniors requiring attention
              </p>
            </div>
          </div>
          <EAButton
            variant="secondary"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
            className="w-full"
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </EAButton>
        </div>

        {/* Alerts List */}
        <div className="p-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <p className="text-lg font-medium text-white">All Clear!</p>
              <p className="text-sm text-slate-400 mt-1">No welfare checks needed at this time</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.patientId}
                onClick={() => setSelectedPatient(alert.patientId)}
                className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedPatient === alert.patientId
                    ? 'bg-[#00857a]/20 border-2 border-[#00857a]'
                    : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                {/* Header with name and urgency */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{alert.patientName}</h3>
                    <p className="text-sm text-slate-400 truncate">{alert.patientAddress}</p>
                  </div>
                  <EARiskIndicator
                    level={getRiskLevel(alert.urgencyScore)}
                    variant="badge"
                    showIcon={false}
                    label={alert.urgencyScore.toString()}
                  />
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 mb-3">
                  <EABadge variant={getPriorityRisk(alert.responsePriority)}>
                    {alert.responsePriority.toUpperCase()}
                  </EABadge>
                  <span className="flex items-center text-xs text-slate-400">
                    <Clock className="h-3 w-3 mr-1" />
                    {alert.hoursSinceCheckIn.toFixed(1)}h ago
                  </span>
                </div>

                {/* Special Needs */}
                {alert.specialNeeds && (
                  <div className="flex items-center text-xs text-amber-400 mb-2 bg-amber-500/10 rounded-sm px-2 py-1">
                    <AlertTriangle className="h-3 w-3 mr-1.5 shrink-0" />
                    <span className="truncate">{alert.specialNeeds}</span>
                  </div>
                )}

                {/* Emergency Contact */}
                <div className="flex items-center text-xs text-slate-500">
                  <Phone className="h-3 w-3 mr-1.5" />
                  {alert.emergencyContactName} • {alert.emergencyContactPhone}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel - Welfare Check Details */}
      <div className="flex-1 overflow-y-auto">
        {selectedPatient && welfareCheckInfo ? (
          <div className="p-6 space-y-6">
            {/* Senior Info Header */}
            <EACard variant="elevated">
              <EACardContent className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-linear-to-br from-[#00857a] to-[#33bfb7] flex items-center justify-center">
                      <User className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{welfareCheckInfo.patientName}</h2>
                      <p className="text-slate-400">Age {welfareCheckInfo.patientAge}</p>
                    </div>
                  </div>
                  <EARiskIndicator
                    level={getPriorityRisk(welfareCheckInfo.responsePriority)}
                    variant="badge"
                    label={`${welfareCheckInfo.responsePriority.toUpperCase()} PRIORITY`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-[#00857a] mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Address</p>
                      <p className="text-white">{welfareCheckInfo.patientAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="h-5 w-5 text-[#00857a] mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Phone</p>
                      <p className="text-white font-mono">{welfareCheckInfo.patientPhone}</p>
                    </div>
                  </div>
                </div>

                {welfareCheckInfo.hoursSinceCheckIn && (
                  <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center text-red-400">
                      <AlertTriangle className="h-5 w-5 mr-2" />
                      <span className="font-semibold">
                        Last check-in: {welfareCheckInfo.hoursSinceCheckIn.toFixed(1)} hours ago
                      </span>
                    </div>
                  </div>
                )}
              </EACardContent>
            </EACard>

            {/* Emergency Response Info */}
            <EACard>
              <EACardHeader icon={<AlertTriangle className="h-5 w-5" />}>
                <h3 className="text-lg font-semibold text-white">Emergency Response Info</h3>
              </EACardHeader>
              <EACardContent className="space-y-4">
                {/* Building Location */}
                {welfareCheckInfo.buildingLocation && (
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-indigo-300 font-semibold mb-2">
                      <Home className="h-4 w-4" />
                      BUILDING LOCATION
                    </div>
                    <p className="text-white whitespace-pre-line">{welfareCheckInfo.buildingLocation}</p>
                    {welfareCheckInfo.floorNumber && (
                      <p className="text-slate-300 mt-2">Floor: {welfareCheckInfo.floorNumber}</p>
                    )}
                    {welfareCheckInfo.elevatorRequired && (
                      <EABadge variant="info" className="mt-2">🛗 ELEVATOR REQUIRED</EABadge>
                    )}
                    {welfareCheckInfo.parkingInstructions && (
                      <p className="text-slate-300 mt-2">
                        <span className="text-slate-500">Parking:</span> {welfareCheckInfo.parkingInstructions}
                      </p>
                    )}
                  </div>
                )}

                {/* Mobility */}
                <div className="flex items-start gap-3">
                  <Activity className="h-5 w-5 text-[#00857a] mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Mobility Status</p>
                    <p className="text-lg font-semibold text-white">{welfareCheckInfo.mobilityStatus}</p>
                  </div>
                </div>

                {/* Medical Equipment */}
                {welfareCheckInfo.medicalEquipment?.length > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold mb-2">
                      <Heart className="h-4 w-4" />
                      MEDICAL EQUIPMENT
                    </div>
                    <ul className="space-y-1">
                      {welfareCheckInfo.medicalEquipment.map((eq, i) => (
                        <li key={i} className="text-white flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                          {eq}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Communication Needs */}
                {welfareCheckInfo.communicationNeeds && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-300 font-semibold mb-2">
                      <Users className="h-4 w-4" />
                      COMMUNICATION NEEDS
                    </div>
                    <p className="text-white">{welfareCheckInfo.communicationNeeds}</p>
                  </div>
                )}

                {/* Access Instructions */}
                {welfareCheckInfo.accessInstructions && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-2">
                      <Key className="h-4 w-4" />
                      ACCESS INSTRUCTIONS
                    </div>
                    <p className="text-white whitespace-pre-line">{welfareCheckInfo.accessInstructions}</p>
                  </div>
                )}

                {/* Pets */}
                {welfareCheckInfo.pets && (
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🐾</span>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Pets in Home</p>
                      <p className="text-white">{welfareCheckInfo.pets}</p>
                    </div>
                  </div>
                )}

                {/* Special Instructions */}
                {welfareCheckInfo.specialInstructions && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-300 font-semibold mb-2">
                      📝 SPECIAL INSTRUCTIONS
                    </div>
                    <p className="text-white whitespace-pre-line">{welfareCheckInfo.specialInstructions}</p>
                  </div>
                )}

                {/* Risk Flags */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {welfareCheckInfo.fallRisk && (
                    <EABadge variant="elevated">⚠️ Fall Risk</EABadge>
                  )}
                  {welfareCheckInfo.cognitiveImpairment && (
                    <EABadge variant="high">🧠 Cognitive Impairment</EABadge>
                  )}
                  {welfareCheckInfo.oxygenDependent && (
                    <EABadge variant="critical">🫁 Oxygen Dependent</EABadge>
                  )}
                </div>
              </EACardContent>
            </EACard>

            {/* Emergency Contacts */}
            <EACard>
              <EACardHeader icon={<Users className="h-5 w-5" />}>
                <h3 className="text-lg font-semibold text-white">Emergency Contacts</h3>
              </EACardHeader>
              <EACardContent className="space-y-4">
                {welfareCheckInfo.emergencyContacts?.map((contact: EmergencyContact, i: number) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border-l-4 border-[#00857a]">
                    <div className="w-10 h-10 rounded-full bg-[#00857a]/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-[#00857a]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{contact.name}</p>
                      <p className="text-sm text-slate-400">{contact.relationship}</p>
                    </div>
                    <p className="font-mono text-[#33bfb7]">{contact.phone}</p>
                  </div>
                ))}

                {welfareCheckInfo.neighborInfo && (
                  <div className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg border-l-4 border-emerald-500">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Home className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 uppercase">Neighbor</p>
                      <p className="font-medium text-white">{welfareCheckInfo.neighborInfo.name}</p>
                      <p className="text-sm text-slate-400">{welfareCheckInfo.neighborInfo.address}</p>
                    </div>
                    <p className="font-mono text-emerald-400">{welfareCheckInfo.neighborInfo.phone}</p>
                  </div>
                )}
              </EACardContent>
            </EACard>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-4">
              <EAButton
                variant="secondary"
                size="lg"
                icon={<Phone className="h-5 w-5" />}
                className="py-4"
              >
                Call Contact
              </EAButton>
              <EAButton
                variant="primary"
                size="lg"
                icon={<Navigation className="h-5 w-5" />}
                className="py-4"
              >
                Dispatch Now
              </EAButton>
              <EAButton
                variant="ghost"
                size="lg"
                icon={<CheckCircle className="h-5 w-5" />}
                className="py-4"
                onClick={() => setReportModalOpen(true)}
              >
                Complete Check
              </EAButton>
            </div>

            {/* Report History */}
            <EACard>
              <EACardHeader icon={<FileText className="h-5 w-5" />}>
                <h3 className="text-lg font-semibold text-white">Welfare Check History</h3>
              </EACardHeader>
              <EACardContent>
                <WelfareCheckReportHistory
                  key={reportHistoryKey}
                  patientId={selectedPatient}
                  tenantId=""
                />
              </EACardContent>
            </EACard>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Shield className="h-10 w-10 text-slate-600" />
              </div>
              <p className="text-lg font-medium text-white">Select a senior from the list</p>
              <p className="text-sm text-slate-500 mt-1">View complete welfare check information</p>
            </div>
          </div>
        )}
      </div>

      {/* Report Filing Modal */}
      {selectedPatient && (() => {
        const selectedAlert = alerts.find((a) => a.patientId === selectedPatient);
        if (!selectedAlert) return null;
        return (
          <WelfareCheckReportModal
            isOpen={reportModalOpen}
            onClose={() => setReportModalOpen(false)}
            onSaved={handleReportSaved}
            alert={selectedAlert}
            tenantId=""
          />
        );
      })()}
    </div>
  );
};

export default ConstableDispatchDashboard;
