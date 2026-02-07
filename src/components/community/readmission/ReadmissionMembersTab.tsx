/**
 * ReadmissionMembersTab - Members table tab for the readmission dashboard.
 *
 * Displays a sortable table of high-risk community members with risk scores,
 * visit counts, engagement metrics, SDOH factors, and action buttons.
 */

import React from 'react';
import {
  AlertTriangle,
  Phone,
  FileText,
  CheckCircle,
  XCircle,
  Pill,
  Users,
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
} from '../../envision-atlus';
import type { CommunityMember, MemberRowProps } from './CommunityReadmission.types';
import { getRiskColor, getRiskBgColor } from './CommunityReadmission.types';

// ============================================================================
// MemberRow - Individual table row for a community member
// ============================================================================

const MemberRow: React.FC<MemberRowProps> = ({ member, onSelect }) => (
  <tr className="hover:bg-slate-800/50 cursor-pointer" onClick={onSelect}>
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getRiskBgColor(member.risk_score)}`}>
          {member.first_name[0]}{member.last_name[0]}
        </div>
        <div>
          <p className="font-medium text-white">{member.first_name} {member.last_name}</p>
          {member.phone && <p className="text-sm text-slate-400">{member.phone}</p>}
        </div>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(member.risk_category)}`}>
        {member.risk_score}
        {member.cms_penalty_risk && (
          <AlertTriangle className="ml-1 text-yellow-400" size={14} />
        )}
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="text-white">
        <span className="font-medium">{member.total_visits_30d}</span>
        <span className="text-slate-400 text-sm"> total</span>
      </div>
      {member.er_visits_30d > 0 && (
        <div className="text-red-400 text-sm">{member.er_visits_30d} ER</div>
      )}
    </td>
    <td className="px-6 py-4">
      {member.check_in_streak > 0 ? (
        <div className="flex items-center gap-1 text-green-400">
          <CheckCircle size={16} />
          <span>{member.check_in_streak}d streak</span>
        </div>
      ) : member.missed_check_ins_7d > 0 ? (
        <div className="flex items-center gap-1 text-red-400">
          <XCircle size={16} />
          <span>{member.missed_check_ins_7d} missed</span>
        </div>
      ) : (
        <span className="text-slate-400">-</span>
      )}
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${member.engagement_score >= 80 ? 'bg-green-500' : member.engagement_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${member.engagement_score}%` }}
          />
        </div>
        <span className="text-white text-sm">{member.engagement_score}%</span>
      </div>
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2">
        <Pill size={16} className={member.medication_adherence >= 90 ? 'text-green-400' : member.medication_adherence >= 70 ? 'text-yellow-400' : 'text-red-400'} />
        <span className={`text-sm font-medium ${member.medication_adherence >= 90 ? 'text-green-400' : member.medication_adherence >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
          {member.medication_adherence}%
        </span>
      </div>
    </td>
    <td className="px-6 py-4">
      {member.sdoh_risk_factors.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {member.sdoh_risk_factors.slice(0, 2).map((factor) => (
            <span key={factor} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-sm">
              {factor}
            </span>
          ))}
          {member.sdoh_risk_factors.length > 2 && (
            <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded-sm">
              +{member.sdoh_risk_factors.length - 2}
            </span>
          )}
        </div>
      ) : (
        <span className="text-slate-500">None identified</span>
      )}
    </td>
    <td className="px-6 py-4">
      <div className="flex items-center gap-2">
        <button className="p-2 bg-[#00857a] hover:bg-[#006d64] text-white rounded-lg">
          <Phone size={14} />
        </button>
        <button className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
          <FileText size={14} />
        </button>
      </div>
    </td>
  </tr>
);

// ============================================================================
// ReadmissionMembersTab - Main export
// ============================================================================

interface ReadmissionMembersTabProps {
  members: CommunityMember[];
  onSelectMember: (member: CommunityMember) => void;
}

export const ReadmissionMembersTab: React.FC<ReadmissionMembersTabProps> = ({
  members, onSelectMember,
}) => (
  <EACard>
    <EACardHeader icon={<Users className="text-blue-400" />}>
      <h3 className="font-semibold text-white">High-Risk Community Members</h3>
      <p className="text-sm text-slate-400">{members.length} members requiring attention</p>
    </EACardHeader>
    <EACardContent>
      {members.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No high-risk members found</p>
          <p className="text-sm mt-1">All community members are within safe risk parameters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Member</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Risk</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Visits</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Check-ins</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Engagement</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Medication</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">SDOH</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onSelect={() => onSelectMember(member)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </EACardContent>
  </EACard>
);

export default ReadmissionMembersTab;
