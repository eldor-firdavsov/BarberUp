import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabase.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    /* ── Session restore on mount ─────────────────────────────────────────── */
    useEffect(() => {
        console.log('[SESSION RESTORE] start');
        try {
            const savedUserStr = localStorage.getItem('user');
            if (!savedUserStr || savedUserStr === 'null' || savedUserStr === 'undefined') {
                console.log('[SESSION RESTORE] no session found');
                setUser(null);
                setLoading(false);
                return;
            }

            const saved = JSON.parse(savedUserStr);

            if (!saved || typeof saved !== 'object') {
                console.error('[SESSION RESTORE] invalid session object');
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            // Require role + email + id; token is optional (some legacy sessions may not have it)
            if (!saved.role || !saved.email || !saved.id) {
                console.error('[SESSION RESTORE] session missing required fields:', {
                    role: saved.role, email: !!saved.email, id: !!saved.id,
                });
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            if (!['client', 'barber'].includes(saved.role)) {
                console.error('[SESSION RESTORE] invalid role:', saved.role);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            console.log('[SESSION RESTORE] success:', { role: saved.role, email: saved.email, id: saved.id });
            setUser(saved);
        } catch (e) {
            console.error('[SESSION RESTORE] JSON parse error:', e);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }

        // Supabase session listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[AUTH STATE CHANGE]', event);
            if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
                setUser(null);
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('onboarding_data');
                window.location.href = '/';
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    /* ── login({ user, token? }) ──────────────────────────────────────────── */
    const login = (userObj, token = null) => {
        console.log('[SESSION LOGIN] start:', { role: userObj?.role, email: userObj?.email, id: userObj?.id });

        if (isLoggingIn) {
            console.warn('[SESSION LOGIN] login already in progress, ignoring duplicate attempt');
            return;
        }

        if (!userObj || typeof userObj !== 'object') {
            console.error('[SESSION LOGIN] invalid user object');
            return;
        }

        if (!userObj.role || !userObj.email || !userObj.id) {
            console.error('[SESSION LOGIN] user object missing required fields:', {
                role: userObj.role, email: !!userObj.email, id: !!userObj.id,
            });
            return;
        }

        if (!['client', 'barber'].includes(userObj.role)) {
            console.error('[SESSION LOGIN] invalid role:', userObj.role);
            return;
        }

        setIsLoggingIn(true);

        try {
            localStorage.removeItem('onboarding_data');
            setUser(userObj);
            localStorage.setItem('user', JSON.stringify(userObj));
            if (token) {
                localStorage.setItem('token', token);
                console.log('[SESSION LOGIN] token saved ->', token.slice(0, 12) + '…');
            }
            console.log('[SESSION LOGIN] success:', { role: userObj.role, email: userObj.email });
        } catch (error) {
            console.error('[SESSION LOGIN] error during login process:', error);
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('onboarding_data');
        } finally {
            setIsLoggingIn(false);
        }
    };

    /* ── updateSessionUser ────────────────────────────────────────────────── */
    const updateSessionUser = (updates) => {
        setUser((prev) => {
            if (!prev) {
                console.warn('[SESSION UPDATE] no user session to update');
                return prev;
            }
            const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };

            if (!next.role || !next.email || !next.id) {
                console.error('[SESSION UPDATE] updated session missing required fields');
                return prev;
            }

            localStorage.setItem('user', JSON.stringify(next));
            console.log('[SESSION UPDATE] success:', { role: next.role, email: next.email });
            return next;
        });
    };

    /* ── logout ───────────────────────────────────────────────────────────── */
    const logout = async () => {
        console.log('[SESSION LOGOUT] start');
        await supabase.auth.signOut().catch(console.error);
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('onboarding_data');
        console.log('[SESSION LOGOUT] success');
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isLoggingIn, updateSessionUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
