/**
 * AIModelCardsDashboard - DSI Transparency and AI Model Card Management
 *
 * Purpose: HTI-1 compliant dashboard for viewing and managing AI model cards,
 *          registry entries, and transparency documentation for all AI/ML models
 * Used by: Admin Panel (sectionDefinitions), route /admin/model-cards
 *
 * Data sources:
 * - ai_model_registry table (model metadata)
 * - ai_model_cards table (detailed 31-attribute HTI-1 model cards)
 * - ai_skills table (skill registry)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';
import {
  EACard,
  EACardHeader,
  EACardContent,
  EAButton,
  EABadge,
  EAMetricCard,
  EAAlert,
  EATabs,
  EATabsList,
  EATabsTrigger,
} from '../envision-atlus';
import { auditLogger } from '../../services/auditLogger';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModelRegistryEntry {
  id: string;
  model_key: string;
  model_name: string;
  model_version: string;
  model_type: string;
  intervention_type: string | null;
  provider_name: string;
  provider_model_id: string | null;
  purpose: string;
  intended_use: string;
  clinical_domain: string | null;
  risk_level: string;
  is_fda_cleared: boolean;
  is_active: boolean;
  deployment_date: string | null;
  explainability_method: string | null;
  accuracy_metrics: Record<string, unknown> | null;
  known_limitations: string[] | null;
  created_at: string;
}

interface AISkillEntry {
  id: string;
  skill_key: string;
  skill_number: number | null;
  description: string;
  model: string | null;
  is_active: boolean;
  created_at: string;
}

interface ModelCard {
  id: string;
  model_id: string;
  model_details: Record<string, unknown>;
  intended_use: Record<string, unknown>;
  metrics: Record<string, unknown>;
  ethical_considerations: Record<string, unknown>;
  caveats_recommendations: Record<string, unknown>;
}

interface RegistryMetrics {
  totalModels: number;
  activeModels: number;
  highRisk: number;
  withModelCards: number;
  totalSkills: number;
}

type TabId = 'registry' | 'skills' | 'model-cards';

// ─── Component ────────────────────────────────────────────────────────────────

const AIModelCardsDashboard: React.FC = () => {
  const supabase = useSupabaseClient();
  const [activeTab, setActiveTab] = useState<TabId>('registry');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registryEntries, setRegistryEntries] = useState<ModelRegistryEntry[]>([]);
  const [skills, setSkills] = useState<AISkillEntry[]>([]);
  const [modelCards, setModelCards] = useState<ModelCard[]>([]);
  const [metrics, setMetrics] = useState<RegistryMetrics>({
    totalModels: 0,
    activeModels: 0,
    highRisk: 0,
    withModelCards: 0,
    totalSkills: 0,
  });
  const [selectedModel, setSelectedModel] = useState<ModelRegistryEntry | null>(null);

  const loadData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch model registry
      const { data: regData, error: regError } = await supabase
        .from('ai_model_registry')
        .select('id, model_key, model_name, model_version, model_type, intervention_type, provider_name, provider_model_id, purpose, intended_use, clinical_domain, risk_level, is_fda_cleared, is_active, deployment_date, explainability_method, accuracy_metrics, known_limitations, created_at')
        .order('model_name', { ascending: true });

      if (regError) throw regError;
      const allModels = (regData || []) as ModelRegistryEntry[];
      setRegistryEntries(allModels);

      // Fetch AI skills
      const { data: skillData, error: skillError } = await supabase
        .from('ai_skills')
        .select('id, skill_key, skill_number, description, model, is_active, created_at')
        .order('skill_number', { ascending: true });

      if (skillError) throw skillError;
      const allSkills = (skillData || []) as AISkillEntry[];
      setSkills(allSkills);

      // Fetch model cards
      const { data: cardData, error: cardError } = await supabase
        .from('ai_model_cards')
        .select('id, model_id, model_details, intended_use, metrics, ethical_considerations, caveats_recommendations');

      if (cardError) throw cardError;
      const allCards = (cardData || []) as ModelCard[];
      setModelCards(allCards);

      // Compute metrics
      const active = allModels.filter(m => m.is_active);
      const highRisk = allModels.filter(m => m.risk_level === 'high');
      const modelIdsWithCards = new Set(allCards.map(c => c.model_id));

      setMetrics({
        totalModels: allModels.length,
        activeModels: active.length,
        highRisk: highRisk.length,
        withModelCards: modelIdsWithCards.size,
        totalSkills: allSkills.length,
      });

      await auditLogger.info('AI_MODEL_CARDS_DASHBOARD_LOADED', {
        modelCount: allModels.length,
        skillCount: allSkills.length,
        cardCount: allCards.length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load model data';
      setError(message);
      await auditLogger.error(
        'AI_MODEL_CARDS_DASHBOARD_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { context: 'loadData' }
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high':
        return <EABadge variant="critical">High Risk</EABadge>;
      case 'moderate':
        return <EABadge variant="elevated">Moderate</EABadge>;
      default:
        return <EABadge variant="normal">Low Risk</EABadge>;
    }
  };

  const getModelTypeBadge = (modelType: string) => {
    const colors: Record<string, 'info' | 'neutral' | 'elevated' | 'high'> = {
      predictive: 'info',
      classification: 'neutral',
      generation: 'elevated',
      extraction: 'high',
      scoring: 'info',
    };
    return <EABadge variant={colors[modelType] || 'neutral'}>{modelType}</EABadge>;
  };

  const hasModelCard = (modelId: string) => {
    return modelCards.some(c => c.model_id === modelId);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <span className="ml-3 text-gray-600 text-lg">Loading AI model registry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">DSI Transparency — AI Model Cards</h2>
          <p className="text-gray-600 mt-1">
            HTI-1 compliant AI/ML model documentation, risk classification, and transparency
          </p>
        </div>
        <EAButton onClick={loadData} variant="secondary" size="sm">
          Refresh
        </EAButton>
      </div>

      {error && (
        <EAAlert variant="warning">
          <p>{error}</p>
        </EAAlert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <EAMetricCard
          label="Registered Models"
          value={metrics.totalModels}
          sublabel="In AI model registry"
        />
        <EAMetricCard
          label="Active"
          value={metrics.activeModels}
          sublabel="Currently deployed"
        />
        <EAMetricCard
          label="High Risk"
          value={metrics.highRisk}
          sublabel="Require extra oversight"
          riskLevel={metrics.highRisk > 0 ? 'critical' : 'normal'}
        />
        <EAMetricCard
          label="Model Cards"
          value={`${metrics.withModelCards}/${metrics.totalModels}`}
          sublabel="HTI-1 documented"
        />
        <EAMetricCard
          label="AI Skills"
          value={metrics.totalSkills}
          sublabel="Registered skill functions"
        />
      </div>

      {/* HTI-1 compliance alert */}
      {metrics.totalModels > 0 && metrics.withModelCards < metrics.totalModels && (
        <EAAlert variant="warning">
          <p>
            <strong>HTI-1 Compliance Gap:</strong> {metrics.totalModels - metrics.withModelCards} models
            are missing detailed model cards. ONC HTI-1 requires 31-attribute documentation for all
            Decision Support Interventions.
          </p>
        </EAAlert>
      )}

      {/* Tabs */}
      <EATabs defaultValue="registry" value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <EATabsList>
          <EATabsTrigger value="registry">
            Model Registry ({registryEntries.length})
          </EATabsTrigger>
          <EATabsTrigger value="skills">
            AI Skills ({skills.length})
          </EATabsTrigger>
          <EATabsTrigger value="model-cards">
            Model Cards ({modelCards.length})
          </EATabsTrigger>
        </EATabsList>
      </EATabs>

      {/* Registry Tab */}
      {activeTab === 'registry' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">AI Model Registry</h3>
              </EACardHeader>
              <EACardContent>
                {registryEntries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No models registered. Run the DSI transparency migration to seed from ai_skills.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {registryEntries.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model)}
                        className={`w-full text-left p-4 rounded-lg border transition-colors ${
                          selectedModel?.id === model.id
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{model.model_name}</span>
                          <div className="flex items-center gap-2">
                            {model.is_active ? (
                              <EABadge variant="normal">Active</EABadge>
                            ) : (
                              <EABadge variant="neutral">Inactive</EABadge>
                            )}
                            {getRiskBadge(model.risk_level)}
                            {hasModelCard(model.id) ? (
                              <EABadge variant="info">Card</EABadge>
                            ) : (
                              <EABadge variant="critical">No Card</EABadge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          {getModelTypeBadge(model.model_type)}
                          <span>{model.provider_name}</span>
                          <span>v{model.model_version}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </EACardContent>
            </EACard>
          </div>

          {/* Model Detail Panel */}
          <div>
            <EACard>
              <EACardHeader>
                <h3 className="text-lg font-semibold">Model Detail</h3>
              </EACardHeader>
              <EACardContent>
                {selectedModel ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{selectedModel.model_name}</h4>
                      <p className="text-gray-500">{selectedModel.model_key} — v{selectedModel.model_version}</p>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Purpose:</span>
                        <p className="text-gray-600">{selectedModel.purpose}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Intended Use:</span>
                        <p className="text-gray-600">{selectedModel.intended_use}</p>
                      </div>
                      {selectedModel.clinical_domain && (
                        <div>
                          <span className="font-medium text-gray-700">Clinical Domain:</span>
                          <p className="text-gray-600">{selectedModel.clinical_domain}</p>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Provider:</span>
                        <span className="font-medium">{selectedModel.provider_name}</span>
                      </div>
                      {selectedModel.provider_model_id && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">Model ID:</span>
                          <span className="font-mono text-xs">{selectedModel.provider_model_id}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-700">Risk Level:</span>
                        {getRiskBadge(selectedModel.risk_level)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">FDA Cleared:</span>
                        <span>{selectedModel.is_fda_cleared ? 'Yes' : 'No'}</span>
                      </div>
                      {selectedModel.explainability_method && (
                        <div className="flex justify-between">
                          <span className="text-gray-700">Explainability:</span>
                          <span>{selectedModel.explainability_method}</span>
                        </div>
                      )}
                    </div>

                    {selectedModel.known_limitations && selectedModel.known_limitations.length > 0 && (
                      <div className="border-t pt-3">
                        <span className="font-medium text-gray-700">Known Limitations:</span>
                        <ul className="mt-1 list-disc list-inside text-gray-600 space-y-1">
                          {selectedModel.known_limitations.map((lim, i) => (
                            <li key={i}>{lim}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedModel.deployment_date && (
                      <div className="border-t pt-3 text-gray-500">
                        Deployed: {new Date(selectedModel.deployment_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Select a model to view details
                  </p>
                )}
              </EACardContent>
            </EACard>
          </div>
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">AI Skill Registry</h3>
          </EACardHeader>
          <EACardContent>
            {skills.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No AI skills registered.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Skill Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {skills.map((skill) => (
                      <tr key={skill.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {skill.skill_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {skill.skill_key}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {skill.description}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {skill.model || 'Default'}
                        </td>
                        <td className="px-4 py-3">
                          {skill.is_active ? (
                            <EABadge variant="normal">Active</EABadge>
                          ) : (
                            <EABadge variant="neutral">Disabled</EABadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </EACardContent>
        </EACard>
      )}

      {/* Model Cards Tab */}
      {activeTab === 'model-cards' && (
        <EACard>
          <EACardHeader>
            <h3 className="text-lg font-semibold">HTI-1 Model Cards (31-Attribute)</h3>
          </EACardHeader>
          <EACardContent>
            {modelCards.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No detailed model cards created yet. HTI-1 requires 31-attribute documentation
                  for all Decision Support Interventions used in clinical settings.
                </p>
                <p className="text-sm text-gray-400">
                  Model cards cover: model details, intended use, factors, metrics, evaluation data,
                  training data, quantitative analyses, ethical considerations, and caveats.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {modelCards.map((card) => {
                  const model = registryEntries.find(m => m.id === card.model_id);
                  return (
                    <div key={card.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">
                          {model?.model_name || 'Unknown Model'}
                        </h4>
                        <EABadge variant="info">HTI-1 Documented</EABadge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Sections Completed:</span>
                          <div className="font-medium">
                            {[
                              card.model_details,
                              card.intended_use,
                              card.metrics,
                              card.ethical_considerations,
                              card.caveats_recommendations,
                            ].filter(s => s && Object.keys(s).length > 0).length}/9
                          </div>
                        </div>
                        {model && (
                          <>
                            <div>
                              <span className="text-gray-500">Risk Level:</span>
                              <div>{getRiskBadge(model.risk_level)}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Type:</span>
                              <div>{getModelTypeBadge(model.model_type)}</div>
                            </div>
                            <div>
                              <span className="text-gray-500">Provider:</span>
                              <div className="font-medium">{model.provider_name}</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </EACardContent>
        </EACard>
      )}
    </div>
  );
};

export default AIModelCardsDashboard;
