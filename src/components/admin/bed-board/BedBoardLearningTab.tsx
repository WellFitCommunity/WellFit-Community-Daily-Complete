/**
 * BedBoardLearningTab — Prediction accuracy dashboard + ML feedback form + learning tips.
 */

import React from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Brain,
  Sparkles,
  Target,
  BarChart3,
} from 'lucide-react';
import { EACard, EACardHeader, EACardContent, EAButton } from '../../envision-atlus';
import type { BedBoardLearningTabProps } from './BedBoard.types';

export const BedBoardLearningTab: React.FC<BedBoardLearningTabProps> = ({
  accuracy,
  units,
  feedbackUnit,
  feedbackDate,
  actualCensus,
  feedbackNotes,
  submittingFeedback,
  onSetFeedbackUnit,
  onSetFeedbackDate,
  onSetActualCensus,
  onSetFeedbackNotes,
  onSubmitFeedback,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Accuracy Dashboard */}
    <EACard>
      <EACardHeader icon={<Target className="w-5 h-5" />}>
        Prediction Accuracy
      </EACardHeader>
      <EACardContent className="p-4">
        {accuracy ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800 rounded-lg text-center">
                <p className="text-sm text-slate-400">Accuracy</p>
                <p className="text-3xl font-bold text-teal-400">
                  {accuracy.accuracy_percentage.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-slate-800 rounded-lg text-center">
                <p className="text-sm text-slate-400">Mean Absolute Error</p>
                <p className="text-3xl font-bold text-white">
                  {accuracy.mean_absolute_error.toFixed(1)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <span className="text-slate-400">Trend</span>
              <span className={`flex items-center gap-1 ${
                accuracy.improving_trend ? 'text-green-400' : 'text-orange-400'
              }`}>
                {accuracy.improving_trend ? (
                  <><TrendingUp className="w-4 h-4" /> Improving</>
                ) : (
                  <><AlertTriangle className="w-4 h-4" /> Needs Attention</>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <span className="text-slate-400">Sample Size</span>
              <span className="text-white">{accuracy.total_predictions} predictions</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">Select a unit to view accuracy</p>
          </div>
        )}
      </EACardContent>
    </EACard>

    {/* Feedback Form */}
    <EACard>
      <EACardHeader icon={<Sparkles className="w-5 h-5" />}>
        Submit Learning Feedback
      </EACardHeader>
      <EACardContent className="p-4">
        <p className="text-sm text-slate-400 mb-4">
          Help the algorithm learn by providing actual census data. This improves future predictions.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Unit</label>
            <select
              value={feedbackUnit}
              onChange={(e) => onSetFeedbackUnit(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select Unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.unit_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={feedbackDate}
              onChange={(e) => onSetFeedbackDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Actual Census (End of Day)
            </label>
            <input
              type="number"
              value={actualCensus}
              onChange={(e) => onSetActualCensus(e.target.value)}
              placeholder="Enter actual patient count"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Notes (Optional)</label>
            <textarea
              value={feedbackNotes}
              onChange={(e) => onSetFeedbackNotes(e.target.value)}
              placeholder="Any factors that affected census (e.g., staff shortage, unexpected admissions)"
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <EAButton
            onClick={onSubmitFeedback}
            disabled={submittingFeedback || !feedbackUnit || !actualCensus}
            className="w-full"
            icon={<Brain className="w-4 h-4" />}
          >
            {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
          </EAButton>
        </div>
      </EACardContent>
    </EACard>

    {/* Learning Tips */}
    <EACard className="lg:col-span-2">
      <EACardHeader icon={<Brain className="w-5 h-5" />}>
        How the Algorithm Learns
      </EACardHeader>
      <EACardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Data Collection', desc: 'Every prediction and actual outcome is recorded for analysis' },
            { step: '2', title: 'Pattern Recognition', desc: 'The model identifies factors that affect census (day of week, season, etc.)' },
            { step: '3', title: 'Continuous Improvement', desc: 'Your feedback helps refine predictions specific to your hospital' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="p-4 bg-slate-800 rounded-lg">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center mb-3">
                <span className="text-teal-400 font-bold">{step}</span>
              </div>
              <h4 className="font-medium text-white mb-1">{title}</h4>
              <p className="text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </EACardContent>
    </EACard>
  </div>
);

export default BedBoardLearningTab;
