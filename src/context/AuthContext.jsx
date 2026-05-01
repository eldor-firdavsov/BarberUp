/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch {
            localStorage.removeItem('user');
            return null;
        }
    });
    const loading = false;

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
