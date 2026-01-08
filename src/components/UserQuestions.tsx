// UserQuestions Component - For both users and admins
import React, { useState, useEffect } from 'react';

interface UserQuestion {
  id: string;
  question_text: string;
  category: string;
  status: 'pending' | 'answered' | 'closed';
  response_text?: string;
  responded_at?: string;
  created_at: string;
  user_email?: string;
  profiles?: {
    first_name: string;
    last_name: string;
    phone: string;
  };
}

interface UserQuestionsProps {
  isAdmin?: boolean;
  // Pass these as props from your parent component
  onSubmitQuestion?: (questionData: { question_text: string; category: string }) => Promise<void>;
  onSubmitResponse?: (questionId: string, responseText: string) => Promise<void>;
  onLoadQuestions?: () => Promise<UserQuestion[]>;
  currentUser?: { id: string; email?: string };
}

export default function UserQuestions({
  isAdmin = false,
  onSubmitQuestion,
  onSubmitResponse,
  onLoadQuestions,
  currentUser: _currentUser
}: UserQuestionsProps) {
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [category, setCategory] = useState<'general' | 'health' | 'technical' | 'account'>('general');
  const [responseText, setResponseText] = useState('');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mock data for demonstration
  const mockQuestions: UserQuestion[] = [
    {
      id: '1',
      question_text: 'How do I update my medication list in the app?',
      category: 'technical',
      status: 'answered',
      response_text: 'You can update your medication list by going to the Health Profile section and clicking "Edit Medications". Make sure to save your changes.',
      responded_at: '2024-01-15T10:30:00Z',
      created_at: '2024-01-14T14:20:00Z',
      user_email: 'john.doe@example.com',
      profiles: {
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890'
      }
    },
    {
      id: '2',
      question_text: 'I\'ve been experiencing some dizziness. Should I be concerned?',
      category: 'health',
      status: 'pending',
      created_at: '2024-01-16T09:15:00Z',
      user_email: 'jane.smith@example.com',
      profiles: {
        first_name: 'Jane',
        last_name: 'Smith',
        phone: '+1234567891'
      }
    }
  ];

  // Load questions
  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (onLoadQuestions) {
        const loadedQuestions = await onLoadQuestions();
        setQuestions(loadedQuestions);
      } else {
        // Use mock data if no loader provided
        setQuestions(mockQuestions);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load questions');
      // Fallback to mock data
      setQuestions(mockQuestions);
    } finally {
      setLoading(false);
    }
  };

  const submitQuestion = async () => {
    if (!newQuestion.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (onSubmitQuestion) {
        await onSubmitQuestion({
          question_text: newQuestion.trim(),
          category,
        });
      } else {
        // Mock submission
      }
      
      setSuccess('Question submitted successfully!');
      setNewQuestion('');
      setCategory('general');
      loadQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit question');
    } finally {
      setSubmitting(false);
    }
  };

  const submitResponse = async (questionId: string) => {
    if (!responseText.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      if (onSubmitResponse) {
        await onSubmitResponse(questionId, responseText.trim());
      } else {
        // Mock response submission
      }
      
      setSuccess('Response submitted successfully!');
      setResponseText('');
      setRespondingTo(null);
      loadQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'answered': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'health': return 'text-red-600 bg-red-100';
      case 'technical': return 'text-blue-600 bg-blue-100';
      case 'account': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">
        {isAdmin ? 'User Questions - Admin Panel' : 'My Care Team Questions'}
      </h2>

      {/* Submit New Question (Users Only) */}
      {!isAdmin && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Ask Your Care Team</h3>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-sm mb-4">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-sm mb-4">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="general">General</option>
                <option value="health">Health</option>
                <option value="technical">Technical Support</option>
                <option value="account">Account</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Question
              </label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={4}
                className="block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="What would you like to ask your care team?"
                maxLength={1000}
              />
              <div className="text-sm text-gray-500 mt-1">
                {newQuestion.length}/1000 characters
              </div>
            </div>

            <button
              onClick={submitQuestion}
              disabled={submitting || !newQuestion.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Question'}
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">
            {isAdmin ? 'Pending Questions' : 'Your Questions'}
          </h3>
          <button
            onClick={loadQuestions}
            disabled={loading}
            className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isAdmin ? 'No pending questions' : 'You haven\'t asked any questions yet.'}
          </div>
        ) : (
          <div className="divide-y">
            {questions.map((question) => (
              <div key={question.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(question.status)}`}>
                      {question.status}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(question.category)}`}>
                      {question.category}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(question.created_at)}
                  </span>
                </div>

                {isAdmin && question.profiles && (
                  <div className="text-sm text-gray-600 mb-2">
                    From: {question.profiles.first_name} {question.profiles.last_name} 
                    ({question.user_email}) - {question.profiles.phone}
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-gray-800">{question.question_text}</p>
                </div>

                {question.response_text && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-3">
                    <div className="text-sm text-blue-600 font-medium mb-1">Care Team Response:</div>
                    <p className="text-gray-800">{question.response_text}</p>
                    {question.responded_at && (
                      <div className="text-xs text-gray-500 mt-1">
                        Responded: {formatDate(question.responded_at)}
                      </div>
                    )}
                  </div>
                )}

                {isAdmin && question.status === 'pending' && (
                  <div>
                    {respondingTo === question.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          rows={3}
                          className="block w-full border border-gray-300 rounded-md px-3 py-2"
                          placeholder="Write your response..."
                          maxLength={2000}
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => submitResponse(question.id)}
                            disabled={submitting || !responseText.trim()}
                            className="bg-green-600 text-white px-3 py-1 text-sm rounded-sm hover:bg-green-700 disabled:opacity-50"
                          >
                            {submitting ? 'Sending...' : 'Send Response'}
                          </button>
                          <button
                            onClick={() => {
                              setRespondingTo(null);
                              setResponseText('');
                            }}
                            className="bg-gray-600 text-white px-3 py-1 text-sm rounded-sm hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRespondingTo(question.id)}
                        className="bg-blue-600 text-white px-3 py-1 text-sm rounded-sm hover:bg-blue-700"
                      >
                        Respond
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">Integration Instructions:</h4>
        <p className="text-sm text-gray-600 mb-2">
          To connect this component to your app, pass these props:
        </p>
        <ul className="text-xs text-gray-500 space-y-1">
          <li><strong>onSubmitQuestion:</strong> Function to submit questions to your database</li>
          <li><strong>onSubmitResponse:</strong> Function for admins to respond to questions</li>
          <li><strong>onLoadQuestions:</strong> Function to load questions from your database</li>
          <li><strong>currentUser:</strong> Current user object from your auth system</li>
        </ul>
      </div>
    </div>
  );
}