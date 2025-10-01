// src/pages/AdminQuestionsPage.tsx
import React, { useState } from 'react';
import RiskAssessmentManager from '../components/admin/RiskAssessmentManager';
import NurseQuestionManager from '../components/admin/NurseQuestionManager';
import SmartBackButton from '../components/ui/SmartBackButton';
import { ClipboardCheck, MessageSquare } from 'lucide-react';

export default function AdminQuestionsPage() {
  const [activeTab, setActiveTab] = useState<'assessment' | 'questions'>('assessment');

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Smart Back Button */}
        <div className="mb-4">
          <SmartBackButton />
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Health Assessment & Questions Management
          </h1>

          {/* Tab Navigation */}
          <div className="flex space-x-4 border-b">
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
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'assessment' ? (
          <RiskAssessmentManager />
        ) : (
          <NurseQuestionManager />
        )}
      </div>
    </div>
  );
}