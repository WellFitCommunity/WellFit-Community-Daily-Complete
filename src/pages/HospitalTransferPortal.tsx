/**
 * Hospital-to-Hospital Transfer Portal
 *
 * Secure patient transfer between facilities with complete handoff documentation.
 * Supports both sending and receiving workflows.
 *
 * ENTERPRISE INTEGRATION:
 * - Uses HandoffService for database operations
 * - Proper PHI decryption for display
 * - HIPAA-compliant audit logging
 * - Real-time refresh capability
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Send,
  Download,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  Pill,
  Activity,
  Phone,
  Ambulance,
  RefreshCw,
  ChevronRight,
  Shield,
  ClipboardList,
  Plus,
} from 'lucide-react';
import HandoffService from '../services/handoffService';
import { auditLogger } from '../services/auditLogger';
import type {
  HandoffPacket,
  HandoffStatus,
  UrgencyLevel,
} from '../types/handoff';
import { URGENCY_LABELS } from '../types/handoff';

/**
 * Display-ready transfer packet with decrypted patient info
 */
interface DisplayTransferPacket extends HandoffPacket {
  decryptedPatientName?: string;
  medicationCount: number;
  allergyCount: number;
  labCount: number;
  imagingCount: number;
}

/**
 * Computed metrics for the transfer portal
 */
interface TransferMetrics {
  pendingOutgoing: number;
  pendingIncoming: number;
  inTransit: number;
  completedToday: number;
  avgTransferTime: string;
  complianceRate: number;
}

const HospitalTransferPortal: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [packets, setPackets] = useState<DisplayTransferPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<DisplayTransferPacket | null>(null);

  // Current facility - in production, this would come from user context
  const currentFacility = 'Methodist Hospital - Texas Medical Center';

  /**
   * Transform HandoffPacket to DisplayTransferPacket with decrypted data
   */
  const transformPacket = useCallback(async (packet: HandoffPacket): Promise<DisplayTransferPacket> => {
    let decryptedName = 'Patient';

    if (packet.patient_name_encrypted) {
      try {
        decryptedName = await HandoffService.decryptPHI(packet.patient_name_encrypted);
      } catch {
        // Keep default name if decryption fails
        decryptedName = `Patient ${packet.patient_mrn || packet.id.slice(0, 8)}`;
      }
    }

    // Extract counts from clinical data
    const clinicalData = packet.clinical_data || {};
    const medications = [
      ...(clinicalData.medications_given || []),
      ...(clinicalData.medications_prescribed || []),
      ...(clinicalData.medications_current || []),
    ];

    return {
      ...packet,
      decryptedPatientName: decryptedName,
      medicationCount: medications.length,
      allergyCount: clinicalData.allergies?.length || 0,
      labCount: clinicalData.labs?.length || 0,
      imagingCount: 0, // Imaging stored as attachments, not in clinical_data
    };
  }, []);

  /**
   * Load transfer data from database
   */
  const loadData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Load packets and stats in parallel
      const [packetsData, statsData] = await Promise.all([
        HandoffService.listPackets(),
        HandoffService.getStats(),
      ]);

      // Transform packets with decrypted patient info
      const transformedPackets = await Promise.all(
        packetsData.map(transformPacket)
      );

      setPackets(transformedPackets);

      // Compute display metrics from stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const completedToday = transformedPackets.filter(
        p => p.status === 'acknowledged' &&
        new Date(p.acknowledged_at || p.updated_at) >= todayStart
      ).length;

      const newMetrics: TransferMetrics = {
        pendingOutgoing: transformedPackets.filter(
          p => p.sending_facility.includes(currentFacility) &&
          (p.status === 'draft' || p.status === 'sent')
        ).length,
        pendingIncoming: transformedPackets.filter(
          p => p.receiving_facility.includes(currentFacility) &&
          p.status === 'sent'
        ).length,
        inTransit: transformedPackets.filter(p => p.status === 'sent').length,
        completedToday,
        avgTransferTime: statsData.average_acknowledgement_time_minutes
          ? `${Math.round(statsData.average_acknowledgement_time_minutes)} min`
          : 'N/A',
        complianceRate: transformedPackets.length > 0
          ? Math.round((statsData.acknowledged_packets / Math.max(statsData.sent_packets + statsData.acknowledged_packets, 1)) * 100)
          : 100,
      };

      setMetrics(newMetrics);

      // Log successful data load
      await auditLogger.clinical('TRANSFER_PORTAL_LOAD', true, {
        packet_count: transformedPackets.length,
        facility: currentFacility,
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transfer data';
      setError(errorMessage);
      toast.error(errorMessage);

      await auditLogger.error('TRANSFER_PORTAL_LOAD_FAILED', errorMessage, {
        facility: currentFacility,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transformPacket, currentFacility]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle refresh button click
   */
  const handleRefresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  /**
   * Navigate to create new transfer
   */
  const handleNewTransfer = useCallback(() => {
    navigate('/handoff/send');
  }, [navigate]);

  /**
   * Acknowledge receipt of incoming transfer
   */
  const handleAcknowledge = useCallback(async (packet: DisplayTransferPacket) => {
    try {
      await HandoffService.acknowledgePacket({
        packet_id: packet.id,
        acknowledgement_notes: 'Acknowledged via Hospital Transfer Portal',
      });

      toast.success('Transfer acknowledged successfully');

      await auditLogger.clinical('TRANSFER_ACKNOWLEDGE', true, {
        packet_id: packet.id,
        sending_facility: packet.sending_facility,
        receiving_facility: packet.receiving_facility,
      });

      // Refresh data
      loadData(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge transfer';
      toast.error(errorMessage);

      await auditLogger.error('TRANSFER_ACKNOWLEDGE_FAILED', errorMessage, {
        packet_id: packet.id,
      });
    }
  }, [loadData]);

  const getUrgencyColor = (urgency: UrgencyLevel): string => {
    switch (urgency) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'emergent': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'urgent': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getStatusColor = (status: HandoffStatus): string => {
    switch (status) {
      case 'acknowledged': return 'bg-green-500/20 text-green-400';
      case 'sent': return 'bg-purple-500/20 text-purple-400';
      case 'draft': return 'bg-yellow-500/20 text-yellow-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusIcon = (status: HandoffStatus): React.ReactNode => {
    switch (status) {
      case 'acknowledged': return <CheckCircle className="h-4 w-4" />;
      case 'sent': return <Ambulance className="h-4 w-4" />;
      case 'draft': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusDisplayLabel = (status: HandoffStatus): string => {
    // Map handoff statuses to transfer-friendly labels
    switch (status) {
      case 'sent': return 'IN TRANSIT';
      case 'acknowledged': return 'RECEIVED';
      case 'draft': return 'PENDING';
      case 'cancelled': return 'CANCELLED';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Transfer Portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Transfers</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const outgoingPackets = packets.filter(p =>
    p.sending_facility.includes(currentFacility)
  );
  const incomingPackets = packets.filter(p =>
    p.receiving_facility.includes(currentFacility)
  );

  const criticalTransfers = packets.filter(
    p => p.urgency_level === 'critical' && p.status === 'sent'
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-linear-to-r from-blue-800 via-blue-700 to-indigo-800 text-white shadow-xl border-b border-blue-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-xl">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hospital Transfer Portal</h1>
                <p className="text-blue-200 text-sm">Secure Inter-Facility Patient Transfers</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600/50 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => navigate('/transfer-logs')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Transfer Logs
              </button>
              <button
                onClick={handleNewTransfer}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Transfer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CRITICAL Alert Banner */}
      {criticalTransfers.length > 0 && (
        <div className="bg-linear-to-r from-red-600 to-red-700 text-white py-3 px-4 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-bold">CRITICAL TRANSFER IN PROGRESS:</span>
            <span>
              {criticalTransfers[0].decryptedPatientName} - {criticalTransfers[0].reason_for_transfer}
            </span>
            <span className="ml-auto font-semibold">
              {URGENCY_LABELS[criticalTransfers[0].urgency_level]}
            </span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800 rounded-xl border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-slate-400">Pending Out</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{metrics?.pendingOutgoing ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-blue-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Pending In</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{metrics?.pendingIncoming ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ambulance className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-slate-400">In Transit</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{metrics?.inTransit ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-green-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-sm text-slate-400">Completed</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{metrics?.completedToday ?? 0}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-slate-400" />
              <span className="text-sm text-slate-400">Avg Time</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics?.avgTransferTime ?? 'N/A'}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-teal-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-sm text-slate-400">Compliance</span>
            </div>
            <div className="text-2xl font-bold text-teal-400">{metrics?.complianceRate ?? 100}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'outgoing'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="h-4 w-4 inline mr-2" />
            Outgoing Transfers ({outgoingPackets.length})
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'incoming'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="h-4 w-4 inline mr-2" />
            Incoming Transfers ({incomingPackets.length})
          </button>
        </div>

        {/* Transfer List */}
        <div className="space-y-4">
          {(activeTab === 'outgoing' ? outgoingPackets : incomingPackets).length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
              <FileText className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No {activeTab} transfers</h3>
              <p className="text-slate-400 mb-4">
                {activeTab === 'outgoing'
                  ? 'Create a new transfer to send a patient to another facility.'
                  : 'No incoming transfers are pending for this facility.'}
              </p>
              {activeTab === 'outgoing' && (
                <button
                  onClick={handleNewTransfer}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Transfer
                </button>
              )}
            </div>
          ) : (
            (activeTab === 'outgoing' ? outgoingPackets : incomingPackets).map((packet) => (
              <div
                key={packet.id}
                onClick={() => setSelectedPacket(packet)}
                className={`bg-slate-800 rounded-xl border cursor-pointer transition-all hover:border-blue-500/50 ${
                  packet.urgency_level === 'critical' ? 'border-red-500/50' : 'border-slate-700'
                } ${selectedPacket?.id === packet.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-semibold text-white">
                          {packet.decryptedPatientName}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(packet.urgency_level)}`}>
                          {URGENCY_LABELS[packet.urgency_level].toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(packet.status)}`}>
                          {getStatusIcon(packet.status)}
                          {getStatusDisplayLabel(packet.status)}
                        </span>
                      </div>

                      <div className="text-sm text-slate-400 mb-2">
                        MRN: {packet.patient_mrn || 'N/A'} | Packet: {packet.packet_number}
                      </div>

                      <div className="text-sm text-white mb-3">
                        <strong>Reason:</strong> {packet.reason_for_transfer}
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <Building2 className="h-4 w-4 text-blue-400" />
                          <span>{packet.sending_facility}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                        <div className="flex items-center gap-2 text-slate-300">
                          <Building2 className="h-4 w-4 text-green-400" />
                          <span>{packet.receiving_facility}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm text-slate-400">
                        {new Date(packet.created_at).toLocaleDateString()}
                      </div>
                      {packet.sent_at && (
                        <div className="text-xs text-slate-500 mt-1">
                          Sent: {new Date(packet.sent_at).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Packet Summary */}
                  <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Pill className="h-4 w-4" />
                      <span>{packet.medicationCount} Medications</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{packet.allergyCount} Allergies</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <Activity className="h-4 w-4" />
                      <span>{packet.labCount} Labs</span>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Phone className="h-4 w-4" />
                        <span>{packet.sender_callback_number}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Transfer Details for Selected */}
        {selectedPacket && (
          <div className="bg-slate-800 rounded-xl border border-blue-500/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" />
              Transfer Details: {selectedPacket.decryptedPatientName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Transfer Information</h4>
                <p className="text-white">{selectedPacket.reason_for_transfer}</p>
                {selectedPacket.sender_notes && (
                  <p className="text-slate-300 mt-2 text-sm">{selectedPacket.sender_notes}</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Contact Information</h4>
                <p className="text-white">Provider: {selectedPacket.sender_provider_name}</p>
                <p className="text-white">Callback: {selectedPacket.sender_callback_number}</p>
                {selectedPacket.receiver_contact_name && (
                  <p className="text-white mt-1">Receiver: {selectedPacket.receiver_contact_name}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => navigate(`/handoff/view/${selectedPacket.id}`)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                View Full Packet
              </button>
              {activeTab === 'incoming' && selectedPacket.status === 'sent' && (
                <button
                  onClick={() => handleAcknowledge(selectedPacket)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Acknowledge Receipt
                </button>
              )}
              <button
                onClick={() => window.open(`tel:${selectedPacket.sender_callback_number}`)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                Call Sending Facility
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Last updated: {new Date().toLocaleTimeString()}
              </span>
              <span>|</span>
              <span>{packets.length} total transfers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HIPAA Compliant</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HL7 FHIR Ready</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">Joint Commission</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HospitalTransferPortal;
