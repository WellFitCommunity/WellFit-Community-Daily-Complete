// AI-Enhanced FHIR Dashboard for WellFit Admin Panel
// Provides intelligent insights, real-time monitoring, and automated recommendations

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import EnhancedFhirService from './EnhancedFhirService';

interface DashboardProps {
  supabaseUrl: string;
  supabaseKey: string;
}

interface DashboardState {
  populationDashboard: any;
  qualityMetrics: any;
  enhancedPatients: any[];
  automatedReports: any;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface AlertConfig {
  enableRealTime: boolean;
  criticalThreshold: number;
  notificationMethods: string[];
}

// Quick Action Card Component
const QuickActionCard: React.FC<{
  title: string;
  description: string;
  action: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  onClick: () => void;
}> = ({ title, description, action, urgency, onClick }) => {
  const urgencyColors = {
    LOW: 'bg-blue-50 border-blue-200 text-blue-800',
    MEDIUM: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    HIGH: 'bg-orange-50 border-orange-200 text-orange-800',
    CRITICAL: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <Card className={`cursor-pointer transition-all hover:shadow-md ${urgencyColors[urgency]}`} onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Badge variant={urgency === 'CRITICAL' ? 'destructive' : 'secondary'}>
            {urgency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs mb-2">{description}</p>
        <Button size="sm" variant="outline" className="w-full">
          {action}
        </Button>
      </CardContent>
    </Card>
  );
};

// Risk Matrix Visualization
const RiskMatrix: React.FC<{ riskMatrix: any }> = ({ riskMatrix }) => {
  if (!riskMatrix) return <div>Loading risk matrix...</div>;

  const { quadrants } = riskMatrix;
  const total = Object.values(quadrants).reduce((sum: number, count: any) => sum + count, 0);

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-red-800">High Risk, Low Adherence</h4>
        <div className="text-2xl font-bold text-red-600">{quadrants.highRiskLowAdherence}</div>
        <div className="text-xs text-red-600">
          {total > 0 ? Math.round((quadrants.highRiskLowAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-yellow-800">High Risk, High Adherence</h4>
        <div className="text-2xl font-bold text-yellow-600">{quadrants.highRiskHighAdherence}</div>
        <div className="text-xs text-yellow-600">
          {total > 0 ? Math.round((quadrants.highRiskHighAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-orange-800">Low Risk, Low Adherence</h4>
        <div className="text-2xl font-bold text-orange-600">{quadrants.lowRiskLowAdherence}</div>
        <div className="text-xs text-orange-600">
          {total > 0 ? Math.round((quadrants.lowRiskLowAdherence / total) * 100) : 0}% of patients
        </div>
      </div>

      <div className="bg-green-100 border-2 border-green-300 rounded-lg p-4 text-center">
        <h4 className="font-semibold text-green-800">Low Risk, High Adherence</h4>
        <div className="text-2xl font-bold text-green-600">{quadrants.lowRiskHighAdherence}</div>
        <div className="text-xs text-green-600">
          {total > 0 ? Math.round((quadrants.lowRiskHighAdherence / total) * 100) : 0}% of patients
        </div>
      </div>
    </div>
  );
};

// Population Health Metrics Component
const PopulationMetrics: React.FC<{ overview: any }> = ({ overview }) => {
  if (!overview) return <div>Loading population metrics...</div>;

  const engagementRate = overview.totalPatients > 0 ?
    Math.round((overview.activePatients / overview.totalPatients) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Total Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overview.totalPatients}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Active Patients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{overview.activePatients}</div>
          <div className="text-xs text-gray-500">{engagementRate}% engagement</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">High Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{overview.highRiskPatients}</div>
          <div className="text-xs text-gray-500">
            {overview.totalPatients > 0 ? Math.round((overview.highRiskPatients / overview.totalPatients) * 100) : 0}% of total
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{overview.averageHealthScore}/100</div>
          <div className="text-xs text-gray-500">Population average</div>
        </CardContent>
      </Card>
    </div>
  );
};

// Predictive Alerts Component
const PredictiveAlerts: React.FC<{ alerts: any[] }> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            No predictive alerts at this time
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Predictive Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert, index) => (
          <Alert key={index} variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
            <AlertDescription>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{alert.message}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Probability: {alert.probabilityScore}% | Timeframe: {alert.timeframe}
                  </div>
                  {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-medium">Recommended Actions:</div>
                      <ul className="text-xs list-disc list-inside">
                        {alert.recommendedActions.slice(0, 2).map((action: string, i: number) => (
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
      </CardContent>
    </Card>
  );
};

// Patient List with AI Insights
const AIPatientList: React.FC<{
  patients: any[];
  onPatientSelect: (patientId: string) => void;
}> = ({ patients, onPatientSelect }) => {
  if (!patients || patients.length === 0) {
    return <div>Loading patient data...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>High-Priority Patients</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patients.slice(0, 10).map((patient, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              onClick={() => onPatientSelect(patient.patientId)}
            >
              <div className="flex-1">
                <div className="font-medium">{patient.patientName}</div>
                <div className="text-sm text-gray-600">
                  Health Score: {patient.overallHealthScore}/100 |
                  Adherence: {patient.adherenceScore}%
                </div>
                {patient.emergencyAlerts && patient.emergencyAlerts.length > 0 && (
                  <div className="text-xs text-red-600 mt-1">
                    {patient.emergencyAlerts.length} active alert(s)
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end space-y-1">
                <Badge
                  variant={
                    patient.riskAssessment?.riskLevel === 'CRITICAL' ? 'destructive' :
                    patient.riskAssessment?.riskLevel === 'HIGH' ? 'destructive' :
                    patient.riskAssessment?.riskLevel === 'MODERATE' ? 'secondary' : 'default'
                  }
                >
                  {patient.riskAssessment?.riskLevel || 'Unknown'}
                </Badge>
                <div className="text-xs text-gray-500">
                  Priority: {patient.riskAssessment?.priority || 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Quality Metrics Component
const QualityMetrics: React.FC<{ qualityMetrics: any }> = ({ qualityMetrics }) => {
  if (!qualityMetrics) return <div>Loading quality metrics...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>FHIR Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">
            {Math.round(qualityMetrics.fhirCompliance?.score || 0)}%
          </div>
          <div className="text-sm text-gray-600">
            {qualityMetrics.fhirCompliance?.issues?.length || 0} issues found
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Completeness:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.completeness || 0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Accuracy:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.accuracy || 0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Consistency:</span>
              <span className="font-medium">{Math.round(qualityMetrics.dataQuality?.consistency || 0)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clinical Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-2">
            {Math.round(qualityMetrics.clinicalQuality?.adherenceToGuidelines || 0)}%
          </div>
          <div className="text-sm text-gray-600">Guideline adherence</div>
          <div className="text-xs text-gray-500 mt-2">
            Readmission rate: {qualityMetrics.clinicalQuality?.outcomeMetrics?.readmissionRate || 0}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Dashboard Component
const FhirAiDashboard: React.FC<DashboardProps> = ({ supabaseUrl, supabaseKey }) => {
  const [state, setState] = useState<DashboardState>({
    populationDashboard: null,
    qualityMetrics: null,
    enhancedPatients: [],
    automatedReports: null,
    loading: true,
    error: null,
    lastUpdated: null
  });

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    enableRealTime: true,
    criticalThreshold: 80,
    notificationMethods: ['dashboard', 'email']
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(300000); // 5 minutes default
  const [fhirService] = useState(() => new EnhancedFhirService(supabaseUrl, supabaseKey));

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const [dashboard, quality, reports] = await Promise.all([
        fhirService.generatePopulationDashboard(),
        fhirService.assessQualityMetrics(),
        fhirService.generateAutomatedReports()
      ]);

      // Get enhanced data for high-priority patients
      const highPriorityPatients = dashboard.interventionQueue
        .filter((item: any) => item.priority >= 4)
        .slice(0, 10);

      const enhancedPatients = await Promise.all(
        highPriorityPatients.map(async (item: any) => {
          try {
            return await fhirService.exportEnhancedPatientData(item.patientId);
          } catch (error) {
            console.error(`Error loading enhanced data for patient ${item.patientId}:`, error);
            return null;
          }
        })
      );

      setState(prev => ({
        ...prev,
        populationDashboard: dashboard,
        qualityMetrics: quality,
        enhancedPatients: enhancedPatients.filter(p => p !== null),
        automatedReports: reports,
        loading: false,
        lastUpdated: new Date()
      }));

    } catch (error) {
      console.error('Dashboard data loading error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data'
      }));
    }
  }, [fhirService]);

  // Initialize dashboard and set up refresh interval
  useEffect(() => {
    loadDashboardData();

    const interval = setInterval(loadDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadDashboardData, refreshInterval]);

  // Start real-time monitoring
  useEffect(() => {
    if (alertConfig.enableRealTime) {
      fhirService.startRealTimeMonitoring();
    }
  }, [fhirService, alertConfig.enableRealTime]);

  // Handle patient selection
  const handlePatientSelect = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  // Handle quick actions
  const handleQuickAction = async (action: string, context?: any) => {
    try {
      switch (action) {
        case 'validate-data':
          await fhirService.validateAndCleanData();
          break;
        case 'generate-reports':
          await fhirService.generateAutomatedReports();
          break;
        case 'refresh-dashboard':
          await loadDashboardData();
          break;
        default:
          console.log(`Quick action: ${action}`, context);
      }
    } catch (error) {
      console.error(`Quick action error (${action}):`, error);
    }
  };

  // Generate quick actions based on current state
  const getQuickActions = () => {
    const actions = [];

    if (state.populationDashboard?.overview?.highRiskPatients > 10) {
      actions.push({
        title: 'High Risk Alert',
        description: `${state.populationDashboard.overview.highRiskPatients} patients need immediate attention`,
        action: 'Review High-Risk Patients',
        urgency: 'HIGH' as const,
        onClick: () => handleQuickAction('review-high-risk')
      });
    }

    if (state.qualityMetrics?.fhirCompliance?.score < 90) {
      actions.push({
        title: 'FHIR Compliance',
        description: 'Data quality issues detected',
        action: 'Validate & Clean Data',
        urgency: 'MEDIUM' as const,
        onClick: () => handleQuickAction('validate-data')
      });
    }

    if (state.populationDashboard?.predictiveAlerts?.some((alert: any) => alert.severity === 'CRITICAL')) {
      actions.push({
        title: 'Critical Predictions',
        description: 'AI has detected critical population trends',
        action: 'Review Predictions',
        urgency: 'CRITICAL' as const,
        onClick: () => handleQuickAction('review-predictions')
      });
    }

    actions.push({
      title: 'Generate Reports',
      description: 'Create latest analytical reports',
      action: 'Generate Reports',
      urgency: 'LOW' as const,
      onClick: () => handleQuickAction('generate-reports')
    });

    return actions;
  };

  if (state.loading && !state.populationDashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading AI-enhanced FHIR dashboard...</div>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <div>Error loading dashboard: {state.error}</div>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={loadDashboardData}
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI-Enhanced FHIR Dashboard</h1>
          <p className="text-gray-600">
            Last updated: {state.lastUpdated?.toLocaleTimeString()} |
            Refresh every {refreshInterval / 60000} minutes
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshInterval(prev => prev === 60000 ? 300000 : 60000)}
          >
            {refreshInterval === 60000 ? 'Normal Refresh' : 'Fast Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={state.loading}
          >
            {state.loading ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {getQuickActions().map((action, index) => (
          <QuickActionCard key={index} {...action} />
        ))}
      </div>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <PopulationMetrics overview={state.populationDashboard?.overview} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Population Risk Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskMatrix riskMatrix={state.populationDashboard?.riskMatrix} />
              </CardContent>
            </Card>

            <PredictiveAlerts alerts={state.populationDashboard?.predictiveAlerts} />
          </div>
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <AIPatientList
            patients={state.enhancedPatients.map(p => p.aiInsights)}
            onPatientSelect={handlePatientSelect}
          />

          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Patient Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-600">
                  Selected Patient ID: {selectedPatient}
                </div>
                {/* Add detailed patient view here */}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trending Concerns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.populationDashboard?.overview?.trendingConcerns?.map((concern: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span>{concern}</span>
                    <Badge variant="secondary">Trending</Badge>
                  </div>
                )) || <div className="text-gray-500">No trending concerns</div>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {state.populationDashboard?.resourceAllocation?.map((rec: any, index: number) => (
                  <div key={index} className="border rounded p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{rec.recommendation}</h4>
                      <Badge variant="outline">Priority {rec.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rec.justification}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                      <div>Cost: {rec.estimatedCost}</div>
                      <div>ROI: {rec.expectedRoi}</div>
                    </div>
                  </div>
                )) || <div className="text-gray-500">No recommendations available</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          <QualityMetrics qualityMetrics={state.qualityMetrics} />

          {state.qualityMetrics?.dataQuality?.issues && (
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {state.qualityMetrics.dataQuality.issues.map((issue: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{issue.type}</div>
                        <div className="text-sm text-gray-600">{issue.description}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant={issue.severity === 'HIGH' ? 'destructive' : 'secondary'}>
                          {issue.severity}
                        </Badge>
                        <div className="text-xs text-gray-500">{issue.count} occurrences</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Report</CardTitle>
              </CardHeader>
              <CardContent>
                {state.automatedReports?.weeklyReport ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>Total Patients: {state.automatedReports.weeklyReport.summary?.totalPatients}</div>
                      <div>Active: {state.automatedReports.weeklyReport.summary?.activePatients}</div>
                      <div>High Risk: {state.automatedReports.weeklyReport.summary?.highRiskPatients}</div>
                      <div>Alerts: {state.automatedReports.weeklyReport.summary?.newEmergencyAlerts}</div>
                    </div>
                    <div>
                      <h5 className="font-medium mb-2">Key Insights:</h5>
                      <ul className="text-sm list-disc list-inside space-y-1">
                        {state.automatedReports.weeklyReport.keyInsights?.map((insight: string, index: number) => (
                          <li key={index}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No weekly report available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emergency Report</CardTitle>
              </CardHeader>
              <CardContent>
                {state.automatedReports?.emergencyReport ? (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">
                        {state.automatedReports.emergencyReport.alertCount}
                      </div>
                      <div className="text-sm text-gray-600">Critical alerts</div>
                    </div>
                    {state.automatedReports.emergencyReport.escalationRequired && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          Immediate escalation required for critical alerts
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">No emergency alerts</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FhirAiDashboard;