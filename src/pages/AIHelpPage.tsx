// src/pages/AIHelpPage.tsx - AI-Enhanced Senior-Friendly Help
import React, { useState, useEffect, useRef } from 'react';
import { useBranding } from '../BrandingContext';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import claudeService from '../services/claudeService';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface UserActivity {
  hasCheckedInToday: boolean;
  hasUsedWordFind: boolean;
  hasUploadedPhotos: boolean;
  hasUsedHealthTracker: boolean;
  lastLoginDays: number;
  isNewUser: boolean;
}

const AIHelpPage: React.FC = () => {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userActivity, setUserActivity] = useState<UserActivity | null>(null);
  const [contextualSuggestions, setContextualSuggestions] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<SpeechRecognition | null>(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionClass = (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition || window.SpeechRecognition;
      recognition.current = new SpeechRecognitionClass();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setSearchTerm(transcript);
        setIsListening(false);
      };

      recognition.current.onerror = () => {
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Load user activity data
  useEffect(() => {
    const loadUserActivity = async () => {
      if (!user?.id) return;

      try {
        // Check recent check-ins
        const today = new Date().toISOString().split('T')[0];
        const { data: todayCheckin } = await supabase
          .from('check_ins')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', today)
          .limit(1);

        // Check if they've used various features
        const { data: communityPosts } = await supabase
          .from('community_moments')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        const { data: healthEntries } = await supabase
          .from('self_reports')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        // Calculate days since last login
        const lastLogin = new Date(user.last_sign_in_at || user.created_at);
        const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
        
        // Check if new user (account created within last 7 days)
        const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

        const activity: UserActivity = {
          hasCheckedInToday: (todayCheckin?.length || 0) > 0,
          hasUsedWordFind: false, // Would need to track this in local storage or separate table
          hasUploadedPhotos: (communityPosts?.length || 0) > 0,
          hasUsedHealthTracker: (healthEntries?.length || 0) > 0,
          lastLoginDays: daysSinceLogin,
          isNewUser: accountAge <= 7
        };

        setUserActivity(activity);
        generateContextualSuggestions(activity);
      } catch (error) {

      }
    };

    loadUserActivity();
  }, [user?.id, user?.created_at, user?.last_sign_in_at, supabase]);

  // Generate contextual suggestions based on user activity
  const generateContextualSuggestions = (activity: UserActivity) => {
    const suggestions: string[] = [];

    if (activity.isNewUser) {
      suggestions.push("Getting started with WellFit Community");
      suggestions.push("How to do your first daily check-in");
    }

    if (!activity.hasCheckedInToday) {
      suggestions.push("How to check in today");
      suggestions.push("What are the daily check-in buttons?");
    }

    if (!activity.hasUploadedPhotos) {
      suggestions.push("How to share photos with the community");
      suggestions.push("Uploading pictures from events");
    }

    if (!activity.hasUsedHealthTracker) {
      suggestions.push("How to track my health and symptoms");
      suggestions.push("What is the Health Tracker?");
    }

    if (activity.lastLoginDays > 7) {
      suggestions.push("What's new in WellFit Community?");
      suggestions.push("Catching up after being away");
    }

    setContextualSuggestions(suggestions.slice(0, 4));
  };

  // Smart search with natural language processing
  const performSmartSearch = (query: string) => {
    const lowercaseQuery = query.toLowerCase();
    
    // Common senior questions mapped to help sections
    const questionMappings = [
      {
        keywords: ['check in', 'daily', 'feeling', 'sick', 'great', 'button'],
        section: 'daily-activities',
        answer: "To check in each day, look for the colorful buttons on your dashboard like '😊 Feeling Great Today' or '🤒 I am not feeling my best today'. Just click the button that best describes how you're doing!"
      },
      {
        keywords: ['emergency', 'help', 'fallen', 'lost', '911', 'urgent'],
        section: 'emergency-help',
        answer: "For emergencies, call 911 immediately. On your dashboard, you can also use the '🚨 Fallen down & injured' or '🤷 I am lost' buttons to alert our care team."
      },
      {
        keywords: ['word find', 'puzzle', 'game', 'brain'],
        section: 'daily-activities',
        answer: "To play Word Find, click 'Word Find' from your dashboard or main menu. Tap letters on the grid to select words in straight lines. It's great exercise for your mind!"
      },
      {
        keywords: ['photo', 'picture', 'community', 'upload', 'share'],
        section: 'community',
        answer: "To share photos, go to the 'Community Moments' card on your dashboard and click 'Share a Photo'. You can upload pictures from events, family gatherings, or special moments."
      },
      {
        keywords: ['doctor', 'health', 'report', 'medical', 'track'],
        section: 'health-tracking',
        answer: "Click 'Health Tracker' in the menu to record how you're feeling and any symptoms. For a summary to show your doctor, click 'Doctor's View' in the menu."
      },
      {
        keywords: ['password', 'login', 'forgot', 'account'],
        section: 'technical-help',
        answer: "If you forgot your password, click 'Forgot Password' on the login screen and enter your email. You'll get instructions to create a new password."
      },
      {
        keywords: ['text', 'small', 'big', 'see', 'read'],
        section: 'technical-help',
        answer: "To make text larger, go to your device settings and increase the font size, or use your browser's zoom feature (Ctrl and + key on computers)."
      }
    ];

    // Find matching section
    const match = questionMappings.find(mapping => 
      mapping.keywords.some(keyword => lowercaseQuery.includes(keyword))
    );

    if (match) {
      return {
        directAnswer: match.answer,
        suggestedSection: match.section,
        confidence: 'high'
      };
    }

    return null;
  };

  // Handle voice search
  const startVoiceSearch = () => {
    if (recognition.current && !isListening) {
      setIsListening(true);
      recognition.current.start();
    }
  };

  // AI Chat Assistant
  const sendChatMessage = async (message?: string) => {
    const userMessage = message || chatInput.trim();
    if (!userMessage) return;

    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsTyping(true);

    try {
      // Try Claude first, fallback to local responses
      const claudeResponse = await claudeService.chatWithHealthAssistant(userMessage, (userActivity as unknown) as Record<string, unknown> | undefined);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: claudeResponse,
        timestamp: new Date(),
        suggestions: generateFollowUpSuggestions(userMessage)
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {

      // Fallback to local response
      const response = generateAIResponse(userMessage);
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.content,
        timestamp: new Date(),
        suggestions: response.suggestions
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Generate follow-up suggestions based on user message
  const generateFollowUpSuggestions = (userMessage: string): string[] => {
    const message = userMessage.toLowerCase();

    if (message.includes('check in') || message.includes('feeling')) {
      return ["How to track my mood daily", "What if I'm not feeling well?", "Show me health tracking"];
    }

    if (message.includes('photo') || message.includes('community')) {
      return ["How to upload photos", "See community posts", "Share with family"];
    }

    if (message.includes('game') || message.includes('word find')) {
      return ["Play Word Find now", "Other games available", "Brain training tips"];
    }

    return ["I have another question", "Take me to dashboard", "What else can I do?"];
  };

  // Generate AI responses
  const generateAIResponse = (userMessage: string): { content: string; suggestions?: string[] } => {
    const message = userMessage.toLowerCase();

    // Greeting responses
    if (message.includes('hello') || message.includes('hi') || message.includes('help')) {
      return {
        content: "Hello! I'm here to help you with WellFit Community. I can answer questions about checking in, playing games, sharing photos, tracking your health, or anything else you need help with. What would you like to know?",
        suggestions: ["How do I check in today?", "Show me how to play Word Find", "How do I share photos?", "I need help with my health tracker"]
      };
    }

    // Use smart search for specific questions
    const smartResult = performSmartSearch(message);
    if (smartResult?.directAnswer) {
      return {
        content: smartResult.directAnswer + " Would you like me to walk you through the steps?",
        suggestions: ["Yes, show me step by step", "No, that helps", "I have another question"]
      };
    }

    // Emergency situations
    if (message.includes('emergency') || message.includes('urgent') || message.includes('help me')) {
      return {
        content: "If this is a medical emergency, please call 911 immediately. For non-emergency help, I'm here to assist you, or you can call our support team at 1-800-WELLFIT. What do you need help with?",
        suggestions: ["Call 911", "Call support team", "I just need app help"]
      };
    }

    // Navigation help
    if (message.includes('lost') || message.includes('find') || message.includes('where')) {
      return {
        content: "I can help you find what you're looking for! Use the menu at the top of your screen to navigate between Dashboard, Health Tracker, Word Find, Memory Lane, and Community. What are you trying to find?",
        suggestions: ["Take me to dashboard", "Show me the games", "I want to see my health info", "Help with community photos"]
      };
    }

    // Default helpful response
    return {
      content: "I'm here to help! I can assist you with daily check-ins, playing games like Word Find and Memory Lane, sharing photos with the community, tracking your health, or any technical questions. What would you like help with?",
      suggestions: ["Daily check-in help", "Game instructions", "Photo sharing", "Health tracking", "Technical support"]
    };
  };

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const helpSections = [
    {
      id: 'getting-started',
      title: '🌟 Getting Started',
      icon: '👋',
      content: [
        {
          question: 'How do I check in each day?',
          answer: 'On your dashboard, you\'ll see colorful buttons like "😊 Feeling Great Today" or "🏥 In the hospital". Simply click the button that best describes how you\'re doing today. The button will turn green to show you\'ve checked in!'
        },
        {
          question: 'What if I need help right away?',
          answer: 'For emergencies, call 911 immediately. On your dashboard, you\'ll also find emergency contact information and buttons for "🚨 Fallen down & injured" or "🤷 I am lost" that will alert our care team.'
        }
      ]
    },
    {
      id: 'daily-activities',
      title: '🎯 Daily Activities',
      icon: '📅',
      content: [
        {
          question: 'How do I play Word Find?',
          answer: 'Click "Word Find" from the menu or dashboard. Tap letters on the grid to select words in straight lines (up, down, diagonal, or across). Found words will be highlighted. It\'s great exercise for your mind!'
        },
        {
          question: 'What is Memory Lane?',
          answer: 'Memory Lane is our trivia game with questions from your era - music, movies, events you remember! It\'s fun brain exercise that brings back good memories. Click "Memory Lane" to start playing.'
        }
      ]
    },
    // Add more sections as needed...
  ];

  // Filter help sections based on search
  const filteredSections = searchTerm 
    ? helpSections.filter(section => {
        const smartResult = performSmartSearch(searchTerm);
        if (smartResult?.suggestedSection === section.id) return true;
        
        return section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
               section.content.some(item => 
                 item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 item.answer.toLowerCase().includes(searchTerm.toLowerCase())
               );
      })
    : helpSections;

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#003865] mb-4">
            💚 WellFit Help Center
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Ask me anything! Your WellFit Helper is here to guide you
          </p>
        </div>

        {/* Contextual Suggestions */}
        {contextualSuggestions.length > 0 && (
          <div className="bg-[#8cc63f] text-white rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">💡 Suggestions Just For You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contextualSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => setSearchTerm(suggestion)}
                  className="bg-white text-[#8cc63f] p-3 rounded-lg hover:bg-gray-100 transition text-left font-semibold"
                >
                  ❓ {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Smart Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-[#003865] mb-4">🔍 Ask Me Anything</h2>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Type your question in plain English..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-4 text-lg border-2 border-[#8cc63f] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#003865]"
                onKeyPress={(e) => e.key === 'Enter' && searchTerm && sendChatMessage(searchTerm)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              onClick={startVoiceSearch}
              disabled={isListening}
              className={`px-6 py-4 rounded-lg font-semibold transition ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-[#003865] text-white hover:bg-[#8cc63f]'
              }`}
            >
              {isListening ? '🎙️ Listening...' : '🎤 Voice'}
            </button>
          </div>

          {/* Smart Search Results */}
          {searchTerm && (
            <div className="mb-4">
              {(() => {
                const smartResult = performSmartSearch(searchTerm);
                if (smartResult?.directAnswer) {
                  return (
                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-800 mb-2">💡 Quick Answer:</h3>
                      <p className="text-green-700">{smartResult.directAnswer}</p>
                    </div>
                  );
                }
                return (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                    <p className="text-blue-700">
                      I found some help sections that might answer your question. Check the results below, or 
                      <button 
                        onClick={() => setShowChat(true)}
                        className="text-blue-600 underline ml-1"
                      >
                        chat with me for personalized help
                      </button>
                      .
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowChat(true)}
              className="bg-[#8cc63f] text-white px-6 py-3 rounded-lg hover:bg-[#003865] transition font-semibold"
            >
              💬 Chat With WellFit Helper
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition font-semibold"
            >
              🏠 Back to Dashboard
            </button>
          </div>
        </div>

        {/* AI Chat Interface */}
        {showChat && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              
              {/* Chat Header */}
              <div className="bg-[#003865] text-white p-4 rounded-t-lg flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">💚</span>
                  <div>
                    <h3 className="font-semibold">WellFit Helper</h3>
                    <p className="text-sm opacity-90">Your friendly community guide!</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="text-2xl hover:bg-white hover:bg-opacity-20 rounded-sm p-1"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-96">
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <span className="text-4xl mb-4 block">💚</span>
                    <p className="text-lg">Hello! I'm your WellFit Helper.</p>
                    <p>Ask me anything about using the app!</p>
                  </div>
                )}

                {chatMessages.map((message) => (
                  <div key={message.id} className={`mb-4 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-[#8cc63f] text-white' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <p className="text-lg">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>

                    {/* AI Suggestions */}
                    {message.type === 'assistant' && message.suggestions && (
                      <div className="mt-2 space-y-1">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => sendChatMessage(suggestion)}
                            className="block bg-blue-50 text-blue-700 px-3 py-1 rounded-sm text-sm hover:bg-blue-100 transition"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isTyping && (
                  <div className="text-left mb-4">
                    <div className="inline-block bg-gray-100 p-3 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type your question..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#8cc63f] text-lg"
                  />
                  <button
                    onClick={() => sendChatMessage()}
                    disabled={!chatInput.trim()}
                    className="bg-[#8cc63f] text-white px-6 py-3 rounded-lg hover:bg-[#003865] transition disabled:opacity-50 font-semibold"
                  >
                    Send
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Traditional Help Sections */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[#003865] mb-4">📚 Browse Help Topics</h2>
          
          {filteredSections.length === 0 && searchTerm && (
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg text-center">
              <span className="text-2xl mb-2 block">🤔</span>
              <p className="text-lg text-yellow-800 mb-4">
                I couldn't find specific help for "{searchTerm}"
              </p>
              <button
                onClick={() => setShowChat(true)}
                className="bg-[#8cc63f] text-white px-6 py-3 rounded-lg hover:bg-[#003865] transition font-semibold"
              >
                💬 Ask WellFit Helper Instead
              </button>
            </div>
          )}

          {filteredSections.map((section) => (
            <Card key={section.id}>
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <span className="text-3xl mr-4">{section.icon}</span>
                  <h2 className="text-xl font-bold text-[#003865]">{section.title}</h2>
                </div>
                
                <div className="space-y-4">
                  {section.content.map((item, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-[#003865] mb-2 text-lg">
                        ❓ {item.question}
                      </h3>
                      <p className="text-gray-700 leading-relaxed text-base">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Emergency Contacts */}
        <div className="mt-8 bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-800 mb-4 text-center">
            🚨 Still Need Help? Contact Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-bold text-lg text-red-800">Emergency</div>
              <div className="text-2xl font-bold text-red-600">911</div>
              <div className="text-sm text-red-700">Life-threatening emergencies</div>
            </div>
            <div>
              <div className="font-bold text-lg text-red-800">WellFit Support</div>
              <div className="text-2xl font-bold text-red-600">1-800-WELLFIT</div>
              <div className="text-sm text-red-700">App help & questions</div>
            </div>
            <div>
              <div className="font-bold text-lg text-red-800">Technical Help</div>
              <div className="text-2xl font-bold text-red-600">1-800-TECH-HELP</div>
              <div className="text-sm text-red-700">Device & connection issues</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AIHelpPage;