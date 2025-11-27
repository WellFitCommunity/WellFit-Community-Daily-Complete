/**
 * =====================================================
 * DENTAL HEALTH DASHBOARD
 * =====================================================
 * Purpose: Patient-facing dental health tracking and management
 * Features: Health summary, self-tracking, educational content
 * Design: Envision Atlus Clinical Design System
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { DentalHealthService } from '../../services/dentalHealthService';
import { auditLogger } from '../../services/auditLogger';
import type {
  DentalHealthDashboardSummary,
  CreatePatientTrackingRequest,
  PatientDentalHealthTracking,
  DentalRiskAlert,
} from '../../types/dentalHealth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAAlert,
  EAMetricCard,
  EARiskIndicator,
  EAPageLayout,
} from '../envision-atlus';
import {
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Heart,
  Calendar,
  Pill,
  TrendingUp,
  Activity,
  FileText,
  Smile,
  RefreshCw,
  Sparkles,
  Clock,
  BookOpen,
} from 'lucide-react';

/**
 * Dental Health Dashboard - Main component
 */
export const DentalHealthDashboard: React.FC = () => {
  const user = useUser();
  const [summary, setSummary] = useState<DentalHealthDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Load dashboard data
  const loadDashboard = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const response = await DentalHealthService.getDashboardSummary();

      if (response.success && response.data) {
        setSummary(response.data);
      } else {
        setError(response.error || 'Failed to load dashboard');
      }
    } catch (err: any) {
      await auditLogger.error('DENTAL_DASHBOARD_LOAD_FAILED', err, {
        userId: user?.id,
        resource_type: 'dashboard',
        operation: 'load'
      });
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboard();

      // Auto-refresh every 2 minutes
      const interval = setInterval(loadDashboard, 120000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <EAAlert variant="critical">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-semibold">Authentication Required</p>
            <p className="text-sm mt-1">Please log in to view your dental health dashboard.</p>
          </div>
        </EAAlert>
      </div>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <EACard className="max-w-md">
          <EACardContent className="p-6 text-center">
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Error Loading Dashboard</h3>
            <p className="text-slate-400 mb-4">{error}</p>
            <EAButton variant="primary" onClick={loadDashboard}>
              Try Again
            </EAButton>
          </EACardContent>
        </EACard>
      </div>
    );
  }

  return (
    <EAPageLayout
      title="Smile Health"
      subtitle="Your dental health is connected to your overall wellness"
      badge={<EABadge variant="info">Dental</EABadge>}
      actions={
        <EAButton
          variant="secondary"
          size="sm"
          onClick={loadDashboard}
          icon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </EAButton>
      }
    >
      {/* Risk Alerts */}
      {summary && summary.risk_alerts && summary.risk_alerts.length > 0 && (
        <div className="mb-6">
          <RiskAlerts alerts={summary.risk_alerts} />
        </div>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700 p-1 rounded-lg">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400 rounded-md px-4 py-2"
          >
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tracking"
            className="data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400 rounded-md px-4 py-2"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Daily Tracking
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400 rounded-md px-4 py-2"
          >
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger
            value="education"
            className="data-[state=active]:bg-[#00857a] data-[state=active]:text-white text-slate-400 rounded-md px-4 py-2"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Learn
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {summary && (
            <>
              <HealthOverview summary={summary} />
              <div className="grid gap-6 md:grid-cols-2">
                <TreatmentSummary summary={summary} />
                <CurrentSymptoms symptoms={summary.current_symptoms} />
              </div>
            </>
          )}
        </TabsContent>

        {/* Daily Tracking Tab */}
        <TabsContent value="tracking">
          <DailyTrackingForm onSave={loadDashboard} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          {summary && <TrackingHistory reports={summary.recent_self_reports} />}
        </TabsContent>

        {/* Education Tab */}
        <TabsContent value="education">
          <EducationalContent />
        </TabsContent>
      </Tabs>
    </EAPageLayout>
  );
};

/**
 * Health Overview Section
 */
const HealthOverview: React.FC<{ summary: DentalHealthDashboardSummary }> = ({ summary }) => {
  const getRiskLevel = (rating?: number): 'critical' | 'high' | 'elevated' | 'normal' => {
    if (!rating) return 'elevated';
    if (rating >= 4) return 'normal';
    if (rating >= 3) return 'elevated';
    if (rating >= 2) return 'high';
    return 'critical';
  };

  const getPeriodontalRisk = (status?: string): 'critical' | 'high' | 'elevated' | 'normal' => {
    if (!status) return 'normal';
    if (status.includes('severe') || status.includes('advanced')) return 'critical';
    if (status.includes('moderate')) return 'high';
    if (status.includes('mild') || status.includes('gingivitis')) return 'elevated';
    return 'normal';
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Overall Health Rating */}
      <EACard variant="highlight">
        <EACardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-[#00857a]/20 rounded-lg">
              <Smile className="h-6 w-6 text-[#00857a]" />
            </div>
            <EARiskIndicator
              level={getRiskLevel(summary.overall_oral_health_rating)}
              variant="badge"
              showIcon={false}
            />
          </div>
          <div className="text-3xl font-bold text-white mb-1">
            {summary.overall_oral_health_rating ? `${summary.overall_oral_health_rating}/5` : 'N/A'}
          </div>
          <p className="text-sm text-slate-400">Overall Oral Health</p>
          {summary.periodontal_status && (
            <div className="mt-3">
              <EABadge variant={getPeriodontalRisk(summary.periodontal_status)}>
                {summary.periodontal_status.replace(/_/g, ' ').toUpperCase()}
              </EABadge>
            </div>
          )}
        </EACardContent>
      </EACard>

      {/* Last Visit */}
      <EACard>
        <EACardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {summary.last_visit_date
              ? new Date(summary.last_visit_date).toLocaleDateString()
              : 'No visits yet'}
          </div>
          <p className="text-sm text-slate-400">Last Dental Visit</p>
          <p className="text-xs text-[#33bfb7] mt-2">
            {summary.next_recommended_visit
              ? `Next: ${new Date(summary.next_recommended_visit).toLocaleDateString()}`
              : 'Schedule your first visit'}
          </p>
        </EACardContent>
      </EACard>

      {/* Active Issues */}
      <EACard>
        <EACardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            {summary.active_conditions_count > 0 && (
              <EARiskIndicator level="medium" variant="badge" showIcon={false} />
            )}
          </div>
          <div className="text-3xl font-bold text-white mb-1">{summary.active_conditions_count}</div>
          <p className="text-sm text-slate-400">Active Conditions</p>
          <p className="text-xs text-slate-500 mt-2">
            {summary.pending_procedures_count} pending procedures
          </p>
        </EACardContent>
      </EACard>
    </div>
  );
};

/**
 * Treatment Summary
 */
const TreatmentSummary: React.FC<{ summary: DentalHealthDashboardSummary }> = ({ summary }) => {
  return (
    <EACard>
      <EACardHeader icon={<FileText className="h-5 w-5" />}>
        <div>
          <h3 className="text-lg font-semibold text-white">Treatment Summary</h3>
          <p className="text-sm text-slate-400">Your current treatment status</p>
        </div>
      </EACardHeader>
      <EACardContent className="space-y-4">
        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-300">Active Treatment Plans</span>
          <EABadge variant="info">{summary.active_treatment_plans_count}</EABadge>
        </div>
        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-300">Pending Procedures</span>
          <EABadge variant="elevated">{summary.pending_procedures_count}</EABadge>
        </div>
        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-300">Completed This Year</span>
          <EABadge variant="normal">{summary.completed_procedures_this_year}</EABadge>
        </div>
        <div className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-300">Pending Referrals</span>
          <EABadge variant={summary.pending_referrals_count > 0 ? 'critical' : 'normal'}>
            {summary.pending_referrals_count}
          </EABadge>
        </div>
      </EACardContent>
    </EACard>
  );
};

/**
 * Current Symptoms Display
 */
const CurrentSymptoms: React.FC<{ symptoms: string[] }> = ({ symptoms }) => {
  return (
    <EACard>
      <EACardHeader icon={<Heart className="h-5 w-5 text-red-400" />}>
        <div>
          <h3 className="text-lg font-semibold text-white">Current Symptoms</h3>
          <p className="text-sm text-slate-400">Based on your recent reports</p>
        </div>
      </EACardHeader>
      <EACardContent>
        {symptoms.length === 0 ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <CheckCircle className="h-6 w-6 text-emerald-400" />
            <span className="text-emerald-300 font-medium">No symptoms reported</span>
          </div>
        ) : (
          <div className="space-y-2">
            {symptoms.map((symptom, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <span className="text-white text-sm">{symptom}</span>
              </div>
            ))}
          </div>
        )}
      </EACardContent>
    </EACard>
  );
};

/**
 * Risk Alerts Component
 */
const RiskAlerts: React.FC<{ alerts: DentalRiskAlert[] }> = ({ alerts }) => {
  const getAlertVariant = (severity: string): 'critical' | 'warning' | 'info' | 'success' => {
    if (severity === 'critical') return 'critical';
    if (severity === 'high') return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <EAAlert key={index} variant={getAlertVariant(alert.severity)}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <EABadge variant={alert.severity === 'critical' ? 'critical' : alert.severity === 'high' ? 'high' : 'elevated'}>
                {alert.severity.toUpperCase()}
              </EABadge>
              <span className="text-white font-medium">{alert.category.replace(/-/g, ' ').toUpperCase()}</span>
            </div>
            <p className="text-slate-300 text-sm">{alert.message}</p>
            <p className="text-[#33bfb7] text-sm mt-2 font-medium">
              Recommended: {alert.recommended_action}
            </p>
            {alert.related_condition && (
              <p className="text-slate-500 text-xs mt-1 italic">Related to: {alert.related_condition}</p>
            )}
          </div>
        </EAAlert>
      ))}
    </div>
  );
};

/**
 * Daily Tracking Form
 */
const DailyTrackingForm: React.FC<{ onSave: () => void }> = ({ onSave }) => {
  const [formData, setFormData] = useState<CreatePatientTrackingRequest>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const response = await DentalHealthService.createPatientTracking(formData);

      if (response.success) {
        setSuccess(true);
        setFormData({});
        onSave();

        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      } else {
        alert(`Error: ${response.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCheckboxChange = (field: keyof CreatePatientTrackingRequest, value: boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: keyof CreatePatientTrackingRequest, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <EACard>
      <EACardHeader icon={<Sparkles className="h-5 w-5" />}>
        <div>
          <h3 className="text-lg font-semibold text-white">Daily Dental Health Check-In</h3>
          <p className="text-sm text-slate-400">Track your daily oral health habits and symptoms</p>
        </div>
      </EACardHeader>
      <EACardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Symptoms Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#00857a] uppercase tracking-wider">Symptoms Today</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.tooth_pain || false}
                  onChange={e => handleCheckboxChange('tooth_pain', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Tooth pain</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.gum_bleeding || false}
                  onChange={e => handleCheckboxChange('gum_bleeding', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Bleeding gums</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.dry_mouth || false}
                  onChange={e => handleCheckboxChange('dry_mouth', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Dry mouth</span>
              </label>
            </div>

            {formData.tooth_pain && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <label className="text-sm font-medium text-red-300">Pain Severity (0-10)</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={formData.tooth_pain_severity || 0}
                  onChange={e => handleNumberChange('tooth_pain_severity', parseInt(e.target.value))}
                  className="mt-2 w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>None</span>
                  <span className="text-red-400 font-bold">{formData.tooth_pain_severity || 0}</span>
                  <span>Severe</span>
                </div>
              </div>
            )}
          </div>

          {/* Hygiene Habits Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#00857a] uppercase tracking-wider">Hygiene Habits Today</h4>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.brushed_today || false}
                  onChange={e => handleCheckboxChange('brushed_today', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Brushed teeth</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.flossed_today || false}
                  onChange={e => handleCheckboxChange('flossed_today', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Flossed</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors border border-slate-700">
                <input
                  type="checkbox"
                  checked={formData.used_mouthwash || false}
                  onChange={e => handleCheckboxChange('used_mouthwash', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#00857a] focus:ring-[#00857a]"
                />
                <span className="text-sm text-white">Used mouthwash</span>
              </label>
            </div>
          </div>

          {/* Additional Concerns */}
          <div>
            <label className="text-sm font-medium text-slate-300">Additional Concerns (Optional)</label>
            <textarea
              value={formData.additional_concerns || ''}
              onChange={e => setFormData(prev => ({ ...prev, additional_concerns: e.target.value }))}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-[#00857a] focus:ring-[#00857a]"
              rows={3}
              placeholder="Any other dental health concerns or observations..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-4">
            <EAButton type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : "Save Today's Entry"}
            </EAButton>
            {success && (
              <span className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Saved successfully!
              </span>
            )}
          </div>
        </form>
      </EACardContent>
    </EACard>
  );
};

/**
 * Tracking History Display
 */
const TrackingHistory: React.FC<{ reports: PatientDentalHealthTracking[] }> = ({ reports }) => {
  if (reports.length === 0) {
    return (
      <EACard>
        <EACardContent className="py-12 text-center">
          <div className="w-16 h-16 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-slate-600" />
          </div>
          <p className="text-white font-medium">No tracking history yet</p>
          <p className="text-slate-500 text-sm mt-1">Start tracking your dental health today!</p>
        </EACardContent>
      </EACard>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map(report => (
        <EACard key={report.id}>
          <EACardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">
                {new Date(report.report_date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h4>
            </div>
            <div className="space-y-2">
              {report.tooth_pain && (
                <div className="flex items-center gap-2 text-sm p-2 bg-red-500/10 rounded">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="text-red-300">Tooth pain (severity: {report.tooth_pain_severity}/10)</span>
                </div>
              )}
              {report.gum_bleeding && (
                <div className="flex items-center gap-2 text-sm p-2 bg-amber-500/10 rounded">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  <span className="text-amber-300">Bleeding gums</span>
                </div>
              )}
              <div className="flex gap-3 mt-3 pt-3 border-t border-slate-700">
                <span className={`text-xs px-2 py-1 rounded ${report.brushed_today ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {report.brushed_today ? '✓' : '✗'} Brushed
                </span>
                <span className={`text-xs px-2 py-1 rounded ${report.flossed_today ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {report.flossed_today ? '✓' : '✗'} Flossed
                </span>
                <span className={`text-xs px-2 py-1 rounded ${report.used_mouthwash ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                  {report.used_mouthwash ? '✓' : '✗'} Mouthwash
                </span>
              </div>
              {report.additional_concerns && (
                <p className="text-sm italic text-slate-400 mt-2 p-2 bg-slate-800/50 rounded">
                  "{report.additional_concerns}"
                </p>
              )}
            </div>
          </EACardContent>
        </EACard>
      ))}
    </div>
  );
};

/**
 * Educational Content Section
 */
const EducationalContent: React.FC = () => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <EACard variant="highlight">
        <EACardHeader icon={<Heart className="h-5 w-5 text-red-400" />}>
          <h3 className="text-lg font-semibold text-white">Oral Health & Your Heart</h3>
        </EACardHeader>
        <EACardContent className="space-y-3 text-sm">
          <p className="text-slate-300">
            <strong className="text-white">Did you know?</strong> Gum disease (periodontitis) is linked to an increased risk of heart disease,
            stroke, and heart attack.
          </p>
          <p className="text-slate-400">
            The bacteria from infected gums can enter your bloodstream, potentially affecting your heart valves and
            contributing to arterial inflammation.
          </p>
          <ul className="space-y-2 text-slate-400">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Brush twice daily for 2 minutes
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Floss at least once per day
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Visit your dentist every 6 months
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Report bleeding gums immediately
            </li>
          </ul>
        </EACardContent>
      </EACard>

      <EACard>
        <EACardHeader icon={<Pill className="h-5 w-5 text-blue-400" />}>
          <h3 className="text-lg font-semibold text-white">Diabetes & Dental Health</h3>
        </EACardHeader>
        <EACardContent className="space-y-3 text-sm">
          <p className="text-slate-300">
            <strong className="text-white">Bidirectional relationship:</strong> Diabetes affects your gum health, and gum disease can make
            blood sugar harder to control.
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-amber-300 font-semibold">
              If you have diabetes, you're 2-3 times more likely to develop gum disease.
            </p>
          </div>
          <ul className="space-y-2 text-slate-400">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Keep blood sugar levels in target range
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Get dental cleanings at least twice per year
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Report dry mouth to your doctor
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-[#00857a]" />
              Treat gum infections promptly
            </li>
          </ul>
        </EACardContent>
      </EACard>

      <EACard>
        <EACardHeader icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}>
          <h3 className="text-lg font-semibold text-white">Nutrition Starts in Your Mouth</h3>
        </EACardHeader>
        <EACardContent className="space-y-3 text-sm">
          <p className="text-slate-300">
            Poor dental health can affect your ability to eat nutritious foods, leading to malnutrition and worsening
            chronic conditions.
          </p>
          <p className="text-slate-400">
            <strong className="text-white">Warning signs:</strong> Difficulty chewing, avoiding certain foods (especially fruits/vegetables),
            unintended weight loss.
          </p>
          <div className="p-3 bg-[#00857a]/10 border border-[#00857a]/30 rounded-lg">
            <p className="text-[#33bfb7] font-semibold">
              Don't let tooth problems impact your nutrition—seek treatment early!
            </p>
          </div>
        </EACardContent>
      </EACard>
    </div>
  );
};

/**
 * Loading Skeleton
 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-12 w-64 bg-slate-800 rounded-lg animate-pulse" />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-32 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-32 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-32 bg-slate-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-64 bg-slate-800 rounded-lg animate-pulse" />
      </div>
    </div>
  );
};

export default DentalHealthDashboard;
