/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    /* Hydrate session after mount so ProtectedRoute never redirects before restore. */
    /* eslint-disable react-hooks/set-state-in-effect -- intentional one-time auth bootstrap */
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
            
            // Validate session object has required fields
            if (!saved || typeof saved !== 'object') {
                console.error('[SESSION RESTORE] invalid session object');
                localStorage.removeItem('user');
                setUser(null);
                setLoading(false);
                return;
            }
            
            // Validate required fields
            if (!saved.role || !saved.email || !saved.id) {
                console.error('[SESSION RESTORE] session missing required fields:', { role: saved.role, email: !!saved.email, id: !!saved.id });
                localStorage.removeItem('user');
                setUser(null);
                setLoading(false);
                return;
            }
            
            // Validate role is either 'client' or 'barber'
            if (!['client', 'barber'].includes(saved.role)) {
                console.error('[SESSION RESTORE] invalid role:', saved.role);
                localStorage.removeItem('user');
                setUser(null);
                setLoading(false);
                return;
            }
            
            console.log('[SESSION RESTORE] success:', { role: saved.role, email: saved.email, id: saved.id });
            setUser(saved);
        } catch (e) {
            console.error('[SESSION RESTORE] JSON parse error:', e);
            localStorage.removeItem('user');
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    const login = (userObj) => {
        console.log('[SESSION LOGIN] start:', { role: userObj?.role, email: userObj?.email, id: userObj?.id });
        
        // Prevent concurrent login attempts (race condition protection)
        if (isLoggingIn) {
            console.warn('[SESSION LOGIN] login already in progress, ignoring duplicate attempt');
            return;
        }
        
        // Validate user object before setting session
        if (!userObj || typeof userObj !== 'object') {
            console.error('[SESSION LOGIN] invalid user object');
            return;
        }
        
        if (!userObj.role || !userObj.email || !userObj.id) {
            console.error('[SESSION LOGIN] user object missing required fields:', { role: userObj.role, email: !!userObj.email, id: !!userObj.id });
            return;
        }
        
        if (!['client', 'barber'].includes(userObj.role)) {
            console.error('[SESSION LOGIN] invalid role:', userObj.role);
            return;
        }
        
        // Set login in progress flag to prevent race conditions
        setIsLoggingIn(true);
        
        try {
            // Clean up any existing onboarding data
            localStorage.removeItem('onboarding_data');
            
            // Set user session
            setUser(userObj);
            localStorage.setItem('user', JSON.stringify(userObj));
            console.log('[SESSION LOGIN] success:', { role: userObj.role, email: userObj.email });
        } catch (error) {
            console.error('[SESSION LOGIN] error during login process:', error);
            // Cleanup on error
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('onboarding_data');
        } finally {
            // Always reset login in progress flag
            setIsLoggingIn(false);
        }
    };

    const updateSessionUser = (updates) => {
        setUser((prev) => {
            if (!prev) {
                console.warn('[SESSION UPDATE] no user session to update');
                return prev;
            }
            const next = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
            
            // Validate updated session
            if (!next.role || !next.email || !next.id) {
                console.error('[SESSION UPDATE] updated session missing required fields');
                return prev; // Don't update if invalid
            }
            
            localStorage.setItem('user', JSON.stringify(next));
            console.log('[SESSION UPDATE] success:', { role: next.role, email: next.email });
            return next;
        });
    };

    const logout = () => {
        console.log('[SESSION LOGOUT] start');
        setUser(null);
        localStorage.removeItem('user');
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
