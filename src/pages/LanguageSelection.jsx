import { useLanguage } from '../context/LanguageContext.jsx';
import { Card } from '../components/ui/index.js';
import { t } from '../utils/i18n.js';

function LanguageSelection() {
    const { setLanguage } = useLanguage();

    return (
        <section className="min-h-screen bg-[var(--bg-base)] flex flex-col justify-center px-6 py-12 max-w-md mx-auto page-animate">
            <div className="text-center mb-10">
                <div className="w-14 h-14 bg-[var(--brand-primary)] rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5">
                    <img src="./Scissor.png" alt="BarberUp" className="w-7 h-7 object-contain invert" onError={e => e.target.style.display = 'none'} />
                </div>
                <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{t('brand.name')}</h1>
                <p className="text-sm text-[var(--text-secondary)]">{t('language.title')}</p>
            </div>

            <div className="space-y-3">
                <Card interactive className="p-5" onClick={() => setLanguage('uz')}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-[var(--text-primary)]">O&apos;zbekcha</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Uzbek</p>
                        </div>
                        <span className="text-2xl">🇺🇿</span>
                    </div>
                </Card>
                <Card interactive className="p-5" onClick={() => setLanguage('ru')}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-[var(--text-primary)]">Русский</h2>
                            <p className="text-sm text-[var(--text-secondary)]">Russian</p>
                        </div>
                        <span className="text-2xl">🇷🇺</span>
                    </div>
                </Card>
            </div>
        </section>
    );
}

export default LanguageSelection;
