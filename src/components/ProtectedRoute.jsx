import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function ProtectedRoute({ children, requiredRole }) {
    const { user, loading } = useAuth();

    if (loading) {
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

