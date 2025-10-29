// Admin Transfer Logs - Complete audit trail for all patient handoffs
// Export to CSV/Excel for compliance reporting

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'exceljs';
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

const AdminTransferLogs: React.FC<AdminTransferLogsProps> = ({
  showExportButton = true,
  defaultFilters,
}) => {
  const [packets, setPackets] = useState<HandoffPacket[]>([]);
  const [stats, setStats] = useState<HandoffPacketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedPacket, setSelectedPacket] = useState<HandoffPacket | null>(null);

  // Filters
  const [filters, setFilters] = useState<HandoffPacketListFilters>(
    defaultFilters || {}
  );

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
        fgColor: { argb: 'FF4472C4' },
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
        fgColor: { argb: 'FF70AD47' },
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

  const getStatusColor = (status: HandoffStatus): string => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      sent: 'bg-blue-100 text-blue-800',
      acknowledged: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status];
  };

  const getUrgencyColor = (level: UrgencyLevel): string => {
    const colors = {
      routine: 'bg-blue-100 text-blue-800',
      urgent: 'bg-yellow-100 text-yellow-800',
      emergent: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[level];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading transfer logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Transfers"
            value={stats.total_packets}
            icon="📦"
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Pending Ack"
            value={stats.pending_acknowledgement}
            icon="⏳"
            color="bg-yellow-50 text-yellow-700"
          />
          <StatCard
            title="Acknowledged"
            value={stats.acknowledged_packets}
            icon="✅"
            color="bg-green-50 text-green-700"
          />
          <StatCard
            title="Avg. Ack Time"
            value={
              stats.average_acknowledgement_time_minutes
                ? `${stats.average_acknowledgement_time_minutes.toFixed(0)} min`
                : 'N/A'
            }
            icon="⏱️"
            color="bg-purple-50 text-purple-700"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">🔍 Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Urgencies</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergent">Emergent</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Packet # or MRN"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex justify-between">
          <button
            onClick={() => setFilters({})}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
          >
            Clear Filters
          </button>

          {showExportButton && (
            <button
              onClick={exportToExcel}
              disabled={exporting || packets.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                exporting || packets.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {exporting ? '⏳ Exporting...' : '📤 Export to Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Transfer Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Packet #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Urgency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  From → To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {packets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No transfer packets found
                  </td>
                </tr>
              ) : (
                packets.map((packet) => (
                  <tr key={packet.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {packet.packet_number}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          packet.status
                        )}`}
                      >
                        {STATUS_LABELS[packet.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(
                          packet.urgency_level
                        )}`}
                      >
                        {URGENCY_LABELS[packet.urgency_level]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="truncate max-w-[150px]" title={packet.sending_facility}>
                          {packet.sending_facility}
                        </span>
                        <span className="mx-2">→</span>
                        <span className="truncate max-w-[150px]" title={packet.receiving_facility}>
                          {packet.receiving_facility}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {packet.sender_provider_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(packet.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setSelectedPacket(packet)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination info */}
      <div className="text-center text-sm text-gray-600">
        Showing {packets.length} transfer packet(s)
      </div>

      {/* Selected Packet Modal would go here */}
      {selectedPacket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  Transfer Details: {selectedPacket.packet_number}
                </h2>
                <button
                  onClick={() => setSelectedPacket(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs">
                {JSON.stringify(selectedPacket, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stats Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: string;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className={`${color} rounded-lg p-4`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className="text-4xl opacity-60">{icon}</div>
    </div>
  </div>
);

export default AdminTransferLogs;
