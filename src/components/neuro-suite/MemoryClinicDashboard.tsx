/**
 * Memory Clinic Dashboard
 * Dementia screening & cognitive care coordination
 *
 * Clinical Standards: MoCA, MMSE, CDR scale, Zarit Burden Interview
 * Purpose: Early detection, staging, caregiver support
 */

import React, { useState, useEffect } from 'react';
import { Brain, Users, TrendingDown, AlertTriangle } from 'lucide-react';
import { NeuroSuiteService } from '../../services/neuroSuiteService';
import type {
  CognitiveAssessment,
  CreateCognitiveAssessmentRequest,
  CreateCaregiverAssessmentRequest,
  CognitiveAssessmentTool,
  CDRScore,
} from '../../types/neuroSuite';

interface MemoryClinicDashboardProps {
  patientId: string;
}

const MemoryClinicDashboard: React.FC<MemoryClinicDashboardProps> = ({ patientId }) => {
  // Loading and saving states
  const [loading, setLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'cognitive' | 'staging' | 'caregiver'>('cognitive');

  // Cognitive Assessment State
  const [assessmentTool] = useState<CognitiveAssessmentTool>('MoCA');
  const [yearsEducation, setYearsEducation] = useState<number>(12);

  // MoCA Scores
  const [mocaVisuospatial, setMocaVisuospatial] = useState(0);
  const [mocaNaming, setMocaNaming] = useState(0);
  const [mocaAttention, setMocaAttention] = useState(0);
  const [mocaLanguage, setMocaLanguage] = useState(0);
  const [mocaAbstraction, setMocaAbstraction] = useState(0);
  const [mocaDelayedRecall, setMocaDelayedRecall] = useState(0);
  const [mocaOrientation, setMocaOrientation] = useState(0);

  // CDR Scores for staging
  const [cdrMemory, setCdrMemory] = useState<CDRScore>(0);
  const [cdrOrientation, setCdrOrientation] = useState<CDRScore>(0);
  const [cdrJudgment, setCdrJudgment] = useState<CDRScore>(0);
  const [cdrCommunity, setCdrCommunity] = useState<CDRScore>(0);
  const [cdrHome, setCdrHome] = useState<CDRScore>(0);
  const [cdrPersonalCare, setCdrPersonalCare] = useState<CDRScore>(0);

  // Caregiver Burden (Zarit 12-item)
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverRelationship, setCaregiverRelationship] = useState('');
  const [zbiFeelStrain, setZbiFeelStrain] = useState(0);
  const [zbiTimeAffected, setZbiTimeAffected] = useState(0);
  const [zbiStressed, setZbiStressed] = useState(0);
  const [zbiEmbarrassed, setZbiEmbarrassed] = useState(0);
  const [zbiAngry, setZbiAngry] = useState(0);
  const [zbiRelationshipsAffected, setZbiRelationshipsAffected] = useState(0);
  const [zbiHealthSuffered, setZbiHealthSuffered] = useState(0);
  const [zbiPrivacyAffected, setZbiPrivacyAffected] = useState(0);
  const [zbiSocialLifeAffected, setZbiSocialLifeAffected] = useState(0);
  const [zbiLostControl, setZbiLostControl] = useState(0);
  const [zbiUncertainWhatToDo, setZbiUncertainWhatToDo] = useState(0);
  const [zbiShouldDoMore, setZbiShouldDoMore] = useState(0);

  // Calculated scores
  const [mocaTotal, setMocaTotal] = useState(0);
  const [mocaAdjusted, setMocaAdjusted] = useState(0);
  const [cognitiveStatus, setCognitiveStatus] = useState('');
  const [cdrGlobal, setCdrGlobal] = useState<CDRScore>(0);
  const [dementiaStage, setDementiaStage] = useState('');
  const [zbiTotal, setZbiTotal] = useState(0);
  const [burdenLevel, setBurdenLevel] = useState('');

  // History
  const [cognitiveHistory, setCognitiveHistory] = useState<CognitiveAssessment[]>([]);
  const [saving, setSaving] = useState(false);

  // Calculate MoCA total
  useEffect(() => {
    const raw = mocaVisuospatial + mocaNaming + mocaAttention + mocaLanguage +
                mocaAbstraction + mocaDelayedRecall + mocaOrientation;
    setMocaTotal(raw);

    // Education adjustment (add 1 point if ≤12 years education)
    const adjusted = yearsEducation <= 12 ? raw + 1 : raw;
    setMocaAdjusted(Math.min(adjusted, 30));

    // Interpret
    if (adjusted >= 26) {
      setCognitiveStatus('Normal cognition');
    } else if (adjusted >= 18) {
      setCognitiveStatus('Mild Cognitive Impairment (MCI)');
    } else {
      setCognitiveStatus('Cognitive impairment consistent with dementia');
    }
  }, [mocaVisuospatial, mocaNaming, mocaAttention, mocaLanguage, mocaAbstraction, mocaDelayedRecall, mocaOrientation, yearsEducation]);

  // Calculate CDR global and staging
  useEffect(() => {
    // Simplified algorithm: if memory and ≥3 domains match, use that score
    const scores = [cdrOrientation, cdrJudgment, cdrCommunity, cdrHome, cdrPersonalCare];
    const matchingMemory = scores.filter(s => s === cdrMemory).length;

    const global = matchingMemory >= 3 ? cdrMemory : cdrMemory;
    setCdrGlobal(global);

    // Interpret stage
    if (global === 0) setDementiaStage('No dementia');
    else if (global === 0.5) setDementiaStage('Questionable dementia / MCI');
    else if (global === 1) setDementiaStage('Mild dementia');
    else if (global === 2) setDementiaStage('Moderate dementia');
    else setDementiaStage('Severe dementia');
  }, [cdrMemory, cdrOrientation, cdrJudgment, cdrCommunity, cdrHome, cdrPersonalCare]);

  // Calculate Zarit burden
  useEffect(() => {
    const total = zbiFeelStrain + zbiTimeAffected + zbiStressed + zbiEmbarrassed +
                  zbiAngry + zbiRelationshipsAffected + zbiHealthSuffered + zbiPrivacyAffected +
                  zbiSocialLifeAffected + zbiLostControl + zbiUncertainWhatToDo + zbiShouldDoMore;
    setZbiTotal(total);

    if (total <= 20) setBurdenLevel('Little to no burden');
    else if (total <= 40) setBurdenLevel('Mild to moderate burden');
    else setBurdenLevel('Moderate to severe burden - INTERVENTION NEEDED');
  }, [zbiFeelStrain, zbiTimeAffected, zbiStressed, zbiEmbarrassed, zbiAngry, zbiRelationshipsAffected,
      zbiHealthSuffered, zbiPrivacyAffected, zbiSocialLifeAffected, zbiLostControl, zbiUncertainWhatToDo, zbiShouldDoMore]);

  // Load cognitive history
  useEffect(() => {
    loadCognitiveHistory();
  }, [patientId]);

  const loadCognitiveHistory = async () => {
    setLoading(true);
    const response = await NeuroSuiteService.getCognitiveAssessmentHistory(patientId);
    if (response.success && response.data) {
      setCognitiveHistory(response.data);
    }
    setLoading(false);
  };

  const handleSaveCognitiveAssessment = async () => {
    setSaving(true);

    const request: CreateCognitiveAssessmentRequest = {
      patient_id: patientId,
      assessment_tool: assessmentTool,
      years_education: yearsEducation,
      moca_visuospatial: mocaVisuospatial,
      moca_naming: mocaNaming,
      moca_attention: mocaAttention,
      moca_language: mocaLanguage,
      moca_abstraction: mocaAbstraction,
      moca_delayed_recall: mocaDelayedRecall,
      moca_orientation: mocaOrientation,
    };

    const response = await NeuroSuiteService.createCognitiveAssessment(request);

    if (response.success) {
      alert('Cognitive assessment saved!');
      loadCognitiveHistory();
    } else {
      alert(`Error: ${response.error}`);
    }

    setSaving(false);
  };

  const handleSaveDementiaStaging = async () => {
    setSaving(true);

    const response = await NeuroSuiteService.createDementiaStaging(
      patientId,
      {
        memory: cdrMemory,
        orientation: cdrOrientation,
        judgment: cdrJudgment,
        community: cdrCommunity,
        home: cdrHome,
        personal_care: cdrPersonalCare,
      }
    );

    if (response.success) {
      alert('Dementia staging saved!');
    } else {
      alert(`Error: ${response.error}`);
    }

    setSaving(false);
  };

  const handleSaveCaregiverAssessment = async () => {
    if (!caregiverName || !caregiverRelationship) {
      alert('Please enter caregiver name and relationship');
      return;
    }

    setSaving(true);

    const request: CreateCaregiverAssessmentRequest = {
      patient_id: patientId,
      caregiver_name: caregiverName,
      caregiver_relationship: caregiverRelationship,
      zbi_feel_strain: zbiFeelStrain,
      zbi_time_affected: zbiTimeAffected,
      zbi_stressed: zbiStressed,
      zbi_embarrassed: zbiEmbarrassed,
      zbi_angry: zbiAngry,
      zbi_relationships_affected: zbiRelationshipsAffected,
      zbi_health_suffered: zbiHealthSuffered,
      zbi_privacy_affected: zbiPrivacyAffected,
      zbi_social_life_affected: zbiSocialLifeAffected,
      zbi_lost_control: zbiLostControl,
      zbi_uncertain_what_to_do: zbiUncertainWhatToDo,
      zbi_should_do_more: zbiShouldDoMore,
    };

    const response = await NeuroSuiteService.createCaregiverAssessment(request);

    if (response.success) {
      alert('Caregiver assessment saved!');
    } else {
      alert(`Error: ${response.error}`);
    }

    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-10 h-10 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Memory Clinic</h1>
                <p className="text-gray-600">Dementia Screening & Cognitive Care Coordination</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('cognitive')}
              className={`flex-1 px-6 py-4 font-semibold ${activeTab === 'cognitive' ? 'border-b-4 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Brain className="w-5 h-5 inline mr-2" />
              Cognitive Screening
            </button>
            <button
              onClick={() => setActiveTab('staging')}
              className={`flex-1 px-6 py-4 font-semibold ${activeTab === 'staging' ? 'border-b-4 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <TrendingDown className="w-5 h-5 inline mr-2" />
              Dementia Staging
            </button>
            <button
              onClick={() => setActiveTab('caregiver')}
              className={`flex-1 px-6 py-4 font-semibold ${activeTab === 'caregiver' ? 'border-b-4 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Users className="w-5 h-5 inline mr-2" />
              Caregiver Support
            </button>
          </div>
        </div>

        {/* Cognitive Assessment Tab */}
        {activeTab === 'cognitive' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Montreal Cognitive Assessment (MoCA)</h2>

                <div className="mb-4">
                  <label htmlFor="years-education" className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Education
                  </label>
                  <input
                    id="years-education"
                    name="years-education"
                    type="number"
                    value={yearsEducation}
                    onChange={(e) => setYearsEducation(parseInt(e.target.value))}
                    className="w-32 px-4 py-2 border rounded-lg"
                    min="0"
                    max="25"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Add 1 point if ≤12 years (MoCA adjustment)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="moca-visuospatial" className="block text-sm font-medium text-gray-700 mb-1">
                      Visuospatial/Executive (0-5)
                    </label>
                    <input
                      id="moca-visuospatial"
                      name="moca-visuospatial"
                      type="number"
                      value={mocaVisuospatial}
                      onChange={(e) => setMocaVisuospatial(Math.min(5, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="5"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-naming" className="block text-sm font-medium text-gray-700 mb-1">
                      Naming (0-3)
                    </label>
                    <input
                      id="moca-naming"
                      name="moca-naming"
                      type="number"
                      value={mocaNaming}
                      onChange={(e) => setMocaNaming(Math.min(3, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="3"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-attention" className="block text-sm font-medium text-gray-700 mb-1">
                      Attention (0-6)
                    </label>
                    <input
                      id="moca-attention"
                      name="moca-attention"
                      type="number"
                      value={mocaAttention}
                      onChange={(e) => setMocaAttention(Math.min(6, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="6"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-language" className="block text-sm font-medium text-gray-700 mb-1">
                      Language (0-3)
                    </label>
                    <input
                      id="moca-language"
                      name="moca-language"
                      type="number"
                      value={mocaLanguage}
                      onChange={(e) => setMocaLanguage(Math.min(3, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="3"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-abstraction" className="block text-sm font-medium text-gray-700 mb-1">
                      Abstraction (0-2)
                    </label>
                    <input
                      id="moca-abstraction"
                      name="moca-abstraction"
                      type="number"
                      value={mocaAbstraction}
                      onChange={(e) => setMocaAbstraction(Math.min(2, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="2"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-delayed-recall" className="block text-sm font-medium text-gray-700 mb-1">
                      Delayed Recall (0-5)
                    </label>
                    <input
                      id="moca-delayed-recall"
                      name="moca-delayed-recall"
                      type="number"
                      value={mocaDelayedRecall}
                      onChange={(e) => setMocaDelayedRecall(Math.min(5, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="5"
                    />
                  </div>
                  <div>
                    <label htmlFor="moca-orientation" className="block text-sm font-medium text-gray-700 mb-1">
                      Orientation (0-6)
                    </label>
                    <input
                      id="moca-orientation"
                      name="moca-orientation"
                      type="number"
                      value={mocaOrientation}
                      onChange={(e) => setMocaOrientation(Math.min(6, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      max="6"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveCognitiveAssessment}
                  disabled={saving}
                  className="w-full mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300"
                >
                  {saving ? 'Saving...' : 'Save Cognitive Assessment'}
                </button>
              </div>
            </div>

            {/* Score Card */}
            <div className="space-y-6">
              <div className={`bg-linear-to-br from-purple-500 to-purple-700 text-white rounded-lg shadow-lg p-6`}>
                <div className="text-center">
                  <div className="text-sm font-medium uppercase tracking-wide mb-2">MoCA Score</div>
                  <div className="text-6xl font-bold mb-2">{mocaAdjusted}</div>
                  <div className="text-sm">out of 30</div>
                  <div className="mt-4 pt-4 border-t border-white/30">
                    <div className="text-lg font-semibold">{cognitiveStatus}</div>
                    {yearsEducation <= 12 && (
                      <div className="text-xs mt-2">
                        Raw: {mocaTotal} + 1 (education adjustment)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Interpretation Guide */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-bold text-gray-900 mb-4">MoCA Interpretation</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>26-30</span>
                    <span className="text-green-600 font-semibold">Normal</span>
                  </div>
                  <div className="flex justify-between">
                    <span>18-25</span>
                    <span className="text-yellow-600 font-semibold">MCI</span>
                  </div>
                  <div className="flex justify-between">
                    <span>&lt;18</span>
                    <span className="text-red-600 font-semibold">Dementia</span>
                  </div>
                </div>
              </div>

              {/* History */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="font-bold text-gray-900 mb-4">Assessment History</h3>
                {cognitiveHistory.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm">No previous assessments</div>
                ) : (
                  <div className="space-y-3">
                    {cognitiveHistory.slice(0, 5).map((assessment) => (
                      <div key={assessment.id} className="border-l-4 border-purple-500 pl-3 py-2">
                        <div className="flex justify-between">
                          <div className="text-sm font-semibold">{assessment.assessment_tool}</div>
                          <div className="text-lg font-bold">
                            {assessment.moca_total_score || assessment.mmse_total_score}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(assessment.assessment_date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dementia Staging Tab */}
        {activeTab === 'staging' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Clinical Dementia Rating (CDR)</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Rate each domain based on patient and informant interview
                </p>

                <div className="space-y-4">
                  {[
                    { label: 'Memory', value: cdrMemory, setter: setCdrMemory },
                    { label: 'Orientation', value: cdrOrientation, setter: setCdrOrientation },
                    { label: 'Judgment & Problem Solving', value: cdrJudgment, setter: setCdrJudgment },
                    { label: 'Community Affairs', value: cdrCommunity, setter: setCdrCommunity },
                    { label: 'Home & Hobbies', value: cdrHome, setter: setCdrHome },
                    { label: 'Personal Care', value: cdrPersonalCare, setter: setCdrPersonalCare },
                  ].map((domain) => (
                    <div key={domain.label}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {domain.label}
                      </label>
                      <select
                        value={domain.value}
                        onChange={(e) => domain.setter(parseFloat(e.target.value) as CDRScore)}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="0">0 - None</option>
                        <option value="0.5">0.5 - Questionable</option>
                        <option value="1">1 - Mild</option>
                        <option value="2">2 - Moderate</option>
                        <option value="3">3 - Severe</option>
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveDementiaStaging}
                  disabled={saving}
                  className="w-full mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300"
                >
                  {saving ? 'Saving...' : 'Save Dementia Staging'}
                </button>
              </div>
            </div>

            <div>
              <div className="bg-linear-to-br from-indigo-500 to-indigo-700 text-white rounded-lg shadow-lg p-6">
                <div className="text-center">
                  <div className="text-sm font-medium uppercase tracking-wide mb-2">CDR Global</div>
                  <div className="text-6xl font-bold mb-4">{cdrGlobal}</div>
                  <div className="text-lg font-semibold">{dementiaStage}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Caregiver Support Tab */}
        {activeTab === 'caregiver' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Caregiver Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Caregiver Name"
                    value={caregiverName}
                    onChange={(e) => setCaregiverName(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Relationship (e.g., Spouse, Daughter)"
                    value={caregiverRelationship}
                    onChange={(e) => setCaregiverRelationship(e.target.value)}
                    className="px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Zarit Burden Interview (Short Form)</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Rate how often you feel this way: 0=Never, 1=Rarely, 2=Sometimes, 3=Quite frequently, 4=Nearly always
                </p>

                <div className="space-y-4">
                  {[
                    { label: 'Do you feel strain caring for your relative?', value: zbiFeelStrain, setter: setZbiFeelStrain },
                    { label: 'Has caring affected the time you have for yourself?', value: zbiTimeAffected, setter: setZbiTimeAffected },
                    { label: 'Do you feel stressed between work/family and caring?', value: zbiStressed, setter: setZbiStressed },
                    { label: 'Do you feel embarrassed by your relative\'s behavior?', value: zbiEmbarrassed, setter: setZbiEmbarrassed },
                    { label: 'Do you feel angry when around your relative?', value: zbiAngry, setter: setZbiAngry },
                    { label: 'Have relationships been affected negatively?', value: zbiRelationshipsAffected, setter: setZbiRelationshipsAffected },
                    { label: 'Are you afraid for your relative\'s future?', value: zbiHealthSuffered, setter: setZbiHealthSuffered },
                    { label: 'Do you feel you have lost control of your life?', value: zbiPrivacyAffected, setter: setZbiPrivacyAffected },
                    { label: 'Do you wish you could leave care to someone else?', value: zbiSocialLifeAffected, setter: setZbiSocialLifeAffected },
                    { label: 'Do you feel uncertain about what to do?', value: zbiLostControl, setter: setZbiLostControl },
                    { label: 'Do you feel you should be doing more?', value: zbiUncertainWhatToDo, setter: setZbiUncertainWhatToDo },
                    { label: 'Do you feel you could do a better job?', value: zbiShouldDoMore, setter: setZbiShouldDoMore },
                  ].map((item, index) => (
                    <div key={index}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {item.label}
                      </label>
                      <select
                        value={item.value}
                        onChange={(e) => item.setter(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="0">0 - Never</option>
                        <option value="1">1 - Rarely</option>
                        <option value="2">2 - Sometimes</option>
                        <option value="3">3 - Quite frequently</option>
                        <option value="4">4 - Nearly always</option>
                      </select>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveCaregiverAssessment}
                  disabled={saving}
                  className="w-full mt-6 bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-300"
                >
                  {saving ? 'Saving...' : 'Save Caregiver Assessment'}
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className={`rounded-lg shadow-lg p-6 ${zbiTotal > 40 ? 'bg-linear-to-br from-red-500 to-red-700' : zbiTotal > 20 ? 'bg-linear-to-br from-yellow-500 to-yellow-700' : 'bg-linear-to-br from-green-500 to-green-700'} text-white`}>
                <div className="text-center">
                  <div className="text-sm font-medium uppercase tracking-wide mb-2">Zarit Burden Score</div>
                  <div className="text-6xl font-bold mb-2">{zbiTotal}</div>
                  <div className="text-sm">out of 48</div>
                  <div className="mt-4 pt-4 border-t border-white/30">
                    <div className="text-lg font-semibold">{burdenLevel}</div>
                  </div>
                </div>
              </div>

              {zbiTotal > 20 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2">Intervention Recommended</h3>
                      <ul className="text-sm text-gray-700 space-y-2">
                        <li>• Respite care services</li>
                        <li>• Caregiver support group</li>
                        <li>• Individual counseling</li>
                        <li>• Adult day care for patient</li>
                        <li>• Home health aide services</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryClinicDashboard;
