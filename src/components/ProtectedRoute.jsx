import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function ProtectedRoute({ children, requiredRole }) {
    const { user, loading } = useAuth();

    if (loading) {
        // Additional validation during loading state to prevent unauthorized access
        // Check if localStorage has corrupted data that needs immediate cleanup
        try {
            const savedUserStr = localStorage.getItem('user');
            if (savedUserStr) {
                const parsed = JSON.parse(savedUserStr);
                // If we can parse but data is invalid during loading, force logout immediately
                if (!parsed || typeof parsed !== 'object' || !parsed.role || !parsed.email || !parsed.id) {
                    console.error('[PROTECTED ROUTE] Invalid session detected during loading, forcing logout');
                    localStorage.removeItem('user');
                    localStorage.removeItem('onboarding_data');
                    return <Navigate to="/login" replace />;
                }
            }
        } catch (e) {
            // JSON parse error during loading - force immediate cleanup
            console.error('[PROTECTED ROUTE] Corrupted session during loading, forcing logout:', e);
            localStorage.removeItem('user');
            localStorage.removeItem('onboarding_data');
            return <Navigate to="/login" replace />;
        }

        return (
            <div className="min-h-screen bg-[var(--background)] flex justify-center items-center p-4">
                <div className="w-full max-w-md">
                    <div className="skeleton-card"></div>
                    <div className="skeleton-text medium mt-4"></div>
                    <div className="skeleton-text small mt-2"></div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!['client', 'barber'].includes(user.role)) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== requiredRole) {
        return <Navigate to={`/${user.role}/dashboard`} replace />;
    }

    return children;
}

export default ProtectedRoute;
