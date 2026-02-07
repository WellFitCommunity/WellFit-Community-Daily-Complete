/**
 * ReadmissionEngagementTab - Engagement tab for the readmission dashboard.
 *
 * Shows check-in streaks leaderboard and members needing outreach.
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Phone,
  Clock,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import type { CommunityMember } from './CommunityReadmission.types';

// ============================================================================
// ReadmissionEngagementTab - Main export
// ============================================================================

interface ReadmissionEngagementTabProps {
  members: CommunityMember[];
}

export const ReadmissionEngagementTab: React.FC<ReadmissionEngagementTabProps> = ({ members }) => {
  const streakMembers = [...members]
    .filter(m => m.check_in_streak > 0)
    .sort((a, b) => b.check_in_streak - a.check_in_streak);

  const missedMembers = [...members]
    .filter(m => m.missed_check_ins_7d > 0)
    .sort((a, b) => b.missed_check_ins_7d - a.missed_check_ins_7d);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Check-in Streaks */}
      <EACard>
        <EACardHeader icon={<CheckCircle className="text-green-400" />}>
          <h3 className="font-semibold text-white">Check-in Streaks</h3>
          <p className="text-sm text-slate-400">Active engagement leaders</p>
        </EACardHeader>
        <EACardContent>
          {streakMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Clock size={36} className="mx-auto mb-3 opacity-50" />
              <p>No active check-in streaks yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {streakMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
                      {member.first_name[0]}{member.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-slate-400">{member.check_in_streak} day streak</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={20} />
                    <span className="font-bold">{member.check_in_streak}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Missed Check-ins */}
      <EACard>
        <EACardHeader icon={<XCircle className="text-red-400" />}>
          <h3 className="font-semibold text-white">Missed Check-ins</h3>
          <p className="text-sm text-slate-400">Members who need outreach</p>
        </EACardHeader>
        <EACardContent>
          {missedMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle size={36} className="mx-auto mb-3 opacity-50" />
              <p>All members are checking in regularly!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {missedMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border-l-4 border-red-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-bold">
                      {member.first_name[0]}{member.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-red-400">{member.missed_check_ins_7d} missed this week</p>
                    </div>
                  </div>
                  <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-sm text-sm flex items-center gap-1">
                    <Phone size={14} />
                    Call
                  </button>
                </div>
              ))}
            </div>
          )}
        </EACardContent>
      </EACard>
    </div>
  );
};

export default ReadmissionEngagementTab;
