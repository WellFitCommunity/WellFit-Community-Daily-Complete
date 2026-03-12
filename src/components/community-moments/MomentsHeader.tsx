/**
 * Community Moments — Header Section
 *
 * Personalized greeting, affirmation of the day, share button, admin pending badge.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { useBranding } from '../../BrandingContext';
import type { Affirmation } from './types';

// @ts-ignore
import { motion } from 'framer-motion';

interface MomentsHeaderProps {
  userFirstName: string;
  affirmation: Affirmation | null;
  isAdmin: boolean;
  pendingCount: number;
  onShareClick: () => void;
}

const MomentsHeader: React.FC<MomentsHeaderProps> = ({
  userFirstName,
  affirmation,
  isAdmin,
  pendingCount,
  onShareClick,
}) => {
  const { branding } = useBranding();

  return (
    <div
      className="p-8 rounded-3xl shadow-2xl flex flex-col items-center mb-8"
      style={{
        background: `linear-gradient(to right, ${branding.primaryColor}, ${branding.secondaryColor || '#8cc63f'})`
      }}
    >
      {/* Personalized Greeting */}
      {userFirstName && (
        <motion.div
          className="bg-white/30 backdrop-blur-xs px-8 py-4 rounded-2xl mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white text-center drop-shadow-lg">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return `Good morning, ${userFirstName}! ☀️`;
              if (hour < 17) return `Good afternoon, ${userFirstName}! 🌤️`;
              return `Good evening, ${userFirstName}! 🌙`;
            })()}
          </h2>
        </motion.div>
      )}

      <motion.div
        className="flex items-center gap-4 mb-4"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <span className="text-6xl" aria-hidden>🎉</span>
        <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg">Community Moments</h1>
        <span className="text-6xl" aria-hidden>📸</span>
      </motion.div>

      <p className="text-2xl text-white text-center mb-6 font-medium">
        Share your memories, celebrate together!
      </p>

      {affirmation && (
        <motion.div
          className="bg-white/20 backdrop-blur-xs text-white rounded-2xl p-6 shadow-xl mb-6 w-full max-w-2xl text-center border-2 border-white/30"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          aria-live="polite"
        >
          <span className="text-3xl md:text-4xl font-semibold italic block mb-3">
            &ldquo;{affirmation.text}&rdquo;
          </span>
          <div className="text-xl font-bold">— {affirmation.author}</div>
        </motion.div>
      )}

      <button
        className="bg-white font-bold px-10 py-5 rounded-2xl shadow-xl hover:scale-105 text-2xl transition-all duration-200 hover:shadow-2xl"
        style={{ color: branding.primaryColor }}
        onClick={onShareClick}
        aria-label="Share your moment"
      >
        <span className="text-3xl mr-2">📷</span>
        Share Your Moment
      </button>

      {isAdmin && pendingCount > 0 && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-6 bg-yellow-400 text-gray-900 rounded-2xl p-5 shadow-lg w-full max-w-2xl text-center border-4 border-yellow-500"
        >
          <div className="flex items-center justify-center gap-3 font-bold text-2xl">
            <span className="text-3xl">📸</span>
            <span>{pendingCount} photo{pendingCount > 1 ? 's' : ''} awaiting approval</span>
          </div>
          <a
            href="/admin"
            className="mt-3 inline-block text-lg underline hover:text-blue-800 font-semibold"
          >
            View in Admin Panel
          </a>
        </motion.div>
      )}
    </div>
  );
};

export default MomentsHeader;
