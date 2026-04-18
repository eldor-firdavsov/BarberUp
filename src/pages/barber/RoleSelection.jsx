import { useNavigate } from 'react-router-dom';

function RoleSelection() {
    const navigate = useNavigate();

    return (
        <div>
            <h1>Role Selection</h1>
            <button onClick={() => navigate('/auth/client')}>Client Login</button>
            <button onClick={() => navigate('/auth/barber')}>Barber Login</button>
        </div>
    );
}

export default RoleSelection;
