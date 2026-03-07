import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const SlideHero: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-all duration-500 ${
        direction === 'right' ? 'animate-wf-slide-in' : direction === 'left' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1BA39C 0%, #158A84 50%, #0F6B66 100%)',
      }}
    >
      <div className="max-w-4xl text-center space-y-8">
        <div className="flex items-center justify-center gap-6 mb-4">
          <div className="w-16 h-16 rounded-xl bg-white/20 border-2 border-black flex items-center justify-center">
            <span className="text-3xl font-bold text-white">EA</span>
          </div>
          <span className="text-white text-3xl font-light">+</span>
          <div className="w-16 h-16 rounded-xl bg-[#C8E63D]/30 border-2 border-black flex items-center justify-center">
            <span className="text-3xl font-bold text-white">WF</span>
          </div>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
          Envision Atlus
          <span className="block text-[#C8E63D] mt-2">+ WellFit Community Daily</span>
        </h1>

        <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
          The first AI-powered platform that bridges hospital care
          and community wellness into one seamless experience.
        </p>

        <div className="flex flex-wrap justify-center gap-4 mt-8">
          {['HIPAA Compliant', 'AI-Powered', '40+ AI Skills', 'FHIR R4 Ready'].map((badge) => (
            <span
              key={badge}
              className="px-4 py-2 rounded-full bg-white/15 border border-white/30 text-white text-sm font-medium backdrop-blur-sm"
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-12 flex items-center justify-center gap-2 text-white/60 text-sm">
          <span>Press</span>
          <kbd className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white font-mono text-xs">
            &rarr;
          </kbd>
          <span>or click arrows to navigate</span>
        </div>
      </div>
    </div>
  );
};

export default SlideHero;
