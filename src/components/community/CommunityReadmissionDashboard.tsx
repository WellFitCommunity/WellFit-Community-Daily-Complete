/**
 * Community Readmission Risk Dashboard
 * WellFit Community Platform - Readmission Prevention & High Utilizer Management
 *
 * This dashboard provides a community-centric view of readmission risk,
 * integrating SDOH factors, community engagement metrics, and daily check-ins
 * to prevent hospital readmissions through proactive intervention.
 *
 * Key Features:
 * - CMS Readmission Penalty Prevention
 * - SDOH Integration (Social Determinants of Health)
 * - Community Engagement Tracking
 * - Daily Check-in Analytics
 * - AI-Powered Risk Predictions
 * - Care Coordination Tools
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Heart,
  Phone,
  Calendar,
  Shield,
  Home,
  Pill,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Bell,
  MapPin,
  DollarSign,
  Brain,
  Stethoscope
} from 'lucide-react';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
  EABadge
} from '../envision-atlus';

// Types
interface CommunityMember {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  mrn?: string; // Methodist Medical Record Number
  discharge_facility?: string; // Which Methodist facility
  primary_diagnosis?: string;
  risk_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'critical';
  total_visits_30d: number;
  er_visits_30d: number;
  readmissions_30d: number;
  last_check_in?: string;
  check_in_streak: number;
  missed_check_ins_7d: number;
  has_active_care_plan: boolean;
  sdoh_risk_factors: string[];
  engagement_score: number;
  medication_adherence: number;
  next_appointment?: string;
  cms_penalty_risk: boolean;
  predicted_readmission_date?: string;
  days_since_discharge?: number;
  wellfit_member_since?: string;
  estimated_savings?: number; // Per-patient savings from prevented readmission
}

interface DashboardMetrics {
  total_high_risk_members: number;
  total_readmissions_30d: number;
  cms_penalty_risk_count: number;
  prevented_readmissions: number;
  active_care_plans: number;
  avg_engagement_score: number;
  check_in_completion_rate: number;
  medication_adherence_rate: number;
  cost_savings_estimate: number;
  critical_alerts: number;
}

interface CommunityAlert {
  id: string;
  member_id: string;
  member_name: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  created_at: string;
  status: 'active' | 'acknowledged' | 'resolved';
  recommended_action?: string;
}

interface SDOHFactor {
  category: string;
  count: number;
  risk_impact: 'low' | 'moderate' | 'high';
  icon: React.ReactNode;
}

// Utility function for risk colors
const getRiskColor = (category: string): string => {
  switch (category) {
    case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/50';
    case 'high': return 'text-orange-400 bg-orange-500/20 border-orange-500/50';
    case 'moderate': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
    default: return 'text-green-400 bg-green-500/20 border-green-500/50';
  }
};

const getRiskBgColor = (score: number): string => {
  if (score >= 80) return 'bg-gradient-to-r from-red-600 to-red-500';
  if (score >= 60) return 'bg-gradient-to-r from-orange-600 to-orange-500';
  if (score >= 40) return 'bg-gradient-to-r from-yellow-600 to-yellow-500';
  return 'bg-gradient-to-r from-green-600 to-green-500';
};

export const CommunityReadmissionDashboard: React.FC = () => {
  // Note: supabase client available via useSupabaseClient() for production data fetching
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high'>('all');

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [alerts, setAlerts] = useState<CommunityAlert[]>([]);
  const [selectedMember, setSelectedMember] = useState<CommunityMember | null>(null);

  // Demo data for Methodist Hospital System presentation
  // Shows how WellFit Community members who are also Methodist patients
  // are tracked for readmission risk - demonstrating hospital ROI
  const demoMetrics: DashboardMetrics = {
    total_high_risk_members: 47,
    total_readmissions_30d: 8,
    cms_penalty_risk_count: 12,
    prevented_readmissions: 23,
    active_care_plans: 34,
    avg_engagement_score: 78,
    check_in_completion_rate: 84.5,
    medication_adherence_rate: 91.2,
    cost_savings_estimate: 287500, // $12,500 avg per prevented readmission x 23
    critical_alerts: 5
  };

  // Methodist Hospital System + WellFit Community Members
  const demoMembers: CommunityMember[] = [
    {
      id: '1',
      first_name: 'Eleanor',
      last_name: 'Richardson',
      phone: '(713) 555-0142',
      mrn: 'MHS-2024-118742',
      discharge_facility: 'Methodist Hospital - Texas Medical Center',
      primary_diagnosis: 'CHF Exacerbation (I50.9)',
      risk_score: 92,
      risk_category: 'critical',
      total_visits_30d: 5,
      er_visits_30d: 3,
      readmissions_30d: 2,
      last_check_in: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      check_in_streak: 0,
      missed_check_ins_7d: 3,
      has_active_care_plan: true,
      sdoh_risk_factors: ['Transportation', 'Food Insecurity', 'Social Isolation'],
      engagement_score: 45,
      medication_adherence: 62,
      next_appointment: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      cms_penalty_risk: true,
      predicted_readmission_date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      days_since_discharge: 12,
      wellfit_member_since: '2024-08-15',
      estimated_savings: 15200
    },
    {
      id: '2',
      first_name: 'James',
      last_name: 'Martinez',
      phone: '(713) 555-0287',
      mrn: 'MHS-2024-093156',
      discharge_facility: 'Methodist West Houston Hospital',
      primary_diagnosis: 'COPD Exacerbation (J44.1)',
      risk_score: 85,
      risk_category: 'critical',
      total_visits_30d: 4,
      er_visits_30d: 2,
      readmissions_30d: 1,
      last_check_in: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      check_in_streak: 2,
      missed_check_ins_7d: 2,
      has_active_care_plan: true,
      sdoh_risk_factors: ['Housing Instability', 'Health Literacy'],
      engagement_score: 55,
      medication_adherence: 71,
      cms_penalty_risk: true,
      days_since_discharge: 18,
      wellfit_member_since: '2024-06-22',
      estimated_savings: 12800
    },
    {
      id: '3',
      first_name: 'Dorothy',
      last_name: 'Chen',
      phone: '(713) 555-0391',
      mrn: 'MHS-2024-156789',
      discharge_facility: 'Houston Methodist Sugar Land',
      primary_diagnosis: 'Pneumonia (J18.9)',
      risk_score: 78,
      risk_category: 'high',
      total_visits_30d: 3,
      er_visits_30d: 1,
      readmissions_30d: 1,
      last_check_in: new Date().toISOString(),
      check_in_streak: 14,
      missed_check_ins_7d: 0,
      has_active_care_plan: true,
      sdoh_risk_factors: ['Language Barrier'],
      engagement_score: 82,
      medication_adherence: 88,
      next_appointment: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      cms_penalty_risk: true,
      days_since_discharge: 22,
      wellfit_member_since: '2024-09-10',
      estimated_savings: 11500
    },
    {
      id: '4',
      first_name: 'Robert',
      last_name: 'Washington',
      phone: '(713) 555-0456',
      mrn: 'MHS-2024-078234',
      discharge_facility: 'Methodist Hospital - Texas Medical Center',
      primary_diagnosis: 'Acute MI Follow-up (I21.9)',
      risk_score: 72,
      risk_category: 'high',
      total_visits_30d: 2,
      er_visits_30d: 1,
      readmissions_30d: 0,
      last_check_in: new Date().toISOString(),
      check_in_streak: 21,
      missed_check_ins_7d: 0,
      has_active_care_plan: false,
      sdoh_risk_factors: ['Financial Stress', 'Caregiver Support'],
      engagement_score: 91,
      medication_adherence: 94,
      cms_penalty_risk: false,
      days_since_discharge: 28,
      wellfit_member_since: '2024-05-03',
      estimated_savings: 14200
    },
    {
      id: '5',
      first_name: 'Maria',
      last_name: 'Santos',
      phone: '(713) 555-0567',
      mrn: 'MHS-2024-134567',
      discharge_facility: 'Houston Methodist Willowbrook',
      primary_diagnosis: 'T2DM with Complications (E11.65)',
      risk_score: 65,
      risk_category: 'high',
      total_visits_30d: 2,
      er_visits_30d: 0,
      readmissions_30d: 0,
      last_check_in: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      check_in_streak: 0,
      missed_check_ins_7d: 3,
      has_active_care_plan: true,
      sdoh_risk_factors: ['Transportation', 'Food Insecurity'],
      engagement_score: 58,
      medication_adherence: 79,
      cms_penalty_risk: false,
      days_since_discharge: 35,
      wellfit_member_since: '2024-07-18',
      estimated_savings: 9800
    },
    {
      id: '6',
      first_name: 'William',
      last_name: 'Thompson',
      phone: '(713) 555-0678',
      mrn: 'MHS-2024-112345',
      discharge_facility: 'Houston Methodist Baytown',
      primary_diagnosis: 'Hip Replacement Follow-up (Z96.641)',
      risk_score: 48,
      risk_category: 'moderate',
      total_visits_30d: 1,
      er_visits_30d: 0,
      readmissions_30d: 0,
      last_check_in: new Date().toISOString(),
      check_in_streak: 45,
      missed_check_ins_7d: 0,
      has_active_care_plan: false,
      sdoh_risk_factors: [],
      engagement_score: 96,
      medication_adherence: 98,
      cms_penalty_risk: false,
      wellfit_member_since: '2024-03-12',
      estimated_savings: 12500
    },
    {
      id: '7',
      first_name: 'Helen',
      last_name: 'Patterson',
      phone: '(713) 555-0789',
      mrn: 'MHS-2024-098765',
      discharge_facility: 'Houston Methodist Clear Lake',
      primary_diagnosis: 'Atrial Fibrillation (I48.91)',
      risk_score: 35,
      risk_category: 'low',
      total_visits_30d: 0,
      er_visits_30d: 0,
      readmissions_30d: 0,
      last_check_in: new Date().toISOString(),
      check_in_streak: 62,
      missed_check_ins_7d: 0,
      has_active_care_plan: false,
      sdoh_risk_factors: [],
      engagement_score: 98,
      medication_adherence: 99,
      cms_penalty_risk: false,
      wellfit_member_since: '2024-01-20',
      estimated_savings: 13200
    }
  ];

  const demoAlerts: CommunityAlert[] = [
    {
      id: '1',
      member_id: '1',
      member_name: 'Eleanor Richardson',
      alert_type: 'missed_check_ins',
      severity: 'critical',
      title: 'Missed 3 Consecutive Check-ins',
      description: 'High-risk member has not checked in for 3 days. Last known wellness score was declining.',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      recommended_action: 'Immediate phone outreach recommended'
    },
    {
      id: '2',
      member_id: '2',
      member_name: 'James Martinez',
      alert_type: 'er_visit_detected',
      severity: 'critical',
      title: 'ER Visit Detected',
      description: 'Member visited Memorial Hermann ER yesterday. CHF exacerbation noted.',
      created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      status: 'acknowledged',
      recommended_action: 'Schedule post-discharge follow-up within 48 hours'
    },
    {
      id: '3',
      member_id: '1',
      member_name: 'Eleanor Richardson',
      alert_type: 'medication_non_adherence',
      severity: 'high',
      title: 'Medication Adherence Declining',
      description: 'Adherence dropped from 82% to 62% over past 14 days. Diuretic doses frequently missed.',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      recommended_action: 'Review medication barriers with pharmacist'
    },
    {
      id: '4',
      member_id: '5',
      member_name: 'Maria Santos',
      alert_type: 'sdoh_barrier',
      severity: 'high',
      title: 'Transportation Barrier Identified',
      description: 'Member reported inability to attend PCP appointment due to transportation issues.',
      created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      recommended_action: 'Coordinate transportation assistance or telehealth'
    },
    {
      id: '5',
      member_id: '3',
      member_name: 'Dorothy Chen',
      alert_type: 'readmission_risk_high',
      severity: 'high',
      title: 'AI Predicts Elevated Readmission Risk',
      description: 'Machine learning model predicts 78% probability of readmission within 14 days.',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      recommended_action: 'Activate intensive care coordination protocol'
    }
  ];

  const sdohFactors: SDOHFactor[] = [
    { category: 'Transportation', count: 18, risk_impact: 'high', icon: <MapPin size={18} /> },
    { category: 'Food Insecurity', count: 14, risk_impact: 'high', icon: <Home size={18} /> },
    { category: 'Social Isolation', count: 22, risk_impact: 'moderate', icon: <Users size={18} /> },
    { category: 'Housing Instability', count: 8, risk_impact: 'high', icon: <Home size={18} /> },
    { category: 'Financial Stress', count: 31, risk_impact: 'moderate', icon: <DollarSign size={18} /> },
    { category: 'Health Literacy', count: 12, risk_impact: 'moderate', icon: <Brain size={18} /> }
  ];

  // Load data
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // For demo, use demo data
      // In production, this would fetch from the database
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

      setMetrics(demoMetrics);
      setMembers(demoMembers);
      setAlerts(demoAlerts);

    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Filter members based on risk
  const filteredMembers = useMemo(() => {
    if (riskFilter === 'all') return members;
    if (riskFilter === 'critical') return members.filter(m => m.risk_category === 'critical');
    return members.filter(m => m.risk_category === 'critical' || m.risk_category === 'high');
  }, [members, riskFilter]);

  // Active alerts count
  const activeAlertsCount = alerts.filter(a => a.status === 'active').length;

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-12 w-12 text-[#00857a] mx-auto mb-4" />
          <p className="text-slate-400">Loading Community Health Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header - Methodist Hospital Integration */}
      <div className="bg-gradient-to-r from-[#003087] via-slate-800 to-slate-900 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-[#003087] text-white text-xs rounded border border-blue-400/50 font-medium">
                Houston Methodist Hospital System
              </span>
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600">
                Tenant: MH-0001
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Heart className="text-[#00857a]" />
              Community Readmission Prevention
            </h1>
            <p className="text-slate-400 mt-1">
              WellFit Community + Houston Methodist - CMS Star Rating & Readmission Penalty Prevention
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Period Selector */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(Number(e.target.value) as 30 | 60 | 90)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-[#00857a]"
            >
              <option value={30}>Last 30 Days</option>
              <option value={60}>Last 60 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>

            {/* Alert Badge */}
            {activeAlertsCount > 0 && (
              <div className="relative">
                <Bell className="text-white" />
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {activeAlertsCount}
                </span>
              </div>
            )}

            <button
              onClick={loadDashboardData}
              className="px-4 py-2 bg-[#00857a] hover:bg-[#006d64] text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            {/* Methodist Hospital Portal Button */}
            <button
              onClick={() => window.location.href = '/envision/login'}
              className="px-4 py-2 bg-[#003087] hover:bg-[#002266] text-white rounded-lg transition-colors flex items-center gap-2 border border-blue-400/30"
            >
              <Stethoscope size={16} />
              Methodist Portal
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Critical Alerts Banner */}
        {alerts.filter(a => a.severity === 'critical' && a.status === 'active').length > 0 && (
          <div className="bg-gradient-to-r from-red-600/20 to-red-500/10 border border-red-500/50 rounded-xl p-4">
            <div className="flex items-start gap-4">
              <AlertTriangle className="text-red-400 mt-1 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="font-bold text-red-400 mb-2">
                  {alerts.filter(a => a.severity === 'critical' && a.status === 'active').length} Critical Alerts Require Immediate Attention
                </h3>
                <div className="space-y-2">
                  {alerts.filter(a => a.severity === 'critical' && a.status === 'active').slice(0, 2).map(alert => (
                    <div key={alert.id} className="flex items-center justify-between bg-red-500/10 rounded-lg p-3">
                      <div>
                        <span className="font-medium text-white">{alert.member_name}</span>
                        <span className="text-red-300 ml-2">- {alert.title}</span>
                      </div>
                      <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm">
                        Take Action
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Row */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <MetricCard
              title="High-Risk Members"
              value={metrics.total_high_risk_members}
              icon={<Users className="text-orange-400" />}
              change={-3}
              changeLabel="vs last month"
              bgColor="bg-gradient-to-br from-orange-500/20 to-slate-800"
            />
            <MetricCard
              title="30-Day Readmissions"
              value={metrics.total_readmissions_30d}
              icon={<Activity className="text-red-400" />}
              change={-12}
              changeLabel="vs last month"
              alert={metrics.total_readmissions_30d > 5}
              bgColor="bg-gradient-to-br from-red-500/20 to-slate-800"
            />
            <MetricCard
              title="CMS Penalty Risk"
              value={metrics.cms_penalty_risk_count}
              icon={<AlertTriangle className="text-yellow-400" />}
              subtitle="members at risk"
              bgColor="bg-gradient-to-br from-yellow-500/20 to-slate-800"
            />
            <MetricCard
              title="Prevented Readmissions"
              value={metrics.prevented_readmissions}
              icon={<Shield className="text-green-400" />}
              change={15}
              changeLabel="this quarter"
              bgColor="bg-gradient-to-br from-green-500/20 to-slate-800"
            />
            <MetricCard
              title="Est. Cost Savings"
              value={`$${(metrics.cost_savings_estimate / 1000).toFixed(0)}K`}
              icon={<DollarSign className="text-emerald-400" />}
              subtitle="this quarter"
              bgColor="bg-gradient-to-br from-emerald-500/20 to-slate-800"
            />
          </div>
        )}

        {/* Tabs */}
        <EATabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList className="bg-slate-800/50">
            <EATabsTrigger value="overview">Dashboard Overview</EATabsTrigger>
            <EATabsTrigger value="members">High-Risk Members</EATabsTrigger>
            <EATabsTrigger value="alerts">
              Alerts
              {activeAlertsCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {activeAlertsCount}
                </span>
              )}
            </EATabsTrigger>
            <EATabsTrigger value="sdoh">SDOH Analysis</EATabsTrigger>
            <EATabsTrigger value="engagement">Engagement Metrics</EATabsTrigger>
          </EATabsList>

          {/* Overview Tab */}
          <EATabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Distribution */}
              <EACard className="lg:col-span-2">
                <EACardHeader icon={<Activity />}>
                  <h3 className="font-semibold text-white">Member Risk Distribution</h3>
                  <p className="text-sm text-slate-400">By readmission risk category</p>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-4">
                    <RiskBar
                      label="Critical Risk (80-100)"
                      count={members.filter(m => m.risk_score >= 80).length}
                      total={members.length}
                      color="bg-red-500"
                    />
                    <RiskBar
                      label="High Risk (60-79)"
                      count={members.filter(m => m.risk_score >= 60 && m.risk_score < 80).length}
                      total={members.length}
                      color="bg-orange-500"
                    />
                    <RiskBar
                      label="Moderate Risk (40-59)"
                      count={members.filter(m => m.risk_score >= 40 && m.risk_score < 60).length}
                      total={members.length}
                      color="bg-yellow-500"
                    />
                    <RiskBar
                      label="Low Risk (0-39)"
                      count={members.filter(m => m.risk_score < 40).length}
                      total={members.length}
                      color="bg-green-500"
                    />
                  </div>
                </EACardContent>
              </EACard>

              {/* Quick Actions */}
              <EACard>
                <EACardHeader icon={<Stethoscope />}>
                  <h3 className="font-semibold text-white">Quick Actions</h3>
                </EACardHeader>
                <EACardContent className="space-y-3">
                  <ActionButton
                    icon={<Phone />}
                    label="Call High-Risk Members"
                    count={members.filter(m => m.risk_category === 'critical').length}
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<FileText />}
                    label="Create Care Plans"
                    count={members.filter(m => !m.has_active_care_plan && m.risk_score >= 70).length}
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<Calendar />}
                    label="Schedule Follow-ups"
                    count={members.filter(m => !m.next_appointment && m.risk_score >= 60).length}
                    onClick={() => {}}
                  />
                  <ActionButton
                    icon={<Bell />}
                    label="Review Pending Alerts"
                    count={activeAlertsCount}
                    onClick={() => setActiveTab('alerts')}
                    urgent
                  />
                </EACardContent>
              </EACard>
            </div>

            {/* Engagement & Adherence Row */}
            {metrics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <EACard>
                  <EACardContent>
                    <div className="text-center">
                      <div className="relative inline-flex">
                        <svg className="w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#334155"
                            strokeWidth="12"
                            fill="none"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#00857a"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 56 * metrics.check_in_completion_rate / 100} ${2 * Math.PI * 56}`}
                            strokeLinecap="round"
                            transform="rotate(-90 64 64)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold text-white">{metrics.check_in_completion_rate.toFixed(0)}%</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-white mt-4">Check-in Completion</h4>
                      <p className="text-sm text-slate-400">Daily wellness check-ins</p>
                    </div>
                  </EACardContent>
                </EACard>

                <EACard>
                  <EACardContent>
                    <div className="text-center">
                      <div className="relative inline-flex">
                        <svg className="w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#334155"
                            strokeWidth="12"
                            fill="none"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#22c55e"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 56 * metrics.medication_adherence_rate / 100} ${2 * Math.PI * 56}`}
                            strokeLinecap="round"
                            transform="rotate(-90 64 64)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold text-white">{metrics.medication_adherence_rate.toFixed(0)}%</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-white mt-4">Medication Adherence</h4>
                      <p className="text-sm text-slate-400">Self-reported adherence</p>
                    </div>
                  </EACardContent>
                </EACard>

                <EACard>
                  <EACardContent>
                    <div className="text-center">
                      <div className="relative inline-flex">
                        <svg className="w-32 h-32">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#334155"
                            strokeWidth="12"
                            fill="none"
                          />
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            stroke="#3b82f6"
                            strokeWidth="12"
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 56 * metrics.avg_engagement_score / 100} ${2 * Math.PI * 56}`}
                            strokeLinecap="round"
                            transform="rotate(-90 64 64)"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl font-bold text-white">{metrics.avg_engagement_score}</span>
                        </div>
                      </div>
                      <h4 className="font-semibold text-white mt-4">Engagement Score</h4>
                      <p className="text-sm text-slate-400">Community participation</p>
                    </div>
                  </EACardContent>
                </EACard>
              </div>
            )}
          </EATabsContent>

          {/* Members Tab */}
          <EATabsContent value="members" className="mt-6">
            <EACard>
              <EACardHeader
                icon={<Users />}
                action={
                  <div className="flex items-center gap-3">
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value as any)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white"
                    >
                      <option value="all">All Risk Levels</option>
                      <option value="high">High & Critical</option>
                      <option value="critical">Critical Only</option>
                    </select>
                    <button className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm flex items-center gap-2">
                      <Download size={14} />
                      Export
                    </button>
                  </div>
                }
              >
                <h3 className="font-semibold text-white">High-Risk Community Members</h3>
                <p className="text-sm text-slate-400">{filteredMembers.length} members requiring intervention</p>
              </EACardHeader>
              <EACardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-800/50 border-b border-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Member</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Risk Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">30d Visits</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Check-in Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Engagement</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Med Adherence</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">SDOH Factors</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredMembers.map((member) => (
                        <MemberRow
                          key={member.id}
                          member={member}
                          onSelect={() => setSelectedMember(member)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Alerts Tab */}
          <EATabsContent value="alerts" className="mt-6">
            <EACard>
              <EACardHeader icon={<Bell />}>
                <h3 className="font-semibold text-white">Care Team Alerts</h3>
                <p className="text-sm text-slate-400">Real-time notifications requiring attention</p>
              </EACardHeader>
              <EACardContent className="space-y-4">
                {alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* SDOH Tab */}
          <EATabsContent value="sdoh" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EACard>
                <EACardHeader icon={<Home />}>
                  <h3 className="font-semibold text-white">Social Determinants of Health</h3>
                  <p className="text-sm text-slate-400">Barriers affecting member health outcomes</p>
                </EACardHeader>
                <EACardContent className="space-y-4">
                  {sdohFactors.map((factor) => (
                    <div key={factor.category} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                          {factor.icon}
                        </div>
                        <div>
                          <p className="font-medium text-white">{factor.category}</p>
                          <p className="text-sm text-slate-400">{factor.count} members affected</p>
                        </div>
                      </div>
                      <EABadge variant={factor.risk_impact === 'high' ? 'critical' : factor.risk_impact === 'moderate' ? 'elevated' : 'normal'}>
                        {factor.risk_impact} impact
                      </EABadge>
                    </div>
                  ))}
                </EACardContent>
              </EACard>

              <EACard>
                <EACardHeader icon={<Brain />}>
                  <h3 className="font-semibold text-white">SDOH Intervention Impact</h3>
                  <p className="text-sm text-slate-400">Addressing barriers reduces readmission risk</p>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-6">
                    <div className="text-center py-4">
                      <div className="text-5xl font-bold text-[#00857a] mb-2">42%</div>
                      <p className="text-slate-400">Average risk reduction when SDOH barriers are addressed</p>
                    </div>
                    <div className="space-y-3">
                      <ImpactRow label="Transportation assistance" reduction={35} />
                      <ImpactRow label="Food security programs" reduction={28} />
                      <ImpactRow label="Social engagement activities" reduction={22} />
                      <ImpactRow label="Housing support" reduction={45} />
                      <ImpactRow label="Health literacy education" reduction={18} />
                    </div>
                  </div>
                </EACardContent>
              </EACard>
            </div>
          </EATabsContent>

          {/* Engagement Tab */}
          <EATabsContent value="engagement" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EACard>
                <EACardHeader icon={<Clock />}>
                  <h3 className="font-semibold text-white">Check-in Streaks</h3>
                  <p className="text-sm text-slate-400">Members with consistent daily engagement</p>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-3">
                    {members
                      .filter(m => m.check_in_streak > 0)
                      .sort((a, b) => b.check_in_streak - a.check_in_streak)
                      .slice(0, 5)
                      .map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold">
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
                </EACardContent>
              </EACard>

              <EACard>
                <EACardHeader icon={<XCircle className="text-red-400" />}>
                  <h3 className="font-semibold text-white">Missed Check-ins</h3>
                  <p className="text-sm text-slate-400">Members who need outreach</p>
                </EACardHeader>
                <EACardContent>
                  <div className="space-y-3">
                    {members
                      .filter(m => m.missed_check_ins_7d > 0)
                      .sort((a, b) => b.missed_check_ins_7d - a.missed_check_ins_7d)
                      .map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border-l-4 border-red-500">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-bold">
                              {member.first_name[0]}{member.last_name[0]}
                            </div>
                            <div>
                              <p className="font-medium text-white">{member.first_name} {member.last_name}</p>
                              <p className="text-sm text-red-400">{member.missed_check_ins_7d} missed this week</p>
                            </div>
                          </div>
                          <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1">
                            <Phone size={14} />
                            Call
                          </button>
                        </div>
                      ))}
                  </div>
                </EACardContent>
              </EACard>
            </div>
          </EATabsContent>
        </EATabs>
      </div>

      {/* Member Detail Modal */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
};

// Sub-components
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  change?: number;
  changeLabel?: string;
  subtitle?: string;
  alert?: boolean;
  bgColor?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title, value, icon, change, changeLabel, subtitle, alert, bgColor
}) => (
  <div className={`rounded-xl p-4 border ${alert ? 'border-red-500/50' : 'border-slate-700'} ${bgColor || 'bg-slate-800'}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-slate-400">{title}</p>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            <span>{Math.abs(change)}% {changeLabel}</span>
          </div>
        )}
      </div>
      <div className="p-2 rounded-lg bg-slate-700/50">{icon}</div>
    </div>
  </div>
);

interface RiskBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const RiskBar: React.FC<RiskBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium">{count} members</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
  urgent?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, count, onClick, urgent }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
      urgent
        ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/30'
        : 'bg-slate-700/50 hover:bg-slate-700'
    }`}
  >
    <div className="flex items-center gap-3">
      <span className={urgent ? 'text-red-400' : 'text-slate-400'}>{icon}</span>
      <span className="text-white">{label}</span>
    </div>
    {count > 0 && (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        urgent ? 'bg-red-500 text-white' : 'bg-slate-600 text-white'
      }`}>
        {count}
      </span>
    )}
  </button>
);

interface MemberRowProps {
  member: CommunityMember;
  onSelect: () => void;
}

const MemberRow: React.FC<MemberRowProps> = ({ member, onSelect }) => (
  <tr className="hover:bg-slate-800/50 cursor-pointer" onClick={onSelect}>
    <td className="px-6 py-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getRiskBgColor(member.risk_score)}`}>
          {member.first_name[0]}{member.last_name[0]}
        </div>
        <div>
          <p className="font-medium text-white">{member.first_name} {member.last_name}</p>
          <p className="text-sm text-slate-400">{member.phone}</p>
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
            <span key={factor} className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
              {factor}
            </span>
          ))}
          {member.sdoh_risk_factors.length > 2 && (
            <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">
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

interface AlertCardProps {
  alert: CommunityAlert;
}

const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const severityColors = {
    critical: 'border-red-500 bg-red-500/10',
    high: 'border-orange-500 bg-orange-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-blue-500 bg-blue-500/10'
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${severityColors[alert.severity]}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-white">{alert.member_name}</span>
            <EABadge variant={alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'info'}>
              {alert.severity}
            </EABadge>
            <EABadge variant={alert.status === 'active' ? 'info' : 'neutral'}>
              {alert.status}
            </EABadge>
          </div>
          <h4 className="font-medium text-white">{alert.title}</h4>
          <p className="text-sm text-slate-400 mt-1">{alert.description}</p>
          {alert.recommended_action && (
            <div className="mt-2 p-2 bg-slate-800/50 rounded text-sm">
              <span className="text-slate-400">Recommended: </span>
              <span className="text-white">{alert.recommended_action}</span>
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {new Date(alert.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          <button className="px-3 py-1.5 bg-[#00857a] hover:bg-[#006d64] text-white rounded text-sm">
            Take Action
          </button>
          <button className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

interface ImpactRowProps {
  label: string;
  reduction: number;
}

const ImpactRow: React.FC<ImpactRowProps> = ({ label, reduction }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-300">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#00857a] to-emerald-500 rounded-full"
          style={{ width: `${reduction}%` }}
        />
      </div>
      <span className="text-green-400 font-medium w-10 text-right">-{reduction}%</span>
    </div>
  </div>
);

interface MemberDetailModalProps {
  member: CommunityMember;
  onClose: () => void;
}

const MemberDetailModal: React.FC<MemberDetailModalProps> = ({ member, onClose }) => (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-slate-700">
      <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${getRiskBgColor(member.risk_score)}`}>
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{member.first_name} {member.last_name}</h2>
            <p className="text-slate-400">{member.phone}</p>
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
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-2"
        >
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
            <p className="text-sm text-slate-400 mt-1">
              {member.days_since_discharge} days since last discharge
            </p>
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

export default CommunityReadmissionDashboard;
