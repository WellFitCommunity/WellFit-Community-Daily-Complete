import React, { useState } from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

interface AICategory {
  name: string;
  color: string;
  bgColor: string;
  skills: string[];
}

const aiCategories: AICategory[] = [
  {
    name: 'Clinical AI',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    skills: [
      'Readmission Risk Predictor',
      'Fall Risk Assessment',
      'Infection Risk Detection',
      'SOAP Note Generator',
      'Discharge Summary',
      'Care Plan Generator',
    ],
  },
  {
    name: 'Medication Safety',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    skills: [
      'Drug Interaction Checker',
      'Medication Reconciliation',
      'Contraindication Detector',
      'Medication Instructions',
      'Adherence Predictor',
      'Pill Identifier',
    ],
  },
  {
    name: 'Community Wellness',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    skills: [
      'Personalized Check-In Questions',
      'Smart Mood Suggestions',
      'Missed Check-In Escalation',
      'Patient Q&A Bot',
      'Personalized Greetings',
      'Dashboard Personalization',
    ],
  },
  {
    name: 'Care Coordination',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    skills: [
      'Care Escalation Scorer',
      'Caregiver Briefing',
      'Shift Handoff Synthesis',
      'Treatment Pathway',
      'Referral Letter Writer',
      'Schedule Optimizer',
    ],
  },
];

const SlideAIPlatform: React.FC<SlideProps> = ({ isActive, direction }) => {
  const [activeCategory, setActiveCategory] = useState(0);

  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 bg-[#111827] transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
    >
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <span className="text-[#C8E63D] text-sm font-semibold uppercase tracking-widest">AI Platform</span>
          <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">
            40+ AI Skills. One Brain.
          </h2>
          <p className="text-gray-400 text-lg mt-3">
            Powered by Claude. Pinned model versions for clinical reproducibility.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3">
          {aiCategories.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border-2 ${
                activeCategory === i
                  ? 'text-white border-current shadow-lg scale-105'
                  : 'text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
              style={activeCategory === i ? { borderColor: cat.color, color: cat.color, backgroundColor: cat.bgColor } : undefined}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Skills Grid */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aiCategories[activeCategory].skills.map((skill) => (
              <div
                key={skill}
                className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: aiCategories[activeCategory].color }}
                />
                <span className="text-white text-sm font-medium">{skill}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/5 rounded-xl border border-white/10 py-4">
            <div className="text-2xl font-bold text-[#C8E63D]">40+</div>
            <div className="text-gray-400 text-xs mt-1">AI Skills</div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 py-4">
            <div className="text-2xl font-bold text-[#C8E63D]">HTI-2</div>
            <div className="text-gray-400 text-xs mt-1">Transparency Ready</div>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 py-4">
            <div className="text-2xl font-bold text-[#C8E63D]">JSON</div>
            <div className="text-gray-400 text-xs mt-1">Structured Output</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlideAIPlatform;
