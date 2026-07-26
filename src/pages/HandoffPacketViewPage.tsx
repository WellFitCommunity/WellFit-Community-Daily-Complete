/**
 * HandoffPacketViewPage - Full detail view of a transfer packet
 *
 * Purpose: renders one handoff packet (demographics decrypted via the clinical
 * key path, clinical data, attachments, audit trail) at /handoff/view/:id.
 * This was a dead navigation target from HospitalTransferPortal's detail modal
 * (tracker: ems-and-hospital-transfer-repair-tracker-2026-07-22.md, H-1b).
 * Used by: HospitalTransferPortal "View Full Packet", discharge transfer flow.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Building2,
  Clock,
  FileText,
  Paperclip,
  Shield,
  User,
} from 'lucide-react';
import HandoffService from '../services/handoffService';
import { auditLogger } from '../services/auditLogger';
import type { HandoffAttachment, HandoffLog, HandoffPacket } from '../types/handoff';

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-900/60 text-red-200 border border-red-500',
  emergent: 'bg-orange-900/60 text-orange-200 border border-orange-500',
  urgent: 'bg-yellow-900/60 text-yellow-200 border border-yellow-500',
  routine: 'bg-slate-700 text-slate-200 border border-slate-500',
};

export const HandoffPacketViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [packet, setPacket] = useState<HandoffPacket | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [patientDob, setPatientDob] = useState<string>('');
  const [attachments, setAttachments] = useState<HandoffAttachment[]>([]);
  const [logs, setLogs] = useState<HandoffLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPacket = useCallback(async () => {
    if (!id) {
      setError('No packet id provided');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const loaded = await HandoffService.getPacket(id);
      setPacket(loaded);

      // Decrypt identifiers for the authorized clinical viewer (§17 clinical key)
      try {
        setPatientName(await HandoffService.decryptPHI(loaded.patient_name_encrypted ?? ''));
        setPatientDob(await HandoffService.decryptPHI(loaded.patient_dob_encrypted ?? ''));
      } catch {
        setPatientName('[decryption unavailable]');
        setPatientDob('');
      }

      const [loadedAttachments, loadedLogs] = await Promise.all([
        HandoffService.getAttachments(id),
        HandoffService.getLogs(id),
      ]);
      setAttachments(loadedAttachments);
      setLogs(loadedLogs);

      // HIPAA §164.312(b) - packet view is a PHI access
      await auditLogger.phi('HANDOFF_PACKET_VIEWED', loaded.id, {
        resourceType: 'handoff_packet',
        action: 'READ',
        packetId: loaded.id,
        packetNumber: loaded.packet_number,
      });
      setError(null);
    } catch (err: unknown) {
      const failure = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('HANDOFF_PACKET_VIEW_FAILED', failure, { packetId: id });
      setError('Unable to load transfer packet. It may not exist or you may not have access.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPacket();
  }, [loadPacket]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-300 text-lg">Loading transfer packet…</p>
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-300 text-lg">{error ?? 'Packet not found'}</p>
        <button
          onClick={() => navigate('/hospital-transfer')}
          className="min-h-[44px] px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Transfer Portal
        </button>
      </div>
    );
  }

  const vitals = packet.clinical_data?.vitals;

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-blue-400" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                Transfer Packet {packet.packet_number}
              </h1>
              <p className="text-slate-400 text-sm">
                {packet.sending_facility} → {packet.receiving_facility}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${
                URGENCY_STYLES[packet.urgency_level] ?? URGENCY_STYLES.routine
              }`}
            >
              {packet.urgency_level}
            </span>
            <button
              onClick={() => navigate('/hospital-transfer')}
              className="min-h-[44px] px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
          </div>
        </div>

        <section className="bg-slate-800 rounded-xl p-5" aria-label="Patient information">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-blue-400" aria-hidden="true" />
            Patient
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-200">
            <div>
              <p className="text-slate-400 text-sm">Name</p>
              <p className="text-lg">{patientName || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Date of Birth</p>
              <p className="text-lg">{patientDob || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">MRN</p>
              <p className="text-lg">{packet.patient_mrn || '—'}</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl p-5" aria-label="Transfer details">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-blue-400" aria-hidden="true" />
            Transfer Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-200">
            <div>
              <p className="text-slate-400 text-sm">Reason for Transfer</p>
              <p>{packet.reason_for_transfer}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Status</p>
              <p className="capitalize">{packet.status}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Sender</p>
              <p>
                {packet.sender_provider_name}
                {packet.sender_callback_number ? ` — ${packet.sender_callback_number}` : ''}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Receiver Contact</p>
              <p>{packet.receiver_contact_name || '—'}</p>
            </div>
            {packet.sender_notes && (
              <div className="md:col-span-2">
                <p className="text-slate-400 text-sm">Sender Notes</p>
                <p>{packet.sender_notes}</p>
              </div>
            )}
          </div>
        </section>

        {vitals && (
          <section className="bg-slate-800 rounded-xl p-5" aria-label="Vital signs">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-blue-400" aria-hidden="true" />
              Vitals at Transfer
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-200">
              {vitals.blood_pressure_systolic !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm">Blood Pressure</p>
                  <p className="text-lg">
                    {vitals.blood_pressure_systolic}/{vitals.blood_pressure_diastolic ?? '—'} mmHg
                  </p>
                </div>
              )}
              {vitals.heart_rate !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm">Heart Rate</p>
                  <p className="text-lg">{vitals.heart_rate} bpm</p>
                </div>
              )}
              {vitals.oxygen_saturation !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm">SpO2</p>
                  <p className="text-lg">{vitals.oxygen_saturation}%</p>
                </div>
              )}
              {vitals.temperature !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm">Temperature</p>
                  <p className="text-lg">
                    {vitals.temperature}°{vitals.temperature_unit ?? 'F'}
                  </p>
                </div>
              )}
              {vitals.respiratory_rate !== undefined && (
                <div>
                  <p className="text-slate-400 text-sm">Respiratory Rate</p>
                  <p className="text-lg">{vitals.respiratory_rate} /min</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="bg-slate-800 rounded-xl p-5" aria-label="Attachments">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Paperclip className="h-5 w-5 text-blue-400" aria-hidden="true" />
            Attachments ({attachments.length})
          </h2>
          {attachments.length === 0 ? (
            <p className="text-slate-400">No attachments on this packet.</p>
          ) : (
            <ul className="space-y-2 text-slate-200">
              {attachments.map((att) => (
                <li key={att.id} className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  <span>{att.file_name}</span>
                  <span className="text-slate-500 text-sm">({att.file_type})</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-slate-800 rounded-xl p-5" aria-label="Audit trail">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-blue-400" aria-hidden="true" />
            Audit Trail
          </h2>
          {logs.length === 0 ? (
            <p className="text-slate-400">No events recorded.</p>
          ) : (
            <ul className="space-y-2 text-slate-200">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  <span className="text-slate-500 text-sm whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span>{log.event_description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default HandoffPacketViewPage;
