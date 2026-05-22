import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center p-6">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-2 border-black/10 border-t-black rounded-full animate-spin mb-4"></div>
                    <p className="text-sm font-semibold text-[#666] tracking-[-0.01em]">Please wait...</p>
                </div>
            </div>
        );
    }

    if (user) {
        if (user.role === 'client') {
            return <Navigate to="/client/dashboard" replace />;
        } else if (user.role === 'barber') {
            return <Navigate to="/barber/dashboard" replace />;
        }
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default PublicRoute;
