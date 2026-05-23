import { useTranslation } from '../context/LanguageContext.jsx';

function LanguageSelector() {
    const { t, language, setLanguage } = useTranslation();

    return (
        <div className="bg-[#f8f8f8] border border-black/5 rounded-[24px] p-5">
            <p className="text-[10px] font-bold uppercase text-[#888] tracking-[0.12em] mb-1">
                {t('settings.language.section')}
            </p>
            <p className="text-sm text-[#666] font-medium mb-4">{t('settings.language.description')}</p>
            <div className="flex p-1.5 bg-white border border-black/5 rounded-2xl gap-1">
                <button
                    type="button"
                    onClick={() => setLanguage('uz')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                        language === 'uz'
                            ? 'bg-[#185FA5] text-white shadow-sm'
                            : 'text-[#666] hover:text-[#111]'
                    }`}
                >
                    {t('settings.language.uz')}
                </button>
                <button
                    type="button"
                    onClick={() => setLanguage('ru')}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${
                        language === 'ru'
                            ? 'bg-[#185FA5] text-white shadow-sm'
                            : 'text-[#666] hover:text-[#111]'
                    }`}
                >
                    {t('settings.language.ru')}
                </button>
            </div>
        </div>
    );
}

export default LanguageSelector;
