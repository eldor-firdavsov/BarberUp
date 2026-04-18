import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function ClientOnboarding() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');
        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleFinish = () => {
        if (name && phone) {
            const data = JSON.parse(localStorage.getItem('onboarding_data'));
            const userObj = {
                role: 'client',
                email: data.email,
                password: data.password,
                name,
                phone
            };

            const users = JSON.parse(localStorage.getItem('users')) || [];
            users.push(userObj);
            localStorage.setItem('users', JSON.stringify(users));

            login(userObj);
            navigate('/client/dashboard');
        }
    };

    return (
        <div>
            <h1>Client Onboarding</h1>
            <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={e => setName(e.target.value)}
            />
            <input
                type="text"
                placeholder="Phone Number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
            />
            <button onClick={handleFinish}>Finish</button>
        </div>
    );
}

export default ClientOnboarding;
