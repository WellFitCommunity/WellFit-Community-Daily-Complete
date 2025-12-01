/**
 * CelebrationOverlay
 *
 * A celebratory overlay with confetti and encouraging messages.
 * Shown when employees clock in on time.
 */

import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationOverlayProps {
  show: boolean;
  message: string;
  streak?: number;
  onComplete?: () => void;
  duration?: number; // milliseconds
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  show,
  message,
  streak = 0,
  onComplete,
  duration = 4000,
}) => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  // Determine confetti intensity based on streak
  const getConfettiProps = () => {
    if (streak >= 30) {
      return { numberOfPieces: 500, recycle: false, colors: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1'] };
    }
    if (streak >= 10) {
      return { numberOfPieces: 300, recycle: false, colors: ['#00857a', '#33bfb7', '#FFD700', '#4ECDC4'] };
    }
    if (streak >= 5) {
      return { numberOfPieces: 200, recycle: false, colors: ['#00857a', '#33bfb7', '#90EE90'] };
    }
    return { numberOfPieces: 150, recycle: false, colors: ['#00857a', '#33bfb7', '#E0E7FF'] };
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          data-testid="celebration-overlay"
        >
          {/* Confetti */}
          {showConfetti && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              {...getConfettiProps()}
              data-testid="confetti"
            />
          )}

          {/* Message Card */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl p-8 mx-4 max-w-md text-center border border-teal-500/30"
            data-testid="celebration-message"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Streak badge */}
              {streak > 0 && (
                <div className="mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    {streak >= 30 && '👑 '}
                    {streak >= 10 && streak < 30 && '🏆 '}
                    {streak >= 5 && streak < 10 && '🔥 '}
                    {streak} day streak
                    {streak >= 30 && ' 👑'}
                    {streak >= 10 && streak < 30 && ' 🏆'}
                    {streak >= 5 && streak < 10 && ' 🔥'}
                  </span>
                </div>
              )}

              {/* Main message */}
              <p className="text-2xl font-bold text-white mb-2" data-testid="celebration-text">
                {message}
              </p>

              <p className="text-slate-400 text-sm">
                You're clocked in and ready to go!
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CelebrationOverlay;
