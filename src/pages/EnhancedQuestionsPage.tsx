// src/pages/EnhancedQuestionsPage.tsx - Senior-Friendly Questions with AI & Voice
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Send, Lightbulb, MessageCircle } from 'lucide-react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';

interface Question {
  id: string;
  question_text: string;
  category: 'general' | 'health' | 'medication' | 'emergency' | 'technical';
  status: 'pending' | 'answered' | 'closed';
  response_text?: string;
  nurse_notes?: string;
  ai_suggestions?: string[];
  responded_at?: string;
  created_at: string;
  urgency: 'low' | 'medium' | 'high';
}

// Common senior questions for suggestions
const SENIOR_QUESTION_SUGGESTIONS = [
  "I'm feeling dizzy when I stand up",
  "I missed my medication this morning",
  "I have a headache that won't go away",
  "My blood pressure seems high today",
  "I'm feeling anxious about my upcoming appointment",
  "I can't remember if I took my pills",
  "I'm having trouble sleeping",
  "My pain is worse than usual",
  "I need help understanding my test results",
  "Can someone check on me today?"
];

// Health-related keywords for urgency detection
const URGENT_KEYWORDS = [
  'chest pain', 'can\'t breathe', 'emergency', 'dizzy', 'fell', 'bleeding',
  'severe pain', 'can\'t move', 'heart', 'stroke', 'unconscious', 'urgent'
];

const EnhancedQuestionsPage: React.FC = () => {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const supabase = useSupabaseClient();
  const user = useUser();

  // State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Question['category']>('general');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Voice recognition
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Initialize voice recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setCurrentQuestion(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        setError('Voice recognition failed. Please try typing instead.');
      };

      setVoiceSupported(true);
    }
  }, []);

  // Load questions
  useEffect(() => {
    loadQuestions();
  }, [user]);

  const loadQuestions = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Use existing user_questions table for medical questions
      const { data, error } = await supabase
        .from('user_questions')
        .select(`
          *,
          responded_by_profile:profiles!responded_by(first_name, last_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load questions:', error);
        setError('Failed to load your questions. Please try again.');
        return;
      }

      // Transform data to match our interface
      const transformedQuestions = (data || []).map(q => ({
        id: q.id,
        question_text: q.question_text,
        category: q.category || 'general',
        status: q.status || 'pending',
        urgency: q.urgency || 'low',
        response_text: q.response_text,
        nurse_notes: q.nurse_notes,
        ai_suggestions: q.ai_suggestions?.resources || [],
        responded_at: q.responded_at,
        created_at: q.created_at
      }));

      setQuestions(transformedQuestions);
    } catch (err) {
      console.error('Failed to load questions:', err);
      setError('Failed to load your questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const detectUrgency = (text: string): Question['urgency'] => {
    const lowerText = text.toLowerCase();
    if (URGENT_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    }
    if (lowerText.includes('pain') || lowerText.includes('medication') || lowerText.includes('worried')) {
      return 'medium';
    }
    return 'low';
  };

  const submitQuestion = async () => {
    if (!currentQuestion.trim() || !user?.id) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const urgency = detectUrgency(currentQuestion);

      // Submit to existing user_questions table
      const { error } = await supabase
        .from('user_questions')
        .insert([{
          user_id: user.id,
          question_text: currentQuestion.trim(),
          category: selectedCategory,
          urgency,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        setError('Failed to send your question. Please try again.');
        return;
      }

      setSuccess(urgency === 'high'
        ? 'Your urgent question has been sent to the nurse immediately!'
        : 'Your question has been sent to your nurse. They\'ll respond soon.');

      setCurrentQuestion('');
      setSelectedCategory('general');
      setShowSuggestions(false);

      // Reload questions
      setTimeout(() => {
        loadQuestions();
        setSuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Failed to submit question:', err);
      setError('Failed to send your question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startVoiceRecognition = () => {
    if (recognitionRef.current && voiceSupported) {
      setIsListening(true);
      setError(null);
      recognitionRef.current.start();
    }
  };

  const stopVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setCurrentQuestion(suggestion);
    setShowSuggestions(false);
    // Auto-categorize based on suggestion
    if (suggestion.includes('medication') || suggestion.includes('pills')) {
      setSelectedCategory('medication');
    } else if (suggestion.includes('pain') || suggestion.includes('dizzy') || suggestion.includes('headache')) {
      setSelectedCategory('health');
    }
  };

  const getUrgencyColor = (urgency: Question['urgency']) => {
    switch (urgency) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getStatusColor = (status: Question['status']) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'answered': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className="min-h-screen py-8"
      style={{
        background: branding.gradient || `linear-gradient(to bottom right, ${branding.primaryColor}, ${branding.secondaryColor})`,
        color: branding.textColor
      }}
    >
      <div className="max-w-4xl mx-auto px-4">

        {/* Header with Back Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center mb-4 px-4 py-2 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
            style={{ color: branding.primaryColor || '#003865' }}
          >
            <ArrowLeft size={20} className="mr-2" />
            Back to Dashboard
          </button>

          <h1 className="text-3xl font-bold text-center" style={{ color: branding.primaryColor || '#003865' }}>
            💬 Ask Your Nurse
          </h1>
          <p className="text-center mt-2" style={{ color: branding.textColor || '#374151' }}>
            Get help from your care team anytime
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Question Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Ask a Question</h2>

          {/* Quick Suggestions */}
          <div className="mb-4">
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center text-blue-600 hover:text-blue-800 mb-2"
            >
              <Lightbulb size={16} className="mr-1" />
              Need ideas? Click for common questions
            </button>

            {showSuggestions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 bg-blue-50 rounded-lg">
                {SENIOR_QUESTION_SUGGESTIONS.slice(0, 6).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => selectSuggestion(suggestion)}
                    className="text-left p-2 bg-white rounded shadow-sm hover:shadow-md transition text-sm"
                  >
                    💡 {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What type of question is this?
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as Question['category'])}
              className="block w-full p-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="general">General Question</option>
              <option value="health">Health Concern</option>
              <option value="medication">Medication Question</option>
              <option value="emergency">Emergency/Urgent</option>
              <option value="technical">App Help</option>
            </select>
          </div>

          {/* Question Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Question
            </label>
            <div className="relative">
              <textarea
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                placeholder="Type your question here, or use the microphone to speak..."
                rows={4}
                className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 pr-16"
                maxLength={1000}
              />

              {/* Voice Button */}
              {voiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                  className={`absolute right-3 top-3 p-2 rounded-full transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                  title={isListening ? 'Stop speaking' : 'Click to speak'}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}
            </div>

            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>{isListening ? '🎤 Listening...' : 'Type or speak your question'}</span>
              <span>{currentQuestion.length}/1000</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={submitQuestion}
            disabled={isSubmitting || !currentQuestion.trim()}
            className="w-full py-3 px-6 text-white text-lg font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
            style={{ backgroundColor: branding.secondaryColor || '#8cc63f' }}
          >
            {isSubmitting ? (
              'Sending to Nurse...'
            ) : (
              <>
                <Send size={20} className="mr-2" />
                Send to Nurse
              </>
            )}
          </button>

          {selectedCategory === 'emergency' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-medium">
                🚨 For immediate emergencies, call 911 or go to your nearest emergency room.
              </p>
            </div>
          )}
        </div>

        {/* Questions History */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b flex items-center">
            <MessageCircle size={20} className="mr-2" style={{ color: branding.primaryColor || '#003865' }} />
            <h3 className="text-lg font-semibold" style={{ color: branding.textColor || '#374151' }}>Your Questions & Responses</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              Loading your questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <p>You haven't asked any questions yet.</p>
              <p className="text-sm">Use the form above to ask your nurse anything!</p>
            </div>
          ) : (
            <div className="divide-y">
              {questions.map((question) => (
                <div key={question.id} className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(question.status)}`}>
                        {question.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full border ${getUrgencyColor(question.urgency)}`}>
                        {question.urgency.toUpperCase()} PRIORITY
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                        {question.category.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(question.created_at).toLocaleDateString()} at{' '}
                      {new Date(question.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Your Question:</h4>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-lg">{question.question_text}</p>
                  </div>

                  {question.response_text && (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-3">
                      <h4 className="font-medium text-blue-900 mb-2">👩‍⚕️ Nurse Response:</h4>
                      <p className="text-blue-800">{question.response_text}</p>
                      {question.responded_at && (
                        <p className="text-xs text-blue-600 mt-2">
                          Responded: {new Date(question.responded_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {question.ai_suggestions && question.ai_suggestions.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-purple-900 mb-2">💡 Related Resources:</h5>
                      <ul className="text-sm text-purple-800 space-y-1">
                        {question.ai_suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">💡 How to Use:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Type your question or click the 🎤 to speak</li>
            <li>• Your nurse will respond within a few hours</li>
            <li>• For emergencies, always call 911 first</li>
            <li>• All conversations are private and secure</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EnhancedQuestionsPage;