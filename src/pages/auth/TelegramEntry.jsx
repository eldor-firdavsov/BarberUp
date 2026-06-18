import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClient } from '../../context/ClientContext.jsx';
import { getTelegramLinkByChatId } from '../../api/telegramApi.js';
import { checkPhoneExists } from '../../api/verificationApi.js';
import { loginClient, getOrCreateClient } from '../../api/clientApi.js';
import { loginBarber } from '../../api/barberApi.js';

const BOT_USERNAME = 'BarberUp_bot';
const TG = () => window.Telegram?.WebApp;

// ── Tiny helpers ───────────────────────────────────────────────────────────
function ScissorIcon({ className = '' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>
    );
}

function Spinner() {
    return (
        <div className="w-8 h-8 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
    );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function TelegramEntry() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const { identify } = useClient();

    const [phase, setPhase] = useState('detecting'); // detecting | role-select | no-phone | error
    const [linkedPhone, setLinkedPhone] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [roleLoading, setRoleLoading] = useState(null); // 'client' | 'barber' | null

    const doAutoLogin = useCallback(async (phone, role) => {
        if (role === 'barber') {
            const { data, error } = await loginBarber(phone);
            if (data && !error) {
                login({ ...data.user, role: 'barber' });
                navigate('/barber/dashboard', { replace: true });
                return true;
            }
        } else {
            const { data, error } = await loginClient(phone);
            if (data && !error) {
                identify(data.user.fullname, phone);
                login({ ...data.user, role: 'client', id: data.user.id, phone });
                navigate('/client/dashboard', { replace: true });
                return true;
            }
        }
        return false;
    }, [login, identify, navigate]);

    useEffect(() => {
        const tg = TG();

        // Not inside Telegram — redirect to normal web flow
        if (!tg || !tg.initDataUnsafe?.user) {
            navigate('/role-select', { replace: true });
            return;
        }

        tg.ready();
        tg.expand();

        const telegramUserId = tg.initDataUnsafe.user.id;

        (async () => {
            try {
                // Step 1: look up the phone linked to this Telegram user
                const { phone, error: linkErr } = await getTelegramLinkByChatId(telegramUserId);

                if (linkErr || !phone) {
                    setPhase('no-phone');
                    return;
                }

                setLinkedPhone(phone);

                // Step 2: check if they're already registered
                const { exists, role } = await checkPhoneExists(phone);

                if (exists && role) {
                    // Auto-login — no friction for returning users
                    const ok = await doAutoLogin(phone, role);
                    if (!ok) {
                        // Something went wrong with the DB lookup — show role select
                        setPhase('role-select');
                    }
                } else {
                    // New user — show role selection so they can onboard
                    setPhase('role-select');
                }
            } catch (err) {
                console.error('[TelegramEntry]', err);
                setErrorMsg("Xatolik yuz berdi. Qayta urinib ko'ring.");
                setPhase('error');
            }
        })();
    }, [doAutoLogin, navigate]);

    const handleRoleSelect = async (role) => {
        if (!linkedPhone) return;
        setRoleLoading(role);

        try {
            if (role === 'client') {
                // For clients: create account immediately with Telegram first name as name
                const tg = TG();
                const tgUser = tg?.initDataUnsafe?.user;
                const defaultName = [tgUser?.first_name, tgUser?.last_name]
                    .filter(Boolean).join(' ') || 'Foydalanuvchi';

                const { data: clientUser, error: clientErr } = await getOrCreateClient(defaultName, linkedPhone);
                if (clientErr || !clientUser) {
                    setErrorMsg(clientErr || 'Akkaunt yaratishda xatolik.');
                    setPhase('error');
                    return;
                }
                identify(defaultName, linkedPhone);
                login({ ...clientUser, role: 'client', id: clientUser.id, phone: linkedPhone });
                navigate('/client/dashboard', { replace: true });
            } else {
                // For barbers: send to the full multi-step onboarding
                const onboardingData = { role: 'barber', phone: linkedPhone };
                localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));
                navigate('/onboarding/barber', { replace: true });
            }
        } catch (err) {
            console.error('[TelegramEntry] role select error:', err);
            setErrorMsg('Xatolik yuz berdi. Qayta urinib ko\'ring.');
            setPhase('error');
        } finally {
            setRoleLoading(null);
        }
    };

    // ── Detecting / loading ───────────────────────────────────────────────
    if (phase === 'detecting') {
        return (
            <div className="tg-entry-page">
                <div className="tg-card">
                    <div className="tg-logo">
                        <ScissorIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="tg-title">BarberUp</h1>
                    <p className="tg-subtitle">Yuklanmoqda…</p>
                    <div className="tg-spinner-wrap">
                        <div className="tg-spinner" />
                    </div>
                </div>
            </div>
        );
    }

    // ── No phone linked — prompt to use bot first ─────────────────────────
    if (phase === 'no-phone') {
        return (
            <div className="tg-entry-page">
                <div className="tg-card">
                    <div className="tg-logo tg-logo--amber">
                        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h1 className="tg-title">Telefon raqam ulanmagan</h1>
                    <p className="tg-subtitle">
                        Ilovadan foydalanish uchun avval @BarberUp_bot botiga kiring va
                        telefon raqamingizni ulang.
                    </p>
                    <div className="tg-steps">
                        <div className="tg-step">
                            <span className="tg-step-num">1</span>
                            <span>@BarberUp_bot botini oching</span>
                        </div>
                        <div className="tg-step">
                            <span className="tg-step-num">2</span>
                            <span>«📱 Telefon raqamni yuborish» tugmasini bosing</span>
                        </div>
                        <div className="tg-step">
                            <span className="tg-step-num">3</span>
                            <span>Shu yerga qaytib keling</span>
                        </div>
                    </div>
                    <a
                        href={`https://t.me/${BOT_USERNAME}`}
                        className="tg-btn tg-btn--primary"
                    >
                        ✈️ @{BOT_USERNAME} ga o'tish
                    </a>
                </div>
            </div>
        );
    }

    // ── Error ─────────────────────────────────────────────────────────────
    if (phase === 'error') {
        return (
            <div className="tg-entry-page">
                <div className="tg-card">
                    <div className="tg-logo tg-logo--red">
                        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                    <h1 className="tg-title">Xatolik yuz berdi</h1>
                    <p className="tg-subtitle">{errorMsg}</p>
                    <button
                        className="tg-btn tg-btn--primary"
                        onClick={() => window.location.reload()}
                    >
                        Qayta urinib ko'rish
                    </button>
                </div>
            </div>
        );
    }

    // ── Role selection ────────────────────────────────────────────────────
    return (
        <div className="tg-entry-page">
            <div className="tg-card tg-card--wide">
                {/* Header */}
                <div className="tg-logo">
                    <ScissorIcon className="w-8 h-8 text-white" />
                </div>
                <h1 className="tg-title">BarberUp</h1>
                {linkedPhone && (
                    <div className="tg-phone-badge">
                        📱 {linkedPhone}
                    </div>
                )}
                <p className="tg-subtitle">Siz kim sifatida foydalanasiz?</p>

                {/* Role Cards */}
                <div className="tg-roles">
                    {/* Client */}
                    <button
                        id="tg-role-client"
                        className="tg-role-card"
                        onClick={() => handleRoleSelect('client')}
                        disabled={!!roleLoading}
                    >
                        {roleLoading === 'client' ? (
                            <div className="tg-role-spinner"><Spinner /></div>
                        ) : (
                            <>
                                <div className="tg-role-icon tg-role-icon--client">
                                    <svg className="w-7 h-7 text-[#378ADD]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                </div>
                                <div className="tg-role-text">
                                    <span className="tg-role-title">Mijoz</span>
                                    <span className="tg-role-desc">Sartaroshxona qidirib navbat band qilaman</span>
                                </div>
                                <svg className="tg-role-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </>
                        )}
                    </button>

                    {/* Barber */}
                    <button
                        id="tg-role-barber"
                        className="tg-role-card"
                        onClick={() => handleRoleSelect('barber')}
                        disabled={!!roleLoading}
                    >
                        {roleLoading === 'barber' ? (
                            <div className="tg-role-spinner"><Spinner /></div>
                        ) : (
                            <>
                                <div className="tg-role-icon tg-role-icon--barber">
                                    <ScissorIcon className="w-7 h-7 text-[#378ADD]" />
                                </div>
                                <div className="tg-role-text">
                                    <span className="tg-role-title">Sartarosh / Usta</span>
                                    <span className="tg-role-desc">Mening sartaroshxonam bor, navbatlarni boshqaraman</span>
                                </div>
                                <svg className="tg-role-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>

                <p className="tg-footnote">
                    ✅ Telegram orqali avtomatik ulangan
                </p>
            </div>

            {/* Inline styles scoped to this page */}
            <style>{`
                .tg-entry-page {
                    min-height: 100dvh;
                    background: linear-gradient(160deg, #f0f6ff 0%, #f5f5f7 60%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px 16px;
                }
                .tg-card {
                    width: 100%;
                    max-width: 360px;
                    background: #fff;
                    border-radius: 32px;
                    border: 1px solid rgba(0,0,0,0.05);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.07);
                    padding: 36px 28px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    text-align: center;
                }
                .tg-card--wide { max-width: 400px; }
                .tg-logo {
                    width: 68px; height: 68px;
                    background: linear-gradient(135deg, #378ADD 0%, #185FA5 100%);
                    border-radius: 22px;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 12px 28px rgba(55,138,221,0.28);
                    margin-bottom: 4px;
                }
                .tg-logo--amber { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 12px 28px rgba(245,158,11,0.25); }
                .tg-logo--red   { background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); box-shadow: 0 12px 28px rgba(239,68,68,0.25); }
                .tg-title {
                    font-size: 24px; font-weight: 800;
                    color: #111; letter-spacing: -0.03em; margin: 0;
                }
                .tg-subtitle {
                    font-size: 14px; color: #666; font-weight: 500;
                    line-height: 1.55; margin: 0;
                }
                .tg-phone-badge {
                    background: #EBF4FF; color: #185FA5;
                    font-size: 13px; font-weight: 700;
                    padding: 6px 16px; border-radius: 100px;
                    border: 1px solid rgba(55,138,221,0.2);
                }
                .tg-spinner-wrap {
                    margin-top: 8px;
                    display: flex; align-items: center; justify-content: center;
                }
                .tg-spinner {
                    width: 36px; height: 36px;
                    border: 3px solid rgba(55,138,221,0.15);
                    border-top-color: #378ADD;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                /* Steps for no-phone screen */
                .tg-steps {
                    width: 100%;
                    display: flex; flex-direction: column; gap: 10px;
                    background: #f8f8f8; border-radius: 20px; padding: 16px;
                    margin: 4px 0;
                }
                .tg-step {
                    display: flex; align-items: center; gap: 12px;
                    text-align: left; font-size: 13px; color: #444; font-weight: 500;
                }
                .tg-step-num {
                    width: 24px; height: 24px; border-radius: 50%;
                    background: #378ADD; color: #fff;
                    font-size: 12px; font-weight: 800;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }

                /* Buttons */
                .tg-btn {
                    width: 100%; padding: 16px;
                    border-radius: 18px; font-size: 15px; font-weight: 700;
                    border: none; cursor: pointer; text-decoration: none;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .tg-btn--primary {
                    background: linear-gradient(135deg, #378ADD 0%, #185FA5 100%);
                    color: #fff;
                    box-shadow: 0 10px 25px rgba(55,138,221,0.28);
                }
                .tg-btn--primary:hover { opacity: 0.92; transform: translateY(-1px); }
                .tg-btn--primary:active { transform: scale(0.98); }

                /* Role cards */
                .tg-roles {
                    width: 100%;
                    display: flex; flex-direction: column; gap: 10px;
                    margin: 4px 0;
                }
                .tg-role-card {
                    width: 100%;
                    background: #fff;
                    border: 1.5px solid rgba(0,0,0,0.06);
                    border-radius: 20px;
                    padding: 16px;
                    display: flex; align-items: center; gap: 14px;
                    cursor: pointer; text-align: left;
                    transition: all 0.2s;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                    min-height: 72px;
                    position: relative;
                }
                .tg-role-card:hover {
                    border-color: rgba(55,138,221,0.25);
                    box-shadow: 0 8px 24px rgba(55,138,221,0.10);
                    transform: translateY(-2px);
                }
                .tg-role-card:active { transform: scale(0.98); }
                .tg-role-card:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
                .tg-role-icon {
                    width: 48px; height: 48px; border-radius: 14px;
                    background: #EBF4FF;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .tg-role-icon--barber { background: #f0fdf4; }
                .tg-role-icon--barber svg { color: #16a34a; }
                .tg-role-text {
                    flex: 1; display: flex; flex-direction: column; gap: 2px;
                }
                .tg-role-title {
                    font-size: 15px; font-weight: 700; color: #111;
                    letter-spacing: -0.01em;
                }
                .tg-role-desc {
                    font-size: 12px; color: #888; font-weight: 500; line-height: 1.4;
                }
                .tg-role-arrow {
                    width: 18px; height: 18px; color: #bbb; flex-shrink: 0;
                }
                .tg-role-spinner {
                    width: 100%; display: flex; align-items: center; justify-content: center;
                }
                .tg-footnote {
                    font-size: 12px; color: #aaa; font-weight: 500; margin-top: 4px;
                }
            `}</style>
        </div>
    );
}
