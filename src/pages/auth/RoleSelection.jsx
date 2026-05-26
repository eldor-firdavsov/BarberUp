import { useNavigate } from 'react-router-dom';
import { t } from '../../utils/i18n.js';

function RoleSelection() {
    const navigate = useNavigate();

    const handleSelectRole = (role) => {
        localStorage.setItem('onboarding_data', JSON.stringify({ role }));
        navigate('/register');
    };

    return (
        <section className="page-animate min-h-screen bg-[#f5f5f7] flex flex-col justify-center px-6 py-12 max-w-md md:max-w-xl mx-auto">

            <div className="text-center mb-14">
                <div className="w-16 h-16 bg-[#378ADD] rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(55,138,221,0.25)]">
                    <img src="./Scissor.png" alt={t('brand.name')} className="w-8 h-8 object-contain invert" onError={e => e.target.style.display = 'none'} />
                </div>
                <h1 className="text-[32px] font-bold text-[#111] tracking-[-0.04em] leading-tight mb-3">{t('brand.name')}</h1>
                <p className="text-sm text-[#666] font-medium">{t('auth.roleSelection.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
                <button
                    onClick={() => handleSelectRole('barber')}
                    className="w-full flex md:flex-col md:items-start md:justify-between md:p-7 items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/20 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                >
                    <div className="flex items-center gap-4 md:gap-3 md:flex-col md:items-start">
                        <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0">
                            <img src="./Scissor.png" alt="" className="w-6 h-6 object-contain" onError={e => e.target.style.display = 'none'} />
                        </div>
                        <div className="text-left">
                            <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">{t('auth.roleSelection.barberTitle')}</h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">{t('auth.roleSelection.barberDesc')}</p>
                        </div>
                    </div>
                    <svg className="shrink-0 md:self-end" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>

                <button
                    onClick={() => handleSelectRole('client')}
                    className="w-full flex md:flex-col md:items-start md:justify-between md:p-7 items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] hover:border-[#378ADD]/20 active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                >
                    <div className="flex items-center gap-4 md:gap-3 md:flex-col md:items-start">
                        <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0">
                            <img src="./Icon.png" alt="" className="w-6 h-6 object-contain" onError={e => e.target.style.display = 'none'} />
                        </div>
                        <div className="text-left">
                            <h2 className="text-[17px] font-bold text-[#111] tracking-[-0.02em]">{t('auth.roleSelection.clientTitle')}</h2>
                            <p className="text-sm text-[#666] font-medium mt-0.5">{t('auth.roleSelection.clientDesc')}</p>
                        </div>
                    </div>
                    <svg className="shrink-0 md:self-end" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>
            </div>

            <div className="mt-14 text-center">
                <p className="text-[11px] uppercase tracking-[0.15em] text-[#999] font-semibold">{t('brand.tagline')}</p>
            </div>
        </section>
    );
}

export default RoleSelection;
