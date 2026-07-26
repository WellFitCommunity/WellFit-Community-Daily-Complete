// Language Context for WellFit Community
// Read order: profiles.preferred_language (signed-in) → localStorage → browser.
// setLanguage applies immediately and persists to both localStorage and profiles,
// so the choice follows the user across devices.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, translations, getBrowserLanguage } from '../i18n/translations';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';

const LANGUAGE_STORAGE_KEY = 'wellfit_language';

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es' || value === 'vi';
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations['en'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(saved) ? saved : getBrowserLanguage();
  });

  // DB preference (if any) wins over localStorage once the session resolves
  useEffect(() => {
    let cancelled = false;
    const loadDbPreference = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!cancelled && isLanguage(profile?.preferred_language)) {
          setLanguageState(profile.preferred_language);
          localStorage.setItem(LANGUAGE_STORAGE_KEY, profile.preferred_language);
        }
      } catch (err: unknown) {
        // Language must never block rendering — log and keep the local choice
        await auditLogger.error(
          'LANGUAGE_PREFERENCE_LOAD_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          {}
        );
      }
    };
    loadDbPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    // Best-effort persistence; UI already switched
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { error } = await supabase
          .from('profiles')
          .update({ preferred_language: lang })
          .eq('user_id', session.user.id);
        if (error) throw new Error(error.message);
      } catch (err: unknown) {
        await auditLogger.error(
          'LANGUAGE_PREFERENCE_SAVE_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { language: lang }
        );
      }
    })();
  };

  const value = {
    language,
    setLanguage,
    t: translations[language],
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
