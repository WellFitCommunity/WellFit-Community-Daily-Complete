/**
 * =====================================================
 * DENTAL HEALTH DASHBOARD
 * =====================================================
 * Purpose: Patient-facing dental health tracking and management
 * Features: Health summary, self-tracking, educational content
 * =====================================================
 */

import React, { useState, useEffect } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { DentalHealthService } from '../../services/dentalHealthService';
import type {
  DentalHealthDashboardSummary,
  CreatePatientTrackingRequest,
  PatientDentalHealthTracking,
  DentalRiskAlert,
} from '../../types/dentalHealth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
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
      console.error('Error loading dental dashboard:', err);
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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <h5 className="mb-1 font-medium leading-none tracking-tight">Authentication Required</h5>
        <AlertDescription>Please log in to view your dental health dashboard.</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <h5 className="mb-1 font-medium leading-none tracking-tight">Error</h5>
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={loadDashboard} className="mt-2" size="sm">
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Smile className="h-8 w-8 text-blue-600" />
            Smile Health
          </h1>
          <p className="text-muted-foreground">
            Your dental health is connected to your overall wellness
          </p>
        </div>
        <Button onClick={loadDashboard} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Risk Alerts */}
      {summary && summary.risk_alerts && summary.risk_alerts.length > 0 && (
        <RiskAlerts alerts={summary.risk_alerts} />
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tracking">Daily Tracking</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="education">Learn</TabsTrigger>
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
    </div>
  );
};

/**
 * Health Overview Section
 */
const HealthOverview: React.FC<{ summary: DentalHealthDashboardSummary }> = ({ summary }) => {
  const getHealthRatingColor = (rating?: number) => {
    if (!rating) return 'gray';
    if (rating >= 4) return 'green';
    if (rating >= 3) return 'yellow';
    return 'red';
  };

  const getPeriodontalStatusBadge = (status?: string) => {
    if (!status) return null;

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      healthy: 'default',
      gingivitis: 'secondary',
      mild_periodontitis: 'secondary',
      moderate_periodontitis: 'destructive',
      severe_periodontitis: 'destructive',
      advanced_periodontitis: 'destructive',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Overall Health Rating */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Oral Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.overall_oral_health_rating ? `${summary.overall_oral_health_rating}/5` : 'N/A'}
          </div>
          <p className="text-xs text-muted-foreground">
            Based on latest assessment
          </p>
          {summary.periodontal_status && (
            <div className="mt-2">
              {getPeriodontalStatusBadge(summary.periodontal_status)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Visit */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Dental Visit</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.last_visit_date
              ? new Date(summary.last_visit_date).toLocaleDateString()
              : 'No visits yet'}
          </div>
          <p className="text-xs text-muted-foreground">
            {summary.next_recommended_visit
              ? `Next: ${new Date(summary.next_recommended_visit).toLocaleDateString()}`
              : 'Schedule your first visit'}
          </p>
        </CardContent>
      </Card>

      {/* Active Issues */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Conditions</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.active_conditions_count}</div>
          <p className="text-xs text-muted-foreground">
            {summary.pending_procedures_count} pending procedures
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Treatment Summary
 */
const TreatmentSummary: React.FC<{ summary: DentalHealthDashboardSummary }> = ({ summary }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Treatment Summary
        </CardTitle>
        <CardDescription>Your current treatment status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Active Treatment Plans</span>
          <Badge variant="secondary">{summary.active_treatment_plans_count}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Pending Procedures</span>
          <Badge variant="outline">{summary.pending_procedures_count}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Completed This Year</span>
          <Badge variant="default">{summary.completed_procedures_this_year}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Pending Referrals</span>
          <Badge variant={summary.pending_referrals_count > 0 ? 'destructive' : 'secondary'}>
            {summary.pending_referrals_count}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Current Symptoms Display
 */
const CurrentSymptoms: React.FC<{ symptoms: string[] }> = ({ symptoms }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Current Symptoms
        </CardTitle>
        <CardDescription>Based on your recent reports</CardDescription>
      </CardHeader>
      <CardContent>
        {symptoms.length === 0 ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>No symptoms reported</span>
          </div>
        ) : (
          <div className="space-y-2">
            {symptoms.map((symptom, index) => (
              <div key={index} className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">{symptom}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Risk Alerts Component
 */
const RiskAlerts: React.FC<{ alerts: DentalRiskAlert[] }> = ({ alerts }) => {
  const getSeverityVariant = (severity: string): 'default' | 'destructive' => {
    return severity === 'critical' || severity === 'high' ? 'destructive' : 'default';
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => (
        <Alert key={index} variant={getSeverityVariant(alert.severity)}>
          <AlertTriangle className="h-4 w-4" />
          <h5 className="mb-1 font-bold leading-none tracking-tight">
            {alert.severity.toUpperCase()}: {alert.category.replace(/-/g, ' ').toUpperCase()}
          </h5>
          <AlertDescription className="space-y-2">
            <p>{alert.message}</p>
            <p className="font-semibold">Recommended Action: {alert.recommended_action}</p>
            {alert.related_condition && (
              <p className="text-sm italic">Related to: {alert.related_condition}</p>
            )}
          </AlertDescription>
        </Alert>
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
    <Card>
      <CardHeader>
        <CardTitle>Daily Dental Health Check-In</CardTitle>
        <CardDescription>Track your daily oral health habits and symptoms</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Symptoms Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Symptoms Today</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.tooth_pain || false}
                  onChange={e => handleCheckboxChange('tooth_pain', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Tooth pain</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.gum_bleeding || false}
                  onChange={e => handleCheckboxChange('gum_bleeding', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Bleeding gums</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.dry_mouth || false}
                  onChange={e => handleCheckboxChange('dry_mouth', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Dry mouth</span>
              </label>
            </div>

            {formData.tooth_pain && (
              <div className="mt-2">
                <label className="text-sm font-medium">Pain Severity (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={formData.tooth_pain_severity || 0}
                  onChange={e => handleNumberChange('tooth_pain_severity', parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            )}
          </div>

          {/* Hygiene Habits Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Hygiene Habits Today</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.brushed_today || false}
                  onChange={e => handleCheckboxChange('brushed_today', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Brushed teeth</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.flossed_today || false}
                  onChange={e => handleCheckboxChange('flossed_today', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Flossed</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.used_mouthwash || false}
                  onChange={e => handleCheckboxChange('used_mouthwash', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Used mouthwash</span>
              </label>
            </div>
          </div>

          {/* Additional Concerns */}
          <div>
            <label className="text-sm font-medium">Additional Concerns (Optional)</label>
            <textarea
              value={formData.additional_concerns || ''}
              onChange={e => setFormData(prev => ({ ...prev, additional_concerns: e.target.value }))}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              rows={3}
              placeholder="Any other dental health concerns or observations..."
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Today\'s Entry'}
            </Button>
            {success && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Saved successfully!
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * Tracking History Display
 */
const TrackingHistory: React.FC<{ reports: PatientDentalHealthTracking[] }> = ({ reports }) => {
  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tracking history yet. Start tracking your dental health today!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map(report => (
        <Card key={report.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {new Date(report.report_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.tooth_pain && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>Tooth pain (severity: {report.tooth_pain_severity}/10)</span>
              </div>
            )}
            {report.gum_bleeding && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>Bleeding gums</span>
              </div>
            )}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>{report.brushed_today ? '✓' : '✗'} Brushed</span>
              <span>{report.flossed_today ? '✓' : '✗'} Flossed</span>
              <span>{report.used_mouthwash ? '✓' : '✗'} Mouthwash</span>
            </div>
            {report.additional_concerns && (
              <p className="text-sm italic mt-2 text-gray-600">"{report.additional_concerns}"</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

/**
 * Educational Content Section
 */
const EducationalContent: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Oral Health & Your Heart
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Did you know?</strong> Gum disease (periodontitis) is linked to an increased risk of heart disease,
            stroke, and heart attack.
          </p>
          <p>
            The bacteria from infected gums can enter your bloodstream, potentially affecting your heart valves and
            contributing to arterial inflammation.
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Brush twice daily for 2 minutes</li>
            <li>Floss at least once per day</li>
            <li>Visit your dentist every 6 months</li>
            <li>Report bleeding gums immediately</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-500" />
            Diabetes & Dental Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <strong>Bidirectional relationship:</strong> Diabetes affects your gum health, and gum disease can make
            blood sugar harder to control.
          </p>
          <p className="font-semibold text-yellow-700">
            If you have diabetes, you're 2-3 times more likely to develop gum disease.
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Keep blood sugar levels in target range</li>
            <li>Get dental cleanings at least twice per year</li>
            <li>Report dry mouth to your doctor (common diabetes side effect)</li>
            <li>Treat gum infections promptly</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Nutrition Starts in Your Mouth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Poor dental health can affect your ability to eat nutritious foods, leading to malnutrition and worsening
            chronic conditions.
          </p>
          <p>
            <strong>Warning signs:</strong> Difficulty chewing, avoiding certain foods (especially fruits/vegetables),
            unintended weight loss.
          </p>
          <p className="font-semibold text-blue-700">
            Don't let tooth problems impact your nutrition—seek treatment early!
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Loading Skeleton
 */
const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
};

export default DentalHealthDashboard;
