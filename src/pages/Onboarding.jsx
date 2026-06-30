/**
 * Onboarding.jsx
 * Step-by-step onboarding flow for users registering via Telegram:
 *   Step 1: Language selection (Uzbek / Russian)
 *   Step 2: Role Selection (Client / Barber) + Full Name input
 * Pre-fills phone from Telegram bot registration — no manual typing.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useClient } from '../context/ClientContext.jsx';
import { getOrCreateClient } from '../api/clientApi.js';
import { getTelegramUser, getTelegramRegisteredPhone, expandApp } from '../utils/telegramWebApp.js';
import { t, setLocale } from '../utils/i18n.js';

export default function Onboarding() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { identify } = useClient();

    const [step, setStep] = useState('lang'); // 'lang' | 'profile'
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState(null); // 'client' | 'barber'
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        expandApp();
        loadTelegramData();
    }, []);

    async function loadTelegramData() {
        const tgUser = getTelegramUser();
        if (tgUser?.first_name) {
            setName([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' '));
        }

        const record = await getTelegramRegisteredPhone();
        if (record?.phone) {
            setPhone(record.phone);
        } else {
            setError(t('onboarding.botFirst') || 'Avval Telegram botda ro\'yxatdan o\'ting');
        }

        // If the user already exists in DB with a role, skip onboarding entirely
        if (record?.role) {
            if (record.role === 'barber') {
                navigate('/barber/dashboard', { replace: true });
            } else {
                navigate('/client/dashboard', { replace: true });
            }
            return;
        }

        setLoading(false);
    }

    const handleSelectLanguage = (lang) => {
        setLocale(lang);
        localStorage.setItem('language', lang);
        setStep('profile');
    };

    async function handleSubmit() {
        if (!name.trim() || !role) return;
        setSaving(true);
        setError(null);

        const tgUser = getTelegramUser();

        try {
            if (role === 'barber') {
                // Save onboarding data in localStorage to pass to BarberOnboarding
                const onboardingData = {
                    role: 'barber',
                    phone,
                    fullname: name.trim(),
                    telegram_id: tgUser?.id ?? null
                };
                localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

                // Save role in telegram_users
                if (tgUser?.id) {
                    await supabase
                        .from('telegram_users')
                        .update({ role: 'barber', first_name: name.trim() })
                        .eq('telegram_id', tgUser.id);
                }

                setSaving(false);
                navigate('/onboarding/barber', { replace: true });
            } else {
                // Client — register directly since they shared phone via Telegram
                const { data: clientUser, error: clientErr } = await getOrCreateClient(name.trim(), phone);
                if (clientErr || !clientUser) {
                    setError(clientErr || 'Ro\'yxatdan o\'tishda xatolik.');
                    setSaving(false);
                    return;
                }

                // Update role in telegram_users
                if (tgUser?.id) {
                    await supabase
                        .from('telegram_users')
                        .update({ role: 'client', first_name: name.trim() })
                        .eq('telegram_id', tgUser.id);
                }

                identify(name.trim(), phone);
                login({ ...clientUser, role: 'client', id: clientUser.id, phone });
                setSaving(false);
                navigate('/client/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('[Onboarding] error:', err);
            setError('Tizimda xatolik yuz berdi.');
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-[#378ADD] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center px-6 py-12 max-w-md mx-auto page-animate">
            {/* Logo */}
            <div className="flex flex-col items-center mb-10 text-center">
                <div className="w-[68px] h-[68px] rounded-[22px] bg-gradient-to-br from-[#378ADD] to-[#185FA5] flex items-center justify-center shadow-[0_12px_28px_rgba(55,138,221,0.28)] mb-4">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <line x1="20" y1="4" x2="8.12" y2="15.88" />
                        <line x1="14.47" y1="14.48" x2="20" y2="20" />
                        <line x1="8.12" y1="8.12" x2="12" y2="12" />
                    </svg>
                </div>
                <h1 className="text-3xl font-extrabold text-[#111] tracking-tight">BarberUp</h1>
                <p className="text-sm text-[#666] mt-1.5">
                    {step === 'lang' ? 'Tilni tanlang / Выберите язык' : t('onboarding.title')}
                </p>
            </div>

            {/* Step 1: Language selection */}
            {step === 'lang' && (
                <div className="grid grid-cols-1 gap-4">
                    <button
                        onClick={() => handleSelectLanguage('uz')}
                        className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0">
                                <img className="w-[28px]" src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Flag_of_Uzbekistan.png" alt="Uzbekistan" />
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
                        onClick={() => handleSelectLanguage('ru')}
                        className="w-full flex items-center justify-between p-5 bg-white border border-black/5 rounded-[28px] transition-all duration-200 hover:shadow-[0_10px_40px_rgba(0,0,0,0.08)] active:scale-[0.99] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center shrink-0">
                                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                                    <rect width="28" height="20" rx="2" fill="white" />
                                    <rect y="6.67" width="28" height="6.67" fill="#0039A6" />
                                    <rect y="13.33" width="28" height="6.67" fill="#D52B1E" />
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
            )}

            {/* Step 2: Role and profile details */}
            {step === 'profile' && (
                <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.07)] p-7 space-y-5">
                    {/* Phone display */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#666] mb-2 block">
                            {t('onboarding.phone')}
                        </label>
                        <div className="w-full px-4 py-3.5 rounded-2xl bg-[#f8f8f8] border border-black/5 text-sm text-[#666] font-medium">
                            {phone}
                        </div>
                    </div>

                    {/* Name input */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#666] mb-2 block">
                            {t('onboarding.name')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('auth.clientOnboarding.namePlaceholder')}
                            className="w-full px-4 py-3.5 rounded-2xl border border-black/5 text-sm outline-none focus:border-[#378ADD] transition bg-white"
                        />
                    </div>

                    {/* Role Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-[#666] mb-3 block">
                            {t('onboarding.role')}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setRole('client')}
                                className={`py-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition active:scale-95 ${
                                    role === 'client' ? 'border-[#378ADD] bg-[#378ADD]/5' : 'border-black/5 bg-white'
                                }`}
                            >
                                <span className="text-3xl">👤</span>
                                <span className={`text-sm font-bold ${role === 'client' ? 'text-[#378ADD]' : 'text-[#111]'}`}>
                                    {t('onboarding.roleClient')}
                                </span>
                                <span className="text-[10px] text-[#888] text-center px-1">{t('onboarding.roleClientDesc')}</span>
                            </button>

                            <button
                                onClick={() => setRole('barber')}
                                className={`py-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition active:scale-95 ${
                                    role === 'barber' ? 'border-[#378ADD] bg-[#378ADD]/5' : 'border-black/5 bg-white'
                                }`}
                            >
                                <span className="text-3xl">✂️</span>
                                <span className={`text-sm font-bold ${role === 'barber' ? 'text-[#378ADD]' : 'text-[#111]'}`}>
                                    {t('onboarding.roleBarber')}
                                </span>
                                <span className="text-[10px] text-[#888] text-center px-1">{t('onboarding.roleBarberDesc')}</span>
                            </button>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !role || saving}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#378ADD] to-[#185FA5] text-white text-base font-bold disabled:opacity-40 active:scale-[0.98] transition shadow-[0_10px_25px_rgba(55,138,221,0.28)]"
                    >
                        {saving ? '...' : `${t('onboarding.submit')} →`}
                    </button>
                </div>
            )}
        </div>
    );
}
