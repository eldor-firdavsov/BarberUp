import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function ProtectedRoute({ children, requiredRole }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (user.role !== requiredRole) {
        return <Navigate to={`/${user.role}/dashboard`} replace />;
    }

    return children;
}

export default ProtectedRoute;
