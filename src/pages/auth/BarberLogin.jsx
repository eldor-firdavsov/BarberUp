import { useNavigate } from 'react-router-dom';

function BarberLogin() {
    const navigate = useNavigate();

    return (
        <div>
            <h1>Barber Login</h1>
            <button onClick={() => navigate('/barber/dashboard')}>Go to /barber/dashboard</button>
        </div>
    );
}

export default BarberLogin;
