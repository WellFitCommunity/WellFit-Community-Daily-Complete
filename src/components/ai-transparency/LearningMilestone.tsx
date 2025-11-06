import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface Milestone {
  id: string;
  milestone_type: string;
  milestone_title: string;
  milestone_description: string;
  badge_icon: string;
  celebration_type: 'toast' | 'modal' | 'confetti' | 'badge';
  created_at: string;
}

interface LearningMilestoneProps {
  onAcknowledge?: (milestoneId: string) => void;
}

export const LearningMilestone: React.FC<LearningMilestoneProps> = ({ onAcknowledge }) => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [currentMilestone, setCurrentMilestone] = useState<Milestone | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    fetchUnacknowledgedMilestones();

    // Subscribe to new milestones
    const subscription = supabase
      .channel('milestone_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_learning_milestones',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload: any) => {
          const newMilestone = payload.new as Milestone;
          setMilestones((prev) => [...prev, newMilestone]);
          displayMilestone(newMilestone);
        }
      )
      .subscribe();

    // Track window size for confetti
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, [user]);

  const fetchUnacknowledgedMilestones = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('ai_learning_milestones')
        .select('*')
        .eq('user_id', user.id)
        .eq('acknowledged', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setMilestones(data);
        displayMilestone(data[0]);
      }
    } catch (error) {
      // Error handled silently - milestones will not display on failure
    }
  };

  const displayMilestone = (milestone: Milestone) => {
    setCurrentMilestone(milestone);

    // Show confetti for modal celebrations
    if (milestone.celebration_type === 'modal' || milestone.celebration_type === 'confetti') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    }

    // Auto-dismiss toast after 5 seconds
    if (milestone.celebration_type === 'toast') {
      setTimeout(() => {
        acknowledgeMilestone(milestone.id);
      }, 5000);
    }
  };

  const acknowledgeMilestone = async (milestoneId: string) => {
    try {
      await supabase
        .from('ai_learning_milestones')
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq('id', milestoneId);

      setMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      setCurrentMilestone(null);

      if (onAcknowledge) {
        onAcknowledge(milestoneId);
      }

      // Show next milestone if available
      const nextMilestone = milestones.find((m) => m.id !== milestoneId);
      if (nextMilestone) {
        setTimeout(() => displayMilestone(nextMilestone), 500);
      }
    } catch (error) {
      // Error handled silently - milestone will remain visible
    }
  };

  if (!currentMilestone) return null;

  const getMilestoneGradient = (type: string) => {
    if (type.includes('first')) return 'from-purple-400 via-pink-500 to-rose-500';
    if (type.includes('sessions_10')) return 'from-blue-400 via-cyan-500 to-teal-500';
    if (type.includes('sessions_50')) return 'from-orange-400 via-amber-500 to-yellow-500';
    if (type.includes('fully_adapted')) return 'from-green-400 via-emerald-500 to-teal-500';
    if (type.includes('confidence')) return 'from-indigo-400 via-purple-500 to-pink-500';
    return 'from-gray-400 via-gray-500 to-gray-600';
  };

  // Toast Notification (Bottom-right)
  if (currentMilestone.celebration_type === 'toast') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, x: 300, y: 0 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div
            className={`
              bg-white rounded-2xl shadow-2xl border-2 border-transparent
              bg-gradient-to-br ${getMilestoneGradient(currentMilestone.milestone_type)}
              p-1 max-w-md
            `}
          >
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start space-x-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                  className="text-5xl flex-shrink-0"
                >
                  {currentMilestone.badge_icon}
                </motion.div>
                <div className="flex-1">
                  <h4 className="text-lg font-bold text-gray-800">{currentMilestone.milestone_title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{currentMilestone.milestone_description}</p>
                </div>
                <button
                  onClick={() => acknowledgeMilestone(currentMilestone.id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Badge Notification (Top-right)
  if (currentMilestone.celebration_type === 'badge') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="fixed top-6 right-6 z-50"
        >
          <div
            className={`
              bg-gradient-to-br ${getMilestoneGradient(currentMilestone.milestone_type)}
              rounded-full p-6 shadow-2xl border-4 border-white
              cursor-pointer hover:scale-110 transition-transform
            `}
            onClick={() => acknowledgeMilestone(currentMilestone.id)}
            title={currentMilestone.milestone_title}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
              className="text-6xl text-white"
            >
              {currentMilestone.badge_icon}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Modal + Confetti (Full celebration)
  return (
    <>
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => acknowledgeMilestone(currentMilestone.id)}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: 100 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="relative max-w-lg w-full mx-4"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div
              className={`
                bg-white rounded-3xl shadow-2xl overflow-hidden
                border-4 border-transparent
                bg-gradient-to-br ${getMilestoneGradient(currentMilestone.milestone_type)}
                p-1
              `}
            >
              <div className="bg-white rounded-2xl p-8">
                {/* Badge Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="flex justify-center mb-6"
                >
                  <div
                    className={`
                      w-32 h-32 rounded-full
                      bg-gradient-to-br ${getMilestoneGradient(currentMilestone.milestone_type)}
                      flex items-center justify-center
                      shadow-2xl
                    `}
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 10, -10, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                      className="text-7xl"
                    >
                      {currentMilestone.badge_icon}
                    </motion.div>
                  </div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={`
                    text-3xl font-bold text-center mb-4
                    bg-gradient-to-r ${getMilestoneGradient(currentMilestone.milestone_type)}
                    bg-clip-text text-transparent
                  `}
                >
                  {currentMilestone.milestone_title}
                </motion.h2>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-center text-gray-600 text-lg mb-6"
                >
                  {currentMilestone.milestone_description}
                </motion.p>

                {/* Achievement Date */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-center text-sm text-gray-500 mb-6"
                >
                  Achieved on {new Date(currentMilestone.created_at).toLocaleDateString()}
                </motion.p>

                {/* Acknowledge Button */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => acknowledgeMilestone(currentMilestone.id)}
                  className={`
                    w-full py-4 rounded-xl font-bold text-white text-lg
                    bg-gradient-to-r ${getMilestoneGradient(currentMilestone.milestone_type)}
                    shadow-lg hover:shadow-2xl transition-all
                  `}
                >
                  Celebrate & Continue
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
