import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { setLocale, getLocale, t as translate } from '../utils/i18n.js';

const STORAGE_KEY = 'navbatgo_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'uz' || stored === 'ru') {
            setLocale(stored);
            setLanguageState(stored);
        }
        setReady(true);
    }, []);

    const setLanguage = useCallback((lang) => {
        if (lang !== 'uz' && lang !== 'ru') return;
        setLocale(lang);
        localStorage.setItem(STORAGE_KEY, lang);
        setLanguageState(lang);
    }, []);

    const value = {
        language,
        setLanguage,
        ready,
        hasChosenLanguage: language === 'uz' || language === 'ru',
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return ctx;
}

/** Re-render when language changes; use in components that call t() */
export function useTranslation() {
    const { language, setLanguage } = useLanguage();
    const tFn = useCallback(
        (key, params) => translate(key, params),
        [language]
    );
    return { t: tFn, language, setLanguage, locale: language ?? getLocale() };
}

export default LanguageContext;
