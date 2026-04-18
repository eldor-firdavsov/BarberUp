import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Settings() {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div>
            <div>Barber Settings</div>
            <button onClick={handleLogout}>Logout</button>
        </div>
    );
}

export default Settings;
