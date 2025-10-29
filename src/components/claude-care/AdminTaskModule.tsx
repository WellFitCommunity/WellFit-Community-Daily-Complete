// ============================================================================
// Admin Task Module - Administrative task automation with templates
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ClaudeCareAssistant } from '../../services/claudeCareAssistant';
import { AdminTaskTemplate, AdminTaskHistory } from '../../types/claudeCareAssistant';
import { ClaudeModel } from '../../types/claude';
import TaskTemplateSelector from './TaskTemplateSelector';
import TaskHistoryViewer from './TaskHistoryViewer';

interface Props {
  userRole: string;
  userId?: string;
  availableTaskTypes: string[];
  preferredModel: ClaudeModel;
}

const AdminTaskModule: React.FC<Props> = ({
  userRole,
  userId,
  availableTaskTypes,
  preferredModel,
}) => {
  const [templates, setTemplates] = useState<AdminTaskTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminTaskTemplate | null>(null);
  const [inputData, setInputData] = useState<Record<string, any>>({});
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [taskHistory, setTaskHistory] = useState<AdminTaskHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    if (userId) {
      loadTaskHistory();
    }
  }, [userRole, userId]);

  const loadTemplates = async () => {
    try {
      const loaded = await ClaudeCareAssistant.getTemplatesForRole(userRole);
      setTemplates(loaded);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    }
  };

  const loadTaskHistory = async () => {
    if (!userId) return;

    try {
      const history = await ClaudeCareAssistant.getUserTaskHistory(userId, 10);
      setTaskHistory(history);
    } catch (err) {
      console.error('Failed to load task history:', err);
    }
  };

  const handleTemplateSelect = (template: AdminTaskTemplate) => {
    setSelectedTemplate(template);
    setGeneratedContent('');
    setError(null);

    // Initialize input data with empty values for required fields
    const initialData: Record<string, any> = {};
    Object.keys(template.requiredFields).forEach((field) => {
      initialData[field] = '';
    });
    setInputData(initialData);
  };

  const handleInputChange = (field: string, value: any) => {
    setInputData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGenerateTask = async () => {
    if (!selectedTemplate || !userId) {
      setError('Template or user ID not available');
      return;
    }

    // Validate required fields
    const missingFields = Object.keys(selectedTemplate.requiredFields).filter(
      (field) => !inputData[field] || inputData[field].toString().trim() === ''
    );

    if (missingFields.length > 0) {
      setError(`Please fill in required fields: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await ClaudeCareAssistant.executeAdminTask({
        templateId: selectedTemplate.id,
        role: userRole,
        taskType: selectedTemplate.taskType,
        inputData,
        preferredModel,
        userId,
      });

      setGeneratedContent(response.generatedContent);

      // Reload task history
      await loadTaskHistory();
    } catch (err) {
      console.error('Task generation failed:', err);
      setError('Failed to generate task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      alert('Content copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getFieldType = (type: string): string => {
    const typeMap: Record<string, string> = {
      string: 'text',
      number: 'number',
      date: 'date',
      text: 'textarea',
    };
    return typeMap[type] || 'text';
  };

  return (
    <div className="space-y-6">
      {/* Template Selector */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Task Template</h3>
          {userId && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
          )}
        </div>

        <TaskTemplateSelector
          role={userRole}
          templates={templates}
          onSelect={handleTemplateSelect}
        />
      </div>

      {/* Task History Sidebar */}
      {showHistory && userId && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <TaskHistoryViewer userId={userId} history={taskHistory} limit={10} />
        </div>
      )}

      {/* Selected Template Form */}
      {selectedTemplate && (
        <div className="bg-white border border-gray-200 rounded-md p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {selectedTemplate.templateName}
              </h3>
              {selectedTemplate.description && (
                <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
              )}
            </div>
            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
              {selectedTemplate.outputFormat}
            </span>
          </div>

          {/* Input Fields */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Required Information</h4>

            {Object.entries(selectedTemplate.requiredFields).map(([field, type]) => {
              const fieldType = getFieldType(type as string);
              const label = field.split('_').map((word) =>
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ');

              return (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label} <span className="text-red-500">*</span>
                  </label>

                  {fieldType === 'textarea' ? (
                    <textarea
                      value={inputData[field] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                  ) : (
                    <input
                      type={fieldType}
                      value={inputData[field] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                  )}
                </div>
              );
            })}

            {/* Optional Fields */}
            {selectedTemplate.optionalFields && Object.keys(selectedTemplate.optionalFields).length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-4">Optional Information</h4>

                {Object.entries(selectedTemplate.optionalFields).map(([field, type]) => {
                  const fieldType = getFieldType(type as string);
                  const label = field.split('_').map((word) =>
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ');

                  return (
                    <div key={field} className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {label}
                      </label>

                      {fieldType === 'textarea' ? (
                        <textarea
                          value={inputData[field] || ''}
                          onChange={(e) => handleInputChange(field, e.target.value)}
                          rows={3}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Enter ${label.toLowerCase()} (optional)`}
                        />
                      ) : (
                        <input
                          type={fieldType}
                          value={inputData[field] || ''}
                          onChange={(e) => handleInputChange(field, e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Enter ${label.toLowerCase()} (optional)`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateTask}
            disabled={loading}
            className={`w-full py-3 px-6 rounded-md font-semibold text-white transition-colors ${
              loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Generating...' : 'Generate Task'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">Generated Content</h4>
                <button
                  onClick={handleCopyToClipboard}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Copy to Clipboard
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {generatedContent}
                </pre>
              </div>

              <div className="flex space-x-4">
                <button className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  Edit
                </button>
                <button className="flex-1 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700">
                  Save to EHR
                </button>
              </div>
            </div>
          )}

          {/* Estimated Cost */}
          {selectedTemplate.estimatedTokens && (
            <div className="text-xs text-gray-500 text-center">
              Estimated tokens: ~{selectedTemplate.estimatedTokens} | Cost: ~$
              {((selectedTemplate.estimatedTokens / 1000) * 0.003).toFixed(4)}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {templates.length === 0 && (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-md">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-gray-600">No templates available for your role</p>
        </div>
      )}
    </div>
  );
};

export default AdminTaskModule;
