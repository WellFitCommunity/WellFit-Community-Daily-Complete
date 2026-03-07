import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const SlideSolution: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
      style={{
        background: 'linear-gradient(135deg, #E8F8F7 0%, #D1F2F0 50%, #E8EAED 100%)',
      }}
    >
      <div className="max-w-5xl w-full space-y-10">
        <div className="text-center">
          <span className="text-[#1BA39C] text-sm font-semibold uppercase tracking-widest">Our Solution</span>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111827] mt-3">
            One Platform. Two Products.
            <span className="text-[#1BA39C]"> Zero Gaps.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* WellFit */}
          <div className="bg-white rounded-xl border-2 border-black p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-[#C8E63D]/20 border-2 border-black flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-[#A8C230]">WF</span>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-3">WellFit Community</h3>
            <p className="text-gray-600 text-sm mb-4">
              Member-facing wellness platform for seniors, caregivers, and community organizations.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Daily check-ins with vitals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Mood tracking & wellness</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Caregiver access & alerts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Community engagement</span>
              </li>
            </ul>
          </div>

          {/* Bridge */}
          <div className="bg-[#1BA39C] rounded-xl border-2 border-black p-8 shadow-lg text-white flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center mb-4">
              <span className="text-2xl">&#8596;</span>
            </div>
            <h3 className="text-xl font-bold mb-3">Shared Spine</h3>
            <p className="text-white/80 text-sm mb-4">
              Identity, FHIR interoperability, AI platform, audit, and billing infrastructure.
            </p>
            <div className="space-y-2 text-sm text-white/90">
              <div className="bg-white/10 rounded-lg px-3 py-2">40+ AI Skills</div>
              <div className="bg-white/10 rounded-lg px-3 py-2">FHIR R4 + HL7 v2</div>
              <div className="bg-white/10 rounded-lg px-3 py-2">Multi-Tenant RLS</div>
              <div className="bg-white/10 rounded-lg px-3 py-2">HIPAA Audit Trail</div>
            </div>
          </div>

          {/* Envision Atlus */}
          <div className="bg-white rounded-xl border-2 border-black p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 rounded-lg bg-[#1BA39C]/10 border-2 border-black flex items-center justify-center mb-4">
              <span className="text-xl font-bold text-[#1BA39C]">EA</span>
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-3">Envision Atlus</h3>
            <p className="text-gray-600 text-sm mb-4">
              Clinical care management engine for hospitals, clinicians, and care teams.
            </p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Bed management & census</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>AI readmission prediction</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>Clinical documentation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#10B981] mt-0.5">&#10003;</span>
                <span>SMART on FHIR apps</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideSolution;
