import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (savedUser) {
            setUser(savedUser);
        }
        setLoading(false);
    }, []);

    const login = (userObj) => {
        setUser(userObj);
        localStorage.setItem('currentUser', JSON.stringify(userObj));
        localStorage.removeItem('onboarding_data');
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
        window.location.href = '/';
    };

    const getBarbers = () => {
        try {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            return users.filter(u => u.role === 'barber');
        } catch (error) {
            return [];
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, getBarbers }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
