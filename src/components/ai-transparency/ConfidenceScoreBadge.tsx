import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfidenceScoreBadgeProps {
  score: number; // 0-100
  suggestionType?: 'billing_code' | 'clinical' | 'drug_interaction' | 'risk_assessment';
  explanation?: string;
  supportingEvidence?: Record<string, unknown>;
  onValidate?: (accepted: boolean, modifiedValue?: string) => void;
  variant?: 'badge' | 'detailed';
}

export const ConfidenceScoreBadge: React.FC<ConfidenceScoreBadgeProps> = ({
  score,
  suggestionType = 'clinical',
  explanation,
  supportingEvidence,
  onValidate,
  variant = 'badge',
}) => {
  const [showExplanation, setShowExplanation] = useState(false);
  const [validated, setValidated] = useState<boolean | null>(null);

  const getConfidenceLevel = (score: number): 'high' | 'medium' | 'low' => {
    if (score >= 90) return 'high';
    if (score >= 75) return 'medium';
    return 'low';
  };

  const getConfidenceConfig = (level: 'high' | 'medium' | 'low') => {
    switch (level) {
      case 'high':
        return {
          label: 'High Confidence',
          icon: '✓',
          gradient: 'from-green-400 to-emerald-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
          ringColor: 'ring-green-500',
        };
      case 'medium':
        return {
          label: 'Medium Confidence',
          icon: '⚠',
          gradient: 'from-yellow-400 to-amber-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-700',
          ringColor: 'ring-yellow-500',
        };
      case 'low':
        return {
          label: 'Low Confidence',
          icon: '!',
          gradient: 'from-red-400 to-rose-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-700',
          ringColor: 'ring-red-500',
        };
    }
  };

  // Get suggestion type-specific label for context
  const getSuggestionTypeLabel = (type: typeof suggestionType): string => {
    switch (type) {
      case 'billing_code':
        return 'Billing';
      case 'clinical':
        return 'Clinical';
      case 'drug_interaction':
        return 'Drug';
      case 'risk_assessment':
        return 'Risk';
      default:
        return 'AI';
    }
  };

  const level = getConfidenceLevel(score);
  const config = getConfidenceConfig(level);
  const typeLabel = getSuggestionTypeLabel(suggestionType);

  const handleValidation = (accepted: boolean) => {
    setValidated(accepted);
    if (onValidate) {
      onValidate(accepted);
    }
  };

  if (variant === 'badge') {
    return (
      <div className="inline-flex items-center space-x-2">
        {/* Confidence Badge */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            inline-flex items-center space-x-2 px-3 py-1 rounded-full
            ${config.bgColor} ${config.borderColor} border-2
            cursor-pointer transition-all duration-200
            hover:shadow-lg
          `}
          onClick={() => setShowExplanation(!showExplanation)}
        >
          <span className="text-sm font-bold">{config.icon}</span>
          <span className={`text-xs ${config.textColor} opacity-75`}>{typeLabel}</span>
          <span className={`text-sm font-semibold ${config.textColor}`}>{score}%</span>
          <span className={`text-xs ${config.textColor} opacity-75`}>{level}</span>
        </motion.div>

        {/* Explain Button */}
        {explanation && (
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Explain
          </button>
        )}

        {/* Validation Buttons */}
        {validated === null && onValidate && level !== 'high' && (
          <div className="inline-flex items-center space-x-1">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleValidation(true)}
              className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-700 flex items-center justify-center text-xs font-bold"
              title="Accept suggestion"
            >
              ✓
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleValidation(false)}
              className="w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold"
              title="Reject suggestion"
            >
              ✗
            </motion.button>
          </div>
        )}

        {/* Validation Status */}
        {validated !== null && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`text-xs font-semibold ${validated ? 'text-green-600' : 'text-red-600'}`}
          >
            {validated ? 'Accepted' : 'Rejected'}
          </motion.span>
        )}

        {/* Explanation Tooltip */}
        <AnimatePresence>
          {showExplanation && explanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute z-50 mt-2 w-80 max-w-md"
              style={{ top: '100%', left: 0 }}
            >
              <div className={`bg-white rounded-xl shadow-2xl border ${config.borderColor} p-4`}>
                <div className="flex items-start space-x-2">
                  <span className="text-2xl">{config.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 mb-2">AI Reasoning</p>
                    <p className="text-sm text-gray-600">{explanation}</p>

                    {supportingEvidence && Object.keys(supportingEvidence).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Supporting Evidence:</p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {Object.entries(supportingEvidence).map(([key, value]) => (
                            <li key={key}>
                              <span className="font-medium">{key}:</span> {JSON.stringify(value)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Detailed variant
  return (
    <div className={`rounded-2xl ${config.bgColor} border-2 ${config.borderColor} p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-full bg-linear-to-br ${config.gradient} flex items-center justify-center text-white text-2xl font-bold`}>
            {config.icon}
          </div>
          <div>
            <p className={`text-lg font-bold ${config.textColor}`}>{config.label}</p>
            <p className="text-sm text-gray-600">AI Suggestion Confidence</p>
          </div>
        </div>

        <div className="text-center">
          <p className={`text-5xl font-bold bg-linear-to-r ${config.gradient} bg-clip-text text-transparent`}>{score}%</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full bg-linear-to-r ${config.gradient}`}
          ></motion.div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>Low (0-74%)</span>
          <span>Medium (75-89%)</span>
          <span>High (90-100%)</span>
        </div>
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 mb-4">
          <p className="font-semibold text-gray-800 mb-2">AI Reasoning:</p>
          <p className="text-sm text-gray-700">{explanation}</p>
        </div>
      )}

      {/* Supporting Evidence */}
      {supportingEvidence && Object.keys(supportingEvidence).length > 0 && (
        <div className="bg-white/70 backdrop-blur-xs rounded-xl p-4 mb-4">
          <p className="font-semibold text-gray-800 mb-2">Supporting Evidence:</p>
          <div className="space-y-2">
            {Object.entries(supportingEvidence).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="font-medium text-gray-700">{key}:</span>{' '}
                <span className="text-gray-600">{JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Actions */}
      {onValidate && validated === null && (
        <div className="flex items-center space-x-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleValidation(true)}
            className="flex-1 bg-linear-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            ✓ Accept Suggestion
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleValidation(false)}
            className="flex-1 bg-linear-to-r from-red-500 to-rose-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            ✗ Reject & Modify
          </motion.button>
        </div>
      )}

      {/* Validation Status */}
      {validated !== null && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-center py-3 rounded-xl font-bold ${
            validated ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {validated ? '✓ Suggestion Accepted' : '✗ Suggestion Rejected'}
        </motion.div>
      )}

      {/* Recommendation based on confidence */}
      {level === 'medium' && (
        <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 p-3 rounded-sm">
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">⚠ Review Recommended:</span> Please verify this suggestion with clinical judgment.
          </p>
        </div>
      )}

      {level === 'low' && (
        <div className="mt-4 bg-red-100 border-l-4 border-red-500 p-3 rounded-sm">
          <p className="text-sm text-red-800">
            <span className="font-semibold">! Manual Review Required:</span> Low confidence. Strongly recommend manual verification.
          </p>
        </div>
      )}
    </div>
  );
};
