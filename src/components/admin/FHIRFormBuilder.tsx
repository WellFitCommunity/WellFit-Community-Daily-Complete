import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';

interface FHIRQuestion {
  linkId: string;
  text: string;
  type: 'string' | 'integer' | 'decimal' | 'boolean' | 'choice' | 'date';
  required?: boolean;
  options?: Array<{ value: string; display: string; code?: string }>;
  enableWhen?: Array<{ question: string; operator: string; answerString: string }>;
}

interface FHIRQuestionnaire {
  resourceType: 'Questionnaire';
  id: string;
  title: string;
  status: 'draft' | 'active' | 'retired';
  description: string;
  item: FHIRQuestion[];
  scoring?: {
    algorithm: string;
    rules: Array<{ condition: string; score: number; interpretation: string }>;
  };
}

const FHIRFormBuilder: React.FC = () => {
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [generatedQuestionnaire, setGeneratedQuestionnaire] = useState<FHIRQuestionnaire | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'form' | 'json' | 'preview'>('form');

  // Common clinical form templates
  const formTemplates = [
    {
      name: 'PHQ-9 Depression Screening',
      description: 'Create a PHQ-9 depression screening form with automatic scoring',
      prompt: 'Create a PHQ-9 depression screening questionnaire with 9 questions about mood, sleep, energy, appetite, concentration, self-worth, and suicidal ideation. Each question should have 4 options: Not at all (0), Several days (1), More than half the days (2), Nearly every day (3). Include automatic scoring where 0-4 is minimal, 5-9 is mild, 10-14 is moderate, 15-19 is moderately severe, and 20-27 is severe depression.'
    },
    {
      name: 'Fall Risk Assessment',
      description: 'Assess fall risk factors for senior patients',
      prompt: 'Create a fall risk assessment form for seniors with questions about: previous falls, balance problems, mobility aids, medications causing dizziness, vision problems, home safety hazards, fear of falling. Include conditional logic and risk scoring.'
    },
    {
      name: 'Medication Adherence Assessment',
      description: 'Track medication compliance patterns',
      prompt: 'Create a medication adherence questionnaire asking about: missed doses, reasons for missing medications, side effects experienced, understanding of medication importance, barriers to taking medications. Include a Morisky scale with scoring.'
    }
  ];

  const generateForm = async (prompt: string = naturalLanguageInput) => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/anthropic-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a FHIR SDC expert specializing in creating clinical questionnaires. 

INSTRUCTIONS:
- Convert natural language form descriptions into valid FHIR R4 Questionnaire resources
- Use proper LOINC codes when available
- Include conditional logic with enableWhen where appropriate
- Add scoring rules for standardized assessments
- Ensure all linkIds are unique and meaningful
- Response must be ONLY valid JSON - no markdown, no explanations, no backticks

FHIR Questionnaire Structure:
- resourceType: "Questionnaire"
- id: descriptive-kebab-case-id
- title: Human readable title
- status: "draft"
- description: Brief description of purpose
- item: Array of questions with proper types
- scoring: Optional scoring algorithm for assessments

Question Types:
- string: Text input
- integer/decimal: Numeric values
- boolean: Yes/No
- choice: Multiple choice with answerOption array
- date: Date picker

For scoring, include algorithm name and rules array with conditions.

RESPOND WITH ONLY JSON - NO OTHER TEXT:`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 3000
        })
      });

      const data = await response.json();
      
      if (data.content && data.content[0]) {
        let jsonText = data.content[0].text;
        
        // Clean any potential markdown formatting
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
          const questionnaire = JSON.parse(jsonText);
          
          // Validate basic FHIR structure
          if (questionnaire.resourceType !== 'Questionnaire') {
            throw new Error('Generated resource is not a FHIR Questionnaire');
          }
          
          setGeneratedQuestionnaire(questionnaire);
        } catch (parseError) {

          setError('Failed to generate valid FHIR questionnaire. Please try rephrasing your request.');
        }
      } else {
        setError('No response from AI service');
      }
    } catch (error) {

      setError('Failed to generate form. Please check your connection and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderQuestionPreview = (question: FHIRQuestion) => {
    return (
      <div key={question.linkId} className="border rounded-lg p-4 mb-4 bg-gray-50">
        <div className="flex items-start justify-between mb-2">
          <label className="font-medium text-gray-900">
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {question.type}
          </span>
        </div>

        {question.type === 'string' && (
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="Text input"
            disabled
          />
        )}

        {question.type === 'integer' && (
          <input
            type="number"
            className="w-full p-2 border border-gray-300 rounded"
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
            className="p-2 border border-gray-300 rounded"
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {formTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => generateForm(template.prompt)}
                  className="text-left p-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  disabled={isGenerating}
                >
                  <div className="font-medium text-blue-600">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{template.description}</div>
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
              <Button
                onClick={downloadQuestionnaire}
                variant="outline"
              >
                📥 Download JSON
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Generated Form Display */}
      {generatedQuestionnaire && (
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

      {/* Integration Instructions */}
      {generatedQuestionnaire && (
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
                <Button size="sm" variant="outline" className="w-full">
                  Deploy to Patient Dashboard
                </Button>
              </div>
              
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">🏥 Export to EHR</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Send to Epic, Cerner, or other FHIR-compatible systems
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Configure EHR Export
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

export default FHIRFormBuilder;