// src/pages/DemoPage.tsx
// Demo showcase page for demonstrating WellFit and Envision Atlus features
// Useful for Methodist meeting and other presentations

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDemoMode } from '../contexts/DemoModeContext';
import { EACard, EACardContent } from '../components/envision-atlus/EACard';
import { EAButton } from '../components/envision-atlus/EAButton';
import { EABadge } from '../components/envision-atlus/EABadge';

interface DemoFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  category: 'clinical' | 'community' | 'admin';
  requiresAuth: boolean;
}

const demoFeatures: DemoFeature[] = [
  // Clinical Features (Envision Atlus)
  {
    id: 'compass-riley',
    title: 'Compass Riley - AI Medical Scribe',
    description: 'Real-time AI transcription with automatic billing code suggestions. Watch a simulated patient visit.',
    icon: '🎙️',
    route: '/compass-riley',
    category: 'clinical',
    requiresAuth: true,
  },
  {
    id: 'nurse-panel',
    title: 'Nurse Command Center',
    description: 'AI-assisted nursing workflows with smart task prioritization and patient monitoring.',
    icon: '👩‍⚕️',
    route: '/nurse-panel',
    category: 'clinical',
    requiresAuth: true,
  },
  {
    id: 'er-dashboard',
    title: 'ER Dashboard',
    description: 'Emergency department overview with real-time bed status and patient flow.',
    icon: '🚑',
    route: '/er-dashboard',
    category: 'clinical',
    requiresAuth: true,
  },
  {
    id: 'neuro-suite',
    title: 'NeuroSuite',
    description: 'Specialized tracking for stroke, dementia, and Parkinson\'s patients with UPDRS assessments.',
    icon: '🧠',
    route: '/neuro-suite',
    category: 'clinical',
    requiresAuth: true,
  },
  {
    id: 'readmissions',
    title: 'Readmission Prevention',
    description: 'AI-powered risk stratification to reduce 30-day readmissions.',
    icon: '📊',
    route: '/readmissions',
    category: 'clinical',
    requiresAuth: true,
  },

  // Community Features (WellFit)
  {
    id: 'senior-dashboard',
    title: 'Senior Community Dashboard',
    description: 'Daily check-ins, DASH meals, tech tips, and community engagement for seniors.',
    icon: '👴',
    route: '/dashboard',
    category: 'community',
    requiresAuth: true,
  },
  {
    id: 'memory-lane',
    title: 'Memory Lane Trivia',
    description: 'Cognitive health trivia game with brain region tracking across 5 decades.',
    icon: '🧩',
    route: '/memory-lane-trivia',
    category: 'community',
    requiresAuth: true,
  },
  {
    id: 'telehealth',
    title: 'Telehealth Appointments',
    description: 'Schedule and join video visits with healthcare providers.',
    icon: '📹',
    route: '/telehealth-appointments',
    category: 'community',
    requiresAuth: true,
  },
  {
    id: 'caregiver-access',
    title: 'Caregiver Access Portal',
    description: 'PIN-based family caregiver access to senior health information.',
    icon: '👨‍👩‍👧',
    route: '/caregiver-access',
    category: 'community',
    requiresAuth: false,
  },

  // Admin Features
  {
    id: 'admin-reports',
    title: 'Engagement Reports',
    description: 'Track community engagement metrics including meals, tech tips, and check-ins.',
    icon: '📈',
    route: '/admin',
    category: 'admin',
    requiresAuth: true,
  },
  {
    id: 'tenant-management',
    title: 'Multi-Tenant Management',
    description: 'Super admin panel for managing multiple healthcare organizations.',
    icon: '🏢',
    route: '/super-admin',
    category: 'admin',
    requiresAuth: true,
  },
];

const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const { isDemo, enableDemo, disableDemo, demoTimeLeft } = useDemoMode();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'clinical' | 'community' | 'admin'>('all');
  const [demoDuration, setDemoDuration] = useState(30); // minutes

  const filteredFeatures = demoFeatures.filter(
    f => selectedCategory === 'all' || f.category === selectedCategory
  );

  const handleStartDemo = () => {
    enableDemo({ durationMs: demoDuration * 60 * 1000 });
  };

  const handleNavigateToFeature = (feature: DemoFeature) => {
    // Start demo mode if not already active
    if (!isDemo) {
      enableDemo({ durationMs: demoDuration * 60 * 1000 });
    }
    navigate(feature.route);
  };

  const formatTimeLeft = () => {
    const min = Math.floor(demoTimeLeft / 60);
    const sec = demoTimeLeft % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-linear-to-r from-[#00857a] to-[#006d64] py-8 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <span className="text-4xl">🎬</span>
                Demo Showcase
              </h1>
              <p className="text-teal-100 mt-2">
                Explore WellFit Community + Envision Atlus features
              </p>
            </div>

            {/* Demo Status */}
            <div className="text-right">
              {isDemo ? (
                <div className="bg-yellow-400 text-black px-4 py-2 rounded-lg">
                  <div className="text-sm font-medium">Demo Mode Active</div>
                  <div className="text-2xl font-mono font-bold">{formatTimeLeft()}</div>
                  <button
                    onClick={disableDemo}
                    className="mt-1 text-xs underline hover:no-underline"
                  >
                    End Demo
                  </button>
                </div>
              ) : (
                <div className="bg-slate-800 px-4 py-3 rounded-lg">
                  <div className="text-sm text-slate-400 mb-2">Start Demo Session</div>
                  <div className="flex items-center gap-2">
                    <select
                      value={demoDuration}
                      onChange={(e) => setDemoDuration(Number(e.target.value))}
                      className="bg-slate-700 text-white px-2 py-1 rounded-sm text-sm"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={60}>60 min</option>
                      <option value={120}>2 hours</option>
                    </select>
                    <EAButton variant="accent" size="sm" onClick={handleStartDemo}>
                      Start Demo
                    </EAButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Features', icon: '🌐' },
            { key: 'clinical', label: 'Clinical (Atlus)', icon: '🏥' },
            { key: 'community', label: 'Community (WellFit)', icon: '👥' },
            { key: 'admin', label: 'Admin Tools', icon: '⚙️' },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key as typeof selectedCategory)}
              className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                selectedCategory === cat.key
                  ? 'bg-[#00857a] text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeatures.map((feature) => (
            <EACard key={feature.id} variant="elevated" className="hover:ring-2 hover:ring-[#00857a]/50 transition-all">
              <EACardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{feature.icon}</span>
                  <EABadge
                    variant={feature.category === 'clinical' ? 'info' : feature.category === 'community' ? 'normal' : 'elevated'}
                    size="sm"
                  >
                    {feature.category}
                  </EABadge>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 mb-4">{feature.description}</p>
                <EAButton
                  variant="secondary"
                  size="sm"
                  onClick={() => handleNavigateToFeature(feature)}
                  className="w-full"
                >
                  {feature.requiresAuth ? 'Demo This Feature' : 'View (No Auth Required)'}
                </EAButton>
              </EACardContent>
            </EACard>
          ))}
        </div>
      </div>

      {/* Quick Launch Section */}
      <div className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-800">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <span>⚡</span> Quick Launch - Methodist Demo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EACard variant="highlight">
            <EACardContent className="p-4 text-center">
              <span className="text-4xl mb-2 block">🎙️</span>
              <h3 className="font-semibold text-white mb-2">Compass Riley Demo</h3>
              <p className="text-xs text-slate-400 mb-3">AI medical scribe with billing codes</p>
              <EAButton
                variant="accent"
                size="sm"
                onClick={() => handleNavigateToFeature(demoFeatures[0])}
                className="w-full"
              >
                Launch Scribe Demo
              </EAButton>
            </EACardContent>
          </EACard>

          <EACard variant="highlight">
            <EACardContent className="p-4 text-center">
              <span className="text-4xl mb-2 block">🧩</span>
              <h3 className="font-semibold text-white mb-2">Memory Lane Trivia</h3>
              <p className="text-xs text-slate-400 mb-3">Cognitive health engagement</p>
              <EAButton
                variant="accent"
                size="sm"
                onClick={() => {
                  const feature = demoFeatures.find(f => f.id === 'memory-lane');
                  if (feature) handleNavigateToFeature(feature);
                }}
                className="w-full"
              >
                Launch Trivia Demo
              </EAButton>
            </EACardContent>
          </EACard>

          <EACard variant="highlight">
            <EACardContent className="p-4 text-center">
              <span className="text-4xl mb-2 block">📊</span>
              <h3 className="font-semibold text-white mb-2">Readmission Prevention</h3>
              <p className="text-xs text-slate-400 mb-3">AI risk stratification</p>
              <EAButton
                variant="accent"
                size="sm"
                onClick={() => {
                  const feature = demoFeatures.find(f => f.id === 'readmissions');
                  if (feature) handleNavigateToFeature(feature);
                }}
                className="w-full"
              >
                Launch Risk Demo
              </EAButton>
            </EACardContent>
          </EACard>
        </div>
      </div>

      {/* Info Footer */}
      <div className="max-w-6xl mx-auto px-6 py-6 text-center text-slate-500 text-sm">
        <p>Demo mode uses simulated data and does not affect real patient records.</p>
        <p className="mt-1">For Methodist Healthcare presentation - December 2025</p>
      </div>
    </div>
  );
};

export default DemoPage;
