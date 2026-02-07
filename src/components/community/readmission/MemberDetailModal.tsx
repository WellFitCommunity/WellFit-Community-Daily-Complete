/**
 * MemberDetailModal - Full-screen modal showing detailed member information.
 *
 * Displays key stats, SDOH factors, AI readmission predictions, and action buttons.
 */

import React from 'react';
import {
  AlertTriangle,
  Phone,
  FileText,
  Calendar,
  XCircle,
  Home,
} from 'lucide-react';
import type { MemberDetailModalProps } from './CommunityReadmission.types';
import { getRiskColor, getRiskBgColor } from './CommunityReadmission.types';

export const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ member, onClose }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-slate-700">
      {/* Header */}
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${getRiskBgColor(member.risk_score)}`}>
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{member.first_name} {member.last_name}</h2>
            {member.phone && <p className="text-slate-400">{member.phone}</p>}
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(member.risk_category)}`}>
                Risk Score: {member.risk_score}
              </span>
              {member.cms_penalty_risk && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/50">
                  CMS Penalty Risk
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
          <XCircle size={24} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-white">{member.total_visits_30d}</p>
            <p className="text-sm text-slate-400">Total Visits (30d)</p>
          </div>
          <div className="bg-red-500/20 rounded-lg p-4 text-center border border-red-500/30">
            <p className="text-3xl font-bold text-red-400">{member.er_visits_30d}</p>
            <p className="text-sm text-slate-400">ER Visits</p>
          </div>
          <div className="bg-orange-500/20 rounded-lg p-4 text-center border border-orange-500/30">
            <p className="text-3xl font-bold text-orange-400">{member.readmissions_30d}</p>
            <p className="text-sm text-slate-400">Readmissions</p>
          </div>
          <div className="bg-green-500/20 rounded-lg p-4 text-center border border-green-500/30">
            <p className="text-3xl font-bold text-green-400">{member.engagement_score}%</p>
            <p className="text-sm text-slate-400">Engagement</p>
          </div>
        </div>

        {/* SDOH Factors */}
        {member.sdoh_risk_factors.length > 0 && (
          <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
            <h4 className="font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Home size={18} />
              Social Determinants of Health Barriers
            </h4>
            <div className="flex flex-wrap gap-2">
              {member.sdoh_risk_factors.map((factor) => (
                <span key={factor} className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-full">
                  {factor}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Predicted Readmission */}
        {member.predicted_readmission_date && (
          <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
            <h4 className="font-semibold text-red-300 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              AI Readmission Prediction
            </h4>
            <p className="text-white">
              High probability of readmission by{' '}
              <span className="font-bold text-red-400">
                {new Date(member.predicted_readmission_date).toLocaleDateString()}
              </span>
            </p>
            {member.days_since_discharge !== undefined && (
              <p className="text-sm text-slate-400 mt-1">
                {member.days_since_discharge} days since last discharge
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700">
          <button className="flex-1 px-4 py-3 bg-[#00857a] hover:bg-[#006d64] text-white rounded-lg flex items-center justify-center gap-2">
            <Phone size={18} />
            Call Member
          </button>
          <button className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2">
            <FileText size={18} />
            {member.has_active_care_plan ? 'View Care Plan' : 'Create Care Plan'}
          </button>
          <button className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center gap-2">
            <Calendar size={18} />
            Schedule Follow-up
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default MemberDetailModal;
