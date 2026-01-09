/**
 * Caregiver Portal
 * Family caregiver dashboard - view patient's neuro assessments & get support
 */

import React, { useState, useEffect } from 'react';
import { Users, Heart, TrendingDown, Phone, Calendar as _Calendar, BookOpen } from 'lucide-react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import type {
  CognitiveAssessment,
  DementiaStaging,
  CaregiverAssessment,
} from '../../types/neuroSuite';

interface CaregiverPortalProps {
  patientId: string;
  caregiverId: string;
}

const CaregiverPortal: React.FC<CaregiverPortalProps> = ({ patientId, caregiverId: _caregiverId }) => {
  const [cognitiveHistory, setCognitiveHistory] = useState<CognitiveAssessment[]>([]);
  const [stagingHistory, setStagingHistory] = useState<DementiaStaging[]>([]);
  const [burdenHistory, setBurdenHistory] = useState<CaregiverAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Load on mount only
  }, [patientId]);

  const loadPortalData = async () => {
    setLoading(true);

    // Load cognitive assessments
    const cogResponse = await NeuroSuiteService.getCognitiveAssessmentHistory(patientId);
    if (cogResponse.success && cogResponse.data) {
      setCognitiveHistory(cogResponse.data);
    }

    // Load dementia staging
    const stagingResponse = await NeuroSuiteService.getDementiaStagingHistory(patientId);
    if (stagingResponse.success && stagingResponse.data) {
      setStagingHistory(stagingResponse.data);
    }

    // Load caregiver burden
    const burdenResponse = await NeuroSuiteService.getCaregiverBurdenHistory(patientId);
    if (burdenResponse.success && burdenResponse.data) {
      setBurdenHistory(burdenResponse.data);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl text-gray-600">Loading...</div>
      </div>
    );
  }

  const latestCognitive = cognitiveHistory[0];
  const latestStaging = stagingHistory[0];
  const latestBurden = burdenHistory[0];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-purple-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Caregiver Portal</h1>
              <p className="text-gray-600">Support and information for family caregivers</p>
            </div>
          </div>
        </div>

        {/* Emergency Contacts Card */}
        <div className="bg-linear-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Phone className="w-8 h-8 text-red-600" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">24/7 Support Line</h3>
                <p className="text-3xl font-bold text-red-600">1-800-CARE-NOW</p>
                <p className="text-sm text-gray-600 mt-1">
                  Crisis support • Medical questions • Caregiver stress
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Latest Cognitive Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Latest Cognitive Assessment</h3>
            {latestCognitive ? (
              <div>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-purple-600 mb-2">
                    {latestCognitive.moca_total_score || latestCognitive.mmse_total_score}
                  </div>
                  <div className="text-sm text-gray-600">
                    {latestCognitive.assessment_tool} Score
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>Status:</strong> {latestCognitive.cognitive_status}
                </div>
                <div className="text-xs text-gray-500">
                  Assessed: {new Date(latestCognitive.assessment_date).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No assessments yet
              </div>
            )}
          </div>

          {/* Latest Dementia Stage */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Dementia Stage</h3>
            {latestStaging ? (
              <div>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-indigo-600 mb-2">
                    {latestStaging.cdr_global_score}
                  </div>
                  <div className="text-sm text-gray-600">CDR Global Score</div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>Stage:</strong> {latestStaging.dementia_stage.replace('_', ' ')}
                </div>
                <div className="text-xs text-gray-500">
                  Staged: {new Date(latestStaging.assessment_date).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No staging yet
              </div>
            )}
          </div>

          {/* Your Burden Level */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Your Caregiver Burden</h3>
            {latestBurden ? (
              <div>
                <div className="text-center mb-4">
                  <div className={`text-5xl font-bold mb-2 ${
                    latestBurden.zbi_total_score > 40 ? 'text-red-600' :
                    latestBurden.zbi_total_score > 20 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {latestBurden.zbi_total_score}
                  </div>
                  <div className="text-sm text-gray-600">Zarit Burden Score</div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <strong>Level:</strong> {latestBurden.burden_level.replace('_', ' ')}
                </div>
                {latestBurden.zbi_total_score > 20 && (
                  <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <div className="text-sm text-orange-800 font-semibold mb-1">
                      Support Recommended
                    </div>
                    <div className="text-xs text-orange-700">
                      Consider respite care, support groups, or counseling
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                No assessment yet
              </div>
            )}
          </div>
        </div>

        {/* Cognitive Trend Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-purple-600" />
            Cognitive Assessment Trend
          </h3>
          {cognitiveHistory.length > 0 ? (
            <div className="space-y-3">
              {cognitiveHistory.slice(0, 10).map((assessment, _index) => (
                <div key={assessment.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-600">
                    {new Date(assessment.assessment_date).toLocaleDateString()}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                    <div
                      className={`h-full rounded-full ${
                        (assessment.moca_total_score || assessment.mmse_total_score || 0) >= 26 ? 'bg-green-500' :
                        (assessment.moca_total_score || assessment.mmse_total_score || 0) >= 18 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{
                        width: `${((assessment.moca_total_score || assessment.mmse_total_score || 0) / 30) * 100}%`
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                      {assessment.moca_total_score || assessment.mmse_total_score}/30
                    </div>
                  </div>
                  <div className="w-20 text-sm text-gray-600">
                    {assessment.assessment_tool}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No assessment history available
            </div>
          )}
        </div>

        {/* Resource Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Educational Resources */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Educational Resources</h3>
            </div>
            <div className="space-y-3">
              <a href="#" className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="font-semibold text-gray-900">Understanding Dementia Stages</div>
                <div className="text-sm text-gray-600">Learn what to expect at each stage</div>
              </a>
              <a href="#" className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="font-semibold text-gray-900">Communication Strategies</div>
                <div className="text-sm text-gray-600">Tips for effective communication</div>
              </a>
              <a href="#" className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="font-semibold text-gray-900">Managing Behavioral Changes</div>
                <div className="text-sm text-gray-600">Evidence-based interventions</div>
              </a>
              <a href="#" className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="font-semibold text-gray-900">Legal & Financial Planning</div>
                <div className="text-sm text-gray-600">Advance directives, power of attorney</div>
              </a>
            </div>
          </div>

          {/* Support Services */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-gray-900">Support Services</h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Respite Care</div>
                <div className="text-sm text-gray-600 mb-2">
                  Temporary relief for caregivers
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  Request Respite Care
                </button>
              </div>
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Support Groups</div>
                <div className="text-sm text-gray-600 mb-2">
                  Connect with other caregivers
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  Find a Group
                </button>
              </div>
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Individual Counseling</div>
                <div className="text-sm text-gray-600 mb-2">
                  Professional mental health support
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  Schedule Session
                </button>
              </div>
              <div className="p-3 border border-gray-200 rounded-lg">
                <div className="font-semibold text-gray-900 mb-1">Adult Day Care</div>
                <div className="text-sm text-gray-600 mb-2">
                  Safe daytime activities for your loved one
                </div>
                <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  Explore Options
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Self-Care Reminder */}
        <div className="mt-6 bg-linear-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Heart className="w-8 h-8 text-purple-600 shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Remember: You Matter Too</h3>
              <p className="text-gray-700 mb-4">
                Taking care of yourself isn't selfish - it's essential. You can't pour from an empty cup.
                Make time for your own health, friendships, and activities that bring you joy.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-semibold text-gray-900 mb-1">🧘 Take Breaks</div>
                  <div className="text-gray-600">Even 15 minutes of "me time" helps</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-semibold text-gray-900 mb-1">🤝 Ask for Help</div>
                  <div className="text-gray-600">It's okay to not do everything alone</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="font-semibold text-gray-900 mb-1">💚 Be Kind to Yourself</div>
                  <div className="text-gray-600">You're doing better than you think</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaregiverPortal;
