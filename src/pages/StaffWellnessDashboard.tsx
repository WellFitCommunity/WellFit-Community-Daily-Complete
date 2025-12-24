/**
 * Staff Wellness Dashboard
 *
 * Burnout prevention and staff wellness monitoring for healthcare providers.
 * Shows compassion fatigue indicators, documentation debt, and proactive interventions.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Brain,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Coffee,
  FileText,
  Activity,
  Shield,
  Smile,
  Frown,
  Meh,
  Sun,
  Moon,
  RefreshCw,
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  burnoutRisk: 'low' | 'moderate' | 'high' | 'critical';
  compassionScore: number;
  documentationDebt: number; // hours behind
  lastBreak: string;
  shiftHours: number;
  patientsToday: number;
  moodTrend: 'improving' | 'stable' | 'declining';
}

interface WellnessMetrics {
  totalStaff: number;
  highRiskCount: number;
  avgCompassionScore: number;
  avgDocDebt: number;
  staffOnBreak: number;
  interventionsToday: number;
}

const StaffWellnessDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<WellnessMetrics | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  useEffect(() => {
    // Demo data for Methodist presentation
    const demoMetrics: WellnessMetrics = {
      totalStaff: 47,
      highRiskCount: 8,
      avgCompassionScore: 72,
      avgDocDebt: 2.3,
      staffOnBreak: 4,
      interventionsToday: 12,
    };

    const demoStaff: StaffMember[] = [
      {
        id: '1',
        name: 'Sarah Johnson, RN',
        role: 'Charge Nurse',
        department: 'Emergency',
        burnoutRisk: 'high',
        compassionScore: 45,
        documentationDebt: 4.5,
        lastBreak: '6 hours ago',
        shiftHours: 10,
        patientsToday: 18,
        moodTrend: 'declining',
      },
      {
        id: '2',
        name: 'Michael Chen, MD',
        role: 'Attending Physician',
        department: 'Emergency',
        burnoutRisk: 'moderate',
        compassionScore: 68,
        documentationDebt: 3.2,
        lastBreak: '3 hours ago',
        shiftHours: 8,
        patientsToday: 12,
        moodTrend: 'stable',
      },
      {
        id: '3',
        name: 'Emily Rodriguez, RN',
        role: 'Staff Nurse',
        department: 'ICU',
        burnoutRisk: 'critical',
        compassionScore: 32,
        documentationDebt: 6.0,
        lastBreak: '8 hours ago',
        shiftHours: 11,
        patientsToday: 6,
        moodTrend: 'declining',
      },
      {
        id: '4',
        name: 'David Kim, PA-C',
        role: 'Physician Assistant',
        department: 'Emergency',
        burnoutRisk: 'low',
        compassionScore: 85,
        documentationDebt: 1.0,
        lastBreak: '1 hour ago',
        shiftHours: 6,
        patientsToday: 8,
        moodTrend: 'improving',
      },
      {
        id: '5',
        name: 'Lisa Thompson, RN',
        role: 'Triage Nurse',
        department: 'Emergency',
        burnoutRisk: 'high',
        compassionScore: 52,
        documentationDebt: 3.8,
        lastBreak: '5 hours ago',
        shiftHours: 9,
        patientsToday: 24,
        moodTrend: 'declining',
      },
      {
        id: '6',
        name: 'James Wilson, MD',
        role: 'Resident',
        department: 'Medicine',
        burnoutRisk: 'moderate',
        compassionScore: 61,
        documentationDebt: 5.5,
        lastBreak: '4 hours ago',
        shiftHours: 14,
        patientsToday: 10,
        moodTrend: 'stable',
      },
    ];

    // Simulate loading
    const timer = setTimeout(() => {
      setMetrics(demoMetrics);
      setStaffMembers(demoStaff);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'moderate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getMoodIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <Smile className="h-4 w-4 text-green-400" />;
      case 'declining': return <Frown className="h-4 w-4 text-red-400" />;
      default: return <Meh className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getCompassionColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Staff Wellness Data...</p>
        </div>
      </div>
    );
  }

  const filteredStaff = selectedDepartment === 'all'
    ? staffMembers
    : staffMembers.filter(s => s.department === selectedDepartment);

  const criticalStaff = staffMembers.filter(s => s.burnoutRisk === 'critical' || s.burnoutRisk === 'high');

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-linear-to-r from-purple-800 via-purple-700 to-indigo-800 text-white shadow-xl border-b border-purple-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-xl">
                <Heart className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Staff Wellness Center</h1>
                <p className="text-purple-200 text-sm">Burnout Prevention & Compassion Fatigue Monitoring</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/nurse-dashboard')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Activity className="h-4 w-4" />
                Nurse Panel
              </button>
              <button
                onClick={() => navigate('/shift-handoff')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Shift Handoff
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Alert Banner for Critical Staff */}
      {criticalStaff.length > 0 && (
        <div className="bg-linear-to-r from-red-600 to-orange-600 text-white py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">{criticalStaff.length} staff member(s) at elevated burnout risk</span>
            <span className="text-red-100">- Immediate wellness intervention recommended</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Total Staff</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics?.totalStaff}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-red-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span className="text-sm text-slate-400">High Risk</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{metrics?.highRiskCount}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-5 w-5 text-pink-400" />
              <span className="text-sm text-slate-400">Avg Compassion</span>
            </div>
            <div className={`text-2xl font-bold ${getCompassionColor(metrics?.avgCompassionScore || 0)}`}>
              {metrics?.avgCompassionScore}%
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-slate-400">Avg Doc Debt</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{metrics?.avgDocDebt}h</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coffee className="h-5 w-5 text-green-400" />
              <span className="text-sm text-slate-400">On Break</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{metrics?.staffOnBreak}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-sm text-slate-400">Interventions</span>
            </div>
            <div className="text-2xl font-bold text-teal-400">{metrics?.interventionsToday}</div>
          </div>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-4">
          <span className="text-slate-400">Filter by Department:</span>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="all">All Departments</option>
            <option value="Emergency">Emergency</option>
            <option value="ICU">ICU</option>
            <option value="Medicine">Medicine</option>
          </select>
        </div>

        {/* Staff Wellness Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              Staff Wellness Monitor
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Staff Member</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Department</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Burnout Risk</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Compassion</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Doc Debt</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Last Break</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Shift</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Mood</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-400">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className={`hover:bg-slate-700/30 ${
                    staff.burnoutRisk === 'critical' ? 'bg-red-500/5' : ''
                  }`}>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-white">{staff.name}</div>
                        <div className="text-sm text-slate-400">{staff.role}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{staff.department}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(staff.burnoutRisk)}`}>
                        {staff.burnoutRisk.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${getCompassionColor(staff.compassionScore)}`}>
                        {staff.compassionScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${staff.documentationDebt > 4 ? 'text-red-400' : 'text-slate-300'}`}>
                        {staff.documentationDebt}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm ${staff.lastBreak.includes('hour') && parseInt(staff.lastBreak) > 4 ? 'text-orange-400' : 'text-slate-300'}`}>
                        {staff.lastBreak}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${staff.shiftHours > 10 ? 'text-orange-400' : 'text-slate-300'}`}>
                        {staff.shiftHours}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getMoodIcon(staff.moodTrend)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(staff.burnoutRisk === 'critical' || staff.burnoutRisk === 'high') && (
                        <button className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors">
                          Intervene
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-linear-to-br from-green-800/30 to-green-900/30 rounded-xl border border-green-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Coffee className="h-6 w-6 text-green-400" />
              <h3 className="font-semibold text-white">Smart Break Scheduler</h3>
            </div>
            <p className="text-green-200 text-sm mb-4">AI-optimized break schedules based on patient load and staff wellness.</p>
            <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
              View Schedule
            </button>
          </div>

          <div className="bg-linear-to-br from-blue-800/30 to-blue-900/30 rounded-xl border border-blue-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-6 w-6 text-blue-400" />
              <h3 className="font-semibold text-white">Peer Support Circles</h3>
            </div>
            <p className="text-blue-200 text-sm mb-4">Connect struggling staff with peer mentors and support groups.</p>
            <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
              Manage Circles
            </button>
          </div>

          <div className="bg-linear-to-br from-purple-800/30 to-purple-900/30 rounded-xl border border-purple-600/30 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Brain className="h-6 w-6 text-purple-400" />
              <h3 className="font-semibold text-white">Wellness Resources</h3>
            </div>
            <p className="text-purple-200 text-sm mb-4">Mental health resources, EAP programs, and self-care tools.</p>
            <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
              View Resources
            </button>
          </div>
        </div>

        {/* Impact Metrics */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-teal-400" />
            Wellness Program Impact
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">-32%</div>
              <div className="text-sm text-slate-400">Turnover Reduction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">+18%</div>
              <div className="text-sm text-slate-400">Staff Satisfaction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">-24%</div>
              <div className="text-sm text-slate-400">Sick Days Used</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">$847K</div>
              <div className="text-sm text-slate-400">Est. Annual Savings</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Auto-refreshes every 5 minutes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HIPAA Compliant</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">Staff Confidential</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StaffWellnessDashboard;
