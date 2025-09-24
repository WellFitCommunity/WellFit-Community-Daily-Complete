// src/components/dashboard/SeniorCommunityDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';
import WeatherWidget from './WeatherWidget';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import PositiveAffirmations from './PositiveAffirmations';
import EmergencyContact from '../features/EmergencyContact';

const SeniorCommunityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();
  
  const [checkedInToday, setCheckedInToday] = useState<string | null>(null);
  const [showEmergencyBanner, setShowEmergencyBanner] = useState(false);
  const [emergencyType, setEmergencyType] = useState<'red' | 'yellow'>('red');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState('');
  const [needsSupport, setNeedsSupport] = useState<boolean | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [recentCommunityPhoto, setRecentCommunityPhoto] = useState<string | null>(null);
  const [todaysMeal, setTodaysMeal] = useState<any>(null);
  const [caregiverPhone, setCaregiverPhone] = useState<string | null>(null);

  // Get today's meal
  useEffect(() => {
    // This would typically come from your recipes data
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    // Placeholder meal data - replace with your actual meal data
    const meals = [
      { name: "Heart-Healthy Salmon", description: "Rich in omega-3 fatty acids" },
      { name: "Vegetable Lentil Soup", description: "High in fiber and protein" },
      { name: "Grilled Chicken Salad", description: "Lean protein with fresh vegetables" }
    ];
    setTodaysMeal(meals[dayOfYear % meals.length]);
  }, []);

  // Load recent community photo and caregiver contact
  useEffect(() => {
    const loadRecentPhoto = async () => {
      try {
        const { data } = await supabase
          .from('community_moments')
          .select('file_url, file_path')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data?.file_url) {
          setRecentCommunityPhoto(data.file_url);
        }
      } catch (error) {
        console.log('No recent community photos found');
      }
    };

    const loadCaregiverContact = async () => {
      if (user?.id) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('caregiver_phone')
            .eq('id', user.id)
            .single();

          if (data?.caregiver_phone) {
            setCaregiverPhone(data.caregiver_phone);
          }
        } catch (error) {
          console.log('No caregiver contact found');
        }
      }
    };

    loadRecentPhoto();
    loadCaregiverContact();
  }, [supabase, user?.id]);

  const checkInButtons = [
    {
      id: 'great',
      emoji: '😊',
      text: 'Feeling Great Today',
      response: 'Awesome! Enjoy your day. 🌞',
      color: '#8cc63f'
    },
    {
      id: 'appointment',
      emoji: '📅',
      text: 'I have a Dr. Appt today',
      response: 'Have a great visit. We are here if you need us.',
      color: '#4CAF50'
    },
    {
      id: 'hospital',
      emoji: '🏥',
      text: 'In the hospital',
      response: 'We will check on you in a few days. Get well soon.',
      color: '#2196F3'
    },
    {
      id: 'navigation',
      emoji: '🧭',
      text: 'Need Healthcare Navigation Assistance',
      response: 'Message the nurse for a call.',
      color: '#FF9800',
      needsNavigation: true
    },
    {
      id: 'event',
      emoji: '⭐',
      text: 'Attending the event today',
      response: "We can't wait to see you there!",
      color: '#9C27B0'
    },
    {
      id: 'not-best',
      emoji: '🤒',
      text: 'I am not feeling my best today',
      response: '',
      color: '#FF5722',
      needsFollowUp: true
    },
    {
      id: 'fallen',
      emoji: '🚨',
      text: 'Fallen down & injured',
      response: '',
      color: '#F44336',
      emergency: 'red'
    },
    {
      id: 'lost',
      emoji: '🤷',
      text: 'I am lost',
      response: '',
      color: '#FFC107',
      emergency: 'yellow'
    }
  ];

  const handleCheckIn = async (button: any) => {
    if (button.emergency) {
      setEmergencyType(button.emergency);
      setEmergencyMessage(
        button.emergency === 'red'
          ? 'Call 911 immediately!'
          : caregiverPhone
            ? `Call your emergency contact: ${caregiverPhone}`
            : 'Call emergency contact'
      );
      setShowEmergencyBanner(true);
      
      // Send alert to team
      await sendTeamAlert(button.id, button.text);
      
      // Auto-hide banner after 10 seconds for safety
      setTimeout(() => setShowEmergencyBanner(false), 10000);
      return;
    }

    if (button.needsFollowUp) {
      setShowFollowUp(true);
      return;
    }

    // Regular check-in
    setCheckedInToday(button.id);
    setFeedbackMessage(button.response);
    
    // Log check-in to database
    await logCheckIn(button.id, button.text, button.response);
    
    // Show feedback for 10 seconds (seniors need more time to read)
    setTimeout(() => setFeedbackMessage(''), 10000);
  };

  const handleFollowUpFeeling = async (feeling: string) => {
    setSelectedFeeling(feeling);
    // Don't auto-proceed, wait for support question
  };

  const handleSupportResponse = async (needsHelp: boolean) => {
    setNeedsSupport(needsHelp);

    let response = '';

    if (selectedFeeling === 'Mentally') {
      if (needsHelp) {
        response = "Mental Health Crisis Hotlines:\n\n988 (National Crisis Lifeline)\n1-800-662-4357 (SAMHSA National Helpline)\n\nTap the numbers above to call.";
      } else {
        response = "Take a walk, get some fresh air, or listen to music... and contact your doctor.";
      }
    } else if (selectedFeeling === 'Physically' || selectedFeeling === 'Emotionally') {
      response = "Contact your doctor.";
    } else {
      // Fallback for any unexpected feeling type
      response = needsHelp
        ? "We understand. Someone from our care team will reach out to you soon."
        : "We're glad you're managing. Remember, we're here if you need us.";
    }

    setFeedbackMessage(response);
    setCheckedInToday('not-best');

    // Log detailed check-in
    await logCheckIn('not-best', `Not feeling best - ${selectedFeeling}`, response, {
      feeling_type: selectedFeeling,
      needs_support: needsHelp
    });

    // Close follow-up
    setShowFollowUp(false);
    setTimeout(() => {
      setFeedbackMessage('');
      setSelectedFeeling('');
      setNeedsSupport(null);
    }, 10000); // 10 seconds for seniors
  };

  const sendTeamAlert = async (type: string, description: string) => {
    try {
      await supabase.functions.invoke('send-team-alert', {
        body: {
          alert_type: type,
          description,
          user_id: user?.id,
          priority: type === 'fallen' ? 'high' : 'medium'
        }
      });
    } catch (error) {
      console.error('Failed to send team alert:', error);
    }
  };

  const logCheckIn = async (type: string, label: string, response: string, metadata?: any) => {
    try {
      await supabase.from('check_ins').insert({
        user_id: user?.id,
        label,
        notes: response,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log check-in:', error);
    }
  };

  const uploadCommunityPhoto = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('community-moments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('community-moments')
        .getPublicUrl(fileName);

      await supabase.from('community_moments').insert({
        user_id: user?.id,
        file_url: urlData.publicUrl,
        file_path: fileName,
        title: 'Community Photo',
        description: 'Shared from dashboard',
        created_at: new Date().toISOString()
      });

      alert('Photo uploaded successfully! 📸');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        
        {/* Welcome Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#003865] mb-2">
            Welcome to Your Community
          </h1>
          <p className="text-lg sm:text-xl text-gray-600">
            Let's check in today
          </p>
        </div>

        {/* Emergency Banner */}
        {showEmergencyBanner && (
          <div className={`fixed top-4 left-4 right-4 z-50 p-6 rounded-lg shadow-lg text-center text-white font-bold text-xl ${
            emergencyType === 'red' ? 'bg-red-600' : 'bg-yellow-600'
          }`}>
            <div className="text-2xl mb-2">🚨</div>
            {emergencyMessage}
            {emergencyType === 'red' && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to call 911? This will dial emergency services.')) {
                      window.location.href = 'tel:911';
                    }
                  }}
                  className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold text-xl hover:bg-gray-100 transition"
                >
                  📞 Call 911 Now
                </button>
              </div>
            )}
            {emergencyType === 'yellow' && caregiverPhone && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to call your emergency contact at ${caregiverPhone}?`)) {
                      window.location.href = `tel:${caregiverPhone}`;
                    }
                  }}
                  className="bg-white text-yellow-600 px-6 py-3 rounded-lg font-bold text-xl hover:bg-gray-100 transition"
                >
                  📞 Call Emergency Contact
                </button>
              </div>
            )}
            <button
              onClick={() => setShowEmergencyBanner(false)}
              className="absolute top-2 right-2 text-white text-2xl"
            >
              ×
            </button>
          </div>
        )}

        {/* Follow-up Modal */}
        {showFollowUp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-[#003865] mb-4 text-center">
                Help us understand better
              </h3>
              
              {!selectedFeeling ? (
                <div>
                  <p className="mb-4 text-center">Are you not feeling your best:</p>
                  <div className="space-y-2">
                    {['Mentally', 'Physically', 'Emotionally'].map(feeling => (
                      <button
                        key={feeling}
                        onClick={() => handleFollowUpFeeling(feeling)}
                        className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition"
                      >
                        {feeling}
                      </button>
                    ))}
                  </div>
                </div>
              ) : needsSupport === null ? (
                <div>
                  <p className="mb-4 text-center">
                    You mentioned feeling {selectedFeeling.toLowerCase()} not your best.
                  </p>
                  <p className="mb-4 text-center font-semibold">
                    Do you need to speak to someone?
                  </p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleSupportResponse(true)}
                      className="flex-1 p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition"
                    >
                      Yes, please
                    </button>
                    <button
                      onClick={() => handleSupportResponse(false)}
                      className="flex-1 p-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
                    >
                      No, I'm okay
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {feedbackMessage && (
          <div className="mb-6 p-4 bg-[#8cc63f] text-white rounded-xl text-center text-lg font-semibold">
            {feedbackMessage.includes('988') ? (
              <div className="whitespace-pre-line">
                Mental Health Crisis Hotlines:
                <br /><br />
                <a href="tel:988" className="text-white underline hover:text-gray-200 text-xl font-bold">
                  988 (National Crisis Lifeline)
                </a>
                <br />
                <a href="tel:18006624357" className="text-white underline hover:text-gray-200 text-xl font-bold">
                  1-800-662-4357 (SAMHSA National Helpline)
                </a>
                <br /><br />
                Tap the numbers above to call.
              </div>
            ) : feedbackMessage.includes('Message the nurse') ? (
              <div>
                {feedbackMessage}
                <br /><br />
                <button
                  onClick={() => navigate('/questions')}
                  className="bg-white text-[#8cc63f] px-6 py-3 rounded-lg font-bold text-xl hover:bg-gray-100 transition"
                >
                  💬 Message Your Nurse Now
                </button>
              </div>
            ) : (
              feedbackMessage
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Weather Widget */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <WeatherWidget />
            </div>

            {/* Daily Scripture */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <DailyScripture />
            </div>

            {/* Emergency Contact */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <EmergencyContact />
            </div>

          </div>

          {/* Center Column - Check-in Buttons */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-[#003865] mb-6 text-center">
              Daily Check-In
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              {checkInButtons.map((button) => (
                <button
                  key={button.id}
                  onClick={() => handleCheckIn(button)}
                  disabled={checkedInToday === button.id}
                  className={`w-full p-4 rounded-xl font-semibold text-white text-lg transition-all duration-200 hover:scale-105 ${
                    checkedInToday === button.id 
                      ? 'bg-[#8cc63f] scale-105' 
                      : 'bg-[#003865] hover:bg-[#8cc63f]'
                  }`}
                  style={{ 
                    backgroundColor: checkedInToday === button.id ? '#8cc63f' : '#003865'
                  }}
                >
                  <span className="text-2xl mr-3">{button.emoji}</span>
                  {button.text}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Community Moments */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-[#003865] mb-4">
                  🌟 Community Moments
                </h3>
                
                {recentCommunityPhoto && (
                  <img 
                    src={recentCommunityPhoto} 
                    alt="Recent community moment" 
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCommunityPhoto(file);
                    }}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="block w-full p-3 bg-[#8cc63f] text-white rounded-lg cursor-pointer hover:bg-[#003865] transition"
                  >
                    📸 Share a Photo
                  </label>
                  
                  <button
                    onClick={() => navigate('/community')}
                    className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition"
                  >
                    👥 View All Moments
                  </button>
                </div>
              </div>
            </div>

            {/* DASH Meal of the Day */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-[#003865] mb-3">
                  🍽️ DASH Meal of the Day
                </h3>
                
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>DASH</strong> = Dietary Approaches to Stop Hypertension
                  </p>
                  <a 
                    href="https://www.nhlbi.nih.gov/education/dash/research" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm"
                  >
                    Learn more about DASH research →
                  </a>
                </div>

                {todaysMeal && (
                  <div className="mb-4">
                    <h4 className="font-semibold text-lg">{todaysMeal.name}</h4>
                    <p className="text-gray-600 text-sm">{todaysMeal.description}</p>
                  </div>
                )}

                <button
                  onClick={() => navigate('/meals')}
                  className="w-full p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition"
                >
                  🍳 View Today's Recipe
                </button>
              </div>
            </div>

            {/* Tech Tips */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <TechTip />
            </div>

          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          
          {/* Word Find */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3">🧩</div>
            <h3 className="text-xl font-bold text-[#003865] mb-3">
              Daily Word Find
            </h3>
            <p className="text-gray-600 mb-4">
              Keep your mind sharp with today's puzzle
            </p>
            <button
              onClick={() => navigate('/word-find')}
              className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition text-lg"
            >
              🧩 Play Today's Puzzle
            </button>
          </div>

          {/* Memory Lane */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3">🎭</div>
            <h3 className="text-xl font-bold text-[#003865] mb-3">
              Memory Lane
            </h3>
            <p className="text-gray-600 mb-4">
              Take a trip down memory lane with trivia from your era
            </p>
            <button
              onClick={() => navigate('/trivia-game')}
              className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition text-lg"
            >
              🎭 Visit Memory Lane
            </button>
          </div>

        </div>

        {/* Positive Affirmations - Bottom */}
        <div className="mt-6">
          <PositiveAffirmations />
        </div>

      </div>
    </div>
  );
};

export default SeniorCommunityDashboard;