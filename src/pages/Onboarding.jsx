/**
 * Onboarding.jsx
 * Shown after Telegram phone registration.
 * Asks: display name + role (client or barber).
 * Pre-fills phone and sets language automatically from Telegram bot registration.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useClient } from '../context/ClientContext.jsx';
import { getOrCreateClient } from '../api/clientApi.js';
import { getTelegramUser, getTelegramRegisteredPhone, expandApp } from '../utils/telegramWebApp.js';
import { t, setLocale } from '../utils/i18n.js';
import { User, Scissors } from 'lucide-react';

export default function Onboarding() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { identify } = useClient();

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
            if (record.language) {
                setLocale(record.language);
                localStorage.setItem('language', record.language);
            }
        }

        // If the user already has a role, skip onboarding
        if (record?.role) {
            if (record.role === 'barber') {
                navigate('/barber/dashboard', { replace: true });
            } else {
                navigate('/client/dashboard', { replace: true });
            }
            return;
        }

        if (!record?.phone) {
            setError(t('onboarding.botFirst') || 'Avval Telegram botda ro\'yxatdan o\'ting');
        }
        setLoading(false);
    }

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
                <p className="text-sm text-[#666] mt-1.5">{t('onboarding.title')}</p>
            </div>

            <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.07)] p-7 space-y-5">
                {/* Phone display */}
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#666] mb-2 block">
                        {t('onboarding.phone')}
                    </label>
                    <div className="w-full px-4 py-3.5 rounded-2xl bg-[#f8f8f8] border border-black/5 text-sm text-[#666] font-medium">
                        {phone || t('onboarding.botFirst')}
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

                {/* Role selection */}
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-[#666] mb-3 block">
                        {t('onboarding.role')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setRole('client')}
                            className={`py-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition active:scale-95 ${
                                role === 'client'
                                    ? 'border-[#378ADD] bg-[#378ADD]/5'
                                    : 'border-black/5 bg-white'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                role === 'client' ? 'bg-[#378ADD]/10 text-[#378ADD]' : 'bg-[#f5f5f7] text-[#666]'
                            }`}>
                                <User size={24} />
                            </div>
                            <span className={`text-sm font-bold ${role === 'client' ? 'text-[#378ADD]' : 'text-[#111]'}`}>
                                {t('onboarding.roleClient')}
                            </span>
                            <span className="text-[10px] text-[#888] text-center px-1">{t('onboarding.roleClientDesc')}</span>
                        </button>

                        <button
                            onClick={() => setRole('barber')}
                            className={`py-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition active:scale-95 ${
                                role === 'barber'
                                    ? 'border-[#378ADD] bg-[#378ADD]/5'
                                    : 'border-black/5 bg-white'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                role === 'barber' ? 'bg-[#378ADD]/10 text-[#378ADD]' : 'bg-[#f5f5f7] text-[#666]'
                            }`}>
                                <Scissors size={24} />
                            </div>
                            <span className={`text-sm font-bold ${role === 'barber' ? 'text-[#378ADD]' : 'text-[#111]'}`}>
                                {t('onboarding.roleBarber')}
                            </span>
                            <span className="text-[10px] text-[#888] text-center px-1">{t('onboarding.roleBarberDesc')}</span>
                        </button>
                    </div>
                </div>

                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || !role || saving || (!phone && !!error)}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#378ADD] to-[#185FA5] text-white text-base font-bold disabled:opacity-40 active:scale-[0.98] transition shadow-[0_10px_25px_rgba(55,138,221,0.28)]"
                >
                    {saving ? '...' : `${t('onboarding.submit')} →`}
                </button>
            </div>
        </div>
    );
}
