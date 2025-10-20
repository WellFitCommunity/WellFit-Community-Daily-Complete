// ============================================================================
// Resilience Library - Training Modules Browser
// ============================================================================
// Purpose: Display and launch evidence-based resilience training modules
// Features: Category filtering, module details, completion tracking
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/AuthContext';
import {
  getActiveModules,
  trackModuleStart,
  trackModuleCompletion,
  getMyCompletions,
} from '../../services/resilienceHubService';
import type {
  ResilienceTrainingModule,
  ProviderTrainingCompletion,
} from '../../types/nurseos';
import { CelebrationModal } from './CelebrationModal';

interface ResilienceLibraryProps {
  onClose: () => void;
}

export const ResilienceLibrary: React.FC<ResilienceLibraryProps> = ({ onClose }) => {
  const user = useUser();

  const [modules, setModules] = useState<ResilienceTrainingModule[]>([]);
  const [completions, setCompletions] = useState<ProviderTrainingCompletion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<ResilienceTrainingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Module viewer state
  const [isViewing, setIsViewing] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Celebration modal state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{ moduleName: string; wasHelpful: boolean } | null>(null);

  // Load modules and user's completion history
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [modulesData, completionsData] = await Promise.all([
        getActiveModules(),
        getMyCompletions().catch(() => []),
      ]);

      setModules(modulesData);
      setCompletions(completionsData);
    } catch (err) {
      console.error('ResilienceLibrary load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Get unique categories
  const categories = ['all', ...new Set(modules.map((m) => m.category))];

  // Filter modules by category
  const filteredModules =
    selectedCategory === 'all'
      ? modules
      : modules.filter((m) => m.category === selectedCategory);

  // Check if module is completed
  const isModuleCompleted = (moduleId: string): boolean => {
    return completions.some(
      (c) => c.module_id === moduleId && c.completion_percentage === 100
    );
  };

  // Get completion percentage for module
  const getModuleProgress = (moduleId: string): number => {
    const completion = completions.find((c) => c.module_id === moduleId);
    return completion?.completion_percentage || 0;
  };

  // Handle module selection
  const handleModuleClick = (module: ResilienceTrainingModule) => {
    setSelectedModule(module);
  };

  // Handle start module
  const handleStartModule = async (module: ResilienceTrainingModule) => {
    try {
      await trackModuleStart(module.id);
      setIsViewing(true);
      setStartTime(new Date());
      // Refresh completions
      const updated = await getMyCompletions();
      setCompletions(updated);
    } catch (err) {
      console.error('Failed to start module:', err);
      alert('Failed to start module. Please try again.');
    }
  };

  // Handle complete module
  const handleCompleteModule = async (helpful: boolean) => {
    if (!selectedModule || !startTime) return;

    try {
      const timeSpent = Math.round((Date.now() - startTime.getTime()) / 60000); // minutes
      await trackModuleCompletion(selectedModule.id, timeSpent, helpful);

      // Refresh completions
      const updated = await getMyCompletions();
      setCompletions(updated);

      // Show celebration modal
      setCelebrationData({
        moduleName: selectedModule.title,
        wasHelpful: helpful,
      });
      setShowCelebration(true);

      // Close viewer
      setIsViewing(false);
      setSelectedModule(null);
      setStartTime(null);
    } catch (err) {
      console.error('Failed to complete module:', err);
      alert('Failed to record completion. Please try again.');
    }
  };

  // Category display names
  const categoryNames: Record<string, string> = {
    all: 'All Modules',
    mindfulness: 'Mindfulness',
    stress_management: 'Stress Management',
    communication: 'Communication',
    self_care: 'Self-Care',
    boundary_setting: 'Boundary Setting',
  };

  // Category icons
  const categoryIcons: Record<string, string> = {
    all: '📚',
    mindfulness: '🧘',
    stress_management: '😌',
    communication: '💬',
    self_care: '💚',
    boundary_setting: '🛡️',
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">Failed to load training modules</p>
            <p className="text-sm mt-1">{error}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={loadData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Module viewer
  if (isViewing && selectedModule) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {selectedModule.title}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedModule.estimated_duration_minutes} minutes • {categoryNames[selectedModule.category]}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsViewing(false);
                  setSelectedModule(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="prose max-w-none">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Evidence-Based:</strong> {selectedModule.citation || 'This module is based on peer-reviewed research in healthcare resilience.'}
                </p>
              </div>

              <p className="text-gray-700 mb-6 text-lg leading-relaxed">
                {selectedModule.description}
              </p>

              {/* Module content based on type */}
              {selectedModule.content_type === 'interactive' && (
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4">Interactive Exercise</h3>
                  {selectedModule.title.includes('Box Breathing') && (
                    <BoxBreathingExercise />
                  )}
                  {selectedModule.title.includes('Micro-Break') && (
                    <MicroBreakRoutine />
                  )}
                </div>
              )}

              {selectedModule.content_type === 'video' && selectedModule.content_url && (
                <div className="mb-6">
                  <div className="bg-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-600 mb-4">Video content available at:</p>
                    <a
                      href={selectedModule.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {selectedModule.content_url}
                    </a>
                  </div>
                </div>
              )}

              {selectedModule.content_type === 'article' && (
                <div className="bg-green-50 rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-semibold mb-4">Key Takeaways</h3>
                  {selectedModule.title.includes('Boundaries') && (
                    <BoundariesArticleContent />
                  )}
                  {selectedModule.title.includes('Communication') && (
                    <CommunicationScriptsContent />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
            <p className="text-sm text-gray-600 mb-3">Did you find this module helpful?</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCompleteModule(true)}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Yes, this helped! ✓
              </button>
              <button
                onClick={() => handleCompleteModule(false)}
                className="flex-1 px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
              >
                No, not really
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Module details view
  if (selectedModule && !isViewing) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{selectedModule.title}</h2>
            <button
              onClick={() => setSelectedModule(null)}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>⏱️ {selectedModule.estimated_duration_minutes} min</span>
              <span>📁 {categoryNames[selectedModule.category]}</span>
              <span>
                {selectedModule.content_type === 'video' && '🎥 Video'}
                {selectedModule.content_type === 'article' && '📄 Article'}
                {selectedModule.content_type === 'interactive' && '✨ Interactive'}
                {selectedModule.content_type === 'audio' && '🎧 Audio'}
                {selectedModule.content_type === 'worksheet' && '📝 Worksheet'}
              </span>
            </div>

            <p className="text-gray-700 leading-relaxed">{selectedModule.description}</p>

            {selectedModule.evidence_based && selectedModule.citation && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-xs text-blue-800">
                  <strong>Evidence-Based Research:</strong> {selectedModule.citation}
                </p>
              </div>
            )}

            {isModuleCompleted(selectedModule.id) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium">✓ You completed this module</p>
              </div>
            )}

            {!isModuleCompleted(selectedModule.id) && getModuleProgress(selectedModule.id) > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium">
                  In Progress ({getModuleProgress(selectedModule.id)}%)
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => handleStartModule(selectedModule)}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {isModuleCompleted(selectedModule.id) ? 'Review Module' : 'Start Module'}
            </button>
            <button
              onClick={() => setSelectedModule(null)}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main library view
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Resilience Training Library 🎓</h2>
              <p className="text-gray-600">Evidence-based modules to prevent burnout</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{categoryIcons[cat] || '📚'}</span>
                {categoryNames[cat] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Module grid */}
        <div className="p-6">
          {filteredModules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No modules found in this category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredModules.map((module) => {
                const completed = isModuleCompleted(module.id);
                const progress = getModuleProgress(module.id);

                return (
                  <button
                    key={module.id}
                    onClick={() => handleModuleClick(module)}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl">
                        {module.content_type === 'video' && '🎥'}
                        {module.content_type === 'article' && '📄'}
                        {module.content_type === 'interactive' && '✨'}
                        {module.content_type === 'audio' && '🎧'}
                        {module.content_type === 'worksheet' && '📝'}
                      </span>
                      {completed && (
                        <span className="text-green-600 text-xl">✓</span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2">
                      {module.title}
                    </h3>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {module.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>⏱️ {module.estimated_duration_minutes} min</span>
                      {module.evidence_based && <span>🔬 Evidence-based</span>}
                    </div>

                    {progress > 0 && progress < 100 && (
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Celebration Modal */}
      {showCelebration && celebrationData && (
        <CelebrationModal
          moduleName={celebrationData.moduleName}
          wasHelpful={celebrationData.wasHelpful}
          onClose={() => {
            setShowCelebration(false);
            setCelebrationData(null);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// INTERACTIVE CONTENT COMPONENTS
// ============================================================================

const BoxBreathingExercise: React.FC = () => {
  const [phase, setPhase] = useState<'inhale' | 'hold1' | 'exhale' | 'hold2'>('inhale');
  const [count, setCount] = useState(4);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          // Move to next phase
          setPhase((currentPhase) => {
            switch (currentPhase) {
              case 'inhale':
                return 'hold1';
              case 'hold1':
                return 'exhale';
              case 'exhale':
                return 'hold2';
              case 'hold2':
                return 'inhale';
              default:
                return 'inhale';
            }
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const phaseText = {
    inhale: 'Breathe In',
    hold1: 'Hold',
    exhale: 'Breathe Out',
    hold2: 'Hold',
  };

  return (
    <div className="text-center">
      <div className="mb-6">
        <div className="w-48 h-48 mx-auto rounded-full bg-blue-100 flex items-center justify-center mb-4 transition-all duration-1000"
          style={{
            transform: phase === 'inhale' || phase === 'hold1' ? 'scale(1.2)' : 'scale(1)',
            backgroundColor: phase === 'inhale' ? '#DBEAFE' : phase === 'exhale' ? '#FEF3C7' : '#E5E7EB',
          }}
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-800 mb-2">{count}</div>
            <div className="text-lg text-gray-600">{phaseText[phase]}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsRunning(!isRunning)}
        className={`px-6 py-3 rounded-lg font-medium ${
          isRunning
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isRunning ? 'Stop' : 'Start Exercise'}
      </button>

      <div className="mt-4 text-sm text-gray-600">
        <p>Follow the circle: Inhale for 4, Hold for 4, Exhale for 4, Hold for 4</p>
        <p className="mt-2">Used by Navy SEALs to reduce stress in high-pressure situations.</p>
      </div>
    </div>
  );
};

const MicroBreakRoutine: React.FC = () => {
  const exercises = [
    { name: 'Neck Rolls', duration: '30 seconds', instruction: 'Slowly roll your head in circles, 3 times each direction' },
    { name: 'Shoulder Shrugs', duration: '30 seconds', instruction: 'Raise shoulders to ears, hold 3 seconds, release. Repeat 5 times.' },
    { name: 'Hand Massage', duration: '1 minute', instruction: 'Massage each hand, focusing on thumb and palm pressure points' },
    { name: 'Deep Breaths', duration: '1 minute', instruction: 'Take 5 deep belly breaths, exhaling slowly' },
  ];

  return (
    <div>
      <p className="text-gray-700 mb-4">
        These quick exercises can be done between patients or during short breaks. Research shows micro-breaks reduce fatigue and improve focus.
      </p>
      <div className="space-y-4">
        {exercises.map((exercise, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-800">{idx + 1}. {exercise.name}</h4>
              <span className="text-sm text-blue-600 font-medium">{exercise.duration}</span>
            </div>
            <p className="text-sm text-gray-600">{exercise.instruction}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const BoundariesArticleContent: React.FC = () => {
  return (
    <div className="space-y-4 text-gray-700">
      <h4 className="font-semibold text-lg">5 Scripts for Setting Boundaries</h4>

      <div className="space-y-3">
        <div>
          <p className="font-medium">1. When asked to take on extra patients:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200 italic">
            "I appreciate you thinking of me, but I'm at capacity right now. Taking on more would compromise the quality of care I can provide. Can we discuss redistributing the panel?"
          </p>
        </div>

        <div>
          <p className="font-medium">2. When interrupted during documentation time:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200 italic">
            "I need to finish this documentation to avoid errors. Can I connect with you in 15 minutes?"
          </p>
        </div>

        <div>
          <p className="font-medium">3. When asked to work on your day off:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200 italic">
            "I'm unavailable that day. I need my scheduled time off to recharge and provide my best care. Let's look at other coverage options."
          </p>
        </div>
      </div>

      <p className="text-sm">
        <strong>Remember:</strong> Setting boundaries isn't selfish—it's essential for preventing burnout and maintaining quality patient care.
      </p>
    </div>
  );
};

const CommunicationScriptsContent: React.FC = () => {
  return (
    <div className="space-y-4 text-gray-700">
      <h4 className="font-semibold text-lg">Difficult Conversation Templates</h4>

      <div className="space-y-3">
        <div>
          <p className="font-medium text-red-700">Reporting Unsafe Staffing:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200">
            "I need to document a safety concern. Our current nurse-to-patient ratio is [X:Y], which exceeds safe limits. This creates risk for both patients and staff. What steps can we take to address this immediately?"
          </p>
        </div>

        <div>
          <p className="font-medium text-orange-700">Addressing Lateral Violence:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200">
            "When you [specific behavior], I felt [emotion]. I value our working relationship and would appreciate if we could [desired outcome]. Can we talk about this?"
          </p>
        </div>

        <div>
          <p className="font-medium text-blue-700">Requesting Support:</p>
          <p className="text-sm bg-white p-3 rounded border border-gray-200">
            "I'm managing a challenging patient situation and could use a second opinion. Do you have 5 minutes to help me think through this?"
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResilienceLibrary;
