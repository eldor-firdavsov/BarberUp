import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { loginBarber } from '../../api/barberApi.js';
import { checkPhoneExists, sendVerificationCode, verifyCode } from '../../api/verificationApi.js';
import { ExternalLink } from 'lucide-react';
import { t } from '../../utils/i18n.js';
import AuthShell from '../../components/AuthShell.jsx';
import { Button } from '../../components/ui/index.js';

const BOT_USERNAME = 'BarberUp_bot';

function Login() {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState('phone');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [telegramLinked, setTelegramLinked] = useState(null);
    const [sent, setSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [resending, setResending] = useState(false);

    const inFlight = useRef(false);
    const inputsRef = useRef([]);
    const { login } = useAuth();
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

    const handleCheckPhone = async () => {
        if (inFlight.current || loading) return;
        if (!isPhoneValid) {
            setError(t('auth.errors.phoneNineDigitsShort'));
            return;
        }

        inFlight.current = true;
        setLoading(true);
        setError('');

        const { exists, role, error: checkErr } = await checkPhoneExists(formattedPhone);
        if (checkErr) {
            setError('Xatolik: ' + checkErr);
            setLoading(false);
            inFlight.current = false;
            return;
        }

        if (!exists) {
            setError('Bu raqam ro\'yxatdan o\'tmagan. Sartarosh sifatida ro\'yxatdan o\'ting.');
            setLoading(false);
            inFlight.current = false;
            return;
        }

        if (role === 'client') {
            navigate('/start', { replace: true });
            setLoading(false);
            inFlight.current = false;
            return;
        }

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

        const { data, error: apiError } = await loginBarber(formattedPhone);
        if (apiError || !data) {
            setError(apiError || 'Sartarosh topilmadi');
            setLoading(false);
            return;
        }
        login({ ...data.user, role: 'barber' });
        navigate('/barber/dashboard');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && step === 'phone') handleCheckPhone();
    };

    return (
        <AuthShell
            title={step === 'verify' ? 'Telefonni tasdiqlash' : t('auth.barberLogin.title')}
            subtitle={step === 'verify'
                ? `${formattedPhone} raqamiga kod yuborildi`
                : t('auth.barberLogin.subtitle')}
            onBack={() => (step === 'verify' ? setStep('phone') : navigate('/role-select'))}
            footer={step === 'phone' ? (
                <p className="text-center text-sm text-[var(--text-secondary)]">
                    {t('auth.barberLogin.noAccount')}{' '}
                    <a href="/register" className="font-semibold text-[var(--brand-primary)]">{t('auth.barberLogin.signUp')}</a>
                </p>
            ) : null}
        >
            {step === 'phone' && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">{t('common.mobileNumber')}</label>
                        <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-lg)] px-4 border border-[var(--border-subtle)] focus-within:border-[var(--brand-primary)] h-12">
                            <span className="text-[var(--text-primary)] font-medium">+998</span>
                            <input
                                type="tel"
                                className="w-full ml-2 text-base bg-transparent outline-none"
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
                        <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-3">
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <Button className="w-full" size="lg" onClick={handleCheckPhone} disabled={!isPhoneValid || loading}>
                        {loading ? t('auth.login.signingIn') : t('auth.barberLogin.signIn')}
                    </Button>
                </div>
            )}

            {step === 'verify' && (
                <div className="space-y-5">
                    {telegramLinked === false && !sent && (
                        <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4 text-center space-y-3">
                            <p className="text-sm text-amber-800">
                                Telegram hisobingiz ulanmagan. Davom etish uchun botga kiring va telefon raqamingizni tasdiqlang.
                            </p>
                            <a
                                href={`https://t.me/${BOT_USERNAME}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2"
                            >
                                <Button size="sm" type="button">
                                    <ExternalLink size={14} />
                                    @{BOT_USERNAME} ga o&apos;tish
                                </Button>
                            </a>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3 text-center">
                            Tasdiqlash kodini kiriting
                        </label>
                        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
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
                                    className="w-11 h-12 text-center text-lg font-bold bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] outline-none focus:border-[var(--brand-primary)]"
                                />
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-3">
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <Button className="w-full" size="lg" onClick={handleVerify} disabled={loading || code.join('').length !== 6}>
                        {loading ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
                    </Button>

                    <div className="text-center">
                        {countdown > 0 ? (
                            <p className="text-sm text-[var(--text-secondary)]">Kodni qayta yuborish ({countdown}s)</p>
                        ) : (
                            <button type="button" onClick={resendCode} disabled={resending} className="text-sm font-semibold text-[var(--brand-primary)] disabled:opacity-50">
                                {resending ? 'Yuborilmoqda...' : 'Kodni qayta yuborish'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </AuthShell>
    );
}

export default Login;
