import { useLanguage } from '../context/LanguageContext.jsx';

function LanguageSelection() {
    const { setLanguage } = useLanguage();

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center px-6 py-12 max-w-md mx-auto page-animate">
            <div className="text-center mb-12">
                <div className="w-16 h-16 bg-[#378ADD] rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(55,138,221,0.25)]">
                    <img src="./Scissor.png" alt="NavbatGo" className="w-8 h-8 object-contain invert" onError={e => e.target.style.display = 'none'} />
                </div>
                <h1 className="text-[32px] font-bold text-[#111] tracking-[-0.04em] leading-tight mb-3">NavbatGo</h1>
                <p className="text-sm text-[#666] font-medium">Tilni tanlang</p>
                <p className="text-sm text-[#666] font-medium mt-1">Выберите язык</p>
            </div>

            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => setLanguage('uz')}
                    className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/30 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                >
                    <div className="text-left">
                        <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">O&apos;zbekcha</h2>
                        <p className="text-sm text-[#666] font-medium mt-0.5">Uzbek</p>
                    </div>
                    <span className="text-2xl" aria-hidden>🇺🇿</span>
                </button>

                <button
                    type="button"
                    onClick={() => setLanguage('ru')}
                    className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/30 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                >
                    <div className="text-left">
                        <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">Русский</h2>
                        <p className="text-sm text-[#666] font-medium mt-0.5">Russian</p>
                    </div>
                    <span className="text-2xl" aria-hidden>🇷🇺</span>
                </button>
            </div>
        </section>
    );
}

export default LanguageSelection;
