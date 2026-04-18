import { useNavigate } from 'react-router-dom';

function ClientLogin() {
    const navigate = useNavigate();

    return (
        <div>
            <h1>Client Login</h1>
            <button onClick={() => navigate('/client/dashboard')}>Go to /client/dashboard</button>
        </div>
    );
}

export default ClientLogin;
