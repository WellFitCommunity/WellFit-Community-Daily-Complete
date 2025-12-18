// Receiving Facility Dashboard
// View incoming transfer packets and acknowledge receipt

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import HandoffService from '../../services/handoffService';
import { integrateHospitalTransfer } from '../../services/hospitalTransferIntegrationService';
import MedicationReconciliationAlert from './MedicationReconciliationAlert';
import LabResultVault from './LabResultVault';
import { TransferPacketSkeleton } from '../ui/skeleton';
import type {
  HandoffPacket,
  HandoffAttachment,
  ReceivingFacilityDashboardProps,
} from '../../types/handoff';
import { URGENCY_LABELS } from '../../types/handoff';

const ReceivingDashboard: React.FC<ReceivingFacilityDashboardProps> = ({
  facilityName,
}) => {
  const [packets, setPackets] = useState<HandoffPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<HandoffPacket | null>(null);
  const [attachments, setAttachments] = useState<HandoffAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgementNotes, setAcknowledgementNotes] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPacketsAsync = async () => {
      try {
        setLoading(true);
        const data = await HandoffService.listPackets({
          receiving_facility: facilityName,
          status: 'sent',
        });
        if (isMounted) {
          setPackets(data);
        }
      } catch (_error: any) {
        if (isMounted) {
          toast.error(`Failed to load transfers: ${_error.message}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPacketsAsync();

    return () => {
      isMounted = false;
    };
  }, [facilityName]);

  useEffect(() => {
    let isMounted = true;

    const loadAttachmentsAsync = async () => {
      if (!selectedPacket) return;
      try {
        const data = await HandoffService.getAttachments(selectedPacket.id);
        if (isMounted) {
          setAttachments(data);
        }
      } catch {
        // Silent error - attachments are optional
      }
    };

    loadAttachmentsAsync();

    return () => {
      isMounted = false;
    };
  }, [selectedPacket]);

  const loadPackets = async () => {
    try {
      setLoading(true);
      const data = await HandoffService.listPackets({
        receiving_facility: facilityName,
        status: 'sent', // Only show sent packets awaiting acknowledgement
      });
      setPackets(data);
    } catch (_error: any) {
      toast.error(`Failed to load transfers: ${_error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedPacket) return;

    // Save packet reference before optimistic update
    const packet = selectedPacket;
    const packetId = selectedPacket.id;

    // Optimistic UI update - remove packet from list immediately
    setPackets(prev => prev.filter(p => p.id !== packetId));
    setSelectedPacket(null);
    setAcknowledgementNotes('');

    // Show optimistic success message
    toast.success('Transfer acknowledged successfully!', { autoClose: 2000 });

    setAcknowledging(true);
    try {
      // Step 1: Acknowledge the packet
      await HandoffService.acknowledgePacket({
        packet_id: packetId,
        acknowledgement_notes: acknowledgementNotes,
      });

      // Step 2: Integrate transfer into patient chart (creates patient, encounter, vitals, billing)

      const integrationResult = await integrateHospitalTransfer(packetId, packet as any);

      if (integrationResult.success) {
        // Integration complete - logged via audit system
        toast.success('Patient chart created and transfer integrated!', { autoClose: 3000 });
      } else {

        toast.warning('Transfer acknowledged but integration incomplete. Please review patient chart.', { autoClose: 5000 });
      }

      // Refresh to ensure sync with server
      loadPackets();
    } catch (_error: any) {
      // Rollback on error - reload all packets
      toast.error(`Failed to acknowledge: ${_error.message}`);
      loadPackets();
    } finally {
      setAcknowledging(false);
    }
  };

  const downloadAttachment = async (attachment: HandoffAttachment) => {
    try {
      const url = await HandoffService.getAttachmentUrl(attachment);
      window.open(url, '_blank');
      toast.success('Opening attachment...');
    } catch (_error: any) {
      toast.error(`Failed to download attachment: ${_error.message}`);
    }
  };

  const getUrgencyColor = (level: string): string => {
    const colors = {
      routine: 'bg-blue-100 text-blue-800',
      urgent: 'bg-yellow-100 text-yellow-800',
      emergent: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <TransferPacketSkeleton />;
  }

  if (selectedPacket) {
    return (
      <PacketViewer
        packet={selectedPacket}
        attachments={attachments}
        acknowledgementNotes={acknowledgementNotes}
        setAcknowledgementNotes={setAcknowledgementNotes}
        acknowledging={acknowledging}
        onAcknowledge={handleAcknowledge}
        onBack={() => setSelectedPacket(null)}
        onDownloadAttachment={downloadAttachment}
      />
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          📥 Incoming Patient Transfers
        </h2>
        <p className="text-gray-600">
          Receiving at: <span className="font-semibold">{facilityName}</span>
        </p>
      </div>

      {packets.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-600 text-lg">No pending transfers</p>
        </div>
      ) : (
        <div className="space-y-4">
          {packets.map((packet) => (
            <PacketCard
              key={packet.id}
              packet={packet}
              onClick={() => setSelectedPacket(packet)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Packet Card Component
const PacketCard: React.FC<{
  packet: HandoffPacket;
  onClick: () => void;
}> = ({ packet, onClick }) => {
  const [patientInfo, setPatientInfo] = useState<{ name: string; dob: string }>({
    name: 'Loading...',
    dob: 'Loading...',
  });

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const name = await HandoffService.decryptPHI(
        packet.patient_name_encrypted || ''
      );
      if (isMounted) {
        setPatientInfo({
          name,
          dob: packet.patient_dob_encrypted || 'N/A',
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [packet]);

  const getUrgencyColor = (level: string): string => {
    const colors = {
      routine: 'bg-blue-100 text-blue-800',
      urgent: 'bg-yellow-100 text-yellow-800',
      emergent: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer bg-white"
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm text-gray-500">Packet #{packet.packet_number}</p>
          <h3 className="text-lg font-semibold text-gray-800">{patientInfo.name}</h3>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(
            packet.urgency_level
          )}`}
        >
          {URGENCY_LABELS[packet.urgency_level]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div>
          <span className="text-gray-600">From:</span>
          <p className="font-medium">{packet.sending_facility}</p>
        </div>
        <div>
          <span className="text-gray-600">Sent:</span>
          <p className="font-medium">
            {new Date(packet.sent_at || packet.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-2 rounded text-sm">
        <span className="text-gray-600">Reason:</span>
        <p className="text-gray-800">{packet.reason_for_transfer}</p>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Provider: {packet.sender_provider_name}
        </p>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
};

// Packet Viewer Component
const PacketViewer: React.FC<{
  packet: HandoffPacket;
  attachments: HandoffAttachment[];
  acknowledgementNotes: string;
  setAcknowledgementNotes: (notes: string) => void;
  acknowledging: boolean;
  onAcknowledge: () => void;
  onBack: () => void;
  onDownloadAttachment: (attachment: HandoffAttachment) => void;
}> = ({
  packet,
  attachments,
  acknowledgementNotes,
  setAcknowledgementNotes,
  acknowledging,
  onAcknowledge,
  onBack,
  onDownloadAttachment,
}) => {
  const [patientInfo, setPatientInfo] = useState<{ name: string; dob: string }>({
    name: 'Loading...',
    dob: 'Loading...',
  });

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const name = await HandoffService.decryptPHI(
        packet.patient_name_encrypted || ''
      );
      const dob = await HandoffService.decryptPHI(packet.patient_dob_encrypted || '');

      // React 19: Only update state if component is still mounted
      if (isMounted) {
        setPatientInfo({ name, dob });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [packet]);

  const vitals = packet.clinical_data.vitals;
  const medicationsGiven = packet.clinical_data.medications_given || [];
  const medicationsPrescribed = packet.clinical_data.medications_prescribed || [];
  const medicationsCurrent = packet.clinical_data.medications_current || [];
  const allergies = packet.clinical_data.allergies || [];
  const labs = packet.clinical_data.labs || [];

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          ← Back to List
        </button>
        <div className="text-right">
          <p className="text-sm text-gray-500">Packet Number</p>
          <p className="text-xl font-mono font-bold text-gray-800">
            {packet.packet_number}
          </p>
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-900 mb-3">👤 Patient Demographics</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Name:</p>
            <p className="font-medium text-gray-900">{patientInfo.name}</p>
          </div>
          <div>
            <p className="text-gray-600">DOB:</p>
            <p className="font-medium text-gray-900">{patientInfo.dob}</p>
          </div>
          <div>
            <p className="text-gray-600">MRN:</p>
            <p className="font-medium text-gray-900">{packet.patient_mrn || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-600">Gender:</p>
            <p className="font-medium text-gray-900">
              {packet.patient_gender || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Medication Reconciliation Alert */}
      <MedicationReconciliationAlert packet={packet} />

      {/* Lab Result Vault - Auto-Populated Labs with Trending */}
      <LabResultVault packet={packet} />

      {/* Transfer Details */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-yellow-900 mb-3">🚑 Transfer Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
          <div>
            <p className="text-gray-600">From:</p>
            <p className="font-medium text-gray-900">{packet.sending_facility}</p>
          </div>
          <div>
            <p className="text-gray-600">Urgency:</p>
            <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
              {URGENCY_LABELS[packet.urgency_level]}
            </span>
          </div>
        </div>
        <div>
          <p className="text-gray-600 mb-1">Reason for Transfer:</p>
          <p className="font-medium text-gray-900">{packet.reason_for_transfer}</p>
        </div>
      </div>

      {/* Clinical Snapshot */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-green-900 mb-3">💊 Clinical Snapshot</h3>

        {/* Vitals */}
        {vitals && Object.keys(vitals).length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Last Vitals:</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic && (
                <div>
                  <p className="text-gray-600">BP:</p>
                  <p className="font-medium">
                    {vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic}
                  </p>
                </div>
              )}
              {vitals.heart_rate && (
                <div>
                  <p className="text-gray-600">HR:</p>
                  <p className="font-medium">{vitals.heart_rate} bpm</p>
                </div>
              )}
              {vitals.temperature && (
                <div>
                  <p className="text-gray-600">Temp:</p>
                  <p className="font-medium">
                    {vitals.temperature}°{vitals.temperature_unit || 'F'}
                  </p>
                </div>
              )}
              {vitals.oxygen_saturation && (
                <div>
                  <p className="text-gray-600">O2 Sat:</p>
                  <p className="font-medium">{vitals.oxygen_saturation}%</p>
                </div>
              )}
              {vitals.respiratory_rate && (
                <div>
                  <p className="text-gray-600">RR:</p>
                  <p className="font-medium">{vitals.respiratory_rate}/min</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medications Given During Visit */}
        {medicationsGiven.length > 0 && (
          <div className="mb-3 bg-blue-50 p-2 rounded border border-blue-200">
            <p className="text-sm font-medium text-blue-800 mb-2">💉 Medications Given During Visit:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {medicationsGiven.map((med, idx) => (
                <li key={idx}>
                  <span className="font-medium">{med.name}</span> - {med.dosage}{' '}
                  {med.route ? `(${med.route})` : ''}
                  {med.frequency ? ` ${med.frequency}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Currently Prescribed Medications */}
        {medicationsPrescribed.length > 0 && (
          <div className="mb-3 bg-purple-50 p-2 rounded border border-purple-200">
            <p className="text-sm font-medium text-purple-800 mb-2">📋 Currently Prescribed Medications:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {medicationsPrescribed.map((med, idx) => (
                <li key={idx}>
                  <span className="font-medium">{med.name}</span> - {med.dosage}{' '}
                  {med.route ? `(${med.route})` : ''}
                  {med.frequency ? ` ${med.frequency}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Currently Taking (Including OTC) */}
        {medicationsCurrent.length > 0 && (
          <div className="mb-3 bg-green-100 p-2 rounded border border-green-300">
            <p className="text-sm font-medium text-green-800 mb-2">💊 Currently Taking (Including OTC):</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {medicationsCurrent.map((med, idx) => (
                <li key={idx}>
                  <span className="font-medium">{med.name}</span> - {med.dosage}{' '}
                  {med.route ? `(${med.route})` : ''}
                  {med.frequency ? ` ${med.frequency}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Lab Results */}
        {labs.length > 0 && (
          <div className="mb-3 bg-yellow-50 p-2 rounded border border-yellow-200">
            <p className="text-sm font-medium text-yellow-800 mb-2">🔬 Lab Results:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {labs.map((lab, idx) => (
                <li key={idx} className={lab.abnormal ? 'text-red-600 font-semibold' : ''}>
                  <span className="font-medium">{lab.test_name}</span>: {lab.value} {lab.unit || ''}
                  {lab.abnormal && ' ⚠️'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Allergies */}
        {allergies.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Allergies:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {allergies.map((allergy, idx) => (
                <li key={idx}>
                  <span className="font-medium">{allergy.allergen}</span> -{' '}
                  {allergy.reaction} ({allergy.severity || 'unknown'})
                </li>
              ))}
            </ul>
          </div>
        )}

        {packet.clinical_data.notes && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-sm font-medium text-gray-700 mb-1">Additional Notes:</p>
            <p className="text-sm text-gray-800">{packet.clinical_data.notes}</p>
          </div>
        )}
      </div>

      {/* Sender Info */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-purple-900 mb-3">📞 Sender Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Provider:</p>
            <p className="font-medium text-gray-900">{packet.sender_provider_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Callback:</p>
            <p className="font-medium text-gray-900">{packet.sender_callback_number}</p>
          </div>
        </div>
        {packet.sender_notes && (
          <div className="mt-2">
            <p className="text-gray-600">Notes:</p>
            <p className="font-medium text-gray-900">{packet.sender_notes}</p>
          </div>
        )}
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">📎 Attachments</h3>
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">📄</span>
                  <div>
                    <p className="font-medium text-sm">{attachment.file_name}</p>
                    <p className="text-xs text-gray-500">
                      {attachment.file_type.toUpperCase()} •{' '}
                      {attachment.file_size_bytes
                        ? `${(attachment.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                        : 'Size unknown'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onDownloadAttachment(attachment)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledgement Section */}
      <div className="bg-green-50 border-2 border-green-600 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">✅ Acknowledge Receipt</h3>
        <p className="text-sm text-gray-700 mb-4">
          Click to confirm that you have received this transfer packet and the patient
          information has been reviewed.
        </p>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">
              Acknowledgement Notes (Optional)
            </label>
            <span className={`text-xs ${acknowledgementNotes.length > 450 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              {acknowledgementNotes.length}/500
            </span>
          </div>
          <textarea
            value={acknowledgementNotes}
            onChange={(e) => setAcknowledgementNotes(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            rows={3}
            maxLength={500}
            placeholder="Patient received, care initiated, bed assigned to Room 302..."
          />
        </div>

        <button
          onClick={onAcknowledge}
          disabled={acknowledging}
          className={`w-full py-3 rounded-lg font-semibold text-lg transition-all ${
            acknowledging
              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {acknowledging ? 'Processing...' : '✅ Acknowledge Receipt'}
        </button>
      </div>
    </div>
  );
};

export default ReceivingDashboard;
