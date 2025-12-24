import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { FHIRQuestionnaireService, FHIRQuestion, FHIRQuestionnaire, FHIRQuestionnaireRecord, QuestionnaireTemplate } from '../../services/fhirQuestionnaireService';

const FHIRFormBuilderEnhanced: React.FC = () => {
  const supabase = useSupabaseClient();
  const fhirService = new FHIRQuestionnaireService(supabase);

  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [generatedQuestionnaire, setGeneratedQuestionnaire] = useState<FHIRQuestionnaire | null>(null);
  const [savedQuestionnaire, setSavedQuestionnaire] = useState<FHIRQuestionnaireRecord | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'form' | 'json' | 'preview'>('form');
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [myQuestionnaires, setMyQuestionnaires] = useState<FHIRQuestionnaireRecord[]>([]);
  const [viewMode, setViewMode] = useState<'builder' | 'library'>('builder');

  const loadTemplates = async () => {
    try {
      const templateData = await fhirService.getTemplates();
      setTemplates(templateData);
    } catch (error) {

    }
  };

  const loadMyQuestionnaires = async () => {
    try {
      const questionnaires = await fhirService.getQuestionnaires();
      setMyQuestionnaires(questionnaires);
    } catch (error) {

    }
  };

  // Load templates and questionnaires on component mount
  useEffect(() => {
    loadTemplates();
    loadMyQuestionnaires();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateForm = async (prompt: string = naturalLanguageInput, templateName?: string) => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const questionnaire = await fhirService.generateQuestionnaire(prompt, templateName);
      setGeneratedQuestionnaire(questionnaire);
      setSavedQuestionnaire(null); // Reset saved state for new generation

      // If generated from template, increment usage count
      if (templateName) {
        const template = templates.find(t => t.name === templateName);
        if (template) {
          await fhirService.incrementTemplateUsage(template.id);
        }
      }
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Failed to generate form');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveQuestionnaire = async () => {
    if (!generatedQuestionnaire) return;

    setIsSaving(true);
    setError(null);

    try {
      const saved = await fhirService.saveQuestionnaire(generatedQuestionnaire, {
        naturalLanguagePrompt: naturalLanguageInput,
        tags: ['ai-generated']
      });

      setSavedQuestionnaire(saved);
      setSuccess('Questionnaire saved successfully!');
      await loadMyQuestionnaires(); // Refresh the list
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Failed to save questionnaire');
    } finally {
      setIsSaving(false);
    }
  };

  const deployToWellFit = async () => {
    if (!savedQuestionnaire) return;

    setIsDeploying(true);
    setError(null);

    try {
      await fhirService.deployToWellFit(savedQuestionnaire.id);
      setSuccess('Questionnaire deployed to WellFit successfully!');
      await loadMyQuestionnaires(); // Refresh to show deployment status
    } catch (error) {

      setError(error instanceof Error ? error.message : 'Failed to deploy questionnaire');
    } finally {
      setIsDeploying(false);
    }
  };

  const loadTemplate = async (template: QuestionnaireTemplate) => {
    setNaturalLanguageInput(template.ai_prompt);
    await generateForm(template.ai_prompt, template.name);
  };

  const downloadQuestionnaire = () => {
    if (!generatedQuestionnaire) return;

    const dataStr = JSON.stringify(generatedQuestionnaire, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `${generatedQuestionnaire.id}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'MENTAL_HEALTH': 'bg-purple-100 text-purple-800',
      'PHYSICAL_HEALTH': 'bg-blue-100 text-blue-800',
      'FUNCTIONAL_ASSESSMENT': 'bg-green-100 text-green-800',
      'PAIN_ASSESSMENT': 'bg-red-100 text-red-800',
      'MEDICATION_ADHERENCE': 'bg-orange-100 text-orange-800',
      'QUALITY_OF_LIFE': 'bg-indigo-100 text-indigo-800',
      'SCREENING': 'bg-yellow-100 text-yellow-800',
      'CUSTOM': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const renderQuestionPreview = (question: FHIRQuestion) => {
    return (
      <div key={question.linkId} className="border rounded-lg p-4 mb-4 bg-gray-50">
        <div className="flex items-start justify-between mb-2">
          <label className="font-medium text-gray-900">
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-sm">
            {question.type}
          </span>
        </div>

        {question.type === 'string' && (
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded-sm"
            placeholder="Text input"
            disabled
          />
        )}

        {question.type === 'integer' && (
          <input
            type="number"
            className="w-full p-2 border border-gray-300 rounded-sm"
            placeholder="Number input"
            disabled
          />
        )}

        {question.type === 'boolean' && (
          <div className="space-x-4">
            <label className="inline-flex items-center">
              <input type="radio" name={question.linkId} disabled />
              <span className="ml-2">Yes</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name={question.linkId} disabled />
              <span className="ml-2">No</span>
            </label>
          </div>
        )}

        {question.type === 'choice' && question.options && (
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <label key={idx} className="flex items-center">
                <input type="radio" name={question.linkId} disabled />
                <span className="ml-2">{option.display}</span>
                {option.code && (
                  <span className="ml-2 text-xs text-gray-500">({option.code})</span>
                )}
              </label>
            ))}
          </div>
        )}

        {question.type === 'date' && (
          <input
            type="date"
            className="p-2 border border-gray-300 rounded-sm"
            disabled
          />
        )}

        {question.enableWhen && (
          <div className="mt-2 text-xs text-blue-600">
            Conditional: Shown when {question.enableWhen.map(c =>
              `${c.question} ${c.operator} "${c.answerString}"`
            ).join(' and ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setViewMode('builder')}
          className={`px-4 py-2 font-medium text-sm border-b-2 ${
            viewMode === 'builder'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          🧠 AI Form Builder
        </button>
        <button
          onClick={() => setViewMode('library')}
          className={`px-4 py-2 font-medium text-sm border-b-2 ${
            viewMode === 'library'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📚 My Questionnaires ({myQuestionnaires.length})
        </button>
      </div>

      {viewMode === 'builder' && (
        <Card>
          <CardHeader>
            <CardTitle>🧠 AI-Powered FHIR Questionnaire Builder</CardTitle>
            <p className="text-gray-600">
              Describe your clinical form in natural language and AI will generate a FHIR-compliant questionnaire
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Quick Start */}
            <div>
              <h3 className="font-medium mb-2">Quick Start Templates:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => loadTemplate(template)}
                    className="text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    disabled={isGenerating}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-blue-600">{template.name}</div>
                      <Badge className={getCategoryColor(template.category)}>
                        {template.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">{template.description}</div>
                    <div className="flex items-center text-xs text-gray-400 space-x-3">
                      <span>⏱️ ~{template.estimated_time_minutes}min</span>
                      <span>📝 {template.estimated_questions} questions</span>
                      <span>🔄 Used {template.usage_count} times</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Form Input */}
            <div>
              <label className="block font-medium mb-2">Or describe your custom form:</label>
              <textarea
                value={naturalLanguageInput}
                onChange={(e) => setNaturalLanguageInput(e.target.value)}
                placeholder="Example: Create a pain assessment form with questions about pain location, intensity (0-10 scale), quality (sharp, dull, burning), triggers, and current treatments. Include conditional questions for patients rating pain above 7."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-none"
                disabled={isGenerating}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => generateForm()}
                disabled={isGenerating || !naturalLanguageInput.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? 'Generating...' : '🚀 Generate FHIR Form'}
              </Button>

              {generatedQuestionnaire && (
                <>
                  <Button
                    onClick={saveQuestionnaire}
                    disabled={isSaving || !!savedQuestionnaire}
                    variant="outline"
                  >
                    {isSaving ? 'Saving...' : savedQuestionnaire ? '✅ Saved' : '💾 Save to Database'}
                  </Button>

                  <Button
                    onClick={downloadQuestionnaire}
                    variant="outline"
                  >
                    📥 Download JSON
                  </Button>
                </>
              )}

              {savedQuestionnaire && (
                <Button
                  onClick={deployToWellFit}
                  disabled={isDeploying}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isDeploying ? 'Deploying...' : '🚀 Deploy to WellFit'}
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated Form Display */}
      {viewMode === 'builder' && generatedQuestionnaire && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{generatedQuestionnaire.title}</CardTitle>
                <p className="text-gray-600">{generatedQuestionnaire.description}</p>
              </div>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setPreviewMode('form')}
                  className={`px-3 py-1 text-sm ${previewMode === 'form' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
                >
                  📝 Form Preview
                </button>
                <button
                  onClick={() => setPreviewMode('json')}
                  className={`px-3 py-1 text-sm border-l border-gray-300 ${previewMode === 'json' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
                >
                  📋 FHIR JSON
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {previewMode === 'form' && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center text-green-800">
                    <span className="mr-2">✅</span>
                    <span className="font-medium">FHIR R4 Questionnaire Generated Successfully</span>
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    ID: {generatedQuestionnaire.id} | Status: {generatedQuestionnaire.status} | Questions: {generatedQuestionnaire.item.length}
                  </div>
                </div>

                {generatedQuestionnaire.scoring && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <div className="font-medium text-blue-800">🧮 Scoring Algorithm: {generatedQuestionnaire.scoring.algorithm}</div>
                    <div className="text-sm text-blue-700 mt-1">
                      {generatedQuestionnaire.scoring.rules.length} scoring rules configured
                    </div>
                  </div>
                )}

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-4">Form Preview:</h4>
                  {generatedQuestionnaire.item.map(renderQuestionPreview)}
                </div>
              </div>
            )}

            {previewMode === 'json' && (
              <div>
                <div className="mb-4 text-sm text-gray-600">
                  This FHIR Questionnaire can be imported into any FHIR-compliant system or EHR.
                </div>
                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                  {JSON.stringify(generatedQuestionnaire, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* My Questionnaires Library */}
      {viewMode === 'library' && (
        <Card>
          <CardHeader>
            <CardTitle>📚 My Questionnaires Library</CardTitle>
            <p className="text-gray-600">
              Manage your saved FHIR questionnaires and deployment status
            </p>
          </CardHeader>
          <CardContent>
            {myQuestionnaires.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No questionnaires created yet.</p>
                <Button
                  onClick={() => setViewMode('builder')}
                  className="mt-4"
                  variant="outline"
                >
                  Create Your First Questionnaire
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myQuestionnaires.map((questionnaire) => (
                  <div key={questionnaire.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium">{questionnaire.title}</h3>
                          <Badge
                            className={`${
                              questionnaire.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : questionnaire.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {questionnaire.status}
                          </Badge>
                          {questionnaire.deployed_to_wellfit && (
                            <Badge className="bg-blue-100 text-blue-800">
                              Deployed to WellFit
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{questionnaire.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>📝 {questionnaire.questionnaire_json.item.length} questions</span>
                          <span>🔄 {questionnaire.total_responses} responses</span>
                          {questionnaire.has_scoring && <span>🧮 Has scoring</span>}
                          <span>📅 {new Date(questionnaire.created_at).toLocaleDateString()}</span>
                        </div>
                        {questionnaire.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {questionnaire.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGeneratedQuestionnaire(questionnaire.questionnaire_json);
                            setSavedQuestionnaire(questionnaire);
                            setViewMode('builder');
                            setPreviewMode('form');
                          }}
                        >
                          👁️ View
                        </Button>
                        {!questionnaire.deployed_to_wellfit && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSavedQuestionnaire(questionnaire);
                              deployToWellFit();
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            🚀 Deploy
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Integration Options */}
      {viewMode === 'builder' && generatedQuestionnaire && (
        <Card>
          <CardHeader>
            <CardTitle>🔗 Integration Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">📱 Deploy to WellFit</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Add this questionnaire to your WellFit patient check-ins
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={deployToWellFit}
                  disabled={!savedQuestionnaire || isDeploying}
                >
                  {!savedQuestionnaire ? 'Save First' : isDeploying ? 'Deploying...' : 'Deploy to Patient Dashboard'}
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">🏥 Export to EHR</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Send to Epic, Cerner, or other FHIR-compatible systems
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={downloadQuestionnaire}
                >
                  Download FHIR JSON
                </Button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <div className="text-sm">
                <strong>🔐 HIPAA Compliance:</strong> Generated forms include proper security extensions
                and can be deployed with encryption for PHI protection.
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FHIRFormBuilderEnhanced;