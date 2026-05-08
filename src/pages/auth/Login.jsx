import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { loginBarber } from '../../api/barberApi.js';
import { loginClient } from '../../api/clientApi.js';

/* ─── Role selector styles (scoped, no global pollution) ─────────────────── */
const roleSelectorStyles = `
  .role-toggle {
    display: flex;
    background: #F3F4F6;
    border-radius: 12px;
    padding: 4px;
    gap: 4px;
  }

  .role-toggle-btn {
    flex: 1;
    height: 40px;
    border: none;
    border-radius: 9px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 180ms ease, color 180ms ease, box-shadow 180ms ease;
    background: transparent;
    color: #6B7280;
  }

  .role-toggle-btn.active {
    background: white;
    color: #1D0065;
    box-shadow: 0 1px 4px rgba(0,0,0,0.10);
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
            setError('Fields cannot be empty.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setError('Invalid email format.');
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
                setError(apiError || 'Login failed. Please try again.');
                return;
            }

            const { token, user } = data;

            // Ensure we have an id field (some endpoints return _id)
            const userObj = {
                role,
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
            setError('Something went wrong. Please try again.');
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

            <section className="page-animate min-h-screen flex flex-col px-6 py-12 max-w-md mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="btn-ghost self-start mb-6"
                    disabled={isBusy}
                    type="button"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    Back
                </button>

                <div className="text-center mb-10">
                    <img src="./Scissor.png" alt="blue scissor icon" className="mx-auto mb-6 h-10 w-10" />
                    <h1 className="text-h1 mb-4">
                        Login to your <br /> account
                    </h1>
                    <p className="text-body">
                        Enter your email and password
                    </p>
                </div>

                <div className="space-y-6">
                    {/* ── Role Selector ── */}
                    <div>
                        <label className="label-base" style={{ marginBottom: '0.5rem' }}>I am a…</label>
                        <div className="role-toggle">
                            <button
                                type="button"
                                id="role-client"
                                className={`role-toggle-btn${role === 'client' ? ' active' : ''}`}
                                onClick={() => { setRole('client'); setError(''); }}
                                disabled={isBusy}
                            >
                                Client
                            </button>
                            <button
                                type="button"
                                id="role-barber"
                                className={`role-toggle-btn${role === 'barber' ? ' active' : ''}`}
                                onClick={() => { setRole('barber'); setError(''); }}
                                disabled={isBusy}
                            >
                                Barber
                            </button>
                        </div>
                    </div>

                    {/* ── Email ── */}
                    <div>
                        <label className="label-base required">Email</label>
                        <input
                            id="login-email"
                            type="email"
                            placeholder="Enter your email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="input-base"
                            disabled={isBusy}
                            autoComplete="email"
                        />
                    </div>

                    {/* ── Password ── */}
                    <div>
                        <label className="label-base required">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="input-base"
                            disabled={isBusy}
                            autoComplete="current-password"
                        />
                    </div>

                    {/* ── Error Banner ── */}
                    {error && (
                        <div className="error-container">
                            <div className="error-container-header">
                                <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="error-title">Login Failed</span>
                            </div>
                            <p className="error-message">{error}</p>
                            <div className="error-actions">
                                <button
                                    type="button"
                                    onClick={() => setError('')}
                                    className="btn-ghost btn-sm"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Submit ── */}
                    <button
                        id="login-submit"
                        type="button"
                        onClick={handleSignIn}
                        disabled={!isFormValid || isBusy}
                        className="btn-primary"
                    >
                        {isBusy ? (
                            <>
                                <div className="spinner" />
                                Signing in…
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>

                    <div className="text-center">
                        <p className="text-small">
                            Don&apos;t have an account?{' '}
                            <Link to="/register" className="font-bold text-[var(--primary)] hover:underline transition-all">
                                Sign Up
                            </Link>
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}

export default Login;