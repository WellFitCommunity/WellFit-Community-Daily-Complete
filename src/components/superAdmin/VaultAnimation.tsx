/**
 * Vault Animation - Master Panel Entry Sequence
 *
 * Cinematic entry sequence for Envision VirtualEdge Group super admins.
 * One continuous scene: locking bolts engage, the vault wheel spins and
 * retracts the bolts, then the door splits open to reveal the Envision
 * Atlus mark. Skippable (ESC / click), auto-skips for reduced motion.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VaultAnimationProps {
  onComplete: () => void;
  skipEnabled?: boolean;
}

type Stage = 'bolts' | 'wheel' | 'opening' | 'complete';

// Brand palette (Envision Atlus teal)
const TEAL = '#00857a';
const TEAL_LIGHT = '#33bfb7';
const STEEL = '#94a3b8';
const PLATE = '#1e293b';
const PLATE_DARK = '#0f172a';

const BOLT_COUNT = 8;
const BOLT_RADIUS = 140;

/** Bolt positions around the door rim (8 bolts, every 45°) */
const boltPositions = Array.from({ length: BOLT_COUNT }, (_, i) => {
  const angle = (i * 360) / BOLT_COUNT - 90;
  const rad = (angle * Math.PI) / 180;
  return { x: 200 + BOLT_RADIUS * Math.cos(rad), y: 200 + BOLT_RADIUS * Math.sin(rad) };
});

/**
 * The circular vault door face, built from geometric primitives so it renders
 * predictably. Rendered twice (one copy clipped inside each sliding panel) so
 * the door visually splits in half when the panels part.
 */
const VaultDoorFace: React.FC<{ stage: Stage }> = ({ stage }) => {
  const boltsRetracted = stage === 'wheel' || stage === 'opening' || stage === 'complete';
  return (
    <svg width="400" height="400" viewBox="0 0 400 400" aria-hidden="true">
      <defs>
        <radialGradient id="vault-plate" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="70%" stopColor={PLATE} />
          <stop offset="100%" stopColor={PLATE_DARK} />
        </radialGradient>
        <linearGradient id="vault-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <radialGradient id="vault-bolt" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor={STEEL} />
        </radialGradient>
      </defs>

      {/* Outer rim + door plate */}
      <circle cx="200" cy="200" r="188" fill={PLATE_DARK} stroke="url(#vault-rim)" strokeWidth="8" />
      <circle cx="200" cy="200" r="170" fill="url(#vault-plate)" stroke="#475569" strokeWidth="2" />
      {/* Teal accent ring */}
      <circle cx="200" cy="200" r="156" fill="none" stroke={TEAL} strokeWidth="2" opacity="0.45" />

      {/* Locking bolts — engage on mount, retract when the wheel turns */}
      {boltPositions.map((pos, i) => (
        <motion.circle
          key={i}
          cx={pos.x}
          cy={pos.y}
          r="11"
          fill="url(#vault-bolt)"
          stroke="#475569"
          strokeWidth="1.5"
          initial={{ scale: 0, opacity: 0 }}
          animate={boltsRetracted ? { scale: 0.35, opacity: 0.35 } : { scale: 1, opacity: 1 }}
          transition={
            boltsRetracted
              ? { delay: i * 0.05, duration: 0.25 }
              : { delay: i * 0.06, type: 'spring', stiffness: 400, damping: 22 }
          }
          style={{ originX: `${pos.x}px`, originY: `${pos.y}px` }}
        />
      ))}

      {/* Vault wheel — rim, three spokes, hub. Spins to retract the bolts. */}
      <motion.g
        style={{ originX: '200px', originY: '200px' }}
        initial={{ rotate: 0 }}
        animate={boltsRetracted ? { rotate: 270 } : { rotate: 0 }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
      >
        <circle cx="200" cy="200" r="72" fill="none" stroke="url(#vault-rim)" strokeWidth="12" />
        {[0, 120, 240].map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1="200"
              y1="200"
              x2={200 + 66 * Math.cos(rad)}
              y2={200 + 66 * Math.sin(rad)}
              stroke="url(#vault-rim)"
              strokeWidth="10"
              strokeLinecap="round"
            />
          );
        })}
        <circle cx="200" cy="200" r="20" fill="url(#vault-plate)" stroke={TEAL_LIGHT} strokeWidth="2.5" />
        <circle cx="200" cy="200" r="6" fill={TEAL_LIGHT} />
      </motion.g>
    </svg>
  );
};

export const VaultAnimation: React.FC<VaultAnimationProps> = ({
  onComplete,
  skipEnabled = true
}) => {
  const [stage, setStage] = useState<Stage>('bolts');
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

  // Preload the emblem so the reveal doesn't pop in late
  useEffect(() => {
    const img = new Image();
    img.src = '/envision-atlus-emblem.png';
  }, []);

  // Animation sequence timing
  useEffect(() => {
    if (skipped || prefersReducedMotion) return;

    const timers = [
      setTimeout(() => setStage('wheel'), 800),      // Bolts engaged → wheel spins
      setTimeout(() => setStage('opening'), 1700),   // Door splits open
      setTimeout(() => setStage('complete'), 2300),  // Access granted reveal
      setTimeout(() => onComplete(), 3200)           // Hand off to the dashboard
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

  // --- Sound design (Web Audio, synthesized in-code — no audio assets) ----
  // One shared context, resumed if the browser suspended it (autoplay policy).
  // The old implementation created a fresh context per stage and never resumed
  // a suspended one, so the sounds could silently not play.
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback((): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null; // No audio support — animation still plays silently
    }
  }, []);

  useEffect(() => {
    return () => {
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
  }, []);

  /** Short filtered noise burst + low thump — a metal bolt snapping home */
  const scheduleBoltClick = useCallback((ctx: AudioContext, t: number) => {
    const noiseLength = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLength * 0.15));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2500;
    bandpass.Q.value = 6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t);
    noise.connect(bandpass).connect(noiseGain).connect(ctx.destination);
    noise.start(t);

    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(120, t);
    thump.frequency.exponentialRampToValueAtTime(55, t + 0.08);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.18, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    thump.connect(thumpGain).connect(ctx.destination);
    thump.start(t);
    thump.stop(t + 0.12);
  }, []);

  /** Accelerating ratchet ticks + low rumble — the wheel spinning */
  const playWheelSpin = useCallback((ctx: AudioContext) => {
    const start = ctx.currentTime;
    let offset = 0;
    for (let i = 0; i < 14; i++) {
      const tick = ctx.createOscillator();
      tick.type = 'square';
      tick.frequency.value = 1800;
      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.06, start + offset);
      tickGain.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.03);
      tick.connect(tickGain).connect(ctx.destination);
      tick.start(start + offset);
      tick.stop(start + offset + 0.04);
      offset += 0.03 + i * 0.006; // ticks spread out as the wheel decelerates
    }

    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(45, start);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 140;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, start);
    rumbleGain.gain.exponentialRampToValueAtTime(0.12, start + 0.15);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
    rumble.connect(lowpass).connect(rumbleGain).connect(ctx.destination);
    rumble.start(start);
    rumble.stop(start + 1);
  }, []);

  /** Deep filtered-noise sweep — the vault doors parting */
  const playDoorWhoosh = useCallback((ctx: AudioContext) => {
    const start = ctx.currentTime;
    const noiseLength = Math.floor(ctx.sampleRate * 1.2);
    const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(900, start);
    lowpass.frequency.exponentialRampToValueAtTime(90, start + 1.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.15);
    noise.connect(lowpass).connect(gain).connect(ctx.destination);
    noise.start(start);
  }, []);

  /** Warm rising major-chord arpeggio — access granted */
  const playGrantedChord = useCallback((ctx: AudioContext) => {
    const start = ctx.currentTime;
    // C3 root for warmth, then C5–E5–G5 arpeggio
    const notes = [130.81, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = start + i * 0.09;
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.1 : 0.14, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.4);
    });
  }, []);

  // Trigger sounds per stage
  useEffect(() => {
    if (prefersReducedMotion || skipped) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    if (stage === 'bolts') {
      // One click per bolt, matching the visual stagger
      for (let i = 0; i < BOLT_COUNT; i++) {
        scheduleBoltClick(ctx, ctx.currentTime + 0.05 + i * 0.06);
      }
    }
    if (stage === 'wheel') playWheelSpin(ctx);
    if (stage === 'opening') playDoorWhoosh(ctx);
    if (stage === 'complete') playGrantedChord(ctx);
  }, [stage, prefersReducedMotion, skipped, getAudioContext, scheduleBoltClick, playWheelSpin, playDoorWhoosh, playGrantedChord]);

  if (prefersReducedMotion || skipped) return null;

  const doorsOpen = stage === 'opening' || stage === 'complete';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 overflow-hidden bg-slate-900"
        onClick={handleSkip}
      >
        {/* Revealed backdrop (visible once the doors part) */}
        <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: `
              linear-gradient(rgba(0, 133, 122, 0.2) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 133, 122, 0.2) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-[#00857a]/15 rounded-full blur-3xl" />

          {/* ACCESS GRANTED */}
          {stage === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center"
            >
              <img
                src="/envision-atlus-emblem.png"
                alt="Envision Atlus"
                className="w-48 h-48 mb-2 select-none drop-shadow-[0_0_35px_rgba(0,133,122,0.45)]"
                draggable={false}
              />
              <div className="text-5xl font-bold text-[#33bfb7] mb-3 tracking-[0.2em] drop-shadow-lg">
                ACCESS GRANTED
              </div>
              <div className="text-sm uppercase tracking-[0.28em] text-slate-400">
                Envision Atlus Master Panel
              </div>
            </motion.div>
          )}
        </div>

        {/* Left door panel — carries the left half of the vault face */}
        <motion.div
          initial={{ x: 0 }}
          animate={doorsOpen ? { x: '-62vw' } : { x: 0 }}
          transition={{ duration: 1.1, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="absolute left-0 top-0 w-1/2 h-full overflow-hidden bg-linear-to-r from-slate-900 to-slate-800"
          style={{ boxShadow: '0 0 60px rgba(0, 133, 122, 0.35)' }}
        >
          <div className="absolute right-0 top-0 h-full w-[3px] bg-[#00857a]/60" />
          <div className="absolute top-1/2 -translate-y-1/2 -right-[200px]">
            <VaultDoorFace stage={stage} />
          </div>
        </motion.div>

        {/* Right door panel — carries the right half of the vault face */}
        <motion.div
          initial={{ x: 0 }}
          animate={doorsOpen ? { x: '62vw' } : { x: 0 }}
          transition={{ duration: 1.1, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="absolute right-0 top-0 w-1/2 h-full overflow-hidden bg-linear-to-l from-slate-900 to-slate-800"
          style={{ boxShadow: '0 0 60px rgba(0, 133, 122, 0.35)' }}
        >
          <div className="absolute left-0 top-0 h-full w-[3px] bg-[#00857a]/60" />
          <div className="absolute top-1/2 -translate-y-1/2 -left-[200px]">
            <VaultDoorFace stage={stage} />
          </div>
        </motion.div>

        {/* Skip hint */}
        {skipEnabled && stage !== 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 1 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 text-teal-300 text-sm"
          >
            Press ESC or click to skip
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default VaultAnimation;
