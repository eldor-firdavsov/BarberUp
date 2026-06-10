import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        try {
            const savedUserStr = localStorage.getItem('user');
            if (!savedUserStr || savedUserStr === 'null' || savedUserStr === 'undefined') {
                setUser(null);
                setLoading(false);
                return;
            }

            const saved = JSON.parse(savedUserStr);

            if (!saved || typeof saved !== 'object') {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            if (!saved.role || !saved.id) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            if (!['client', 'barber'].includes(saved.role)) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return;
            }

            setUser(saved);
        } catch (e) {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (userObj, token = null) => {
        if (isLoggingIn) {
            return;
        }

        if (!userObj || typeof userObj !== 'object') {
            return;
        }

        if (!userObj.role || !userObj.id) {
            return;
        }

        if (!['client', 'barber'].includes(userObj.role)) {
            return;
        }

        setIsLoggingIn(true);

        try {
            localStorage.removeItem('onboarding_data');
            setUser(userObj);
            localStorage.setItem('user', JSON.stringify(userObj));
            if (token) {
                localStorage.setItem('token', token);
            }
        } catch (error) {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('onboarding_data');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const updateSessionUser = (updates) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };

            if (!next.role || !next.id) return prev;

            localStorage.setItem('user', JSON.stringify(next));
            return next;
        });
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('onboarding_data');
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
