import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { sendVerificationCode, verifyCode } from '../../api/verificationApi.js';

const BOT_USERNAME = 'BarberUp_bot';

function VerifyPhone() {
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [telegramLinked, setTelegramLinked] = useState(null); // null=checking, true/false
    const [sent, setSent] = useState(false);
    const inputsRef = useRef([]);
    const navigate = useNavigate();

    const onboardingData = (() => {
        try {
            return JSON.parse(localStorage.getItem('onboarding_data') || '{}');
        } catch {
            return {};
        }
    })();

    const phone = onboardingData.phone || '';

    const sendCode = async () => {
        setResending(true);
        setError('');
        setTelegramLinked(null);
        setSent(false);
        const result = await sendVerificationCode(phone);
        if (result.error) {
            setError('Kod yuborishda xatolik: ' + result.error);
        } else {
            setTelegramLinked(!!result.linked);
            setSent(!!result.sent);
            if (result.linked && !result.sent) {
                setError('Kodni Telegram orqali yuborishda xatolik. Telefon raqamingiz botda ulanganligini tekshiring.');
            }
        }
        setResending(false);
        setCountdown(60);
    };

    useEffect(() => {
        if (!phone) {
            navigate('/');
            return;
        }
        sendCode();
    }, []);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleChange = (index, value) => {
        if (value && !/^\d$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        if (value && index < 5) inputsRef.current[index + 1]?.focus();
        if (!value && index > 0) inputsRef.current[index - 1]?.focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) inputsRef.current[index - 1]?.focus();
        if (e.key === 'Enter') handleVerify();
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('Iltimos, 6 xonali kodni to\'liq kiriting');
            return;
        }
        setLoading(true);
        setError('');
        const { error: err } = await verifyCode(phone, fullCode);
        if (err) {
            setError(err);
            setLoading(false);
            return;
        }
        localStorage.removeItem('onboarding_data');
        if (onboardingData.role === 'client') {
            navigate('/client/dashboard');
        } else {
            navigate('/onboarding/barber');
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        for (let i = 0; i < pasted.length; i++) newCode[i] = pasted[i];
        setCode(newCode);
        if (pasted.length === 6) inputsRef.current[5]?.focus();
    };

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

                    <div className="text-center">
                        <div className="w-14 h-14 bg-[#378ADD] rounded-[20px] flex items-center justify-center mx-auto mb-6 shadow-[0_10px_30px_rgba(55,138,221,0.25)]">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                        </div>
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                            Telefonni tasdiqlash
                        </h1>
                        <p className="text-sm text-[#666] font-medium">
                            {phone} raqamiga kod yuborildi
                        </p>
                    </div>

                    {telegramLinked === false && !sent && (
                        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center space-y-4">
                            <p className="text-sm font-medium text-amber-800">
                                Telegram hisobingiz ulanmagan. Davom etish uchun botga kiring va telefon raqamingizni tasdiqlang.
                            </p>
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-3 bg-[#378ADD] text-white rounded-2xl font-bold text-sm hover:bg-[#185FA5] transition-all shadow-[0_8px_20px_rgba(55,138,221,0.2)]"
                            >
                                <ExternalLink size={16} />
                                @{BOT_USERNAME} ga o'tish
                            </a>
                            <p className="text-[10px] text-amber-600 font-medium">
                                Botga kirib, "Telefon raqamni yuborish" tugmasini bosing va qaytib "Kodni qayta yuborish" ni bosing.
                            </p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-4 text-center">
                                Tasdiqlash kodini kiriting
                            </label>
                            <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                                {code.map((digit, index) => (
                                    <input
                                        key={index}
                                        ref={(el) => inputsRef.current[index] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-12 h-14 text-center text-xl font-bold bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                    />
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={loading || code.join('').length !== 6}
                            className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Tekshirilmoqda...
                                </>
                            ) : 'Tasdiqlash'}
                        </button>

                        <div className="text-center">
                            {countdown > 0 ? (
                                <p className="text-sm text-[#666] font-medium">
                                    Kodni qayta yuborish ({countdown}s)
                                </p>
                            ) : (
                                <button
                                    onClick={sendCode}
                                    disabled={resending}
                                    className="text-sm font-bold text-[#378ADD] hover:text-[#185FA5] hover:underline transition-all disabled:opacity-50"
                                >
                                    {resending ? 'Yuborilmoqda...' : 'Kodni qayta yuborish'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default VerifyPhone;
