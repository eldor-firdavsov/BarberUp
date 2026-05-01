import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function PublicRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
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
