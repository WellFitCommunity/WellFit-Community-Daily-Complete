// ============================================================================
// Translation Module - Real-time translation with cultural context
// ============================================================================

import React, { useState } from 'react';
import { ClaudeCareAssistant } from '../../services/claudeCareAssistant';
import { SupportedLanguage, LANGUAGE_NAMES, TranslationContextType } from '../../types/claudeCareAssistant';

interface Props {
  userRole: string;
}

const TranslationModule: React.FC<Props> = ({ userRole }) => {
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguage>('en');
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>('es');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [culturalNotes, setCulturalNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState(false);
  const [contextType, setContextType] = useState<TranslationContextType>('medical');
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setError('Please enter text to translate');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await ClaudeCareAssistant.translate({
        sourceLanguage,
        targetLanguage,
        sourceText,
        contextType,
      });

      setTranslatedText(response.translatedText);
      setCulturalNotes(response.culturalNotes || []);
      setCached(response.cached);
    } catch (err) {
      setError('Translation failed. Please try again.');

    } finally {
      setLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      alert('Translation copied to clipboard!');
    } catch (err) {

    }
  };

  const languages = Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code,
    name,
  }));

  return (
    <div className="space-y-6">
      {/* Context Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Translation Context
        </label>
        <select
          value={contextType}
          onChange={(e) => setContextType(e.target.value as TranslationContextType)}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="medical">Medical/Clinical</option>
          <option value="administrative">Administrative</option>
          <option value="general">General Communication</option>
        </select>
      </div>

      {/* Language Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <select
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value as SupportedLanguage)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleSwapLanguages}
            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
            title="Swap languages"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <select
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value as SupportedLanguage)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Text Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Original Text
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="Enter text to translate..."
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
            <span>Translation</span>
            {cached && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-sm">
                Cached
              </span>
            )}
          </label>
          <textarea
            value={translatedText}
            readOnly
            placeholder="Translation will appear here..."
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-md bg-gray-50 font-mono"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={handleTranslate}
          disabled={loading || !sourceText.trim()}
          className={`flex-1 py-3 px-6 rounded-md font-semibold text-white transition-colors ${
            loading || !sourceText.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Translating...' : 'Translate'}
        </button>

        {translatedText && (
          <button
            onClick={handleCopyToClipboard}
            className="px-6 py-3 border border-gray-300 rounded-md font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Copy
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Cultural Notes */}
      {culturalNotes.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Cultural Considerations
          </h3>
          <ul className="space-y-2">
            {culturalNotes.map((note, index) => (
              <li key={index} className="flex items-start">
                <svg
                  className="w-5 h-5 text-blue-600 mr-2 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-blue-800">{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h4 className="font-semibold text-gray-900 mb-2">About Translation</h4>
        <p className="text-sm text-gray-700">
          Claude Care Assistant provides accurate medical translations with cultural context
          to ensure clear communication with patients and families. Translations are cached
          for faster future use and cost savings.
        </p>
      </div>
    </div>
  );
};

export default TranslationModule;
