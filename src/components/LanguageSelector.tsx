// Language Selector Component - Toggle between English, Spanish, and Vietnamese
// Supporting Houston's diverse population
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
  };

  // Get localized label
  const getLabel = () => {
    switch (language) {
      case 'es': return 'Idioma:';
      case 'vi': return 'Ngon ngu:';
      default: return 'Language:';
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {showLabel && (
        <label className="text-base font-semibold text-gray-700">
          {getLabel()}
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleLanguageChange('en')}
          className={`px-4 py-3 font-semibold transition-colors rounded-lg border-2 ${
            language === 'en'
              ? 'bg-[#003865] text-white border-[#003865]'
              : 'bg-white text-[#003865] border-gray-300 hover:border-[#003865]'
          }`}
          aria-label="Switch to English"
          aria-pressed={language === 'en'}
        >
          <span className="text-xl mr-2">🇺🇸</span>
          English
        </button>

        <button
          onClick={() => handleLanguageChange('es')}
          className={`px-4 py-3 font-semibold transition-colors rounded-lg border-2 ${
            language === 'es'
              ? 'bg-[#8cc63f] text-white border-[#8cc63f]'
              : 'bg-white text-[#003865] border-gray-300 hover:border-[#8cc63f]'
          }`}
          aria-label="Cambiar a Espanol"
          aria-pressed={language === 'es'}
        >
          <span className="text-xl mr-2">🇪🇸</span>
          Espanol
        </button>

        <button
          onClick={() => handleLanguageChange('vi')}
          className={`px-4 py-3 font-semibold transition-colors rounded-lg border-2 ${
            language === 'vi'
              ? 'bg-[#da251d] text-white border-[#da251d]'
              : 'bg-white text-[#003865] border-gray-300 hover:border-[#da251d]'
          }`}
          aria-label="Chuyen sang Tieng Viet"
          aria-pressed={language === 'vi'}
        >
          <span className="text-xl mr-2">🇻🇳</span>
          Tieng Viet
        </button>
      </div>
    </div>
  );
};

export default LanguageSelector;