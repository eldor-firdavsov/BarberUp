import { AuthProvider } from './context/AuthContext.jsx';
import { LanguageProvider, useLanguage } from './context/LanguageContext.jsx';
import AppRouter from './routes/AppRouter.jsx';
import LanguageSelection from './pages/LanguageSelection.jsx';
import { t } from './utils/i18n.js';

function AppShell() {
    const { ready, hasChosenLanguage, language } = useLanguage();

    if (!ready) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-6">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-4" />
                    <p className="text-sm font-semibold text-[#666]">{t('common.pleaseWait')}</p>
                </div>
            </div>
        );
    }

    if (!hasChosenLanguage) {
        return <LanguageSelection />;
    }

    return (
        <AuthProvider>
            <div key={language}>
                <AppRouter />
            </div>
        </AuthProvider>
    );
}

function App() {
    return (
        <LanguageProvider>
            <AppShell />
        </LanguageProvider>
    );
}

export default App;
