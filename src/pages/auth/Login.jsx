import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSignIn = () => {
        const users = JSON.parse(localStorage.getItem('users')) || [];
        const foundUser = users.find(u => u.email === email && u.password === password);

        if (foundUser) {
            setError('');
            login(foundUser);
            if (foundUser.role === 'client') {
                navigate('/client/dashboard');
            } else if (foundUser.role === 'barber') {
                navigate('/barber/dashboard');
            }
        } else {
            setError('Invalid email or password.');
        }
    };

    return (
        <div>
            <h1>Sign In</h1>
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
            <button onClick={handleSignIn}>Sign In</button>
            {error && <div style={{ color: 'red' }}>{error}</div>}
            <br /><br />
            <button onClick={() => navigate('/register')}>Back to Register</button>
        </div>
    );
}

export default Login;
