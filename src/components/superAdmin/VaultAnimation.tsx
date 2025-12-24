/**
 * Vault Animation - Epic Master Panel Entry Sequence
 *
 * Cinematic authentication sequence for Envision VirtualEdge Group super admins
 * Features: Mechanical locks, spinning gears, sound effects, and vault door opening
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Unlock } from 'lucide-react';

interface VaultAnimationProps {
  onComplete: () => void;
  skipEnabled?: boolean;
}

export const VaultAnimation: React.FC<VaultAnimationProps> = ({
  onComplete,
  skipEnabled = true
}) => {
  const [stage, setStage] = useState<'locks' | 'gears' | 'opening' | 'complete'>('locks');
  const [skipped, setSkipped] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Auto-skip if reduced motion is preferred
  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete();
    }
  }, [prefersReducedMotion, onComplete]);

  // Animation sequence timing - Faster, non-blocking
  useEffect(() => {
    if (skipped || prefersReducedMotion) return;

    const timers = [
      setTimeout(() => setStage('gears'), 600),       // Locks click into place (faster)
      setTimeout(() => setStage('opening'), 1200),    // Gears turn (faster)
      setTimeout(() => setStage('complete'), 1800),   // Vault opens (faster)
      setTimeout(() => onComplete(), 2200)            // Auto-complete after 2.2s
    ];

    return () => timers.forEach(clearTimeout);
  }, [skipped, prefersReducedMotion, onComplete]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (!skipEnabled) return;
    setSkipped(true);
    onComplete();
  }, [skipEnabled, onComplete]);

  // ESC key to skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  // Play sound effects
  const playSound = useCallback((type: 'lock' | 'gear' | 'open' | 'granted') => {
    // Web Audio API - using oscillator for now (you can replace with actual audio files)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Sound profiles
    switch (type) {
      case 'lock':
        oscillator.frequency.value = 150;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        break;
      case 'gear':
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        break;
      case 'open':
        oscillator.frequency.value = 100;
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        break;
      case 'granted':
        oscillator.frequency.value = 600;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        break;
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }, []);

  // Trigger sounds
  useEffect(() => {
    if (prefersReducedMotion || skipped) return;

    if (stage === 'locks') playSound('lock');
    if (stage === 'gears') playSound('gear');
    if (stage === 'opening') playSound('open');
    if (stage === 'complete') playSound('granted');
  }, [stage, playSound, prefersReducedMotion, skipped]);

  if (prefersReducedMotion || skipped) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-linear-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center"
        onClick={handleSkip}
      >
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
        </div>

        <div className="relative z-10 text-center">
          {/* Stage 1: Lock Mechanisms */}
          {stage === 'locks' && (
            <motion.div className="flex items-center justify-center gap-8">
              {[0, 1, 2, 3].map((index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: index * 0.15,
                    type: 'spring',
                    stiffness: 260,
                    damping: 20
                  }}
                  className="relative"
                >
                  {/* Lock ring */}
                  <svg width="120" height="120" viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="55"
                      fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="4"
                      className="drop-shadow-lg"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                      </linearGradient>
                    </defs>

                    {/* Rotating segments */}
                    <motion.g
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, ease: 'easeInOut' }}
                      style={{ originX: '60px', originY: '60px' }}
                    >
                      <line x1="60" y1="10" x2="60" y2="25" stroke="#60a5fa" strokeWidth="3" />
                      <line x1="60" y1="95" x2="60" y2="110" stroke="#60a5fa" strokeWidth="3" />
                      <line x1="10" y1="60" x2="25" y2="60" stroke="#60a5fa" strokeWidth="3" />
                      <line x1="95" y1="60" x2="110" y2="60" stroke="#60a5fa" strokeWidth="3" />
                    </motion.g>
                  </svg>

                  {/* Lock icon */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.15 + 0.5 }}
                  >
                    <Lock className="w-10 h-10 text-blue-400" />
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Stage 2: Gears Turning */}
          {stage === 'gears' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-80 h-80 mx-auto"
            >
              {/* Large gear */}
              <motion.svg
                className="absolute inset-0"
                width="320"
                height="320"
                viewBox="0 0 200 200"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
              >
                <path
                  d="M100,10 L110,40 L120,40 L130,10 L140,10 L140,30 L150,30 L160,10 L170,20 L160,40 L170,50 L180,40 L180,50 L160,60 L160,70 L180,80 L180,90 L160,90 L150,110 L160,130 L180,130 L180,140 L160,140 L160,150 L180,160 L170,170 L150,160 L140,170 L140,190 L130,190 L120,170 L110,170 L100,190 L90,190 L80,170 L70,170 L60,190 L50,190 L50,170 L40,160 L20,170 L10,160 L30,150 L30,140 L10,130 L10,120 L30,110 L30,100 L10,90 L10,80 L30,70 L30,60 L10,50 L10,40 L30,40 L40,30 L30,10 L40,10 L50,30 L60,30 L70,10 L80,10 L90,30 L100,30 Z"
                  fill="#1e40af"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  className="drop-shadow-2xl"
                />
                <circle cx="100" cy="100" r="20" fill="#0f172a" stroke="#3b82f6" strokeWidth="2" />
              </motion.svg>

              {/* Small gear */}
              <motion.svg
                className="absolute top-20 right-10"
                width="120"
                height="120"
                viewBox="0 0 100 100"
                animate={{ rotate: -360 }}
                transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
              >
                <path
                  d="M50,5 L55,20 L60,20 L65,5 L70,10 L65,25 L70,30 L80,25 L80,35 L70,35 L65,50 L70,65 L80,65 L80,75 L70,70 L65,75 L70,90 L65,95 L60,80 L55,80 L50,95 L45,95 L40,80 L35,80 L30,95 L25,90 L30,75 L25,70 L15,75 L15,65 L25,65 L30,50 L25,35 L15,35 L15,25 L25,30 L30,25 L25,10 L30,5 L35,20 L40,20 L45,5 Z"
                  fill="#1e3a8a"
                  stroke="#60a5fa"
                  strokeWidth="1.5"
                  className="drop-shadow-xl"
                />
                <circle cx="50" cy="50" r="12" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.5" />
              </motion.svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-16 h-16 text-blue-400 drop-shadow-lg" />
              </div>
            </motion.div>
          )}

          {/* Stage 3: Vault Opening */}
          {(stage === 'opening' || stage === 'complete') && (
            <div className="relative w-screen h-screen flex items-center justify-center overflow-hidden">
              {/* Left door */}
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: '-50vw' }}
                transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
                className="absolute left-0 top-0 w-1/2 h-full bg-linear-to-r from-slate-800 to-slate-700 border-r-4 border-blue-500"
                style={{
                  boxShadow: '0 0 50px rgba(59, 130, 246, 0.5)'
                }}
              >
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <Lock className="w-16 h-16 text-blue-400" />
                </div>
              </motion.div>

              {/* Right door */}
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: '50vw' }}
                transition={{ duration: 1.2, ease: [0.43, 0.13, 0.23, 0.96] }}
                className="absolute right-0 top-0 w-1/2 h-full bg-linear-to-l from-slate-800 to-slate-700 border-l-4 border-blue-500"
                style={{
                  boxShadow: '0 0 50px rgba(59, 130, 246, 0.5)'
                }}
              >
                <div className="absolute left-8 top-1/2 -translate-y-1/2">
                  <Unlock className="w-16 h-16 text-blue-400" />
                </div>
              </motion.div>

              {/* ACCESS GRANTED */}
              {stage === 'complete' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
                  className="absolute z-20 text-center"
                >
                  <Shield className="w-24 h-24 text-blue-400 mx-auto mb-4 drop-shadow-2xl" />
                  <div className="text-5xl font-bold text-blue-400 mb-2 tracking-wider drop-shadow-lg">
                    ACCESS GRANTED
                  </div>
                  <div className="text-xl text-blue-300">
                    Envision VirtualEdge Group
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Skip hint */}
          {skipEnabled && stage !== 'complete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-blue-300 text-sm"
            >
              Press ESC or click to skip
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VaultAnimation;
