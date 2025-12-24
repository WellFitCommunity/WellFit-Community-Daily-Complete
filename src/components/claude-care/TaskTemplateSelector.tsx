// ============================================================================
// Task Template Selector - Reusable template selector with preview
// ============================================================================

import React from 'react';
import { AdminTaskTemplate } from '../../types/claudeCareAssistant';

interface Props {
  role: string;
  templates: AdminTaskTemplate[];
  onSelect: (template: AdminTaskTemplate) => void;
}

const TaskTemplateSelector: React.FC<Props> = ({ role, templates, onSelect }) => {
  // Group templates by task type
  const groupedTemplates = templates.reduce((acc, template) => {
    const type = template.taskType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(template);
    return acc;
  }, {} as Record<string, AdminTaskTemplate[]>);

  const formatTaskType = (taskType: string): string => {
    return taskType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getOutputFormatBadge = (format: string): React.ReactElement => {
    const colors: Record<string, string> = {
      narrative: 'bg-blue-100 text-blue-800',
      form: 'bg-green-100 text-green-800',
      letter: 'bg-purple-100 text-purple-800',
      structured: 'bg-yellow-100 text-yellow-800',
    };

    return (
      <span className={`text-xs px-2 py-1 rounded-sm ${colors[format] || 'bg-gray-100 text-gray-800'}`}>
        {format}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedTemplates).map(([taskType, taskTemplates]) => (
        <div key={taskType}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">
            {formatTaskType(taskType)}
          </h4>

          <div className="space-y-2">
            {taskTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className="w-full text-left p-4 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h5 className="font-semibold text-gray-900 group-hover:text-blue-700">
                        {template.templateName}
                      </h5>
                      {getOutputFormatBadge(template.outputFormat)}
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>
                        Required fields: {Object.keys(template.requiredFields).length}
                      </span>
                      {template.estimatedTokens && (
                        <span>~{template.estimatedTokens} tokens</span>
                      )}
                    </div>
                  </div>

                  <svg
                    className="h-5 w-5 text-gray-400 group-hover:text-blue-600 ml-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {templates.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No templates available for role: {role}</p>
        </div>
      )}
    </div>
  );
};

export default TaskTemplateSelector;
