import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

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

  useEffect(() => {
    fetchGreeting();
  }, [user]);

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

  if (!greetingData?.show_greeting) {
    return null;
  }

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
            greetingData.time_of_day
          )} bg-clip-text text-transparent`}
        >
          {greetingData.greeting}
        </h1>
      </motion.div>

      {/* Motivational Quote */}
      <AnimatePresence>
        {greetingData.quote && showQuote && (
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
                bg-gradient-to-br ${getGradientByTimeOfDay(greetingData.time_of_day)}
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
                  bg-gradient-to-br ${getGradientByTimeOfDay(greetingData.time_of_day)}
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
                  <p className="text-gray-800 dark:text-gray-100 text-lg font-medium italic leading-relaxed">
                    "{greetingData.quote.text}"
                  </p>
                  <p className="text-gray-600 dark:text-gray-300 text-sm font-semibold mt-2">
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
