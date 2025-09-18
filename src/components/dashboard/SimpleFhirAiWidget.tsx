// Simple AI Health Widget for Senior Users
// Ultra-simplified interface with minimal clicks and clear visuals

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EnhancedFhirService from '../admin/EnhancedFhirService';

interface SimpleHealthStatus {
  healthScore: number;
  status: 'GREAT' | 'GOOD' | 'NEEDS_ATTENTION' | 'CONTACT_DOCTOR';
  mainMessage: string;
  actionMessage: string;
  lastCheckIn: string;
  hasEmergencyAlert: boolean;
  emergencyMessage?: string;
}

const SimpleFhirAiWidget: React.FC = () => {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState<SimpleHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fhirService = new EnhancedFhirService(
    process.env.REACT_APP_SUPABASE_URL || '',
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
  );

  // Load simple health status
  useEffect(() => {
    const loadHealthStatus = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // Get AI insights
        const enhancedData = await fhirService.exportEnhancedPatientData(user.id);
        const insights = enhancedData.aiInsights;

        // Simplify for seniors
        const simpleStatus: SimpleHealthStatus = {
          healthScore: insights.overallHealthScore,
          status: getSimpleStatus(insights.riskAssessment.riskLevel, insights.overallHealthScore),
          mainMessage: getMainMessage(insights.riskAssessment.riskLevel, insights.overallHealthScore),
          actionMessage: getActionMessage(insights.adherenceScore, insights.lastCheckIn),
          lastCheckIn: insights.lastCheckIn,
          hasEmergencyAlert: insights.emergencyAlerts.length > 0,
          emergencyMessage: insights.emergencyAlerts[0]?.message
        };

        setHealthStatus(simpleStatus);
      } catch (error) {
        console.error('Error loading health status:', error);
        // Set safe default
        setHealthStatus({
          healthScore: 0,
          status: 'GOOD',
          mainMessage: "Let's check your health today!",
          actionMessage: "Tap the button below to do your daily check-in.",
          lastCheckIn: 'Never',
          hasEmergencyAlert: false
        });
      } finally {
        setLoading(false);
      }
    };

    loadHealthStatus();
    // Refresh every 15 minutes
    const interval = setInterval(loadHealthStatus, 900000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Helper functions for senior-friendly messaging
  const getSimpleStatus = (riskLevel: string, healthScore: number): SimpleHealthStatus['status'] => {
    if (riskLevel === 'CRITICAL') return 'CONTACT_DOCTOR';
    if (riskLevel === 'HIGH') return 'NEEDS_ATTENTION';
    if (healthScore >= 75) return 'GREAT';
    return 'GOOD';
  };

  const getMainMessage = (riskLevel: string, healthScore: number): string => {
    if (riskLevel === 'CRITICAL') return "Please contact your doctor today.";
    if (riskLevel === 'HIGH') return "Let's take extra care of your health.";
    if (healthScore >= 80) return "You're doing amazing! Keep it up!";
    if (healthScore >= 60) return "You're doing well! Small steps count.";
    return "Every day is a new chance to feel better.";
  };

  const getActionMessage = (adherenceScore: number, lastCheckIn: string): string => {
    const isRecent = lastCheckIn !== 'Never' &&
      (Date.now() - new Date(lastCheckIn).getTime()) < 24 * 60 * 60 * 1000;

    if (isRecent) return "Great job checking in! Come back tomorrow.";
    if (adherenceScore >= 80) return "You're doing great with your check-ins!";
    return "A quick check-in helps us take care of you.";
  };

  const getStatusColors = (status: SimpleHealthStatus['status']) => {
    switch (status) {
      case 'GREAT': return {
        bg: 'bg-green-100',
        border: 'border-green-300',
        text: 'text-green-800',
        emoji: '🌟',
        statusText: 'Excellent!'
      };
      case 'GOOD': return {
        bg: 'bg-blue-100',
        border: 'border-blue-300',
        text: 'text-blue-800',
        emoji: '😊',
        statusText: 'Good'
      };
      case 'NEEDS_ATTENTION': return {
        bg: 'bg-yellow-100',
        border: 'border-yellow-300',
        text: 'text-yellow-800',
        emoji: '⚠️',
        statusText: 'Pay Attention'
      };
      case 'CONTACT_DOCTOR': return {
        bg: 'bg-red-100',
        border: 'border-red-300',
        text: 'text-red-800',
        emoji: '🏥',
        statusText: 'Contact Doctor'
      };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-pulse">
          <div className="text-6xl mb-4">🔄</div>
          <div className="text-xl text-gray-600">Checking your health...</div>
        </div>
      </div>
    );
  }

  if (!healthStatus) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">📱</div>
        <div className="text-xl text-gray-700 mb-4">Ready to check your health?</div>
        <button
          onClick={() => window.location.href = '/daily-checkin'}
          className="bg-blue-600 text-white text-xl px-8 py-4 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Health Check
        </button>
      </div>
    );
  }

  const colors = getStatusColors(healthStatus.status);

  return (
    <div className="space-y-6">
      {/* Emergency Alert */}
      {healthStatus.hasEmergencyAlert && (
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-6 text-center">
          <div className="text-4xl mb-3">🚨</div>
          <div className="text-xl font-bold text-red-800 mb-2">Important Health Alert</div>
          <div className="text-lg text-red-700 mb-4">{healthStatus.emergencyMessage}</div>
          <button
            onClick={() => window.location.href = 'tel:911'}
            className="bg-red-600 text-white text-xl px-8 py-4 rounded-lg hover:bg-red-700 transition-colors mr-4"
          >
            Call 911
          </button>
          <button
            onClick={() => window.location.href = '/doctors-view'}
            className="bg-red-500 text-white text-xl px-8 py-4 rounded-lg hover:bg-red-600 transition-colors"
          >
            Contact Doctor
          </button>
        </div>
      )}

      {/* Main Health Status */}
      <div className={`${colors.bg} ${colors.border} border-2 rounded-xl p-8 text-center`}>
        <div className="text-8xl mb-4">{colors.emoji}</div>

        <div className="mb-6">
          <div className={`text-3xl font-bold ${colors.text} mb-2`}>
            {colors.statusText}
          </div>
          <div className="text-xl text-gray-700 leading-relaxed">
            {healthStatus.mainMessage}
          </div>
        </div>

        {/* Health Score (Simple) */}
        <div className="mb-6">
          <div className="text-sm text-gray-600 mb-2">Your Health Score</div>
          <div className={`text-5xl font-bold ${colors.text}`}>
            {healthStatus.healthScore}/100
          </div>
        </div>

        {/* Action Message */}
        <div className="text-lg text-gray-600 mb-6">
          {healthStatus.actionMessage}
        </div>

        {/* Single Primary Action */}
        <div className="space-y-4">
          {healthStatus.status === 'CONTACT_DOCTOR' ? (
            <button
              onClick={() => window.location.href = '/doctors-view'}
              className="bg-red-600 text-white text-2xl px-12 py-6 rounded-xl hover:bg-red-700 transition-colors w-full"
            >
              📞 Contact Doctor
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/daily-checkin'}
              className="bg-blue-600 text-white text-2xl px-12 py-6 rounded-xl hover:bg-blue-700 transition-colors w-full"
            >
              📝 Daily Check-In
            </button>
          )}

          {/* Secondary Action */}
          <button
            onClick={() => window.location.href = '/self-reporting'}
            className="bg-gray-100 text-gray-700 text-xl px-8 py-4 rounded-xl hover:bg-gray-200 transition-colors w-full"
          >
            📊 View My Health
          </button>
        </div>
      </div>

      {/* Simple Progress Indicator */}
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-2xl mb-3">📅</div>
        <div className="text-lg font-medium text-gray-800 mb-2">Last Check-In</div>
        <div className="text-xl text-gray-600">
          {healthStatus.lastCheckIn === 'Never' ? 'Not yet' :
           new Date(healthStatus.lastCheckIn).toLocaleDateString('en-US', {
             weekday: 'long',
             month: 'short',
             day: 'numeric'
           })}
        </div>
      </div>
    </div>
  );
};

export default SimpleFhirAiWidget;