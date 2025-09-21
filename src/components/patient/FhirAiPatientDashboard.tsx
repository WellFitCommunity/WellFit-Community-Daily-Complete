// Lite AI Dashboard for Senior Patients
// Provides personalized health insights and AI-powered recommendations

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';
import EnhancedFhirService from '../admin/EnhancedFhirService';

interface PatientDashboardProps {
  supabaseUrl: string;
  supabaseKey: string;
}

interface PatientInsights {
  overallHealthScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  adherenceScore: number;
  lastCheckIn: string;
  emergencyAlerts: any[];
  careRecommendations: any[];
  vitalsTrends: any[];
  nextActions: string[];
  encouragement: string;
}

interface HealthMetric {
  name: string;
  value: string;
  status: 'good' | 'warning' | 'concerning';
  trend: 'improving' | 'stable' | 'declining';
  recommendation?: string;
}

// Health Score Display Component
const HealthScoreDisplay: React.FC<{ score: number; riskLevel: string }> = ({ score, riskLevel }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreMessage = (score: number, riskLevel: string) => {
    if (score >= 80) return "You're doing great! Keep up the excellent work.";
    if (score >= 60) return "Good progress! A few small improvements could help.";
    if (score >= 40) return "You're on the right track. Let's work together to improve.";
    return "We're here to help you feel better. Let's take it one step at a time.";
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Your Health Score</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        <div className={`text-4xl font-bold mb-2 ${getScoreColor(score)}`}>
          {score}/100
        </div>
        <Badge
          variant={riskLevel === 'LOW' ? 'default' : riskLevel === 'MODERATE' ? 'secondary' : 'destructive'}
          className="mb-3"
        >
          {riskLevel === 'LOW' ? 'Good Health' :
           riskLevel === 'MODERATE' ? 'Watch & Improve' :
           riskLevel === 'HIGH' ? 'Needs Attention' : 'Please Contact Care Team'}
        </Badge>
        <p className="text-sm text-gray-600 max-w-xs mx-auto">
          {getScoreMessage(score, riskLevel)}
        </p>
      </CardContent>
    </Card>
  );
};

// Simplified Health Metrics Component
const HealthMetrics: React.FC<{ metrics: HealthMetric[] }> = ({ metrics }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return '✅';
      case 'warning': return '⚠️';
      case 'concerning': return '🔴';
      default: return '📊';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Health Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getStatusIcon(metric.status)}</span>
                <div>
                  <div className="font-medium">{metric.name}</div>
                  <div className="text-sm text-gray-600">{metric.value}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-1">
                  <span className="text-lg">{getTrendIcon(metric.trend)}</span>
                  <span className="text-xs text-gray-500 capitalize">{metric.trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Care Recommendations Component
const CareRecommendations: React.FC<{ recommendations: any[]; nextActions: string[] }> = ({
  recommendations,
  nextActions
}) => {
  const priorityRecommendations = recommendations
    .filter(rec => rec.priority === 'HIGH' || rec.priority === 'MEDIUM')
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Personalized Care Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextActions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">Next Steps for You:</h4>
            <ul className="space-y-1">
              {nextActions.slice(0, 3).map((action, index) => (
                <li key={index} className="text-sm text-blue-700 flex items-start">
                  <span className="mr-2">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {priorityRecommendations.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Recommended for You:</h4>
            <div className="space-y-3">
              {priorityRecommendations.map((rec, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-sm">{rec.category}</span>
                    <Badge variant={rec.priority === 'HIGH' ? 'destructive' : 'secondary'} className="text-xs">
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{rec.recommendation}</p>
                  {rec.estimatedImpact && (
                    <p className="text-xs text-green-600">Expected benefit: {rec.estimatedImpact}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Emergency Alerts Component
const EmergencyAlerts: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => (
        <Alert key={index} variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
          <AlertDescription>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{alert.message}</div>
                {alert.suggestedActions && alert.suggestedActions.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">What to do:</span>
                    <ul className="list-disc list-inside mt-1">
                      {alert.suggestedActions.slice(0, 2).map((action: string, i: number) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}>
                {alert.severity}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
};

// Encouragement and Progress Component
const EncouragementCard: React.FC<{
  encouragement: string;
  adherenceScore: number;
  lastCheckIn: string
}> = ({ encouragement, adherenceScore, lastCheckIn }) => {
  const getEncouragementEmoji = (score: number) => {
    if (score >= 80) return '🌟';
    if (score >= 60) return '💪';
    if (score >= 40) return '🎯';
    return '💙';
  };

  const getDaysAgo = (dateString: string) => {
    if (!dateString || dateString === 'Never') return 'Never';
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="text-3xl mb-3">{getEncouragementEmoji(adherenceScore)}</div>
          <p className="text-gray-700 mb-4">{encouragement}</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Check-in Streak:</span>
              <div className="text-lg font-bold text-green-600">{adherenceScore}%</div>
            </div>
            <div>
              <span className="font-medium">Last Check-in:</span>
              <div className="text-lg font-bold text-blue-600">{getDaysAgo(lastCheckIn)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Patient Dashboard Component
const FhirAiPatientDashboard: React.FC<PatientDashboardProps> = ({ supabaseUrl, supabaseKey }) => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PatientInsights | null>(null);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [fhirService] = useState(() => new EnhancedFhirService());

  // Load patient insights
  const loadPatientInsights = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Get enhanced patient data
      const enhancedData = await fhirService.exportEnhancedPatientData(user.id);
      const aiInsights = enhancedData.aiInsights;

      // Transform AI insights into patient-friendly format
      const patientInsights: PatientInsights = {
        overallHealthScore: aiInsights.overallHealthScore,
        riskLevel: aiInsights.riskAssessment.riskLevel,
        adherenceScore: aiInsights.adherenceScore,
        lastCheckIn: aiInsights.lastCheckIn,
        emergencyAlerts: aiInsights.emergencyAlerts,
        careRecommendations: aiInsights.careRecommendations,
        vitalsTrends: aiInsights.vitalsTrends,
        nextActions: enhancedData.recommendedActions || [],
        encouragement: generateEncouragement(aiInsights.overallHealthScore, aiInsights.adherenceScore)
      };

      // Transform vitals trends into health metrics
      const metrics: HealthMetric[] = aiInsights.vitalsTrends.map((trend: any) => ({
        name: getMetricDisplayName(trend.metric),
        value: `${trend.current} ${getMetricUnit(trend.metric)}`,
        status: trend.isAbnormal ? 'concerning' : 'good',
        trend: trend.trend.toLowerCase(),
        recommendation: trend.recommendation
      }));

      setInsights(patientInsights);
      setHealthMetrics(metrics);
      setLastUpdated(new Date());

    } catch (error) {
      console.error('Error loading patient insights:', error);
      setError('Unable to load your health insights. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, fhirService]);

  // Initialize and set up refresh
  useEffect(() => {
    loadPatientInsights();
    const interval = setInterval(loadPatientInsights, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [loadPatientInsights]);

  // Helper functions
  const generateEncouragement = (healthScore: number, adherenceScore: number): string => {
    if (healthScore >= 80 && adherenceScore >= 80) {
      return "You're doing an amazing job taking care of your health! Your consistency is inspiring.";
    }
    if (healthScore >= 60) {
      return "You're making great progress! Every small step counts toward better health.";
    }
    if (adherenceScore >= 60) {
      return "We love seeing your regular check-ins! Your commitment to your health shows.";
    }
    return "You're taking important steps for your health. We're here to support you every step of the way.";
  };

  const getMetricDisplayName = (metric: string): string => {
    const names: Record<string, string> = {
      'bp_systolic': 'Blood Pressure (Top)',
      'bp_diastolic': 'Blood Pressure (Bottom)',
      'heart_rate': 'Heart Rate',
      'glucose_mg_dl': 'Blood Sugar',
      'pulse_oximeter': 'Oxygen Level'
    };
    return names[metric] || metric;
  };

  const getMetricUnit = (metric: string): string => {
    const units: Record<string, string> = {
      'bp_systolic': 'mmHg',
      'bp_diastolic': 'mmHg',
      'heart_rate': 'bpm',
      'glucose_mg_dl': 'mg/dL',
      'pulse_oximeter': '%'
    };
    return units[metric] || '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading your health insights...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <div>{error}</div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={loadPatientInsights}
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-gray-500">
            <p>No health data available yet.</p>
            <p className="text-sm mt-2">Complete a health check-in to see your personalized insights!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Health Dashboard</h1>
        <p className="text-gray-600">
          Last updated: {lastUpdated?.toLocaleTimeString()}
        </p>
      </div>

      {/* Emergency Alerts */}
      {insights.emergencyAlerts.length > 0 && (
        <EmergencyAlerts alerts={insights.emergencyAlerts} />
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <HealthScoreDisplay
            score={insights.overallHealthScore}
            riskLevel={insights.riskLevel}
          />

          <EncouragementCard
            encouragement={insights.encouragement}
            adherenceScore={insights.adherenceScore}
            lastCheckIn={insights.lastCheckIn}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <HealthMetrics metrics={healthMetrics} />

          <CareRecommendations
            recommendations={insights.careRecommendations}
            nextActions={insights.nextActions}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center space-x-4 pt-6">
        <Button onClick={loadPatientInsights} variant="outline">
          Refresh Insights
        </Button>
        <Button onClick={() => window.location.href = '/daily-checkin'}>
          Complete Check-in
        </Button>
      </div>
    </div>
  );
};

export default FhirAiPatientDashboard;