import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClient } from '../../context/ClientContext.jsx';
import { getOrCreateClient } from '../../api/clientApi.js';
import { sendVerificationCode, verifyCode } from '../../api/verificationApi.js';
import { ExternalLink } from 'lucide-react';
import { t } from '../../utils/i18n.js';

const BOT_USERNAME = 'BarberUp_bot';

function Register() {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState('phone');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [fullname, setFullname] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [telegramLinked, setTelegramLinked] = useState(null);
    const [sent, setSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [resending, setResending] = useState(false);

    const inFlight = useRef(false);
    const inputsRef = useRef([]);
    const { login } = useAuth();
    const { identify } = useClient();
    const navigate = useNavigate();

    const cleanPhone = (value) => {
        let digits = value.replace(/\D/g, '');
        if (digits.length >= 12 && digits.startsWith('998')) {
            digits = digits.slice(3);
        }
        return digits;
    };
    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;
    const formattedPhone = `+998${phoneDigits}`;

    const handlePhoneChange = (val) => {
        const cleaned = cleanPhone(val);
        setPhone(cleaned);
    };

    const onboardingData = (() => {
        try { return JSON.parse(localStorage.getItem('onboarding_data') || '{}'); }
        catch { return {}; }
    })();

    const role = onboardingData.role || 'client';

    useEffect(() => {
        if (!onboardingData.role) {
            navigate('/role-select');
        }
    }, [onboardingData.role, navigate]);

    const handleSendCode = async () => {
        if (inFlight.current || loading) return;
        if (!isPhoneValid) {
            setError(t('auth.errors.phoneNineDigitsShort'));
            return;
        }

        inFlight.current = true;
        setLoading(true);
        setError('');
        setTelegramLinked(null);
        setSent(false);

        const { error: sendErr, linked, sent: sentOk } = await sendVerificationCode(formattedPhone);
        if (sendErr) {
            setError('Kod yuborishda xatolik: ' + sendErr);
            setLoading(false);
            inFlight.current = false;
            return;
        }

        setTelegramLinked(!!linked);
        setSent(!!sentOk);
        if (linked && !sentOk) {
            setError('Kodni Telegram orqali yuborishda xatolik. Telefon raqamingiz botda ulanganligini tekshiring.');
        }
        localStorage.setItem('onboarding_data', JSON.stringify({ ...onboardingData, phone: formattedPhone }));
        setStep('verify');
        setCountdown(60);
        setLoading(false);
        inFlight.current = false;
    };

    const resendCode = async () => {
        if (inFlight.current || loading) return;
        setResending(true);
        setError('');
        setTelegramLinked(null);
        setSent(false);
        const { error: sendErr, linked, sent: sentOk } = await sendVerificationCode(formattedPhone);
        if (sendErr) {
            setError('Kod yuborishda xatolik: ' + sendErr);
        } else {
            setTelegramLinked(!!linked);
            setSent(!!sentOk);
            if (linked && !sentOk) {
                setError('Kodni Telegram orqali yuborishda xatolik. Telefon raqamingiz botda ulanganligini tekshiring.');
            }
        }
        setResending(false);
        setCountdown(60);
    };

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleCodeChange = (index, value) => {
        if (value && !/^\d$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        if (value && index < 5) inputsRef.current[index + 1]?.focus();
        if (!value && index > 0) inputsRef.current[index - 1]?.focus();
    };

    const handleCodeKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) inputsRef.current[index - 1]?.focus();
        if (e.key === 'Enter') handleVerify();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        for (let i = 0; i < pasted.length; i++) newCode[i] = pasted[i];
        setCode(newCode);
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('Kodni to\'liq kiriting');
            return;
        }

        setLoading(true);
        setError('');

        const { error: verifyErr } = await verifyCode(formattedPhone, fullCode);
        if (verifyErr) {
            setError(verifyErr);
            setLoading(false);
            return;
        }

        if (role === 'client') {
            setStep('name');
            setLoading(false);
        } else {
            localStorage.setItem('onboarding_data', JSON.stringify({ ...onboardingData, phone: formattedPhone }));
            navigate('/onboarding/barber');
        }
    };

    const handleCreateClient = async () => {
        if (!fullname.trim()) {
            setError(t('auth.errors.fieldsEmpty'));
            return;
        }

        setLoading(true);
        setError('');

        const { data: clientUser, error: clientErr } = await getOrCreateClient(fullname.trim(), formattedPhone);
        if (clientErr || !clientUser) {
            setError(clientErr || t('auth.errors.somethingWrong'));
            setLoading(false);
            return;
        }

        identify(fullname.trim(), formattedPhone);
        login({ ...clientUser, role: 'client', id: clientUser.id, phone: formattedPhone });
        navigate('/client/dashboard');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && step === 'phone') handleSendCode();
    };

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 py-8 sm:px-6 sm:py-12">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                    <button
                        onClick={() => step === 'phone' ? navigate('/role-select') : (step === 'verify' ? setStep('phone') : setStep('verify'))}
                        className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <div className="text-center">
                        <img src="./Scissor.png" alt={t('common.scissorIcon')} className="mx-auto mb-6 h-10 w-10" />
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                            {step === 'phone' ? t('auth.register.title') : step === 'verify' ? 'Telefonni tasdiqlash' : t('auth.clientOnboarding.setupTitle')}
                        </h1>
                        <p className="text-sm text-[#666] font-medium">
                            {step === 'phone'
                                ? (role === 'barber' ? 'Sartarosh sifatida ro\'yxatdan o\'tish' : t('auth.register.subtitle'))
                                : step === 'verify'
                                    ? `${formattedPhone} raqamiga kod yuborildi`
                                    : t('auth.clientOnboarding.setupSubtitle')
                            }
                        </p>
                    </div>

                    {step === 'phone' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.mobileNumber')}</label>
                                <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-[#185FA5]/30 focus-within:bg-white transition-all h-14 min-h-[52px]">
                                    <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                    <input
                                        type="tel"
                                        className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                        placeholder={t('auth.clientOnboarding.phonePlaceholder')}
                                        value={phone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={loading}
                                        autoFocus
                                        enterKeyHint="send"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
                                    <span className="text-red-500 shrink-0 mt-0.5">!</span>
                                    <p className="font-semibold text-red-700 text-sm flex-1">{error}</p>
                                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0 p-1 -m-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleSendCode}
                                disabled={!isPhoneValid || loading}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('auth.register.checking')}</>
                                ) : t('auth.register.signUp')}
                            </button>

                            <div className="text-center">
                                <p className="text-sm text-[#666]">
                                    {t('auth.register.hasAccount')}{' '}
                                    <a href="/login" className="font-bold text-[#378ADD] hover:text-[#185FA5] hover:underline transition-all">
                                        {t('auth.register.signIn')}
                                    </a>
                                </p>
                            </div>
                        </div>
                    )}

                    {step === 'verify' && (
                        <div className="space-y-6">
                            {telegramLinked === false && !sent && (
                                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center space-y-4">
                                    <p className="text-sm font-medium text-amber-800">
                                        Telegram hisobingiz ulanmagan. Davom etish uchun botga kiring va telefon raqamingizni tasdiqlang.
                                    </p>
                                    <a
                                        href={`https://t.me/${BOT_USERNAME}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#378ADD] text-white rounded-2xl font-bold text-sm hover:bg-[#185FA5] transition-all shadow-[0_8px_20px_rgba(55,138,221,0.2)] active:scale-[0.98]"
                                    >
                                        <ExternalLink size={16} />
                                        @{BOT_USERNAME} ga o'tish
                                    </a>
                                    <p className="text-[10px] text-amber-600 font-medium">
                                        Botga kirib, "Telefon raqamni yuborish" tugmasini bosing va qaytib "Kodni qayta yuborish" ni bosing.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-4 text-center">
                                    Tasdiqlash kodini kiriting
                                </label>
                                <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
                                    {code.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(el) => inputsRef.current[index] = el}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(index, e.target.value)}
                                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                            className="w-11 sm:w-12 h-14 text-center text-xl font-bold bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                        />
                                    ))}
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
                                    <span className="text-red-500 shrink-0 mt-0.5">!</span>
                                    <p className="font-semibold text-red-700 text-sm flex-1">{error}</p>
                                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0 p-1 -m-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleVerify}
                                disabled={loading || code.join('').length !== 6}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Tekshirilmoqda...</>
                                ) : 'Tasdiqlash'}
                            </button>

                            <div className="text-center">
                                {countdown > 0 ? (
                                    <p className="text-sm text-[#666] font-medium">
                                        Kodni qayta yuborish ({countdown}s)
                                    </p>
                                ) : (
                                    <button
                                        onClick={resendCode}
                                        disabled={resending}
                                        className="text-sm font-bold text-[#378ADD] hover:text-[#185FA5] hover:underline transition-all disabled:opacity-50 py-2 min-h-[44px]"
                                    >
                                        {resending ? 'Yuborilmoqda...' : 'Kodni qayta yuborish'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'name' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.fullName')}</label>
                                <input
                                    type="text"
                                    value={fullname}
                                    onChange={e => setFullname(e.target.value)}
                                    placeholder={t('auth.clientOnboarding.namePlaceholder')}
                                    className="w-full h-14 min-h-[52px] px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                    disabled={loading}
                                    autoFocus
                                    enterKeyHint="done"
                                />
                            </div>

                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
                                    <span className="text-red-500 shrink-0 mt-0.5">!</span>
                                    <p className="font-semibold text-red-700 text-sm flex-1">{error}</p>
                                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0 p-1 -m-1">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleCreateClient}
                                disabled={loading || !fullname.trim()}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('auth.clientOnboarding.creatingAccount')}</>
                                ) : t('common.continue')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default Register;
