/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    /* Hydrate session after mount so ProtectedRoute never redirects before restore. */
    /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time auth bootstrap */
    useEffect(() => {
        console.log('[AUTH RESTORE] start');
        try {
            const saved = JSON.parse(localStorage.getItem('user') || 'null');
            setUser(saved);
            console.log('[AUTH RESTORE]', saved ? `role=${saved.role}` : 'no session');
        } catch (e) {
            console.error('[AUTH RESTORE] invalid JSON', e);
            localStorage.removeItem('user');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    const login = (userObj) => {
        setUser(userObj);
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.removeItem('onboarding_data');
    };

    const updateSessionUser = (updates) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
            localStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, updateSessionUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
