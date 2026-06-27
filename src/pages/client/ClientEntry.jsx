import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClient } from '../../context/ClientContext.jsx';
import { getOrCreateClient, loginClient } from '../../api/clientApi.js';
import { sendVerificationCode, verifyCode } from '../../api/verificationApi.js';
import AuthShell from '../../components/AuthShell.jsx';
import { Button } from '../../components/ui/index.js';
import { t } from '../../utils/i18n.js';

const BOT_USERNAME = 'BarberUp_bot';

function cleanPhone(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.length >= 12 && digits.startsWith('998')) {
        digits = digits.slice(3);
    }
    return digits;
}

export default function ClientEntry() {
    const { login } = useAuth();
    const { identify } = useClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/client/dashboard';

    const [step, setStep] = useState('phone');
    const [phone, setPhone] = useState('');
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

    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;
    const formattedPhone = `+998${phoneDigits}`;

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const finishClientSession = (clientUser) => {
        const name = clientUser.fullname || clientUser.name || fullname.trim();
        identify(name, formattedPhone);
        login({
            ...clientUser,
            role: 'client',
            id: clientUser.id,
            phone: formattedPhone,
        });
        navigate(redirectTo, { replace: true });
    };

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
            setError(`Kod yuborishda xatolik: ${sendErr}`);
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
        const { error: sendErr, linked, sent: sentOk } = await sendVerificationCode(formattedPhone);
        if (sendErr) {
            setError(`Kod yuborishda xatolik: ${sendErr}`);
        } else {
            setTelegramLinked(!!linked);
            setSent(!!sentOk);
        }
        setResending(false);
        setCountdown(60);
    };

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

        const { data, error: clientErr } = await loginClient(formattedPhone);
        if (data?.user?.fullname && data.user.fullname !== 'Unknown') {
            finishClientSession(data.user);
            setLoading(false);
            return;
        }

        if (data?.user) {
            setFullname(data.user.fullname === 'Unknown' ? '' : (data.user.fullname || ''));
        }

        setStep('name');
        setLoading(false);
    };

    const handleNameSubmit = async () => {
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

        finishClientSession(clientUser);
        setLoading(false);
    };

    const handlePhoneChange = (val) => {
        setPhone(cleanPhone(val));
    };

    const handleBack = () => {
        if (step === 'verify') {
            setStep('phone');
            setCode(['', '', '', '', '', '']);
        } else if (step === 'name') {
            setStep('verify');
        } else {
            navigate('/');
        }
        setError('');
    };

    const stepTitle = step === 'phone'
        ? t('auth.clientEntry.title')
        : step === 'verify'
            ? t('auth.clientEntry.verifyTitle')
            : t('auth.clientEntry.nameTitle');

    const stepSubtitle = step === 'phone'
        ? t('auth.clientEntry.subtitle')
        : step === 'verify'
            ? `${formattedPhone} ${t('auth.clientEntry.codeSent')}`
            : t('auth.clientEntry.nameSubtitle');

    return (
        <AuthShell
            title={stepTitle}
            subtitle={stepSubtitle}
            onBack={handleBack}
            footer={
                <p className="text-center text-sm text-[var(--text-secondary)]">
                    {t('auth.clientEntry.barberPrompt')}{' '}
                    <Link to="/login" className="font-semibold text-[var(--brand-primary)]">
                        {t('auth.clientEntry.barberLink')}
                    </Link>
                </p>
            }
        >
            {step === 'phone' && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                            {t('common.mobileNumber')}
                        </label>
                        <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-lg)] px-4 border border-[var(--border-subtle)] focus-within:border-[var(--brand-primary)] h-12">
                            <span className="font-medium">+998</span>
                            <input
                                type="tel"
                                className="w-full ml-2 bg-transparent outline-none"
                                placeholder={t('auth.clientOnboarding.phonePlaceholder')}
                                value={phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                                disabled={loading}
                                autoFocus
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-3">
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <Button className="w-full" size="lg" onClick={handleSendCode} disabled={!isPhoneValid || loading}>
                        {loading ? t('common.pleaseWait') : t('auth.clientEntry.continue')}
                    </Button>
                </div>
            )}

            {step === 'verify' && (
                <div className="space-y-5">
                    {telegramLinked === false && !sent && (
                        <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4 text-center space-y-3">
                            <p className="text-sm text-amber-800">{t('auth.clientEntry.telegramHint')}</p>
                            <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" type="button">
                                    <ExternalLink size={14} />
                                    @{BOT_USERNAME}
                                </Button>
                            </a>
                        </div>
                    )}

                    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputsRef.current[index] = el; }}
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

                    {error && (
                        <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-3">
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <Button className="w-full" size="lg" onClick={handleVerify} disabled={loading || code.join('').length !== 6}>
                        {loading ? t('common.pleaseWait') : t('auth.clientEntry.verify')}
                    </Button>

                    <div className="text-center">
                        {countdown > 0 ? (
                            <p className="text-sm text-[var(--text-secondary)]">
                                {t('auth.clientEntry.resendIn')} ({countdown}s)
                            </p>
                        ) : (
                            <button type="button" onClick={resendCode} disabled={resending} className="text-sm font-semibold text-[var(--brand-primary)] disabled:opacity-50">
                                {resending ? t('common.pleaseWait') : t('auth.clientEntry.resend')}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {step === 'name' && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">
                            {t('common.fullName')}
                        </label>
                        <input
                            type="text"
                            value={fullname}
                            onChange={(e) => setFullname(e.target.value)}
                            placeholder={t('auth.clientOnboarding.namePlaceholder')}
                            className="w-full h-12 px-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] outline-none focus:border-[var(--brand-primary)]"
                            disabled={loading}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                        />
                    </div>

                    {error && (
                        <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-3">
                            <p className="text-sm font-semibold text-red-700">{error}</p>
                        </div>
                    )}

                    <Button className="w-full" size="lg" onClick={handleNameSubmit} disabled={loading || !fullname.trim()}>
                        {loading ? t('auth.clientOnboarding.creatingAccount') : t('common.continue')}
                    </Button>
                </div>
            )}
        </AuthShell>
    );
}
