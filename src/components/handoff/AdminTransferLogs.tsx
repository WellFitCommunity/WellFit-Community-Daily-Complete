// Admin Transfer Logs - Complete audit trail for all patient handoffs
// Export to CSV/Excel for compliance reporting
// Envision Atlus Dark Theme

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import * as XLSX from 'exceljs';
import {
  FileSpreadsheet,
  Search,
  Filter,
  X,
  Clock,
  CheckCircle,
  AlertTriangle,
  Package,
  RefreshCw,
  Bed,
  ArrowRight,
  Eye,
  Plus,
  FileText,
  UserMinus,
} from 'lucide-react';
import HandoffService from '../../services/handoffService';
import type {
  HandoffPacket,
  HandoffPacketStats,
  HandoffPacketListFilters,
  AdminTransferLogsProps,
  HandoffStatus,
  UrgencyLevel,
} from '../../types/handoff';
import { URGENCY_LABELS, STATUS_LABELS } from '../../types/handoff';
import { EACard, EACardHeader, EACardContent, EAButton } from '../envision-atlus';

// Discharge transfer info passed from bed management
interface DischargeTransferState {
  createTransfer?: boolean;
  patientId?: string;
  patientName?: string;
  patientMrn?: string;
  disposition?: string;
  fromBedManagement?: boolean;
}

const AdminTransferLogs: React.FC<AdminTransferLogsProps> = ({
  showExportButton = true,
  defaultFilters,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [packets, setPackets] = useState<HandoffPacket[]>([]);
  const [stats, setStats] = useState<HandoffPacketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<HandoffPacket | null>(null);

  // Discharge transfer from bed management
  const [showDischargeTransferModal, setShowDischargeTransferModal] = useState(false);
  const [dischargeTransferInfo, setDischargeTransferInfo] = useState<DischargeTransferState | null>(null);
  const [receivingFacility, setReceivingFacility] = useState('');
  const [receivingContact, setReceivingContact] = useState('');
  const [receivingPhone, setReceivingPhone] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [creatingTransfer, setCreatingTransfer] = useState(false);

  // Filters
  const [filters, setFilters] = useState<HandoffPacketListFilters>(
    defaultFilters || {}
  );

  // Check for incoming discharge transfer from bed management
  useEffect(() => {
    const state = location.state as DischargeTransferState | null;
    if (state?.createTransfer && state?.fromBedManagement) {
      setDischargeTransferInfo(state);
      setShowDischargeTransferModal(true);
      // Clear the location state to prevent re-showing on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [packetsData, statsData] = await Promise.all([
        HandoffService.listPackets(filters),
        HandoffService.getStats(filters),
      ]);
      setPackets(packetsData);
      setStats(statsData);
    } catch (error: any) {
      toast.error(`Failed to load data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const exportToExcel = async () => {
    try {
      setExporting(true);
      toast.info('Generating Excel export...');

      const workbook = new XLSX.Workbook();
      const worksheet = workbook.addWorksheet('Patient Handoff Audit Trail');

      // Define columns
      worksheet.columns = [
        { header: 'Packet Number', key: 'packet_number', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Urgency', key: 'urgency_level', width: 12 },
        { header: 'Patient MRN', key: 'patient_mrn', width: 15 },
        { header: 'Sending Facility', key: 'sending_facility', width: 30 },
        { header: 'Receiving Facility', key: 'receiving_facility', width: 30 },
        { header: 'Sender Provider', key: 'sender_provider_name', width: 25 },
        { header: 'Sender Phone', key: 'sender_callback_number', width: 18 },
        { header: 'Reason for Transfer', key: 'reason_for_transfer', width: 40 },
        { header: 'Created At', key: 'created_at', width: 20 },
        { header: 'Sent At', key: 'sent_at', width: 20 },
        { header: 'Acknowledged At', key: 'acknowledged_at', width: 20 },
        {
          header: 'Time to Acknowledgement (min)',
          key: 'ack_time_minutes',
          width: 25,
        },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00857A' }, // EA Teal
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add data rows
      for (const packet of packets) {
        let ackTimeMinutes = null;
        if (packet.sent_at && packet.acknowledged_at) {
          const sentTime = new Date(packet.sent_at).getTime();
          const ackTime = new Date(packet.acknowledged_at).getTime();
          ackTimeMinutes = ((ackTime - sentTime) / 1000 / 60).toFixed(2);
        }

        // Decrypt patient info for export (admins only)
        const patientName = packet.patient_name_encrypted
          ? await HandoffService.decryptPHI(packet.patient_name_encrypted)
          : 'N/A';

        worksheet.addRow({
          packet_number: packet.packet_number,
          status: STATUS_LABELS[packet.status],
          urgency_level: URGENCY_LABELS[packet.urgency_level],
          patient_mrn: packet.patient_mrn || 'N/A',
          sending_facility: packet.sending_facility,
          receiving_facility: packet.receiving_facility,
          sender_provider_name: packet.sender_provider_name,
          sender_callback_number: packet.sender_callback_number,
          reason_for_transfer: packet.reason_for_transfer,
          created_at: new Date(packet.created_at).toLocaleString(),
          sent_at: packet.sent_at ? new Date(packet.sent_at).toLocaleString() : 'N/A',
          acknowledged_at: packet.acknowledged_at
            ? new Date(packet.acknowledged_at).toLocaleString()
            : 'N/A',
          ack_time_minutes: ackTimeMinutes || 'N/A',
        });
      }

      // Add summary statistics sheet
      const statsSheet = workbook.addWorksheet('Statistics');
      statsSheet.columns = [
        { header: 'Metric', key: 'metric', width: 35 },
        { header: 'Value', key: 'value', width: 15 },
      ];

      statsSheet.getRow(1).font = { bold: true };
      statsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00857A' },
      };
      statsSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      if (stats) {
        statsSheet.addRow({ metric: 'Total Packets', value: stats.total_packets });
        statsSheet.addRow({ metric: 'Sent Packets', value: stats.sent_packets });
        statsSheet.addRow({
          metric: 'Acknowledged Packets',
          value: stats.acknowledged_packets,
        });
        statsSheet.addRow({
          metric: 'Pending Acknowledgement',
          value: stats.pending_acknowledgement,
        });
        statsSheet.addRow({
          metric: 'Avg. Acknowledgement Time (min)',
          value: stats.average_acknowledgement_time_minutes?.toFixed(2) || 'N/A',
        });

        statsSheet.addRow({ metric: '', value: '' }); // Spacer
        statsSheet.addRow({ metric: 'By Status:', value: '' });
        Object.entries(stats.packets_by_status).forEach(([status, count]) => {
          statsSheet.addRow({
            metric: `  ${STATUS_LABELS[status as HandoffStatus]}`,
            value: count,
          });
        });

        statsSheet.addRow({ metric: '', value: '' }); // Spacer
        statsSheet.addRow({ metric: 'By Urgency:', value: '' });
        Object.entries(stats.packets_by_urgency).forEach(([urgency, count]) => {
          statsSheet.addRow({
            metric: `  ${URGENCY_LABELS[urgency as UrgencyLevel]}`,
            value: count,
          });
        });
      }

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Patient_Handoff_Audit_Trail_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Export completed successfully!');
    } catch (error: any) {
      toast.error(`Failed to export: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  /**
   * Create discharge transfer packet from bed management
   */
  const handleCreateDischargeTransfer = async () => {
    if (!dischargeTransferInfo || !receivingFacility) {
      toast.error('Please enter the receiving facility information');
      return;
    }

    setCreatingTransfer(true);
    try {
      // Create handoff packet
      const result = await HandoffService.createPacket({
        patient_name: dischargeTransferInfo.patientName || 'Unknown Patient',
        patient_mrn: dischargeTransferInfo.patientMrn,
        patient_dob: '1970-01-01', // Required field - will be updated in future
        sending_facility: 'Current Hospital', // Will use user's facility
        receiving_facility: receivingFacility,
        urgency_level: 'routine',
        reason_for_transfer: `Post-Acute Discharge - ${dischargeTransferInfo.disposition || 'Transfer'}`,
        clinical_data: {
          notes: clinicalSummary || undefined,
        },
        sender_provider_name: 'Discharge Planning Team',
        sender_callback_number: 'N/A',
        sender_notes: clinicalSummary,
        receiver_contact_name: receivingContact || undefined,
        receiver_contact_phone: receivingPhone || undefined,
      });

      toast.success('Transfer packet created successfully!');
      setShowDischargeTransferModal(false);
      setDischargeTransferInfo(null);
      setReceivingFacility('');
      setReceivingContact('');
      setReceivingPhone('');
      setClinicalSummary('');

      // Reload data to show the new packet
      await loadData();

      // Show the newly created packet
      if (result?.packet) {
        setSelectedPacket(result.packet);
      }
    } catch (error: any) {
      toast.error(`Failed to create transfer: ${error.message}`);
    } finally {
      setCreatingTransfer(false);
    }
  };

  const getStatusColor = (status: HandoffStatus): string => {
    const colors = {
      draft: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      acknowledged: 'bg-green-500/20 text-green-400 border-green-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[status];
  };

  const getUrgencyColor = (level: UrgencyLevel): string => {
    const colors = {
      routine: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      urgent: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      emergent: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[level];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-[#00857a] animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading transfer logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-7 h-7 text-[#00857a]" />
              Transfer Logs
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Complete audit trail for patient handoffs and transfers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EAButton
              variant="secondary"
              icon={<Bed className="w-4 h-4" />}
              onClick={() => navigate('/bed-management')}
            >
              Bed Management
            </EAButton>
            <EAButton
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={loadData}
            >
              Refresh
            </EAButton>
          </div>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <EACard>
              <EACardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Transfers</p>
                    <p className="text-2xl font-bold text-white">{stats.total_packets}</p>
                  </div>
                  <Package className="w-8 h-8 text-blue-400 opacity-50" />
                </div>
              </EACardContent>
            </EACard>

            <EACard>
              <EACardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Pending Ack</p>
                    <p className="text-2xl font-bold text-yellow-400">{stats.pending_acknowledgement}</p>
                  </div>
                  <Clock className="w-8 h-8 text-yellow-400 opacity-50" />
                </div>
              </EACardContent>
            </EACard>

            <EACard>
              <EACardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Acknowledged</p>
                    <p className="text-2xl font-bold text-green-400">{stats.acknowledged_packets}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-400 opacity-50" />
                </div>
              </EACardContent>
            </EACard>

            <EACard>
              <EACardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Avg. Ack Time</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {stats.average_acknowledgement_time_minutes
                        ? `${stats.average_acknowledgement_time_minutes.toFixed(0)} min`
                        : 'N/A'}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-purple-400 opacity-50" />
                </div>
              </EACardContent>
            </EACard>
          </div>
        )}

        {/* Filters */}
        <EACard>
          <EACardHeader icon={<Filter className="w-5 h-5" />}>
            Filters
          </EACardHeader>
          <EACardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      status: e.target.value as HandoffStatus | undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Urgency
                </label>
                <select
                  value={filters.urgency_level || ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      urgency_level: e.target.value as UrgencyLevel | undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                >
                  <option value="">All Urgencies</option>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergent">Emergent</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={filters.search || ''}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Packet # or MRN"
                    className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-between">
              <EAButton
                variant="secondary"
                onClick={() => setFilters({})}
              >
                Clear Filters
              </EAButton>

              {showExportButton && (
                <EAButton
                  onClick={exportToExcel}
                  disabled={exporting || packets.length === 0}
                  icon={<FileSpreadsheet className="w-4 h-4" />}
                >
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </EAButton>
              )}
            </div>
          </EACardContent>
        </EACard>

        {/* Transfer Logs Table */}
        <EACard>
          <EACardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Packet #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Urgency
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      From → To
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {packets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No transfer packets found</p>
                      </td>
                    </tr>
                  ) : (
                    packets.map((packet) => (
                      <tr key={packet.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono font-medium text-white">
                          {packet.packet_number}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              packet.status
                            )}`}
                          >
                            {STATUS_LABELS[packet.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(
                              packet.urgency_level
                            )}`}
                          >
                            {URGENCY_LABELS[packet.urgency_level]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[120px]" title={packet.sending_facility}>
                              {packet.sending_facility}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[120px]" title={packet.receiving_facility}>
                              {packet.receiving_facility}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {packet.sender_provider_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">
                          {new Date(packet.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => setSelectedPacket(packet)}
                            className="flex items-center gap-1 text-[#00857a] hover:text-[#33bfb7] font-medium transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </EACardContent>
        </EACard>

        {/* Pagination info */}
        <div className="text-center text-sm text-slate-500">
          Showing {packets.length} transfer packet(s)
        </div>

        {/* Selected Packet Modal */}
        {selectedPacket && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Transfer Details
                    </h2>
                    <p className="text-sm text-slate-400 mt-1 font-mono">
                      {selectedPacket.packet_number}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPacket(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-400">Status</p>
                    <span className={`inline-block px-2 py-1 mt-1 rounded-full text-xs font-medium border ${getStatusColor(selectedPacket.status)}`}>
                      {STATUS_LABELS[selectedPacket.status]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Urgency</p>
                    <span className={`inline-block px-2 py-1 mt-1 rounded-full text-xs font-medium border ${getUrgencyColor(selectedPacket.urgency_level)}`}>
                      {URGENCY_LABELS[selectedPacket.urgency_level]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Sending Facility</p>
                    <p className="text-white font-medium">{selectedPacket.sending_facility}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Receiving Facility</p>
                    <p className="text-white font-medium">{selectedPacket.receiving_facility}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Provider</p>
                    <p className="text-white">{selectedPacket.sender_provider_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Callback Number</p>
                    <p className="text-white">{selectedPacket.sender_callback_number}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-1">Reason for Transfer</p>
                  <p className="text-white bg-slate-700/50 p-3 rounded-lg">
                    {selectedPacket.reason_for_transfer}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Created</p>
                    <p className="text-white">{new Date(selectedPacket.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Sent</p>
                    <p className="text-white">
                      {selectedPacket.sent_at ? new Date(selectedPacket.sent_at).toLocaleString() : 'Not sent'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Acknowledged</p>
                    <p className="text-white">
                      {selectedPacket.acknowledged_at ? new Date(selectedPacket.acknowledged_at).toLocaleString() : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-700 flex justify-end">
                <EAButton variant="secondary" onClick={() => setSelectedPacket(null)}>
                  Close
                </EAButton>
              </div>
            </div>
          </div>
        )}

        {/* Discharge Transfer Modal - from Bed Management */}
        {showDischargeTransferModal && dischargeTransferInfo && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl shadow-xl max-w-lg w-full border border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                      <UserMinus className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        Create Discharge Transfer
                      </h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Patient discharged from Bed Management
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDischargeTransferModal(false);
                      setDischargeTransferInfo(null);
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Patient Info */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Patient</p>
                  <p className="text-white font-medium">{dischargeTransferInfo.patientName || 'Unknown'}</p>
                  {dischargeTransferInfo.patientMrn && (
                    <p className="text-sm text-slate-400">MRN: {dischargeTransferInfo.patientMrn}</p>
                  )}
                  <p className="text-sm text-teal-400 mt-2">
                    Disposition: {dischargeTransferInfo.disposition}
                  </p>
                </div>

                {/* Receiving Facility */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Receiving Facility Name *
                  </label>
                  <input
                    type="text"
                    value={receivingFacility}
                    onChange={(e) => setReceivingFacility(e.target.value)}
                    placeholder="e.g., Sunrise Skilled Nursing"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={receivingContact}
                      onChange={(e) => setReceivingContact(e.target.value)}
                      placeholder="Admissions coordinator"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={receivingPhone}
                      onChange={(e) => setReceivingPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Clinical Summary */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Clinical Summary
                  </label>
                  <textarea
                    value={clinicalSummary}
                    onChange={(e) => setClinicalSummary(e.target.value)}
                    placeholder="Key clinical information for the receiving facility..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-[#00857a] focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
                <EAButton
                  variant="secondary"
                  onClick={() => {
                    setShowDischargeTransferModal(false);
                    setDischargeTransferInfo(null);
                  }}
                >
                  Skip Transfer
                </EAButton>
                <EAButton
                  onClick={handleCreateDischargeTransfer}
                  disabled={!receivingFacility || creatingTransfer}
                  icon={<FileText className="w-4 h-4" />}
                >
                  {creatingTransfer ? 'Creating...' : 'Create Transfer Packet'}
                </EAButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTransferLogs;
