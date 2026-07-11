// src/pages/AdminQuestionsPage.tsx
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import RiskAssessmentManager from '../components/admin/RiskAssessmentManager';
import NurseQuestionManager from '../components/admin/NurseQuestionManager';
import SmartScribe from '../components/smart/RealTimeSmartScribe';
import SmartBackButton from '../components/ui/SmartBackButton';
import { ClipboardCheck, MessageSquare, Mic } from 'lucide-react';

type AdminQuestionsTab = 'assessment' | 'questions' | 'scribe';
const VALID_TABS: readonly AdminQuestionsTab[] = ['assessment', 'questions', 'scribe'];

export default function AdminQuestionsPage() {
  // Deep-linkable tab: e.g. /admin-questions?tab=assessment lands directly on the
  // Health Assessments tab (the Risk Assessment Manager). Falls back to 'questions'.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: AdminQuestionsTab =
    tabParam && VALID_TABS.includes(tabParam as AdminQuestionsTab)
      ? (tabParam as AdminQuestionsTab)
      : 'questions';
  const [activeTab, setActiveTabState] = useState<AdminQuestionsTab>(initialTab);

  const setActiveTab = (tab: AdminQuestionsTab) => {
    setActiveTabState(tab);
    // Keep the URL in sync so the tab is shareable/back-button friendly.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Smart Back Button */}
        <div className="mb-4">
          <SmartBackButton />
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-xs p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Nurse Dashboard
          </h1>

          {/* Tab Navigation */}
          <div className="flex space-x-4 border-b">
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex items-center px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Patient Questions
            </button>
            <button
              onClick={() => setActiveTab('assessment')}
              className={`flex items-center px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'assessment'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Health Assessments
            </button>
            <button
              onClick={() => setActiveTab('scribe')}
              className={`flex items-center px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'scribe'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Mic className="w-4 h-4 mr-2" />
              Medical Scribe
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'questions' && <NurseQuestionManager />}
        {activeTab === 'assessment' && <RiskAssessmentManager />}
        {activeTab === 'scribe' && (
          <div className="bg-white rounded-lg shadow-xs p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">AI-Powered Medical Scribe</h2>
              <p className="text-sm text-gray-600">
                Record patient consultations with voice transcription and AI-powered clinical note generation
              </p>
            </div>
            <SmartScribe />
          </div>
        )}
      </div>
    </div>
  );
}