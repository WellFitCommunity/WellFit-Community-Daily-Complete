// src/components/dashboard/SeniorCommunityDashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { auditLogger } from '../../services/auditLogger';
import WeatherWidget from './WeatherWidget';
import DailyScripture from './DailyScripture';
import TechTip from './TechTip';
import PositiveAffirmations from './PositiveAffirmations';
import EmergencyContact from '../features/EmergencyContact';
import WhatsNewSeniorModal from '../WhatsNewSeniorModal';
import UpcomingAppointmentBanner from './UpcomingAppointmentBanner';
// Health widgets removed - now accessible via My Health Hub page

const SeniorCommunityDashboard: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();
  const { t } = useLanguage();
  
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
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [emergencyBannerTimeoutId, setEmergencyBannerTimeoutId] = useState<NodeJS.Timeout | null>(null);

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
        // Silent fail - no photos is normal for new installations
        auditLogger.debug('No recent community photos found');
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
          // Silent fail - no caregiver is normal
          auditLogger.debug('No caregiver contact found');
        }
      }
    };

    loadRecentPhoto();
    loadCaregiverContact();
  }, [supabase, user?.id]);

  // Check if user should see What's New modal
  useEffect(() => {
    try {
      const lastSeenVersion = localStorage.getItem('seniorWhatsNew_lastSeen');
      const permanentlyDismissed = localStorage.getItem('seniorWhatsNew_permanentlyDismissed');
      const currentVersion = '2025-10-16';

      // Don't show if permanently dismissed
      if (permanentlyDismissed === 'true') {
        auditLogger.debug('[WhatsNew Senior] Modal permanently dismissed by user');
        return;
      }

      if (lastSeenVersion !== currentVersion) {
        // Show modal after a short delay for better UX
        auditLogger.debug('[WhatsNew Senior] Showing modal for version', { version: currentVersion });
        setTimeout(() => setShowWhatsNew(true), 1000);
      }
    } catch (err) {
      auditLogger.error('WHATS_NEW_CHECK_FAILED', err instanceof Error ? err : new Error('Unknown error'), {
        component: 'SeniorCommunityDashboard'
      });
    }
  }, []);

  const checkInButtons = [
    {
      id: 'great',
      emoji: '😊',
      text: t.dashboard.checkInButtons.feelingGreat,
      response: t.dashboard.checkInResponses.feelingGreat,
      color: '#8cc63f'
    },
    {
      id: 'appointment',
      emoji: '📅',
      text: t.dashboard.checkInButtons.doctorAppt,
      response: t.dashboard.checkInResponses.doctorAppt,
      color: '#4CAF50'
    },
    {
      id: 'hospital',
      emoji: '🏥',
      text: t.dashboard.checkInButtons.inHospital,
      response: t.dashboard.checkInResponses.inHospital,
      color: '#2196F3'
    },
    {
      id: 'navigation',
      emoji: '🧭',
      text: t.dashboard.checkInButtons.navigation,
      response: t.dashboard.checkInResponses.navigation,
      color: '#FF9800',
      needsNavigation: true
    },
    {
      id: 'event',
      emoji: '⭐',
      text: t.dashboard.checkInButtons.attendingEvent,
      response: t.dashboard.checkInResponses.attendingEvent,
      color: '#9C27B0'
    },
    {
      id: 'not-best',
      emoji: '🤒',
      text: t.dashboard.checkInButtons.notBest,
      response: t.dashboard.checkInResponses.notBest,
      color: '#FF5722',
      needsFollowUp: true
    },
    {
      id: 'fallen',
      emoji: '🚨',
      text: t.dashboard.checkInButtons.fallen,
      response: t.dashboard.checkInResponses.fallen,
      color: '#F44336',
      emergency: 'red'
    },
    {
      id: 'lost',
      emoji: '🤷',
      text: t.dashboard.checkInButtons.lost,
      response: t.dashboard.checkInResponses.lost,
      color: '#FFC107',
      emergency: 'yellow'
    }
  ];

  const handleCheckIn = async (button: any) => {
    // Set the check-in status and show response message for all buttons
    setCheckedInToday(button.id);
    setFeedbackMessage(button.response);

    if (button.emergency) {
      setEmergencyType(button.emergency);
      setEmergencyMessage(
        button.emergency === 'red'
          ? '🚨 CALL 911 IMMEDIATELY! 🚨'
          : caregiverPhone
            ? `📞 Call your emergency contact: ${caregiverPhone}`
            : '📞 Call emergency contact'
      );
      setShowEmergencyBanner(true);

      // Send alert to team
      await sendTeamAlert(button.id, button.text);

      // Auto-hide banner after 30 seconds for safety (increased from 15 for seniors)
      const timeoutId = setTimeout(() => setShowEmergencyBanner(false), 30000);
      setEmergencyBannerTimeoutId(timeoutId);

      // Log emergency check-in
      await logCheckIn(button.id, button.text, button.response);
    } else if (button.needsFollowUp) {
      setShowFollowUp(true);

      // Log initial follow-up check-in
      await logCheckIn(button.id, button.text, button.response);
    } else {
      // Regular check-in
      await logCheckIn(button.id, button.text, button.response);
    }

    // Show feedback for 15 seconds (seniors need more time to read)
    setTimeout(() => setFeedbackMessage(''), 15000);
  };

  const handleFollowUpFeeling = async (feeling: string) => {
    setSelectedFeeling(feeling);
    // Don't auto-proceed, wait for support question
  };

  const handleSupportResponse = async (needsHelp: boolean) => {
    setNeedsSupport(needsHelp);

    let response = '';

    if (selectedFeeling === 'Mentally' || selectedFeeling === 'Emotionally') {
      if (needsHelp) {
        response = "🆘 CALL OR TEXT 988 MENTAL HEALTH HOTLINE 🆘";
      } else {
        response = "Take a walk, get some fresh air, or listen to music... and contact your doctor.";
      }
    } else if (selectedFeeling === 'Physically') {
      if (needsHelp) {
        response = "📞 CONTACT YOUR PHYSICIAN\n\n🚨 If this is a medical emergency CALL 911! 🚨";
      } else {
        response = "Contact your physician if symptoms continue.";
      }
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

      // HIPAA Audit: Log emergency alert sent
      await auditLogger.security('EMERGENCY_ALERT_SENT', type === 'fallen' ? 'high' : 'medium', {
        userId: user?.id,
        alertType: type,
        description
      });
    } catch (error) {
      // HIPAA Audit: Log emergency alert failure (CRITICAL)
      await auditLogger.error('EMERGENCY_ALERT_FAILED', error instanceof Error ? error : new Error('Unknown error'), {
        userId: user?.id,
        alertType: type
      });
    }
  };

  const logCheckIn = async (_type: string, label: string, response: string, metadata?: any) => {
    try {
      await supabase.from('check_ins').insert({
        user_id: user?.id,
        label,
        notes: response,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      });

      // HIPAA Audit: Log patient check-in
      await auditLogger.clinical('CHECK_IN', true, {
        userId: user?.id,
        label,
        hasMetadata: !!metadata
      });
    } catch (error) {
      // HIPAA Audit: Log check-in failure
      await auditLogger.error('CHECK_IN_FAILED', error instanceof Error ? error : new Error('Unknown error'), {
        userId: user?.id,
        label
      });
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

      // HIPAA Audit: Log photo upload (non-PHI)
      await auditLogger.info('COMMUNITY_PHOTO_UPLOADED', {
        userId: user?.id,
        fileName
      });
    } catch (error) {
      // HIPAA Audit: Log upload failure
      await auditLogger.error('PHOTO_UPLOAD_FAILED', error instanceof Error ? error : new Error('Unknown error'), {
        userId: user?.id
      });
      alert('Upload failed. Please try again.');
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: branding.gradient }}
    >
      {/* What's New Modal */}
      <WhatsNewSeniorModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">

        {/* Welcome Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#003865] mb-2">
            {t.dashboard.welcome}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600">
            {t.dashboard.welcomeSubtitle}
          </p>
        </div>

        {/* Upcoming Appointment Banner */}
        <UpcomingAppointmentBanner />

        {/* Emergency Banner */}
        {showEmergencyBanner && (
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className={`fixed top-4 left-4 right-4 z-50 p-6 rounded-lg shadow-lg text-center text-white font-bold text-xl ${
            emergencyType === 'red' ? 'bg-red-600' : 'bg-yellow-600'
          }`}>
            <div className="text-2xl mb-2" aria-hidden="true">🚨</div>
            {emergencyMessage}
            {emergencyType === 'red' && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to call 911? This will dial emergency services.')) {
                      window.location.href = 'tel:911';
                    }
                  }}
                  aria-label="Call 911 emergency services"
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
                  aria-label={`Call emergency contact at ${caregiverPhone}`}
                  className="bg-white text-yellow-600 px-6 py-3 rounded-lg font-bold text-xl hover:bg-gray-100 transition"
                >
                  📞 Call Emergency Contact
                </button>
              </div>
            )}
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => {
                  if (emergencyBannerTimeoutId) {
                    clearTimeout(emergencyBannerTimeoutId);
                    setEmergencyBannerTimeoutId(null);
                  }
                }}
                aria-label="Keep emergency banner visible"
                className="bg-white bg-opacity-90 text-gray-800 px-6 py-3 rounded-lg font-bold text-lg hover:bg-opacity-100 transition"
              >
                📌 Keep This Message Visible
              </button>
              <button
                onClick={() => setShowEmergencyBanner(false)}
                aria-label="Close emergency banner"
                className="bg-white bg-opacity-90 text-gray-800 px-6 py-3 rounded-lg font-bold text-lg hover:bg-opacity-100 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Follow-up Modal */}
        {showFollowUp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4" role="dialog" aria-modal="true" aria-labelledby="followup-title">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 id="followup-title" className="text-xl font-bold text-[#003865] mb-4 text-center">
                Help us understand better
              </h3>
              
              {!selectedFeeling ? (
                <div>
                  <p className="mb-4 text-center">Are you not feeling your best:</p>
                  <div className="space-y-2" role="group" aria-label="Feeling type options">
                    {['Mentally', 'Physically', 'Emotionally'].map(feeling => (
                      <button
                        key={feeling}
                        onClick={() => handleFollowUpFeeling(feeling)}
                        aria-label={`Not feeling best ${feeling.toLowerCase()}`}
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
                  <div className="flex gap-4" role="group" aria-label="Support request options">
                    <button
                      onClick={() => handleSupportResponse(true)}
                      aria-label="Yes, I need to speak to someone"
                      className="flex-1 p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition"
                    >
                      Yes, please
                    </button>
                    <button
                      onClick={() => handleSupportResponse(false)}
                      aria-label="No, I'm okay and don't need support"
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
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mb-6 p-4 bg-[#8cc63f] text-white rounded-xl text-center text-lg font-semibold"
          >
            {feedbackMessage.includes('988') ? (
              <div className="whitespace-pre-line">
                Mental Health Crisis Hotlines:
                <br /><br />
                <a
                  href="tel:988"
                  aria-label="Call 988 National Crisis Lifeline"
                  className="text-white underline hover:text-gray-200 text-xl font-bold"
                >
                  988 (National Crisis Lifeline)
                </a>
                <br />
                <a
                  href="tel:18006624357"
                  aria-label="Call 1-800-662-4357 SAMHSA National Helpline"
                  className="text-white underline hover:text-gray-200 text-xl font-bold"
                >
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
                  aria-label="Message your nurse now"
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
            <h2 id="daily-checkin-heading" className="text-2xl font-bold text-[#003865] mb-6 text-center">
              {t.dashboard.dailyCheckIn}
            </h2>

            <div className="grid grid-cols-1 gap-4" role="group" aria-labelledby="daily-checkin-heading">
              {checkInButtons.map((button) => (
                <button
                  key={button.id}
                  onClick={() => handleCheckIn(button)}
                  disabled={checkedInToday === button.id && !button.needsFollowUp}
                  aria-label={`Check in: ${button.text}`}
                  aria-pressed={checkedInToday === button.id}
                  className={`w-full p-4 rounded-xl font-semibold text-white text-lg transition-all duration-200 hover:scale-105 ${
                    checkedInToday === button.id
                      ? 'bg-[#8cc63f] scale-105'
                      : 'bg-[#003865] hover:bg-[#8cc63f]'
                  }`}
                  style={{
                    backgroundColor: checkedInToday === button.id ? '#8cc63f' : '#003865',
                    minHeight: checkedInToday === button.id && !button.needsFollowUp ? '80px' : '60px'
                  }}
                >
                  {checkedInToday === button.id && !button.needsFollowUp ? (
                    <div className="whitespace-normal">
                      <div className="text-2xl mb-2" aria-hidden="true">✅</div>
                      <div className="font-bold">{button.response}</div>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl mr-3" aria-hidden="true">{button.emoji}</span>
                      {button.text}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Community Moments */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center">
                <h3 id="community-moments-heading" className="text-xl font-bold text-[#003865] mb-4">
                  {t.dashboard.communityMoments}
                </h3>

                {recentCommunityPhoto && (
                  <img
                    src={recentCommunityPhoto}
                    alt="Most recent community moment photo shared by a member"
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
                    aria-label="Upload community photo"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="block w-full p-3 bg-[#8cc63f] text-white rounded-lg cursor-pointer hover:bg-[#003865] transition"
                  >
                    {t.dashboard.sharePhoto}
                  </label>

                  <button
                    onClick={() => navigate('/community')}
                    aria-label="View all community moments"
                    className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition"
                  >
                    {t.dashboard.viewAllMoments}
                  </button>
                </div>
              </div>
            </div>

            {/* DASH Meal of the Day */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-center">
                <h3 id="meal-heading" className="text-xl font-bold text-[#003865] mb-3">
                  {t.dashboard.dashMeal}
                </h3>

                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>{t.dashboard.dashExplanation}</strong>
                  </p>
                  <a
                    href="https://www.nhlbi.nih.gov/education/dash/research"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Learn more about the DASH diet (opens in new window)"
                    className="text-blue-600 underline text-sm"
                  >
                    {t.dashboard.learnMore}
                  </a>
                </div>

                {todaysMeal && (
                  <div className="mb-4" role="region" aria-labelledby="meal-heading">
                    <h4 className="font-semibold text-lg">{todaysMeal.name}</h4>
                    <p className="text-gray-600 text-sm">{todaysMeal.description}</p>
                  </div>
                )}

                <button
                  onClick={() => {
                    // Get today's meal and navigate to it
                    const today = new Date();
                    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
                    const { allRecipes } = require('../../data/allRecipes');
                    const mealIndex = dayOfYear % allRecipes.length;
                    const todaysMeal = allRecipes[mealIndex];
                    navigate(`/meals/${todaysMeal.id}`);
                  }}
                  aria-label="View today's meal recipe"
                  className="w-full p-3 bg-[#8cc63f] text-white rounded-lg hover:bg-[#003865] transition"
                >
                  {t.dashboard.viewRecipe}
                </button>
              </div>
            </div>

            {/* Tech Tips */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <TechTip />
            </div>

            {/* My Health Records Hub - Large, Easy-to-See Button */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 text-center transform hover:scale-105 transition-all duration-300 hover:shadow-2xl">
              <div className="text-5xl mb-4" aria-hidden="true">🏥</div>
              <h3 id="health-records-heading" className="text-2xl font-bold text-white mb-3 drop-shadow-lg">
                My Health Records
              </h3>
              <p className="text-white/90 mb-6 text-lg leading-relaxed">
                View your vaccines, vitals, labs, medications, and care plans
              </p>
              <button
                onClick={() => navigate('/my-health')}
                aria-label="View my health records including vaccines, vitals, labs, medications, and care plans"
                className="w-full p-4 bg-white text-blue-700 rounded-lg hover:bg-gray-50 transition-all transform hover:scale-105 text-xl font-bold shadow-lg flex items-center justify-center gap-3"
              >
                <span className="text-2xl" aria-hidden="true">📋</span>
                <span>View My Health Records</span>
                <span className="text-2xl" aria-hidden="true">→</span>
              </button>
            </div>

          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">

          {/* Word Find */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">🧩</div>
            <h3 id="word-find-heading" className="text-xl font-bold text-[#003865] mb-3">
              {t.dashboard.dailyWordFind}
            </h3>
            <p className="text-gray-600 mb-4">
              Keep your mind sharp with today's puzzle
            </p>
            <button
              onClick={() => navigate('/word-find')}
              aria-label="Play today's word find puzzle"
              className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition text-lg"
            >
              {t.dashboard.playPuzzle}
            </button>
          </div>

          {/* Memory Lane */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">🎭</div>
            <h3 id="memory-lane-heading" className="text-xl font-bold text-[#003865] mb-3">
              {t.dashboard.memoryLane}
            </h3>
            <p className="text-gray-600 mb-4">
              Take a trip down memory lane with trivia from your era
            </p>
            <button
              onClick={() => navigate('/memory-lane-trivia')}
              aria-label="Visit Memory Lane trivia game"
              className="w-full p-3 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition text-lg"
            >
              {t.dashboard.visitMemoryLane}
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