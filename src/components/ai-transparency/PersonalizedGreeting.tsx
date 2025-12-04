import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { generateGreeting, getRoleSpecificStats, getTimeBasedGreeting, GreetingContext } from '../../services/personalizedGreeting';

interface GreetingData {
  show_greeting: boolean;
  greeting: string;
  quote: {
    text: string;
    author: string;
    theme: string;
  } | null;
  user_display_name: string;
  time_of_day: string;
}

export const PersonalizedGreeting: React.FC = () => {
  const { user } = useAuth();
  const [greetingData, setGreetingData] = useState<GreetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuote, setShowQuote] = useState(false);
  const [roleStats, setRoleStats] = useState<Record<string, any>>({});
  const [localGreetingContext, setLocalGreetingContext] = useState<GreetingContext | null>(null);

  useEffect(() => {
    fetchGreeting();
    fetchLocalGreeting();
  }, [user]);

  const fetchLocalGreeting = async () => {
    if (!user) return;

    try {
      // Fetch user profile and generate personalized greeting
      const greetingContext = await generateGreeting(supabase, user.id);

      if (greetingContext) {
        setLocalGreetingContext(greetingContext);

        // Fetch role-specific stats
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, tenant_id')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          const stats = await getRoleSpecificStats(
            supabase,
            user.id,
            profile.role,
            profile.tenant_id
          );
          setRoleStats(stats);
        }
      }
    } catch (error) {
      // Fail gracefully
    }
  };

  useEffect(() => {
    // Animate quote appearance after greeting
    if (greetingData?.quote) {
      const timer = setTimeout(() => setShowQuote(true), 800);
      return () => clearTimeout(timer);
    }
  }, [greetingData]);

  const fetchGreeting = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-personalized-greeting', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;
      setGreetingData(data);
    } catch (error) {
      // Error handled silently - greeting will not display on failure
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-8 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg w-64"></div>
        <div className="h-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg w-96 mt-2"></div>
      </div>
    );
  }

  // Show greeting if we have either edge function data or local greeting
  const hasGreeting = greetingData?.show_greeting || localGreetingContext?.fullGreeting;
  if (!hasGreeting) {
    return null;
  }

  // Determine the greeting text and time of day - prefer edge function, fallback to local
  const displayGreeting = greetingData?.greeting || localGreetingContext?.fullGreeting || '';
  const displayTimeOfDay = greetingData?.time_of_day || localGreetingContext?.timeOfDay || getTimeBasedGreeting().timeOfDay;

  const getGradientByTimeOfDay = (timeOfDay: string) => {
    switch (timeOfDay) {
      case 'morning':
        return 'from-amber-400 via-orange-400 to-yellow-400'; // Sunrise
      case 'afternoon':
        return 'from-blue-400 via-cyan-400 to-teal-400'; // Bright sky
      case 'evening':
        return 'from-purple-400 via-pink-400 to-rose-400'; // Sunset
      default:
        return 'from-indigo-400 via-purple-400 to-pink-400'; // Night
    }
  };

  const getThemeIcon = (theme: string) => {
    const icons: Record<string, string> = {
      compassion: '❤️',
      excellence: '⭐',
      perseverance: '💪',
      innovation: '💡',
      healing: '🌱',
      teamwork: '🤝',
      leadership: '👑',
    };
    return icons[theme] || '✨';
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Main Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative"
      >
        <h1
          className={`text-3xl font-bold bg-gradient-to-r ${getGradientByTimeOfDay(
            displayTimeOfDay
          )} bg-clip-text text-transparent`}
        >
          {displayGreeting}
        </h1>
      </motion.div>

      {/* Role-Specific Quick Stats */}
      {Object.keys(roleStats).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"
        >
          {roleStats.patientCount !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-100">
              <div className="text-sm text-gray-600 font-medium">Patients</div>
              <div className="text-2xl font-bold text-blue-600 mt-1">{roleStats.patientCount}</div>
            </div>
          )}
          {roleStats.pendingAlerts !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-yellow-100">
              <div className="text-sm text-gray-600 font-medium">Pending Alerts</div>
              <div className="text-2xl font-bold text-yellow-600 mt-1">{roleStats.pendingAlerts}</div>
            </div>
          )}
          {roleStats.activePatients !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-100">
              <div className="text-sm text-gray-600 font-medium">Active Patients</div>
              <div className="text-2xl font-bold text-green-600 mt-1">{roleStats.activePatients}</div>
            </div>
          )}
          {roleStats.vitalsDueToday !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-purple-100">
              <div className="text-sm text-gray-600 font-medium">Vitals Due Today</div>
              <div className="text-2xl font-bold text-purple-600 mt-1">{roleStats.vitalsDueToday}</div>
            </div>
          )}
          {roleStats.totalUsers !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-indigo-100">
              <div className="text-sm text-gray-600 font-medium">Total Users</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">{roleStats.totalUsers}</div>
            </div>
          )}
          {roleStats.pendingApprovals !== undefined && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-orange-100">
              <div className="text-sm text-gray-600 font-medium">Pending Approvals</div>
              <div className="text-2xl font-bold text-orange-600 mt-1">{roleStats.pendingApprovals}</div>
            </div>
          )}
          {roleStats.criticalAlerts !== undefined && roleStats.criticalAlerts > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4 border border-red-100">
              <div className="text-sm text-gray-600 font-medium">Critical Alerts</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{roleStats.criticalAlerts}</div>
            </div>
          )}
        </motion.div>
      )}

      {/* Motivational Quote */}
      <AnimatePresence>
        {greetingData?.quote && showQuote && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative group"
          >
            <div
              className={`
                relative overflow-hidden rounded-2xl p-6
                bg-gradient-to-br ${getGradientByTimeOfDay(displayTimeOfDay)}
                shadow-lg hover:shadow-2xl transition-all duration-300
                border border-white/20 backdrop-blur-sm
              `}
              style={{
                background: `linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)`,
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Decorative gradient overlay */}
              <div
                className={`
                  absolute inset-0 opacity-10
                  bg-gradient-to-br ${getGradientByTimeOfDay(displayTimeOfDay)}
                `}
              ></div>

              {/* Content */}
              <div className="relative z-10 flex items-start space-x-4">
                {/* Theme Icon */}
                <motion.div
                  animate={{
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                  className="text-4xl flex-shrink-0"
                >
                  {getThemeIcon(greetingData.quote.theme)}
                </motion.div>

                {/* Quote Text */}
                <div className="flex-1">
                  <p className="text-slate-900 text-lg font-medium italic leading-relaxed">
                    "{greetingData.quote.text}"
                  </p>
                  <p className="text-slate-700 text-sm font-semibold mt-2">
                    — {greetingData.quote.author}
                  </p>
                </div>
              </div>

              {/* Subtle shine effect on hover */}
              <div
                className="
                  absolute inset-0 opacity-0 group-hover:opacity-20
                  bg-gradient-to-r from-transparent via-white to-transparent
                  transform -skew-x-12 -translate-x-full group-hover:translate-x-full
                  transition-all duration-1000
                "
              ></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
