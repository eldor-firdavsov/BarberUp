import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClient } from '../../context/ClientContext.jsx';
import { t } from '../../utils/i18n.js';
import { supabase } from '../../api/supabase.js';

const UZ_PHONE_REGEX = /^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/;

function formatPhone(raw) {
    let val = raw.replace(/\D/g, '');
    if (val.startsWith('998')) val = '+' + val;
    else if (val.startsWith('0'))  val = '+998' + val.slice(1);
    else if (!val.startsWith('+')) val = '+998' + val;
    return val;
}

export default function ClientEntry() {
    const { identify } = useClient();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/client/dashboard';

    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' | 'name'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handlePhoneSubmit(e) {
        e.preventDefault();
        setError('');
        const formatted = formatPhone(phone);

        if (!UZ_PHONE_REGEX.test(formatted)) {
            setError(t('guest.phoneError') || 'Telefon raqam noto\'g\'ri (+998 XX XXX XX XX)');
            return;
        }

        setLoading(true);
        try {
            // Check if there are any previous bookings for this phone number
            const { data, error: dbError } = await supabase
                .from('bookings')
                .select('guest_name')
                .eq('guest_phone', formatted)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (dbError) {
                console.error('[DB CHECK ERROR]', dbError);
                setError('Xatolik yuz berdi, iltimos qayta urinib ko\'ring.');
                setLoading(false);
                return;
            }

            if (data && data.guest_name) {
                // Returning user found! Log them in directly
                identify(data.guest_name, formatted);
                navigate(redirectTo);
            } else {
                // New user - proceed to name step
                setStep('name');
            }
        } catch (err) {
            console.error('[SUBMIT EXCEPTION]', err);
            setError('Tarmoq xatoligi yuz berdi.');
        } finally {
            setLoading(false);
        }
    }

    function handleNameSubmit(e) {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError(t('errors.nameRequired') || 'Ism kiritish majburiy');
            return;
        }

        const formatted = formatPhone(phone);
        identify(name.trim(), formatted);
        navigate(redirectTo);
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center px-4">
            <div className="w-full max-w-sm bg-white rounded-[32px] shadow-[0_20px_60px_rgba(0,0,0,0.06)] border border-black/5 p-8 space-y-7 relative overflow-hidden">
                
                {/* Back button if in name step */}
                {step === 'name' && (
                    <button 
                        onClick={() => { setStep('phone'); setError(''); }}
                        className="absolute left-6 top-6 text-[#888] hover:text-[#111] transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </button>
                )}

                {/* Logo */}
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-[#378ADD] rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-[#378ADD]/25">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 3h12l4 6-10 13L2 9z"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-[#111] tracking-[-0.03em]">BarberUp</h1>
                    <p className="text-xs text-[#888] font-medium">
                        {step === 'phone' 
                            ? (t('app.tagline') || 'Sartaroshxonangizda navbatni onlayn band qiling')
                            : 'Profilni yakunlash uchun ismingizni kiriting'}
                    </p>
                </div>

                {step === 'phone' ? (
                    <form onSubmit={handlePhoneSubmit} className="space-y-4">
                        {/* Phone */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-[#888] uppercase tracking-[0.1em]">
                                {t('auth.phone') || 'Telefon raqam'}
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setError(''); }}
                                placeholder="+998 90 123 45 67"
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-sm font-medium text-[#111] outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/20 focus:bg-white"
                                disabled={loading}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !phone}
                            className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white rounded-2xl text-sm font-bold transition-all duration-200 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-95 disabled:opacity-50 flex items-center justify-center"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                t('guest.submit') || 'Davom etish'
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleNameSubmit} className="space-y-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-[#888] uppercase tracking-[0.1em]">
                                {t('auth.fullname') || 'To\'liq ism'}
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(''); }}
                                placeholder={t('guest.namePlaceholder') || 'Ismingizni kiriting'}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-sm font-medium text-[#111] outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/20 focus:bg-white"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <p className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white rounded-2xl text-sm font-bold transition-all duration-200 shadow-[0_10px_25px_rgba(55,138,221,0.25)] active:scale-95"
                        >
                            {t('guest.submit') || 'Davom etish'}
                        </button>
                    </form>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-black/5" />
                    <span className="text-[11px] font-medium text-[#bbb]">yoki</span>
                    <div className="flex-1 h-px bg-black/5" />
                </div>

                {/* Barber login link */}
                <p className="text-center text-xs text-[#888]">
                    Siz usta misiz?{' '}
                    <a
                        href="/barber/login"
                        className="text-[#378ADD] font-bold hover:underline"
                    >
                        Usta sifatida kirish →
                    </a>
                </p>
            </div>
        </div>
    );
}
