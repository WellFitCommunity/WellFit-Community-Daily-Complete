// Questionnaire Analytics Dashboard - SMART Questionnaire Deployment & Analytics
// Dashboard for managing questionnaire deployments, tracking responses, and analyzing results
// Supports FHIR Questionnaire standard
// White-label ready - uses Envision Atlus design system

import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Users,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  CheckCircle as _CheckCircle,
  Clock,
  FileText,
  Send,
  Eye,
} from 'lucide-react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EAPageLayout,
  EATabs,
  EATabsList,
  EATabsTrigger,
  EATabsContent,
} from '../envision-atlus';

// Types for questionnaire system
interface QuestionnaireDeployment {
  id: string;
  questionnaire_id: string;
  questionnaire_name: string;
  target_population: string;
  deployment_type: 'scheduled' | 'triggered' | 'manual' | 'recurring';
  status: 'draft' | 'active' | 'paused' | 'completed';
  start_date: string;
  end_date?: string;
  target_count: number;
  completed_count: number;
  response_rate: number;
  created_at: string;
}

interface QuestionnaireResponse {
  id: string;
  questionnaire_id: string;
  questionnaire_name: string;
  respondent_id: string;
  respondent_name: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  completion_time_minutes?: number;
  score?: number;
  risk_flags?: string[];
  created_at: string;
  completed_at?: string;
}

interface QuestionnaireTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  question_count: number;
  estimated_minutes: number;
  times_used: number;
  last_used?: string;
}

interface DashboardMetrics {
  totalDeployments: number;
  activeDeployments: number;
  totalResponses: number;
  avgResponseRate: number;
  avgCompletionTime: number;
  riskFlagsToday: number;
}

export const QuestionnaireAnalyticsDashboard: React.FC = () => {
  const { supabase } = useSupabaseClient() as any;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [deployments, setDeployments] = useState<QuestionnaireDeployment[]>([]);
  const [recentResponses, setRecentResponses] = useState<QuestionnaireResponse[]>([]);
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('deployments');

  useEffect(() => {
    loadDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load questionnaire deployments
      const { data: deploymentsData, error: deploymentsError } = await supabase
        .from('questionnaire_deployments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!deploymentsError && deploymentsData) {
        setDeployments(deploymentsData);
      }

      // Load recent responses
      const { data: responsesData, error: responsesError } = await supabase
        .from('questionnaire_responses')
        .select(`
          *,
          profiles(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!responsesError && responsesData) {
        const formatted = responsesData.map((r: any) => ({
          ...r,
          respondent_name: r.profiles
            ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim()
            : 'Unknown',
        }));
        setRecentResponses(formatted);
      }

      // Load question templates
      const { data: templatesData, error: templatesError } = await supabase
        .from('question_templates')
        .select('*')
        .order('times_used', { ascending: false })
        .limit(20);

      if (!templatesError && templatesData) {
        setTemplates(templatesData.map((t: any) => ({
          id: t.id,
          name: t.question_text?.substring(0, 50) || 'Unnamed Template',
          description: t.category || '',
          category: t.category || 'General',
          question_count: 1,
          estimated_minutes: 2,
          times_used: t.times_used || 0,
          last_used: t.updated_at,
        })));
      }

      // Calculate metrics
      const activeDeployments = (deploymentsData || []).filter(
        (d: QuestionnaireDeployment) => d.status === 'active'
      );
      const totalResponses = (responsesData || []).length;
      const completedResponses = (responsesData || []).filter(
        (r: QuestionnaireResponse) => r.status === 'completed'
      );
      const avgCompletionTime = completedResponses.length > 0
        ? completedResponses.reduce(
            (sum: number, r: QuestionnaireResponse) => sum + (r.completion_time_minutes || 0),
            0
          ) / completedResponses.length
        : 0;
      const riskFlags = (responsesData || []).filter(
        (r: QuestionnaireResponse) => r.risk_flags && r.risk_flags.length > 0
      ).length;

      setMetrics({
        totalDeployments: (deploymentsData || []).length,
        activeDeployments: activeDeployments.length,
        totalResponses,
        avgResponseRate: activeDeployments.length > 0
          ? activeDeployments.reduce(
              (sum: number, d: QuestionnaireDeployment) => sum + (d.response_rate || 0),
              0
            ) / activeDeployments.length
          : 0,
        avgCompletionTime: Math.round(avgCompletionTime),
        riskFlagsToday: riskFlags,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string): 'normal' | 'elevated' | 'info' | 'neutral' => {
    switch (status) {
      case 'active': return 'normal';
      case 'completed': return 'info';
      case 'paused': return 'elevated';
      case 'draft': return 'neutral';
      default: return 'neutral';
    }
  };

  const getResponseStatusVariant = (status: string): 'normal' | 'elevated' | 'neutral' => {
    switch (status) {
      case 'completed': return 'normal';
      case 'in_progress': return 'elevated';
      case 'abandoned': return 'neutral';
      default: return 'neutral';
    }
  };

  if (loading && !metrics) {
    return (
      <EAPageLayout title="Questionnaire Analytics">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </EAPageLayout>
    );
  }

  if (error) {
    return (
      <EAPageLayout title="Questionnaire Analytics">
        <EAAlert variant="critical" dismissible={false}>
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <h3 className="text-lg font-bold mb-2">Failed to Load Dashboard</h3>
            <p className="mb-4">{error}</p>
            <EAButton onClick={loadDashboard} variant="primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </EAButton>
          </div>
        </EAAlert>
      </EAPageLayout>
    );
  }

  return (
    <EAPageLayout title="Questionnaire Analytics" subtitle="SMART Questionnaire Deployment & Response Tracking">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">Questionnaire Analytics</h1>
            <p className="text-slate-400">SMART Questionnaire Deployment & Response Tracking</p>
          </div>
          <div className="flex items-center space-x-3">
            <EAButton onClick={loadDashboard} variant="secondary" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </EAButton>
            <EAButton variant="primary" size="sm">
              <Send className="h-4 w-4 mr-2" />
              New Deployment
            </EAButton>
          </div>
        </div>

        {/* Key Metrics */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <EAMetricCard
              label="Total Deployments"
              value={metrics.totalDeployments}
              icon={<ClipboardList className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Active Deployments"
              value={metrics.activeDeployments}
              icon={<Send className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Total Responses"
              value={metrics.totalResponses}
              icon={<Users className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Avg Response Rate"
              value={`${metrics.avgResponseRate.toFixed(0)}%`}
              icon={<TrendingUp className="h-5 w-5" />}
              riskLevel={metrics.avgResponseRate < 50 ? 'elevated' : 'normal'}
            />
            <EAMetricCard
              label="Avg Time (min)"
              value={metrics.avgCompletionTime}
              icon={<Clock className="h-5 w-5" />}
            />
            <EAMetricCard
              label="Risk Flags"
              value={metrics.riskFlagsToday}
              icon={<AlertTriangle className="h-5 w-5" />}
              riskLevel={metrics.riskFlagsToday > 5 ? 'high' : 'normal'}
            />
          </div>
        )}

        {/* Tabs */}
        <EATabs defaultValue="deployments" value={activeTab} onValueChange={setActiveTab}>
          <EATabsList>
            <EATabsTrigger value="deployments">
              <Send className="h-4 w-4 mr-2" />
              Deployments
            </EATabsTrigger>
            <EATabsTrigger value="responses">
              <FileText className="h-4 w-4 mr-2" />
              Responses
            </EATabsTrigger>
            <EATabsTrigger value="templates">
              <ClipboardList className="h-4 w-4 mr-2" />
              Templates
            </EATabsTrigger>
            <EATabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </EATabsTrigger>
          </EATabsList>

          {/* Deployments Tab */}
          <EATabsContent value="deployments">
            <EACard>
              <EACardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Questionnaire Deployments</h2>
                  <EAButton variant="primary" size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    Create Deployment
                  </EAButton>
                </div>
              </EACardHeader>
              <EACardContent>
                {deployments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No deployments yet</p>
                    <p className="text-sm mt-1">Create a deployment to start collecting responses</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Questionnaire</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Target</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Progress</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Response Rate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700">
                        {deployments.map((deployment) => (
                          <tr key={deployment.id} className="hover:bg-slate-700/50">
                            <td className="px-4 py-3">
                              <div className="font-medium text-white">{deployment.questionnaire_name}</div>
                              <div className="text-xs text-slate-400">
                                Started: {new Date(deployment.start_date).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {deployment.deployment_type}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-300">
                              {deployment.target_population}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-20 h-2 bg-slate-600 rounded-full">
                                  <div
                                    className="h-full bg-teal-500 rounded-full"
                                    style={{
                                      width: `${(deployment.completed_count / deployment.target_count) * 100}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400">
                                  {deployment.completed_count}/{deployment.target_count}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-medium ${
                                deployment.response_rate >= 70 ? 'text-green-400' :
                                deployment.response_rate >= 40 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {deployment.response_rate}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <EABadge variant={getStatusBadgeVariant(deployment.status)} size="sm">
                                {deployment.status}
                              </EABadge>
                            </td>
                            <td className="px-4 py-3">
                              <EAButton size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </EAButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Responses Tab */}
          <EATabsContent value="responses">
            <EACard>
              <EACardHeader>
                <h2 className="text-lg font-semibold text-white">Recent Responses</h2>
              </EACardHeader>
              <EACardContent>
                {recentResponses.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No responses yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentResponses.map((response) => (
                      <div
                        key={response.id}
                        className="p-4 bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <h3 className="font-medium text-white">{response.respondent_name}</h3>
                              <EABadge variant={getResponseStatusVariant(response.status)} size="sm">
                                {response.status}
                              </EABadge>
                              {response.risk_flags && response.risk_flags.length > 0 && (
                                <EABadge variant="critical" size="sm">
                                  {response.risk_flags.length} flags
                                </EABadge>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {response.questionnaire_name}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-slate-500">
                              <span>
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {new Date(response.created_at).toLocaleDateString()}
                              </span>
                              {response.completion_time_minutes && (
                                <span>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {response.completion_time_minutes} min
                                </span>
                              )}
                              {response.score !== undefined && (
                                <span>Score: {response.score}</span>
                              )}
                            </div>
                          </div>
                          <EAButton size="sm" variant="secondary">
                            View Details
                          </EAButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Templates Tab */}
          <EATabsContent value="templates">
            <EACard>
              <EACardHeader>
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Questionnaire Templates</h2>
                  <EAButton variant="primary" size="sm">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Create Template
                  </EAButton>
                </div>
              </EACardHeader>
              <EACardContent>
                {templates.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No templates available</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="p-4 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        <h3 className="font-medium text-white">{template.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">{template.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-3 text-xs text-slate-500">
                            <span>{template.question_count} questions</span>
                            <span>{template.estimated_minutes} min</span>
                          </div>
                          <EABadge variant="neutral" size="sm">
                            Used {template.times_used}x
                          </EABadge>
                        </div>
                        <div className="flex space-x-2 mt-3">
                          <EAButton size="sm" variant="secondary" className="flex-1">
                            Preview
                          </EAButton>
                          <EAButton size="sm" variant="primary" className="flex-1">
                            Deploy
                          </EAButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </EATabsContent>

          {/* Analytics Tab */}
          <EATabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Response Trends
                  </h2>
                </EACardHeader>
                <EACardContent>
                  <div className="text-center py-12 text-slate-400">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Response trend chart would appear here</p>
                    <p className="text-sm mt-1">Showing daily/weekly response volumes</p>
                  </div>
                </EACardContent>
              </EACard>

              <EACard>
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white flex items-center">
                    <PieChart className="h-5 w-5 mr-2" />
                    Completion Rates by Category
                  </h2>
                </EACardHeader>
                <EACardContent>
                  <div className="text-center py-12 text-slate-400">
                    <PieChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Category breakdown chart would appear here</p>
                    <p className="text-sm mt-1">Comparing completion rates across questionnaire types</p>
                  </div>
                </EACardContent>
              </EACard>

              <EACard className="lg:col-span-2">
                <EACardHeader>
                  <h2 className="text-lg font-semibold text-white flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                    Risk Flag Summary
                  </h2>
                </EACardHeader>
                <EACardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Depression Screening', count: 3, color: 'text-red-400' },
                      { label: 'Anxiety Indicators', count: 5, color: 'text-orange-400' },
                      { label: 'SDOH Concerns', count: 8, color: 'text-yellow-400' },
                      { label: 'Fall Risk', count: 2, color: 'text-purple-400' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-700/50 rounded-lg text-center">
                        <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                        <div className="text-sm text-slate-400 mt-1">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </EACardContent>
              </EACard>
            </div>
          </EATabsContent>
        </EATabs>
      </div>
    </EAPageLayout>
  );
};

export default QuestionnaireAnalyticsDashboard;
