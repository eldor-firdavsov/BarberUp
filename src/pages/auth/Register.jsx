import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');
        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleContinue = () => {
        if (email && password) {
            const data = JSON.parse(localStorage.getItem('onboarding_data'));
            const updatedData = { ...data, email, password };
            localStorage.setItem('onboarding_data', JSON.stringify(updatedData));

            if (data.role === 'client') {
                navigate('/onboarding/client');
            } else if (data.role === 'barber') {
                navigate('/onboarding/barber');
            }
        }
    };

    return (
        <div>
            <h1>Register Account</h1>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
            <button onClick={handleContinue}>Continue</button>
            <br /><br />
            <button onClick={() => navigate('/login')}>Already have account? Sign In</button>
        </div>
    );
}

export default Register;
