/**
 * HandoffSendPage - New hospital-to-hospital transfer (sender)
 *
 * Purpose: mounts LiteSenderPortal at /handoff/send so clinicians can create
 * and send a transfer packet. This was the missing sender entry point —
 * HospitalTransferPortal's "New Transfer" button targeted this route while it
 * didn't exist (tracker: ems-and-hospital-transfer-repair-tracker-2026-07-22.md, H-1a).
 * Used by: /handoff/send route (workflow category, clinical/admin roles).
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Send } from 'lucide-react';
import LiteSenderPortal from '../components/handoff/LiteSenderPortal';
import type { HandoffPacket } from '../types/handoff';

export const HandoffSendPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePacketCreated = useCallback(
    (packet: HandoffPacket, _accessUrl: string) => {
      toast.success(
        `Transfer packet ${packet.packet_number} created for ${packet.receiving_facility}.`,
        { autoClose: 4000 }
      );
      navigate('/hospital-transfer');
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Send className="h-7 w-7 text-blue-400" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-bold text-white">New Patient Transfer</h1>
              <p className="text-slate-400 text-sm">
                Create and send a secure handoff packet to a receiving facility
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/hospital-transfer')}
            className="min-h-[44px] px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Transfer Portal
          </button>
        </div>

        <LiteSenderPortal onPacketCreated={handlePacketCreated} />
      </div>
    </div>
  );
};

export default HandoffSendPage;
