import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Dashboard() {
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div>
            <div>Client Dashboard</div>
            <div>Welcome, {user?.name}</div>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}

export default Dashboard;
