import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSignIn = () => {
        if (!email || !password) {
            setError("Fields cannot be empty.");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Invalid email format.");
            return;
        }

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

    const isFormValid = email.trim() !== "" && password.trim() !== "";

    return (
        <section className="page-animate min-h-screen flex flex-col px-6 py-12 max-w-md mx-auto">
            <button
                onClick={() => navigate('/')}
                className="self-start mb-6 flex items-center text-[#4C4451] font-medium"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 18l-6-6 6-6" /></svg>
                Back
            </button>
            <div className="text-center mb-10">
                <img src="./Scissor.png" alt="blue scissor icon" className="mx-auto mb-6 h-10 w-10" />
                <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-3">
                    Login to your <br /> account
                </h1>
                <p className="text-base text-[#4C4451]">
                    Enter your email and password
                </p>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="label-base">Email</label>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="input-base"
                    />
                </div>

                <div>
                    <label className="label-base">Password</label>
                    <input
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="input-base"
                    />
                </div>

                {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}

                <button
                    onClick={handleSignIn}
                    disabled={!isFormValid}
                    className="btn-primary mt-4"
                >
                    Sign In
                </button>

                <div className="text-center mt-6">
                    <p className="text-xs text-[#7D7483]">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-bold text-[#1D0065] underline">
                            Sign Up
                        </Link>
                    </p>
                </div>
            </div>
        </section>
    );
}

export default Login;