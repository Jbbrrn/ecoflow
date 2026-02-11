import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { translations } from './i18n';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('en');

  // Load initial language from localStorage (if available)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('ecoflow_language');
      if (stored === 'en' || stored === 'fil') {
        setLanguageState(stored);
      }
    } catch {
      // Ignore storage errors and keep default
    }
  }, []);

  const setLanguage = (lang) => {
    const safeLang = lang === 'fil' ? 'fil' : 'en';
    setLanguageState(safeLang);
    try {
      window.localStorage.setItem('ecoflow_language', safeLang);
    } catch {
      // Ignore storage errors
    }
  };

  const t = useMemo(() => {
    return (key) => {
      if (!key) return '';
      return (translations[language] && translations[language][key]) ||
        (translations.en && translations.en[key]) ||
        key;
    };
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

