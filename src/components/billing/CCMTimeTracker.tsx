// CCM Time Tracking Component for CMS Compliance
// Tracks billable activities for Chronic Care Management billing

import { useState, useEffect } from 'react';
import type { CCMActivity, CCMTimeTracking } from '../../types/sdohBilling';

type Props = {
  encounterId: string;
  patientId: string;
  onSave: (activities: CCMActivity[]) => void;
  onCancel: () => void;
  initialData?: CCMTimeTracking;
};

const ACTIVITY_TYPES = [
  { value: 'assessment', label: 'Assessment & Care Planning', billable: true },
  { value: 'care_coordination', label: 'Care Coordination', billable: true },
  { value: 'medication_mgmt', label: 'Medication Management', billable: true },
  { value: 'patient_education', label: 'Patient Education', billable: true },
  { value: 'communication', label: 'Patient/Family Communication', billable: true }
];

export function CCMTimeTracker({ onSave, onCancel, initialData }: Props) {
  const [activities, setActivities] = useState<CCMActivity[]>(initialData?.activities || []);
  const [currentActivity, setCurrentActivity] = useState<Partial<CCMActivity>>({
    type: 'assessment',
    duration: 0,
    description: '',
    provider: '',
    billable: true
  });
  const [timer, setTimer] = useState<{
    isRunning: boolean;
    startTime: Date | null;
    elapsed: number;
  }>({
    isRunning: false,
    startTime: null,
    elapsed: 0
  });

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (timer.isRunning && timer.startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timer.startTime!.getTime()) / 1000);
        setTimer(prev => ({ ...prev, elapsed }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer.isRunning, timer.startTime]);

  // Calculate totals
  const totalMinutes = activities.reduce((sum, activity) => sum + activity.duration, 0);
  const billableMinutes = activities.filter(a => a.billable).reduce((sum, activity) => sum + activity.duration, 0);

  // Determine suggested codes
  const getSuggestedCodes = (billableMin: number): string[] => {
    const codes = [];

    if (billableMin >= 60) {
      codes.push('99487'); // Complex CCM first 60 minutes
      const additionalMinutes = billableMin - 60;
      const additional30MinBlocks = Math.floor(additionalMinutes / 30);
      for (let i = 0; i < additional30MinBlocks; i++) {
        codes.push('99489');
      }
    } else if (billableMin >= 20) {
      codes.push('99490'); // Basic CCM first 20 minutes
      const additionalMinutes = billableMin - 20;
      const additional20MinBlocks = Math.floor(additionalMinutes / 20);
      for (let i = 0; i < additional20MinBlocks; i++) {
        codes.push('99491');
      }
    }

    return codes;
  };

  const suggestedCodes = getSuggestedCodes(billableMinutes);

  // Compliance checks
  const getComplianceIssues = (): string[] => {
    const issues = [];

    if (billableMinutes < 20) {
      issues.push('Minimum 20 minutes required for CCM billing');
    }

    const requiredTypes: CCMActivity['type'][] = ['assessment', 'care_coordination'];
    const providedTypes = [...new Set(activities.map(a => a.type))];
    const missingTypes = requiredTypes.filter(type => !providedTypes.includes(type));

    if (missingTypes.length > 0) {
      issues.push(`Missing required activities: ${missingTypes.join(', ')}`);
    }

    const poorlyDocumented = activities.filter(a => !a.description || a.description.length < 10);
    if (poorlyDocumented.length > 0) {
      issues.push(`${poorlyDocumented.length} activities need better documentation`);
    }

    return issues;
  };

  const complianceIssues = getComplianceIssues();

  // Timer functions
  const startTimer = () => {
    setTimer({
      isRunning: true,
      startTime: new Date(),
      elapsed: 0
    });
  };

  const stopTimer = () => {
    if (timer.elapsed > 0) {
      setCurrentActivity(prev => ({
        ...prev,
        duration: Math.floor(timer.elapsed / 60) // Convert seconds to minutes
      }));
    }
    setTimer({
      isRunning: false,
      startTime: null,
      elapsed: 0
    });
  };

  const resetTimer = () => {
    setTimer({
      isRunning: false,
      startTime: null,
      elapsed: 0
    });
  };

  // Activity management
  const addActivity = () => {
    if (!currentActivity.type || !currentActivity.provider || !currentActivity.description) {
      alert('Please fill in all required fields');
      return;
    }

    const duration = currentActivity.duration || Math.floor(timer.elapsed / 60);

    if (duration <= 0) {
      alert('Activity duration must be greater than 0 minutes');
      return;
    }

    const newActivity: CCMActivity = {
      type: currentActivity.type as CCMActivity['type'],
      duration,
      description: currentActivity.description,
      provider: currentActivity.provider,
      billable: currentActivity.billable || true
    };

    setActivities(prev => [...prev, newActivity]);
    setCurrentActivity({
      type: 'assessment',
      duration: 0,
      description: '',
      provider: currentActivity.provider, // Keep provider name
      billable: true
    });
    resetTimer();
  };

  const removeActivity = (index: number) => {
    setActivities(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (activities.length === 0) {
      alert('Please add at least one activity before saving');
      return;
    }

    onSave(activities);
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">CCM Time Tracking</h3>
          <div className="text-sm text-gray-600">
            Track billable activities for Chronic Care Management
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Activity Form */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-4">Add Activity</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Activity Type *</label>
                <select
                  value={currentActivity.type || ''}
                  onChange={(e) => setCurrentActivity(prev => ({
                    ...prev,
                    type: e.target.value as CCMActivity['type']
                  }))}
                  className="w-full border rounded px-3 py-2"
                >
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Provider *</label>
                <input
                  type="text"
                  value={currentActivity.provider || ''}
                  onChange={(e) => setCurrentActivity(prev => ({
                    ...prev,
                    provider: e.target.value
                  }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Provider name"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                value={currentActivity.description || ''}
                onChange={(e) => setCurrentActivity(prev => ({
                  ...prev,
                  description: e.target.value
                }))}
                className="w-full border rounded px-3 py-2"
                rows={2}
                placeholder="Detailed description of activity performed..."
              />
            </div>

            {/* Timer Section */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-mono font-bold">
                  {formatTime(timer.elapsed)}
                </div>
                <div className="flex gap-2">
                  {!timer.isRunning ? (
                    <button
                      onClick={startTimer}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={stopTimer}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      Stop
                    </button>
                  )}
                  <button
                    onClick={resetTimer}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-600">or</div>

              <div className="flex items-center gap-2">
                <label className="text-sm">Manual entry:</label>
                <input
                  type="number"
                  value={currentActivity.duration || ''}
                  onChange={(e) => setCurrentActivity(prev => ({
                    ...prev,
                    duration: parseInt(e.target.value) || 0
                  }))}
                  className="w-20 border rounded px-2 py-1 text-sm"
                  placeholder="min"
                  min="0"
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={currentActivity.billable !== false}
                  onChange={(e) => setCurrentActivity(prev => ({
                    ...prev,
                    billable: e.target.checked
                  }))}
                />
                <span className="text-sm">Billable activity</span>
              </label>

              <button
                onClick={addActivity}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Add Activity
              </button>
            </div>
          </div>

          {/* Activities List */}
          <div className="border rounded-lg p-4">
            <h4 className="font-medium mb-4">Logged Activities</h4>

            {activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No activities logged yet
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, index) => (
                  <div key={index} className="border rounded p-3 bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">
                            {ACTIVITY_TYPES.find(t => t.value === activity.type)?.label}
                          </span>
                          <span className="text-sm text-gray-600">
                            • {formatMinutes(activity.duration)}
                          </span>
                          {activity.billable && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                              Billable
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 mb-1">
                          {activity.description}
                        </div>
                        <div className="text-xs text-gray-500">
                          Provider: {activity.provider}
                        </div>
                      </div>
                      <button
                        onClick={() => removeActivity(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-medium mb-4">Time Summary</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatMinutes(totalMinutes)}
                </div>
                <div className="text-sm text-gray-600">Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatMinutes(billableMinutes)}
                </div>
                <div className="text-sm text-gray-600">Billable Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {suggestedCodes.length}
                </div>
                <div className="text-sm text-gray-600">Suggested Codes</div>
              </div>
            </div>

            {/* Suggested Codes */}
            {suggestedCodes.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium mb-2">Suggested CPT Codes:</h5>
                <div className="flex flex-wrap gap-2">
                  {suggestedCodes.map((code, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-green-100 text-green-800 rounded font-mono text-sm"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Compliance Issues */}
            {complianceIssues.length > 0 && (
              <div className="mb-4">
                <h5 className="font-medium mb-2 text-red-800">Compliance Issues:</h5>
                <ul className="text-sm text-red-700 space-y-1">
                  {complianceIssues.map((issue, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-500 mt-1">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {complianceIssues.length === 0 && billableMinutes >= 20 && (
              <div className="text-green-700 text-sm font-medium">
                ✓ All compliance requirements met
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={activities.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
          >
            Save Time Tracking
          </button>
        </div>
      </div>
    </div>
  );
}

export default CCMTimeTracker;