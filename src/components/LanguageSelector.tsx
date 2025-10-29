// Language Selector Component - Toggle between English and Spanish
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n/translations';

interface LanguageSelectorProps {
  showLabel?: boolean;
  className?: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  showLabel = true,
  className = ''
}) => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    // Optional: Show a toast notification
    // console.log(`Language changed to ${lang === 'en' ? 'English' : 'Español'}`);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabel && (
        <label className="text-base font-semibold text-gray-700">
          {language === 'en' ? 'Language:' : 'Idioma:'}
        </label>
      )}

      <div className="flex items-center bg-white border-2 border-[#003865] rounded-lg overflow-hidden shadow-sm">
        <button
          onClick={() => handleLanguageChange('en')}
          className={`px-4 py-2 font-semibold transition-colors ${
            language === 'en'
              ? 'bg-[#003865] text-white'
              : 'bg-white text-[#003865] hover:bg-gray-50'
          }`}
          aria-label="Switch to English"
          aria-pressed={language === 'en'}
        >
          🇺🇸 English
        </button>

        <button
          onClick={() => handleLanguageChange('es')}
          className={`px-4 py-2 font-semibold transition-colors ${
            language === 'es'
              ? 'bg-[#8cc63f] text-white'
              : 'bg-white text-[#003865] hover:bg-gray-50'
          }`}
          aria-label="Cambiar a Español"
          aria-pressed={language === 'es'}
        >
          🇪🇸 Español
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;