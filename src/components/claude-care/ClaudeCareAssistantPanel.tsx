// ============================================================================
// Claude Care Assistant Panel - Main Component
// ============================================================================
// Purpose: Unified panel showing role-appropriate modules
// Autonomous healthcare system engineer implementation
// ============================================================================

import React, { useState, useEffect } from 'react';
import { ROLE_MODULE_CONFIGS, ClaudeCareModuleConfig } from '../../types/claudeCareAssistant';
import TranslationModule from './TranslationModule';
import AdminTaskModule from './AdminTaskModule';
import VoiceInputModule from './VoiceInputModule';
import CrossRoleContextModule from './CrossRoleContextModule';

interface Props {
  userRole: string;
  patientId?: string;
  userId?: string;
}

const ClaudeCareAssistantPanel: React.FC<Props> = ({ userRole, patientId, userId }) => {
  const [activeTab, setActiveTab] = useState<'translation' | 'tasks' | 'voice' | 'context'>('tasks');
  const [moduleConfig, setModuleConfig] = useState<ClaudeCareModuleConfig | null>(null);
  const [voiceTemplateId, setVoiceTemplateId] = useState<string | undefined>();
  const [voiceTranscription, setVoiceTranscription] = useState<string | undefined>();

  useEffect(() => {
    // Load module configuration for role
    const config = ROLE_MODULE_CONFIGS[userRole];
    if (config) {
      setModuleConfig(config);

      // Set default active tab based on enabled features
      if (config.enabledFeatures.adminTaskAutomation) {
        setActiveTab('tasks');
      } else if (config.enabledFeatures.translation) {
        setActiveTab('translation');
      } else if (config.enabledFeatures.voiceInput) {
        setActiveTab('voice');
      } else if (config.enabledFeatures.crossRoleContext) {
        setActiveTab('context');
      }
    }
  }, [userRole]);

  // Handler for voice input to populate admin task form
  const handleVoicePopulateTask = (templateId: string, transcription: string) => {
    // Store the voice data
    setVoiceTemplateId(templateId);
    setVoiceTranscription(transcription);

    // Switch to the tasks tab
    setActiveTab('tasks');
  };

  if (!moduleConfig) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          Claude Care Assistant is not configured for role: {userRole}
        </p>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string): string => {
    const colors: Record<string, string> = {
      physician: 'bg-blue-100 text-blue-800',
      nurse: 'bg-green-100 text-green-800',
      nurse_practitioner: 'bg-teal-100 text-teal-800',
      physician_assistant: 'bg-indigo-100 text-indigo-800',
      case_manager: 'bg-purple-100 text-purple-800',
      social_worker: 'bg-pink-100 text-pink-800',
      admin: 'bg-gray-100 text-gray-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleDisplayName = (role: string): string => {
    const names: Record<string, string> = {
      physician: 'Physician',
      nurse: 'Nurse',
      nurse_practitioner: 'Nurse Practitioner',
      physician_assistant: 'Physician Assistant',
      case_manager: 'Case Manager',
      social_worker: 'Social Worker',
      admin: 'Administrator',
    };
    return names[role] || role;
  };

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Claude Care Assistant</h2>
            <p className="text-blue-100 mt-1">AI-powered translation, task automation, and collaboration</p>
          </div>
          <div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getRoleBadgeColor(userRole)}`}>
              {getRoleDisplayName(userRole)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {moduleConfig.enabledFeatures.adminTaskAutomation && (
            <button
              onClick={() => setActiveTab('tasks')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tasks'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Admin Tasks
            </button>
          )}

          {moduleConfig.enabledFeatures.translation && (
            <button
              onClick={() => setActiveTab('translation')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'translation'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Translation
            </button>
          )}

          {moduleConfig.enabledFeatures.voiceInput && (
            <button
              onClick={() => setActiveTab('voice')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'voice'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Voice Input
            </button>
          )}

          {moduleConfig.enabledFeatures.crossRoleContext && patientId && (
            <button
              onClick={() => setActiveTab('context')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'context'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Team Context
            </button>
          )}
        </nav>
      </div>

      {/* Active Module Content */}
      <div className="p-6">
        {activeTab === 'tasks' && moduleConfig.enabledFeatures.adminTaskAutomation && (
          <AdminTaskModule
            userRole={userRole}
            userId={userId}
            availableTaskTypes={moduleConfig.availableTaskTypes}
            preferredModel={moduleConfig.preferredModel}
            voiceTemplateId={voiceTemplateId}
            voiceTranscription={voiceTranscription}
            onVoiceDataUsed={() => {
              setVoiceTemplateId(undefined);
              setVoiceTranscription(undefined);
            }}
          />
        )}

        {activeTab === 'translation' && moduleConfig.enabledFeatures.translation && (
          <TranslationModule userRole={userRole} />
        )}

        {activeTab === 'voice' && moduleConfig.enabledFeatures.voiceInput && (
          <VoiceInputModule
            userRole={userRole}
            userId={userId}
            onPopulateTaskForm={handleVoicePopulateTask}
          />
        )}

        {activeTab === 'context' && moduleConfig.enabledFeatures.crossRoleContext && patientId && (
          <CrossRoleContextModule userRole={userRole} patientId={patientId} userId={userId} />
        )}
      </div>
    </div>
  );
};

export default ClaudeCareAssistantPanel;
