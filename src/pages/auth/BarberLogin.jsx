import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function BarberLogin() {
    const [phone, setPhone] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = () => {
        if (phone.trim()) {
            login('barber', phone);
            navigate('/barber/dashboard');
        }
    };

    return (
        <div>
            <h1>Barber Login</h1>
            <input
                type="text"
                placeholder="Enter Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
            />
            <button onClick={handleLogin}>Login</button>
        </div>
    );
}

export default BarberLogin;
