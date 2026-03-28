// Main Dashboard Component for AI-Enhanced FHIR Dashboard
// Orchestrates tabs, state management, and data loading

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '../../ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import EnhancedFhirService from '../EnhancedFhirService';
import RiskAssessmentManager from '../RiskAssessmentManager';
import SmartLauncher from '../../smart/SmartLauncher';
import SmartSessionStatus from '../../smart/SmartSessionStatus';
import QuickActionCard from './QuickActionCard';
import RiskMatrix from './RiskMatrix';
import PopulationMetrics from './PopulationMetrics';
import PredictiveAlerts from './PredictiveAlerts';
import AIPatientList from './AIPatientList';
import QualityMetrics from './QualityMetrics';
import type {
  DashboardProps,
  DashboardState,
  AlertConfig,
  QuickActionContext,
  InterventionQueueItem,
  PredictiveAlert,
  ResourceAllocationItem,
  DataQualityIssue,
} from './FhirAiDashboard.types';

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
  const [fhirService] = useState(() => new EnhancedFhirService());

  // Track active EHR connections
  const [activeEhrConnections, setActiveEhrConnections] = useState<string[]>([]);

  // Store Supabase connection info for direct FHIR sync
  const [_connectionConfig] = useState({
    supabaseUrl: supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
    supabaseKey: supabaseKey || import.meta.env.VITE_SB_PUBLISHABLE_API_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
    isConfigured: Boolean(supabaseUrl || import.meta.env.VITE_SUPABASE_URL)
  });

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
        .filter((item: InterventionQueueItem) => item.priority >= 4)
        .slice(0, 10);

      const enhancedPatients = await Promise.all(
        highPriorityPatients.map(async (item: InterventionQueueItem) => {
          try {
            return await fhirService.exportEnhancedPatientData(item.patientId);
          } catch {
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

    } catch (error: unknown) {

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

  // Handle quick actions with optional context
  const handleQuickAction = async (action: string, context?: QuickActionContext) => {
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
        case 'review-high-risk':
          // Navigate to high-risk patients view with context
          if (context?.patientId) {
            setSelectedPatient(context.patientId);
          }
          break;
        case 'sync-ehr':
          // Sync with specific EHR using context
          if (context?.ehrSystem && activeEhrConnections.includes(context.ehrSystem)) {
            // Would trigger EHR-specific sync
          }
          break;
        default:
          // Unknown action - log for debugging
          break;
      }

      // Track action completion
      setState(prev => ({
        ...prev,
        lastUpdated: new Date()
      }));
    } catch {
      // Error handling without console - would use audit logger in production
    }
  };

  // Generate quick actions based on current state
  const getQuickActions = () => {
    const actions = [];

    const highRiskCount = state.populationDashboard?.overview?.highRiskPatients ?? 0;
    if (highRiskCount > 10) {
      actions.push({
        title: 'High Risk Alert',
        description: `${highRiskCount} patients need immediate attention`,
        action: 'Review High-Risk Patients',
        urgency: 'HIGH' as const,
        onClick: () => handleQuickAction('review-high-risk')
      });
    }

    const fhirScore = state.qualityMetrics?.fhirCompliance?.score ?? 100;
    if (fhirScore < 90) {
      actions.push({
        title: 'FHIR Compliance',
        description: 'Data quality issues detected',
        action: 'Validate & Clean Data',
        urgency: 'MEDIUM' as const,
        onClick: () => handleQuickAction('validate-data')
      });
    }

    if (state.populationDashboard?.predictiveAlerts?.some((alert: PredictiveAlert) => alert.severity === 'CRITICAL')) {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--ea-primary)] mx-auto mb-4"></div>
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
    <div className="space-y-6" aria-label="AI-Enhanced FHIR Dashboard" aria-live="polite">
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="risk-assessment">Risk Assessment</TabsTrigger>
          <TabsTrigger value="smart-ehr">Smart-EHR Connect</TabsTrigger>
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

          {/* Alert Configuration */}
          <Card className="bg-linear-to-br from-purple-50 to-blue-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">🔔</span>
                Alert Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                <div>
                  <h4 className="font-semibold text-gray-900">Real-Time Monitoring</h4>
                  <p className="text-sm text-gray-600">Enable continuous monitoring and instant alerts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertConfig.enableRealTime}
                    onChange={(e) => setAlertConfig(prev => ({ ...prev, enableRealTime: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-hidden peer-focus:ring-4 peer-focus:ring-[var(--ea-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--ea-primary)]"></div>
                </label>
              </div>

              <div className="p-4 bg-white rounded-lg border space-y-3">
                <label className="block">
                  <span className="font-semibold text-gray-900 block mb-2">Critical Threshold</span>
                  <p className="text-sm text-gray-600 mb-3">
                    Alert when risk score reaches this threshold (0-100)
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={alertConfig.criticalThreshold}
                    onChange={(e) => setAlertConfig(prev => ({ ...prev, criticalThreshold: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-500">Low (0)</span>
                    <span className="text-2xl font-bold text-blue-600">{alertConfig.criticalThreshold}</span>
                    <span className="text-sm text-gray-500">Critical (100)</span>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-white rounded-lg border space-y-3">
                <h4 className="font-semibold text-gray-900">Notification Methods</h4>
                <div className="space-y-2">
                  {[
                    { value: 'dashboard', label: 'In-Dashboard Notifications', icon: '📊' },
                    { value: 'email', label: 'Email Alerts', icon: '📧' },
                    { value: 'sms', label: 'SMS Notifications', icon: '📱' },
                    { value: 'webhook', label: 'Webhook Integration', icon: '🔗' }
                  ].map(method => (
                    <label key={method.value} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={alertConfig.notificationMethods.includes(method.value)}
                        onChange={(e) => {
                          const methods = e.target.checked
                            ? [...alertConfig.notificationMethods, method.value]
                            : alertConfig.notificationMethods.filter(m => m !== method.value);
                          setAlertConfig(prev => ({ ...prev, notificationMethods: methods }));
                        }}
                        className="w-4 h-4 text-[var(--ea-primary)] border-gray-300 rounded-sm focus-visible:ring-[var(--ea-primary)]"
                      />
                      <span className="text-lg">{method.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{method.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${alertConfig.enableRealTime ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                  <span className="text-sm font-medium text-gray-700">
                    Status: {alertConfig.enableRealTime ? 'Active Monitoring' : 'Inactive'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {alertConfig.notificationMethods.length} method{alertConfig.notificationMethods.length !== 1 ? 's' : ''} enabled
                </span>
              </div>
            </CardContent>
          </Card>
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

        <TabsContent value="risk-assessment" className="space-y-6">
          <RiskAssessmentManager />
        </TabsContent>

        <TabsContent value="smart-ehr" className="space-y-6">
           <Card>
            <CardHeader>
               <CardTitle>🏥 SMART on FHIR Integration</CardTitle>
               <p className="text-gray-600">
                 Connect WellFit to hospital EHR systems using SMART on FHIR standards
               </p>
            </CardHeader>
            <CardContent>
              <SmartLauncher
                onLaunch={(ehrSystem) => {
                  // Track new EHR connection
                  if (ehrSystem && !activeEhrConnections.includes(ehrSystem)) {
                    setActiveEhrConnections(prev => [...prev, ehrSystem]);
                  }
                  // Trigger sync action with EHR context
                  handleQuickAction('sync-ehr', { ehrSystem, source: 'smart-launcher' });
                }}
              />
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Current EHR Connections</CardTitle>
           </CardHeader>
           <CardContent>
             <SmartSessionStatus />
           </CardContent>
         </Card>
      </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Trending Concerns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {state.populationDashboard?.overview?.trendingConcerns?.map((concern: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded-sm">
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
                {state.populationDashboard?.resourceAllocation?.map((rec: ResourceAllocationItem, index: number) => (
                  <div key={index} className="border rounded-sm p-4">
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
                  {state.qualityMetrics.dataQuality.issues.map((issue: DataQualityIssue, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-sm">
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
