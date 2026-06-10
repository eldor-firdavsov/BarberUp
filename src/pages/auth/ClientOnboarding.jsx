import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendVerificationCode } from '../../api/verificationApi.js';
import { t } from '../../utils/i18n.js';

function ClientOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const cleanPhone = (value) => value.replace(/\D/g, '');
    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;

    const navigate = useNavigate();

    const handleFinish = async () => {
        if (!fullname.trim() || !phone.trim()) {
            setError(t('auth.errors.fillRequired'));
            return;
        }
        if (!isPhoneValid) {
            setError(t('auth.errors.phoneNineDigitsShort'));
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formattedPhone = `+998${phoneDigits}`;

            const { error: sendErr } = await sendVerificationCode(formattedPhone);
            if (sendErr) {
                setError('Kod yuborishda xatolik: ' + sendErr);
                setLoading(false);
                return;
            }

            localStorage.setItem('onboarding_data', JSON.stringify({
                role: 'client',
                fullname: fullname.trim(),
                phone: formattedPhone,
            }));

            navigate('/verify-phone');
        } catch (err) {
            console.error('[ClientOnboarding] unexpected error:', err);
            setError(t('auth.errors.somethingWrong'));
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = fullname.trim() !== '' && isPhoneValid;

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 py-8 sm:px-6 sm:py-12">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                    <button
                        onClick={() => navigate('/')}
                        className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <header>
                        <div className="flex items-center gap-2 mb-4">
                            <img src="./Scissor.png" alt="scissor icon" className="w-4 h-4" />
                            <p className="text-[#111] text-sm font-bold uppercase tracking-[0.12em]">{t('auth.clientOnboarding.joinTitle')}</p>
                        </div>
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">
                            {t('auth.clientOnboarding.setupTitle')}
                        </h1>
                        <p className="text-sm text-[#666] font-medium mt-2">
                            {t('auth.clientOnboarding.setupSubtitle')}
                        </p>
                    </header>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.fullName')}</label>
                            <input
                                type="text"
                                value={fullname}
                                onChange={e => setFullname(e.target.value)}
                                placeholder={t('auth.clientOnboarding.namePlaceholder')}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.mobileNumber')}</label>
                            <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-[#185FA5]/30 focus-within:bg-white transition-all h-14">
                                <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder={t('auth.clientOnboarding.phonePlaceholder')}
                                    className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                    disabled={loading}
                                />
                            </div>
                            {phone.trim() !== '' && !isPhoneValid && (
                                <p className="text-red-500 text-xs mt-1">{t('auth.errors.phoneNineDigits')}</p>
                            )}
                        </div>

                        {error && (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleFinish}
                        disabled={!isFormValid || loading}
                        className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {t('auth.clientOnboarding.creatingAccount')}
                            </>
                        ) : t('common.continue')}
                    </button>
                </div>
            </div>
        </section>
    );
}

export default ClientOnboarding;
