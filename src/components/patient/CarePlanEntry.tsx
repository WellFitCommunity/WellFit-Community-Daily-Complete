import React, { useState } from 'react';
import FHIRService from '../../services/fhirResourceService';
import type { FHIRCarePlan, CarePlanActivity } from '../../types/fhir';
import {
  CARE_PLAN_CATEGORIES,
  CARE_PLAN_CATEGORY_NAMES,
  SENIOR_CARE_ACTIVITIES,
} from '../../types/fhir';

interface CarePlanEntryProps {
  userId: string;
  onSave: () => void;
  onCancel: () => void;
}

const CarePlanEntry: React.FC<CarePlanEntryProps> = ({ userId, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<CarePlanActivity[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    status: 'active' as 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown',
    intent: 'plan' as 'proposal' | 'plan' | 'order' | 'option',
    category: [CARE_PLAN_CATEGORIES.ASSESS_PLAN] as string[],
    title: '',
    description: '',
    periodStart: new Date().toISOString().split('T')[0],
    periodEnd: '',
    authorDisplay: '',
    careTeamDisplay: '',
    goals: [''],
    conditions: [''],
    note: '',
  });

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCategoryToggle = (category: string) => {
    const categories = [...formData.category];
    const index = categories.indexOf(category);
    if (index > -1) {
      categories.splice(index, 1);
    } else {
      categories.push(category);
    }
    setFormData({ ...formData, category: categories });
  };

  const addGoal = () => {
    setFormData({ ...formData, goals: [...formData.goals, ''] });
  };

  const removeGoal = (index: number) => {
    const goals = [...formData.goals];
    goals.splice(index, 1);
    setFormData({ ...formData, goals });
  };

  const updateGoal = (index: number, value: string) => {
    const goals = [...formData.goals];
    goals[index] = value;
    setFormData({ ...formData, goals });
  };

  const addCondition = () => {
    setFormData({ ...formData, conditions: [...formData.conditions, ''] });
  };

  const removeCondition = (index: number) => {
    const conditions = [...formData.conditions];
    conditions.splice(index, 1);
    setFormData({ ...formData, conditions });
  };

  const updateCondition = (index: number, value: string) => {
    const conditions = [...formData.conditions];
    conditions[index] = value;
    setFormData({ ...formData, conditions });
  };

  const addActivity = () => {
    setActivities([...activities, {
      status: 'not-started',
      detail: {
        code_display: '',
        description: '',
        status: 'not-started'
      }
    }]);
  };

  const removeActivity = (index: number) => {
    const newActivities = [...activities];
    newActivities.splice(index, 1);
    setActivities(newActivities);
  };

  const updateActivity = (index: number, field: string, value: string) => {
    const newActivities = [...activities];
    if (field.startsWith('detail.')) {
      const detailField = field.substring(7);
      newActivities[index] = {
        ...newActivities[index],
        detail: {
          ...newActivities[index].detail,
          [detailField]: value
        }
      };
    } else {
      newActivities[index] = {
        ...newActivities[index],
        [field]: value
      };
    }
    setActivities(newActivities);
  };

  const addTemplateActivity = (template: typeof SENIOR_CARE_ACTIVITIES[keyof typeof SENIOR_CARE_ACTIVITIES]) => {
    setActivities([...activities, {
      status: 'not-started',
      detail: {
        code: template.code,
        code_display: template.display,
        description: template.display,
        status: 'not-started',
        kind: 'Task'
      }
    }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title) {
      setError('Please provide a title for the care plan');
      return;
    }

    if (formData.category.length === 0) {
      setError('Please select at least one category');
      return;
    }

    setLoading(true);

    try {
      const carePlan: Partial<FHIRCarePlan> = {
        patient_id: userId,
        status: formData.status,
        intent: formData.intent,
        category: formData.category,
        category_display: formData.category.map(cat => CARE_PLAN_CATEGORY_NAMES[cat] || cat),
        title: formData.title,
        description: formData.description || undefined,
        period_start: formData.periodStart,
        period_end: formData.periodEnd || undefined,
        author_display: formData.authorDisplay || undefined,
        care_team_display: formData.careTeamDisplay || undefined,
        goal_displays: formData.goals.filter(g => g.trim() !== ''),
        addresses_condition_displays: formData.conditions.filter(c => c.trim() !== ''),
        activities: activities.length > 0 ? activities : undefined,
        note: formData.note || undefined,
      };

      await FHIRService.CarePlan.create(carePlan);
      onSave();
    } catch (err) {

      setError('Failed to save care plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-1">📋 Create Care Plan</h2>
              <p className="text-blue-100">Coordinate healthcare goals and activities</p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            >
              <span className="text-2xl">×</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
              Basic Information
            </h3>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Diabetes Management Plan, Fall Prevention Plan"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Describe the purpose and scope of this care plan..."
              />
            </div>

            {/* Status and Intent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intent <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.intent}
                  onChange={(e) => handleInputChange('intent', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="proposal">Proposal</option>
                  <option value="plan">Plan</option>
                  <option value="order">Order</option>
                  <option value="option">Option</option>
                </select>
              </div>
            </div>

            {/* Categories */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Categories <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(CARE_PLAN_CATEGORY_NAMES).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.category.includes(key)}
                      onChange={() => handleCategoryToggle(key)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded-sm focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Period */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => handleInputChange('periodStart', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => handleInputChange('periodEnd', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Author and Care Team */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Author (Provider/Organization)
                </label>
                <input
                  type="text"
                  value={formData.authorDisplay}
                  onChange={(e) => handleInputChange('authorDisplay', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Dr. Smith, Primary Care"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Care Team
                </label>
                <input
                  type="text"
                  value={formData.careTeamDisplay}
                  onChange={(e) => handleInputChange('careTeamDisplay', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Primary Care Team, Diabetes Care Team"
                />
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Goals</h3>
              <button
                type="button"
                onClick={addGoal}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Goal
              </button>
            </div>
            <div className="space-y-3">
              {formData.goals.map((goal, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => updateGoal(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Maintain HbA1c below 7%, Reduce fall risk"
                  />
                  <button
                    type="button"
                    onClick={() => removeGoal(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Conditions Addressed */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Conditions Addressed</h3>
              <button
                type="button"
                onClick={addCondition}
                className="px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                + Add Condition
              </button>
            </div>
            <div className="space-y-3">
              {formData.conditions.map((condition, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => updateCondition(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Type 2 Diabetes, Hypertension, COPD"
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activities */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h3 className="text-lg font-semibold text-gray-900">Activities</h3>
              <button
                type="button"
                onClick={addActivity}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Custom Activity
              </button>
            </div>

            {/* Activity Templates */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quick Add Common Activities:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SENIOR_CARE_ACTIVITIES).slice(0, 6).map(([key, activity]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => addTemplateActivity(activity)}
                    className="px-3 py-1 text-xs bg-purple-100 text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    + {activity.display}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity List */}
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Activity {index + 1}</h4>
                    <button
                      type="button"
                      onClick={() => removeActivity(index)}
                      className="text-red-600 hover:bg-red-50 rounded-sm px-2 py-1 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Activity Name
                      </label>
                      <input
                        type="text"
                        value={activity.detail?.code_display || ''}
                        onChange={(e) => updateActivity(index, 'detail.code_display', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder="e.g., Daily glucose monitoring"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={activity.status || 'not-started'}
                        onChange={(e) => updateActivity(index, 'status', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="not-started">Not Started</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in-progress">In Progress</option>
                        <option value="on-hold">On Hold</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={activity.detail?.description || ''}
                      onChange={(e) => updateActivity(index, 'detail.description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                      placeholder="Describe the activity..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Additional notes about this care plan..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Create Care Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CarePlanEntry;
