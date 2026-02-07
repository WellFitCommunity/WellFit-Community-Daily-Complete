/**
 * BedBoardHeader — Header bar with title, voice commands, presence, and action buttons.
 */

import React from 'react';
import {
  Bed as BedIcon,
  RefreshCw,
  Package,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react';
import { EAButton } from '../../envision-atlus';
import { PresenceAvatars } from '../../collaboration';
import type { BedBoardHeaderProps } from './BedBoard.types';

export const BedBoardHeader: React.FC<BedBoardHeaderProps> = ({
  isVoiceListening,
  voiceSupported,
  voiceTranscript,
  loading,
  otherUsers,
  onToggleVoice,
  onRefresh,
  onNavigateTransferLogs,
}) => (
  <>
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
        <PresenceAvatars users={otherUsers} maxDisplay={4} size="sm" />
      </div>
      <div className="flex items-center gap-3">
        {voiceSupported && (
          <button
            onClick={onToggleVoice}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
              isVoiceListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
            }`}
            title={isVoiceListening ? 'Stop listening' : 'Voice commands: "Mark bed ready", "Start cleaning", "Show available ICU beds"'}
          >
            {isVoiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="text-sm hidden sm:inline">
              {isVoiceListening ? 'Stop' : 'Voice'}
            </span>
          </button>
        )}
        <EAButton
          onClick={onNavigateTransferLogs}
          icon={<Package className="w-4 h-4" />}
          variant="secondary"
        >
          Transfer Logs
        </EAButton>
        <EAButton
          onClick={onRefresh}
          icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          variant="secondary"
        >
          Refresh
        </EAButton>
      </div>
    </div>
  </>
);

export default BedBoardHeader;
