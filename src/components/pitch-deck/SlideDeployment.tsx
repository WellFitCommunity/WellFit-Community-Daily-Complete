import React from 'react';
import type { SlideProps } from './PitchDeckSlide.types';

const deploymentModels = [
  {
    digit: '0',
    label: 'Both Products',
    description: 'Full integration: WellFit community-facing + Envision Atlus clinical backend',
    example: 'Large health systems with community outreach programs',
    color: '#1BA39C',
    features: ['Shared patient context', 'Cross-system AI', 'Unified billing', 'Complete care continuity'],
  },
  {
    digit: '8',
    label: 'Envision Atlus Only',
    description: 'Standalone clinical care management engine for providers',
    example: 'Hospitals, clinics, specialty practices',
    color: '#3B82F6',
    features: ['Bed management', 'Clinical AI', 'FHIR/HL7', 'SMART on FHIR'],
  },
  {
    digit: '9',
    label: 'WellFit Only',
    description: 'Community wellness engagement for member organizations',
    example: 'Senior centers, faith-based orgs, community health',
    color: '#C8E63D',
    features: ['Daily check-ins', 'Caregiver tools', 'Wellness tracking', 'Gamification'],
  },
];

const SlideDeployment: React.FC<SlideProps> = ({ isActive, direction }) => {
  if (!isActive) return null;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-8 transition-all duration-500 ${
        direction !== 'none' ? 'animate-wf-slide-in' : 'animate-wf-fade-in'
      }`}
      style={{
        background: 'linear-gradient(135deg, #C0C5CB 0%, #A8ADB3 100%)',
      }}
    >
      <div className="max-w-5xl w-full space-y-8">
        <div className="text-center">
          <span className="text-[#1BA39C] text-sm font-semibold uppercase tracking-widest">Flexible Deployment</span>
          <h2 className="text-4xl md:text-5xl font-bold text-[#111827] mt-3">
            Deploy Your Way
          </h2>
          <p className="text-gray-700 text-lg mt-3">
            White-label multi-tenant SaaS. Each organization gets their own branded experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {deploymentModels.map((model) => (
            <div
              key={model.digit}
              className="bg-white rounded-xl border-2 border-black p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 border-2 border-black"
                style={{ backgroundColor: `${model.color}20` }}
              >
                <span className="text-2xl font-bold" style={{ color: model.color }}>
                  {model.digit}
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#111827] mb-2">{model.label}</h3>
              <p className="text-gray-600 text-sm mb-3">{model.description}</p>
              <p className="text-gray-500 text-xs italic mb-4">{model.example}</p>
              <div className="space-y-2">
                {model.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-[#10B981]">&#10003;</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <p className="text-gray-600 text-sm">
            Tenant code format: <code className="bg-white/50 px-2 py-1 rounded border border-black/20 text-xs font-mono">ORG-LICENSE_DIGIT+SEQUENCE</code>
            &mdash; e.g., <code className="bg-white/50 px-2 py-1 rounded border border-black/20 text-xs font-mono">VG-0002</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SlideDeployment;
