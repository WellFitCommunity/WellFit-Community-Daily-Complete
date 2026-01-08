// ============================================================================
// Language Switcher for Resilience Hub
// ============================================================================
// Purpose: Toggle between English and Spanish
// Design: Compact flag-based switcher
// ============================================================================

import React, { useState } from 'react';
import type { Language } from '../../i18n/resilienceHubTranslations';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('wellfit_resilience_language');
    return (saved as Language) || 'en';
  });

  const toggleLanguage = () => {
    const newLang: Language = language === 'en' ? 'es' : 'en';
    setLanguageState(newLang);
    localStorage.setItem('wellfit_resilience_language', newLang);
    // Reload page to apply translations
    window.location.reload();
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-colors bg-white ${className}`}
      aria-label={`Switch to ${language === 'en' ? 'Spanish' : 'English'}`}
    >
      <span className="text-2xl">{language === 'en' ? '🇺🇸' : '🇲🇽'}</span>
      <div className="text-left">
        <div className="text-xs text-gray-600 uppercase tracking-wide">
          {language === 'en' ? 'Language' : 'Idioma'}
        </div>
        <div className="text-sm font-bold text-gray-800">
          {language === 'en' ? 'English' : 'Español'}
        </div>
      </div>
      <span className="text-gray-400 text-sm ml-1">⇄</span>
    </button>
  );
};

// Hook to get current language
export function useResilienceLanguage(): Language {
  const [language] = useState<Language>(() => {
    const saved = localStorage.getItem('wellfit_resilience_language');
    return (saved as Language) || 'en';
  });

  return language;
}

export default LanguageSwitcher;
