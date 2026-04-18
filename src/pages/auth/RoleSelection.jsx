import { useNavigate } from 'react-router-dom';

function RoleSelection() {
    const navigate = useNavigate();

    const handleSelectRole = (role) => {
        localStorage.setItem('onboarding_data', JSON.stringify({ role }));
        navigate('/register');
    };

    return (
        <div>
            <h1>Select Your Role</h1>
            <button onClick={() => handleSelectRole('client')}>Client</button>
            <button onClick={() => handleSelectRole('barber')}>Barber</button>
        </div>
    );
}

export default RoleSelection;
