import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { loginBarber } from '../../api/barberApi.js';
import { loginClient } from '../../api/clientApi.js';
import { t } from '../../utils/i18n.js';

/* ─── Role selector styles (scoped, no global pollution) ─────────────────── */
const roleSelectorStyles = `
  .role-toggle {
    display: flex;
    background: #f8f8f8;
    border-radius: 16px;
    padding: 4px;
    gap: 4px;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  .role-toggle-btn {
    flex: 1;
    height: 44px;
    border: none;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 200ms ease;
    background: transparent;
    color: #666666;
  }

  .role-toggle-btn.active {
    background: #185FA5;
    color: white;
    box-shadow: 0 4px 12px rgba(24, 95, 165, 0.25);
  }

  .role-toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

function Login() {
    const [role, setRole] = useState('client');   // 'client' | 'barber'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Ref-based inflight guard to prevent race conditions / double-submits
    const inFlight = useRef(false);

    const { login, isLoggingIn } = useAuth();
    const navigate = useNavigate();

    const handleSignIn = async () => {
        // Double-click / concurrent request guard
        if (inFlight.current || loading || isLoggingIn) return;

        // Basic field validation
        if (!email.trim() || !password.trim()) {
            setError(t('auth.errors.fieldsEmpty'));
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError(t('auth.errors.invalidEmail'));
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();

        inFlight.current = true;
        setLoading(true);
        setError('');

        console.log('[LOGIN] request start ->', { role, email: normalizedEmail });

        try {
            let result;

            if (role === 'barber') {
                result = await loginBarber(normalizedEmail, normalizedPassword);
            } else {
                result = await loginClient(normalizedEmail, normalizedPassword);
            }

            const { data, error: apiError } = result;

            if (apiError || !data) {
                console.error('[LOGIN] api error ->', apiError);
                setError(apiError || t('auth.errors.loginFailed'));
                return;
            }

            const { token, user } = data;

            // Ensure we have an id field (some endpoints return _id)
            const userObj = {
                id: user?.id ?? user?._id ?? normalizedEmail,
                email: user?.email ?? normalizedEmail,
                ...user,
                role,   // re-assert role so it's always correct
            };

            console.log('[LOGIN] success ->', { role, email: userObj.email, id: userObj.id, hasToken: !!token });

            login(userObj, token ?? null);

            if (role === 'barber') {
                navigate('/barber/dashboard');
            } else {
                navigate('/client/dashboard');
            }
        } catch (err) {
            // Should not normally reach here — loginBarber/loginClient catch internally
            console.error('[LOGIN] unexpected error ->', err);
            setError(t('auth.errors.somethingWrong'));
        } finally {
            setLoading(false);
            inFlight.current = false;
        }
    };

    // Allow pressing Enter to submit
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSignIn();
    };

    const isFormValid = email.trim() !== '' && password.trim() !== '';
    const isBusy = loading || isLoggingIn;

    return (
        <>
            <style>{roleSelectorStyles}</style>

            <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 py-8 sm:px-6 sm:py-12">
                <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                    <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                        <button
                            onClick={() => navigate('/')}
                            className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                            disabled={isBusy}
                            type="button"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>

                        <div className="text-center">
                            <img src="./Scissor.png" alt={t('common.scissorIcon')} className="mx-auto mb-6 h-10 w-10" />
                            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                                {t('auth.login.title')}
                            </h1>
                            <p className="text-sm text-[#666] font-medium">
                                {t('auth.login.subtitle')}
                            </p>
                        </div>

                        <div className="space-y-6">
                            {/* ── Role Selector ── */}
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('auth.login.roleLabel')}</label>
                                <div className="role-toggle">
                                    <button
                                        type="button"
                                        id="role-client"
                                        className={`role-toggle-btn${role === 'client' ? ' active' : ''}`}
                                        onClick={() => { setRole('client'); setError(''); }}
                                        disabled={isBusy}
                                    >
                                        {t('auth.login.client')}
                                    </button>
                                    <button
                                        type="button"
                                        id="role-barber"
                                        className={`role-toggle-btn${role === 'barber' ? ' active' : ''}`}
                                        onClick={() => { setRole('barber'); setError(''); }}
                                        disabled={isBusy}
                                    >
                                        {t('auth.login.barber')}
                                    </button>
                                </div>
                            </div>

                            {/* ── Email ── */}
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.email')}</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    placeholder={t('auth.login.emailPlaceholder')}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                    disabled={isBusy}
                                    autoComplete="email"
                                />
                            </div>

                            {/* ── Password ── */}
                            <div>
                                <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.password')}</label>
                                <input
                                    id="login-password"
                                    type="password"
                                    placeholder={t('auth.login.passwordPlaceholder')}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                    disabled={isBusy}
                                    autoComplete="current-password"
                                />
                            </div>

                            {/* ── Error Banner ── */}
                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                    <p className="font-semibold text-red-700 text-sm">{error}</p>
                                </div>
                            )}

                            {/* ── Submit ── */}
                            <button
                                id="login-submit"
                                type="button"
                                onClick={handleSignIn}
                                disabled={!isFormValid || isBusy}
                                className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                            >
                                {isBusy ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        {t('auth.login.signingIn')}
                                    </>
                                ) : (
                                    t('auth.login.signIn')
                                )}
                            </button>

                            <div className="text-center">
                                <p className="text-sm text-[#666]">
                                    {t('auth.login.noAccount')}{' '}
                                    <Link to="/register" className="font-bold text-[#378ADD] hover:text-[#185FA5] hover:underline transition-all">
                                        {t('auth.login.signUp')}
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default Login;