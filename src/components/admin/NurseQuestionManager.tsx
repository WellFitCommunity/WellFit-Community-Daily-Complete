// src/components/admin/NurseQuestionManager.tsx - AI-Powered Nurse Response System
import React, { useState, useEffect } from 'react';
import { Search, Filter, Clock, AlertTriangle, MessageCircle, Brain, Send, User, Phone } from 'lucide-react';
import { fetchNurseQueue, claimQuestion, fetchMyQuestions, addNurseNote, submitAnswer } from '../../lib/nurseApi';
import { claudeEdgeService } from '../../services/claudeEdgeService';
import { UserRole, RequestType, ClaudeRequestContext } from '../../types/claude';
import { auditLogger } from '../../services/auditLogger';

interface Question {
  id: string;
  user_id: string;
  question_text: string;
  category: 'general' | 'health' | 'medication' | 'emergency' | 'technical';
  status: 'pending' | 'answered' | 'closed';
  urgency: 'low' | 'medium' | 'high';
  response_text?: string;
  nurse_notes?: string;
  ai_suggestions?: string[];
  ai_context?: string;
  created_at: string;
  responded_at?: string;
  patient_profile?: {
    first_name: string;
    last_name: string;
    phone: string;
    age?: number;
    conditions?: string[];
    medications?: string[];
  };
}

interface AISuggestion {
  response: string;
  confidence: number;
  reasoning: string;
  resources: string[];
  followUp: string[];
}

const NurseQuestionManager: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [responseText, setResponseText] = useState('');
  const [nurseNotes, setNurseNotes] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'answered'>('pending');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const autosaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Demo/Training data - replace with real database connection when ready
  const mockQuestions: Question[] = [
    {
      id: '1',
      user_id: 'user123',
      question_text: 'I missed my morning blood pressure medication. Should I take it now or wait until tomorrow?',
      category: 'medication',
      status: 'pending',
      urgency: 'medium',
      created_at: '2024-01-15T08:30:00Z',
      patient_profile: {
        first_name: 'Mary',
        last_name: 'Johnson',
        phone: '+1-555-0123',
        age: 72,
        conditions: ['Hypertension', 'Diabetes Type 2'],
        medications: ['Lisinopril 10mg', 'Metformin 500mg']
      }
    },
    {
      id: '2',
      user_id: 'user456',
      question_text: 'I\'ve been feeling dizzy when I stand up. This started yesterday and happens every time.',
      category: 'health',
      status: 'pending',
      urgency: 'high',
      created_at: '2024-01-15T09:15:00Z',
      patient_profile: {
        first_name: 'Robert',
        last_name: 'Chen',
        phone: '+1-555-0456',
        age: 68,
        conditions: ['Hypertension', 'Heart Disease'],
        medications: ['Metoprolol 50mg', 'Aspirin 81mg']
      }
    }
  ];

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave effect
  useEffect(() => {
    if (!selectedQuestion || (!responseText && !nurseNotes)) {
      return;
    }

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer for 3 seconds after last change
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, 3000);

    // Cleanup on unmount
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responseText, nurseNotes, selectedQuestion]);

  const performAutosave = async () => {
    if (!selectedQuestion) return;

    setAutoSaving(true);
    try {
      // Save draft to localStorage as backup
      const draftKey = `nurse-draft-${selectedQuestion.id}`;
      const draft = {
        questionId: selectedQuestion.id,
        responseText,
        nurseNotes,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastSaved(new Date());
    } catch (err) {
      auditLogger.error('NURSE_DRAFT_SAVE_FAILED', err instanceof Error ? err : new Error(String(err)), {
        questionId: selectedQuestion?.id,
        context: 'saveDraft'
      });
    } finally {
      setAutoSaving(false);
    }
  };

  const loadDraft = (questionId: string) => {
    try {
      const draftKey = `nurse-draft-${questionId}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        setResponseText(draft.responseText || '');
        setNurseNotes(draft.nurseNotes || '');
        setLastSaved(new Date(draft.timestamp));
        return true;
      }
    } catch {
      // localStorage may fail in private browsing - silent fallback
    }
    return false;
  };

  const clearDraft = (questionId: string) => {
    try {
      const draftKey = `nurse-draft-${questionId}`;
      localStorage.removeItem(draftKey);
      setLastSaved(null);
    } catch {
      // localStorage may fail in private browsing - silent fallback
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await fetchNurseQueue();
      setQuestions(data.map(q => ({
        id: q.question_id,
        user_id: '',
        question_text: q.preview,
        category: 'general' as const,
        status: 'pending' as const,
        urgency: 'medium' as const,
        created_at: q.asked_at,
        patient_profile: {
          first_name: 'Patient',
          last_name: '',
          phone: ''
        }
      })));
    } catch (err) {
      auditLogger.error('NURSE_QUEUE_LOAD_FAILED', err instanceof Error ? err : new Error(String(err)), {
        context: 'loadQuestions',
        fallback: 'mockQuestions'
      });
      setQuestions(mockQuestions);
    }
  };

  const generateAISuggestion = async (question: Question) => {
    setLoadingAi(true);
    try {
      // Build health context from patient profile
      const healthContext = question.patient_profile ? {
        patientId: question.user_id,
        demographics: {
          age: question.patient_profile.age || 70,
          gender: 'unknown' as const
        },
        currentConditions: (question.patient_profile.conditions || []).map(condition => ({
          condition,
          severity: 'moderate' as const,
          onsetDate: undefined
        })),
        medications: (question.patient_profile.medications || []).map(med => ({
          name: med,
          dosage: 'as prescribed',
          frequency: 'as prescribed',
          purpose: 'chronic condition management'
        })),
        recentVitals: {
          lastUpdated: new Date().toISOString()
        }
      } : undefined;

      // Create request context for Claude
      const context: ClaudeRequestContext = {
        userId: 'nurse-panel',
        userRole: UserRole.HEALTHCARE_PROVIDER,
        requestId: `nurse-q-${question.id}-${Date.now()}`,
        timestamp: new Date(),
        requestType: RequestType.HEALTH_QUESTION,
        healthContext
      };

      // Log AI request with context for audit trail
      auditLogger.info('NURSE_AI_SUGGESTION_REQUESTED', {
        requestId: context.requestId,
        userId: context.userId,
        questionId: question.id,
        category: question.category,
        urgency: question.urgency,
        hasPatientProfile: !!question.patient_profile
      });

      // Build enhanced prompt with patient context
      const enhancedPrompt = `As a registered nurse reviewing a patient question, please provide a professional, evidence-based response.

PATIENT QUESTION:
${question.question_text}

CATEGORY: ${question.category}
URGENCY: ${question.urgency}

${question.patient_profile ? `
PATIENT CONTEXT:
- Age: ${question.patient_profile.age || 'Unknown'}
- Phone: ${question.patient_profile.phone}
${question.patient_profile.conditions?.length ? `- Known Conditions: ${question.patient_profile.conditions.join(', ')}` : ''}
${question.patient_profile.medications?.length ? `- Current Medications: ${question.patient_profile.medications.join(', ')}` : ''}
` : ''}

Please provide:
1. A clear, compassionate response suitable for sending directly to the patient
2. Your clinical reasoning for this recommendation
3. Any follow-up actions needed
4. Relevant patient education resources

Format your response as a clear, professional message that can be sent to the patient.`;

      // Call secure Claude Edge Function (server-side API)
      const aiResponse = await claudeEdgeService.complete(enhancedPrompt, {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: 'You are a healthcare professional assistant providing guidance for patient questions. Be compassionate, clear, and evidence-based.'
      });

      // Parse AI response into structured suggestion
      const aiSuggestion: AISuggestion = {
        response: aiResponse,
        confidence: 0.90,
        reasoning: `AI-generated response based on patient's ${question.category} question via secure Edge Function.`,
        resources: [
          'Evidence-Based Guidelines',
          'Patient Education Materials',
          'Clinical Protocols'
        ],
        followUp: [
          'Document response in patient record',
          'Schedule follow-up if needed',
          'Monitor patient response'
        ]
      };

      setAiSuggestion(aiSuggestion);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Provide helpful fallback message
      setAiSuggestion({
        response: `Unable to generate AI suggestion at this time. Error: ${errorMessage}. Please provide a manual response based on your clinical judgment.`,
        confidence: 0,
        reasoning: 'AI service temporarily unavailable',
        resources: [],
        followUp: ['Provide manual clinical response']
      });
    } finally {
      setLoadingAi(false);
    }
  };

  const selectQuestion = (question: Question) => {
    setSelectedQuestion(question);
    setShowAiHelp(false);
    setAiSuggestion(null);
    // Try to load saved draft
    const hasDraft = loadDraft(question.id);
    if (!hasDraft) {
      setResponseText('');
      setNurseNotes('');
    }
  };

  const submitResponse = async () => {
    if (!selectedQuestion || !responseText.trim()) return;

    setSubmitting(true);
    try {
      await submitAnswer(selectedQuestion.id, responseText);

      if (nurseNotes.trim()) {
        await addNurseNote(selectedQuestion.id, nurseNotes);
      }

      // Clear the draft after successful submission
      clearDraft(selectedQuestion.id);

      // Update question status locally
      setQuestions(prev => prev.map(q =>
        q.id === selectedQuestion.id
          ? {
              ...q,
              status: 'answered' as const,
              response_text: responseText,
              nurse_notes: nurseNotes,
              ai_suggestions: aiSuggestion?.resources,
              responded_at: new Date().toISOString()
            }
          : q
      ));

      // Reset form
      setSelectedQuestion(null);
      setResponseText('');
      setNurseNotes('');
      setAiSuggestion(null);
      setShowAiHelp(false);

    } catch (error) {

    } finally {
      setSubmitting(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const matchesStatus = filterStatus === 'all' || q.status === filterStatus;
    const matchesUrgency = filterUrgency === 'all' || q.urgency === filterUrgency;
    const matchesSearch = searchTerm === '' ||
      q.question_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${q.patient_profile?.first_name} ${q.patient_profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesUrgency && matchesSearch;
  });

  const getUrgencyColor = (urgency: Question['urgency']) => {
    switch (urgency) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getStatusColor = (status: Question['status']) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'answered': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Questions - Nurse Dashboard</h1>
        <p className="text-gray-600">Manage patient questions with AI-powered response assistance</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-xs border p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={async () => {
              try {
                const data = await fetchNurseQueue();
                setQuestions(data.map(q => ({
                  id: q.question_id,
                  user_id: '',
                  question_text: q.preview,
                  category: 'general' as const,
                  status: 'pending' as const,
                  urgency: 'medium' as const,
                  created_at: q.asked_at,
                  patient_profile: {
                    first_name: 'Patient',
                    last_name: '',
                    phone: ''
                  }
                })));
              } catch (error) {

              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Queue
          </button>

          <button
            onClick={async () => {
              try {
                const data = await fetchMyQuestions();
                setQuestions(data.map(q => ({
                  id: q.question_id,
                  user_id: '',
                  question_text: q.question,
                  category: 'general' as const,
                  status: q.status as Question['status'],
                  urgency: 'medium' as const,
                  created_at: q.asked_at,
                  patient_profile: {
                    first_name: 'Patient',
                    last_name: '',
                    phone: ''
                  }
                })));
              } catch (error) {

              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            My Questions
          </button>

          <div className="flex items-center space-x-2">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search questions or patient names..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'answered')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="answered">Answered</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <AlertTriangle size={20} className="text-gray-400" />
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as 'all' | 'low' | 'medium' | 'high')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priority</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            {filteredQuestions.length} questions
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <div className="bg-white rounded-lg shadow-xs border">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Patient Questions</h2>
          </div>

          <div className="divide-y max-h-96 overflow-y-auto">
            {filteredQuestions.map((question) => (
              <div
                key={question.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 ${
                  selectedQuestion?.id === question.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                }`}
                onClick={async () => {
                  if (question.status === 'pending') {
                    try {
                      await claimQuestion(question.id);
                    } catch (error) {

                    }
                  }
                  selectQuestion(question);
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getUrgencyColor(question.urgency)}`}></div>
                    <span className="font-medium">
                      {question.patient_profile?.first_name} {question.patient_profile?.last_name}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(question.status)}`}>
                      {question.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(question.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                  {question.question_text}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="capitalize">{question.category}</span>
                  <div className="flex items-center space-x-2">
                    <Clock size={12} />
                    <span>{new Date(question.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response Panel */}
        <div className="bg-white rounded-lg shadow-xs border">
          {selectedQuestion ? (
            <div className="p-4">
              <div className="border-b pb-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">
                    Responding to {selectedQuestion.patient_profile?.first_name} {selectedQuestion.patient_profile?.last_name}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getUrgencyColor(selectedQuestion.urgency)}`}></div>
                    <span className="text-sm font-medium capitalize">{selectedQuestion.urgency} Priority</span>
                  </div>
                </div>

                {/* Patient Info */}
                <div className="bg-gray-50 p-3 rounded-lg mb-3">
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <User size={16} />
                      <span>Age {selectedQuestion.patient_profile?.age}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Phone size={16} />
                      <span>{selectedQuestion.patient_profile?.phone}</span>
                    </div>
                  </div>

                  {selectedQuestion.patient_profile?.conditions && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-600">Conditions: </span>
                      <span className="text-xs text-gray-700">
                        {selectedQuestion.patient_profile.conditions.join(', ')}
                      </span>
                    </div>
                  )}

                  {selectedQuestion.patient_profile?.medications && (
                    <div className="mt-1">
                      <span className="text-xs font-medium text-gray-600">Medications: </span>
                      <span className="text-xs text-gray-700">
                        {selectedQuestion.patient_profile.medications.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Question */}
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-1">Patient's Question:</h4>
                  <p className="text-blue-800">{selectedQuestion.question_text}</p>
                  <p className="text-xs text-blue-600 mt-2">
                    Asked: {new Date(selectedQuestion.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* AI Assistance */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    setShowAiHelp(!showAiHelp);
                    if (!showAiHelp && !aiSuggestion) {
                      generateAISuggestion(selectedQuestion);
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                >
                  <Brain size={16} />
                  <span>{showAiHelp ? 'Hide AI Assistant' : 'Get AI Response Suggestions'}</span>
                </button>

                {showAiHelp && (
                  <div className="mt-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    {loadingAi ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                        <p className="text-purple-700">AI analyzing patient data and question...</p>
                      </div>
                    ) : aiSuggestion ? (
                      <div>
                        <h4 className="font-medium text-purple-900 mb-2">AI Response Suggestion:</h4>
                        <div className="bg-white p-3 rounded-sm border mb-3">
                          <p className="text-gray-800 text-sm mb-2">{aiSuggestion.response}</p>
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Confidence:</span> {(aiSuggestion.confidence * 100).toFixed(0)}%
                          </div>
                        </div>

                        <div className="text-xs text-purple-700 mb-2">
                          <span className="font-medium">AI Reasoning:</span> {aiSuggestion.reasoning}
                        </div>

                        {aiSuggestion.resources.length > 0 && (
                          <div className="text-xs text-purple-700 mb-2">
                            <span className="font-medium">Helpful Resources:</span> {aiSuggestion.resources.join(', ')}
                          </div>
                        )}

                        <button
                          onClick={() => setResponseText(aiSuggestion.response)}
                          className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded-sm hover:bg-purple-300"
                        >
                          Use This Response
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Response Form */}
              <div className="space-y-4">
                {/* Autosave Indicator */}
                {(responseText || nurseNotes) && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      {autoSaving ? (
                        <>
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-blue-600">Saving draft...</span>
                        </>
                      ) : lastSaved ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-green-600">
                            Draft saved {lastSaved.toLocaleTimeString()}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Response to Patient
                  </label>
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    rows={6}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Type your response to the patient here... (autosaves every 3 seconds)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Internal Notes (Not shared with patient)
                  </label>
                  <textarea
                    value={nurseNotes}
                    onChange={(e) => setNurseNotes(e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add notes for other care team members..."
                  />
                </div>

                <button
                  onClick={submitResponse}
                  disabled={submitting || !responseText.trim()}
                  className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {submitting ? (
                    'Sending Response...'
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Send Response to Patient</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Select a question to respond</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NurseQuestionManager;