import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ClientProvider } from './context/ClientContext.jsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';
import AppRouter from './routes/AppRouter.jsx';
import LanguageSelection from './pages/LanguageSelection.jsx';
import { t } from './utils/i18n.js';
import { useEffect } from 'react';

function AppShell() {
    const { ready, hasChosenLanguage, language } = useLanguage();
    const { user, loading: authLoading } = useAuth();

    // Initialize the Telegram Mini App SDK as early as possible.
    // This is safe to call even outside Telegram — the guard prevents errors.
    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
        }
    }, []);

    if (!ready || authLoading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-6">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-semibold text-[#666]">{t('common.pleaseWait')}</p>
                </div>
            </div>
        );
    }

    // Inside Telegram, skip language selection — go straight to the router
    // (TelegramEntry handles everything from there).
    const isInTelegram = !!window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (isInTelegram) {
        return (
            <div key={language}>
                <AppRouter />
            </div>
        );
    }

    // Show language selector only on true cold-start (no user, no language
    // stored). Once a user exists OR a language is stored, the user is in
    // the app — the language can always be changed later from Settings.
    if (!hasChosenLanguage && !user) {
        return <LanguageSelection />;
    }

    return (
        <div key={language}>
            <AppRouter />
        </div>
    );
}

function InnerShell() {
    return (
        <AuthProvider>
            <ClientProvider>
                <AppShell />
            </ClientProvider>
        </AuthProvider>
    );
}

function App() {
    return (
        <LanguageProvider>
            <InnerShell />
        </LanguageProvider>
    );
}

export default App;
