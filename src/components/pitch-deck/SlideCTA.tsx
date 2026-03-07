import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const SlideCTA: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1BA39C 0%, #158A84 40%, #111827 100%)',
      }}
    >
      <div className="max-w-3xl text-center space-y-8">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-white/20 border-2 border-white/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">EA</span>
          </div>
          <span className="text-white/50 text-2xl">+</span>
          <div className="w-14 h-14 rounded-xl bg-[#C8E63D]/20 border-2 border-[#C8E63D]/30 flex items-center justify-center">
            <span className="text-2xl font-bold text-[#C8E63D]">WF</span>
          </div>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Ready to Bridge the Gap
          <span className="block text-[#C8E63D] mt-2">Between Hospital & Home?</span>
        </h2>

        <p className="text-xl text-white/80 max-w-2xl mx-auto">
          Join the healthcare organizations already using our platform to reduce readmissions,
          engage communities, and deliver better outcomes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <a
            href="mailto:maria@wellfitcommunity.com"
            className="px-8 py-4 bg-[#C8E63D] hover:bg-[#A8C230] text-black font-bold rounded-xl border-2 border-black shadow-lg hover:shadow-xl transition-all text-lg min-w-[200px]"
          >
            Schedule a Demo
          </a>
          <a
            href="mailto:maria@wellfitcommunity.com"
            className="px-8 py-4 bg-transparent hover:bg-white/10 text-white font-semibold rounded-xl border-2 border-white/30 hover:border-white/60 transition-all text-lg min-w-[200px]"
          >
            Contact Us
          </a>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-white/40 text-sm mb-3">
            Envision Virtual Edge Group LLC
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-white/30">
            <span>maria@wellfitcommunity.com</span>
            <span>&bull;</span>
            <span>HIPAA Compliant</span>
            <span>&bull;</span>
            <span>SOC 2 Ready</span>
            <span>&bull;</span>
            <span>ONC HTI-2 Transparent</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideCTA;
