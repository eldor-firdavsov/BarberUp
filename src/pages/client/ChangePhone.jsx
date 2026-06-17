import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ExternalLink, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClient } from '../../context/ClientContext.jsx';
import { supabase } from '../../api/supabase.js';
import { sendVerificationCode, verifyCode } from '../../api/verificationApi.js';
import { t } from '../../utils/i18n.js';

const BOT_USERNAME = 'BarberUp_bot';

/**
 * Universal "change phone number" screen.
 *
 * Reused by BOTH /client/change-phone and /barber/change-phone. The only
 * differences are which Supabase table we update (`clients` vs `barbers`)
 * and the post-success redirect. These are passed in via props.
 */
function ChangePhone({
    table = 'clients',           // 'clients' | 'barbers'
    returnPath = '/client/settings',
}) {
    const { user, updateSessionUser } = useAuth();
    const { identify } = useClient();
    const navigate = useNavigate();

    const [step, setStep] = useState('phone'); // 'phone' | 'verify' | 'done'
    const [newPhone, setNewPhone] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [linked, setLinked] = useState(null);
    const [sent, setSent] = useState(false);

    const inputsRef = useRef([]);
    const inFlight = useRef(false);

    const currentDisplay = user?.phone || '';

    const cleanPhone = (v) => v.replace(/\D/g, '');
    const phoneDigits = cleanPhone(newPhone);
    const isPhoneValid = phoneDigits.length === 9;
    const formattedPhone = `+998${phoneDigits}`;

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = async () => {
        if (inFlight.current || loading) return;
        if (!isPhoneValid) {
            setError(t('auth.errors.phoneNineDigitsShort'));
            return;
        }
        if (formattedPhone === user?.phone) {
            setError('Bu sizning joriy raqamingiz. Boshqa raqam kiriting.');
            return;
        }

        inFlight.current = true;
        setLoading(true);
        setError('');
        setLinked(null);
        setSent(false);

        const { error: sendErr, linked: lk, sent: sentOk } =
            await sendVerificationCode(formattedPhone);
        if (sendErr) {
            setError('Kod yuborishda xatolik: ' + sendErr);
            setLoading(false);
            inFlight.current = false;
            return;
        }
        setLinked(!!lk);
        setSent(!!sentOk);
        if (lk && !sentOk) {
            setError('Kodni Telegram orqali yuborishda xatolik. Telefon raqamingiz botda ulanganligini tekshiring.');
        }
        setStep('verify');
        setCountdown(60);
        setLoading(false);
        inFlight.current = false;
    };

    const resendCode = async () => {
        if (inFlight.current || loading) return;
        setResending(true);
        setError('');
        setLinked(null);
        setSent(false);
        const { error: sendErr, linked: lk, sent: sentOk } =
            await sendVerificationCode(formattedPhone);
        if (sendErr) {
            setError('Kod yuborishda xatolik: ' + sendErr);
        } else {
            setLinked(!!lk);
            setSent(!!sentOk);
            if (lk && !sentOk) {
                setError('Kodni Telegram orqali yuborishda xatolik. Telefon raqamingiz botda ulanganligini tekshiring.');
            }
        }
        setResending(false);
        setCountdown(60);
    };

    const handleCodeChange = (index, value) => {
        if (value && !/^\d$/.test(value)) return;
        const next = [...code];
        next[index] = value;
        setCode(next);
        if (value && index < 5) inputsRef.current[index + 1]?.focus();
        if (!value && index > 0) inputsRef.current[index - 1]?.focus();
    };

    const handleCodeKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') handleVerify();
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const next = [...code];
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        setCode(next);
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

        // Phone verified — commit the change.
        try {
            const { error: dbErr } = await supabase
                .from(table)
                .update({ phone: formattedPhone })
                .eq('id', user?.id);

            if (dbErr) {
                setError('Raqam tasdiqlandi, lekin saqlashda xatolik: ' + dbErr.message);
                setLoading(false);
                return;
            }

            // Update the local session and the ClientContext (if used).
            updateSessionUser({ ...user, phone: formattedPhone });
            if (table === 'clients') {
                identify(user?.fullname || user?.name || '', formattedPhone);
            }

            setStep('done');
        } catch (err) {
            setError('Saqlashda xatolik: ' + (err?.message || 'noma\'lum'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 pt-8 pb-32 sm:px-6 sm:py-12">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                    <button
                        onClick={() => step === 'verify' ? setStep('phone') : navigate(-1)}
                        className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                    >
                        <ChevronLeft size={20} className="text-[#111]" />
                    </button>

                    <div className="text-center">
                        <img src="./Scissor.png" alt="" className="mx-auto mb-6 h-10 w-10" />
                        <h1 className="text-[24px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                            {step === 'phone' && 'Telefon raqamini o\'zgartirish'}
                            {step === 'verify' && 'Tasdiqlash kodi'}
                            {step === 'done' && 'Tayyor!'}
                        </h1>
                        <p className="text-sm text-[#666] font-medium">
                            {step === 'phone' && (
                                <>Hozirgi raqam: <b>{currentDisplay || '—'}</b></>
                            )}
                            {step === 'verify' && (
                                <>{formattedPhone} raqamiga kod yuborildi</>
                            )}
                            {step === 'done' && (
                                <>Yangi raqam saqlandi</>
                            )}
                        </p>
                    </div>

                    {step === 'phone' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">
                                    {t('common.mobileNumber')}
                                </label>
                                <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-[#185FA5]/30 focus-within:bg-white transition-all h-14 min-h-[52px]">
                                    <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                    <input
                                        type="tel"
                                        className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                        placeholder={t('auth.clientOnboarding.phonePlaceholder')}
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        disabled={loading}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
                                    <span className="text-red-500 shrink-0 mt-0.5">!</span>
                                    <p className="font-semibold text-red-700 text-sm flex-1">{error}</p>
                                </div>
                            )}

                            <button
                                onClick={handleSendCode}
                                disabled={!isPhoneValid || loading}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Yuborilmoqda...</>
                                ) : 'Davom etish'}
                            </button>
                        </div>
                    )}

                    {step === 'verify' && (
                        <div className="space-y-6">
                            {linked === false && !sent && (
                                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-center space-y-4">
                                    <p className="text-sm font-medium text-amber-800">
                                        Bu telefon raqami botga ulanmagan. Botga kiring va telefon raqamingizni yuboring.
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
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-4 text-center">
                                    6 xonali kodni kiriting
                                </label>
                                <div className="flex gap-2 sm:gap-3 justify-center" onPaste={handlePaste}>
                                    {code.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={(el) => inputsRef.current[index] = el}
                                            type="text"
                                            inputMode="numeric"
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
                                </div>
                            )}

                            <button
                                onClick={handleVerify}
                                disabled={loading || code.join('').length !== 6}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Tasdiqlanmoqda...</>
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

                    {step === 'done' && (
                        <div className="space-y-6 text-center">
                            <div className="w-20 h-20 mx-auto bg-green-50 border border-green-100 rounded-[28px] flex items-center justify-center">
                                <Check className="text-green-600" size={36} />
                            </div>
                            <p className="text-sm text-[#666] font-medium">
                                Endi barcha xabarnomalar shu raqamga yuboriladi:
                                <br />
                                <b className="text-[#111]">{formattedPhone}</b>
                            </p>
                            <button
                                onClick={() => navigate(returnPath)}
                                className="w-full h-14 min-h-[52px] rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-[0.98]"
                            >
                                Sozlamalarga qaytish
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default ChangePhone;
