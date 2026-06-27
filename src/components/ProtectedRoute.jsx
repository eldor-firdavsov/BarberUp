import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { t } from '../utils/i18n.js';

function ProtectedRoute({ children, requiredRole }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-6">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-semibold text-[#666] tracking-[-0.01em]">{t('common.loadingExperience')}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/start" replace />;
    }

    if (!['client', 'barber'].includes(user.role)) {
        return <Navigate to="/start" replace />;
    }

    if (user.role !== requiredRole) {
        return <Navigate to={`/${user.role}/dashboard`} replace />;
    }

    return children;
}

export default ProtectedRoute;
