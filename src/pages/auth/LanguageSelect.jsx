import { useNavigate } from 'react-router-dom';
import { setLocale } from '../../utils/i18n.js';

function LanguageSelect() {
    const navigate = useNavigate();

    const handleSelect = (lang) => {
        setLocale(lang);
        localStorage.setItem('language', lang);
        navigate('/role-select');
    };

    return (
        <section className="page-animate min-h-screen bg-[#f5f5f7] flex flex-col justify-center px-6 py-12 max-w-md md:max-w-xl mx-auto">
            <div className="text-center mb-14">
                <div className="w-16 h-16 bg-[#378ADD] rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(55,138,221,0.25)]">
                    <img src="./Scissor.png" alt="BarberUp" className="w-8 h-8 object-contain invert" onError={e => e.target.style.display = 'none'} />
                </div>
                <h1 className="text-[32px] font-bold text-[#111] tracking-[-0.04em] leading-tight mb-3">BarberUp</h1>
                <p className="text-sm text-[#666] font-medium">Tilni tanlang / Выберите язык</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={() => handleSelect('uz')}
                    className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/20 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0">
                            <img className='w-[28px]' src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Flag_of_Uzbekistan.png" alt="" />
                        </div>
                        <div>
                            <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">O'zbekcha</h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">O'zbek tili</p>
                        </div>
                    </div>
                    <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>

                <button
                    onClick={() => handleSelect('ru')}
                    className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/20 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0 text-xl font-bold text-[#111]">
                            <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                                <rect width="28" height="20" rx="2" fill="white"/>
                                <rect y="6.67" width="28" height="6.67" fill="#0039A6"/>
                                <rect y="13.33" width="28" height="6.67" fill="#D52B1E"/>
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">Русский</h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">Русский язык</p>
                        </div>
                    </div>
                    <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>
            </div>

            <div className="mt-14 text-center">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#999] font-semibold">BarberUp</p>
            </div>
        </section>
    );
}

export default LanguageSelect;
