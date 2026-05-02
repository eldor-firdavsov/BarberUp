import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { getClients } from '../../api/clientApi.js';
import { getBarbers } from '../../api/barberApi.js';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSignIn = async () => {
        if (loading) return;
        if (!email || !password) {
            setError('Fields cannot be empty.');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Invalid email format.');
            return;
        }

        // Normalize email and password for consistent comparison
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();
        
        setLoading(true);
        setError('');
        console.log('[LOGIN ATTEMPT] email:', normalizedEmail);

        try {
            const [
                { data: barberList, error: barberError },
                { data: clientList, error: clientError }
            ] = await Promise.all([getBarbers(), getClients()]);
            console.log('[LOGIN FETCH] barbers:', barberList?.length || 0, 'error:', !!barberError);
            console.log('[LOGIN FETCH] clients:', clientList?.length || 0, 'error:', !!clientError);

            if (barberError && clientError) {
                console.error('[LOGIN FAILURE] Both API calls failed');
                setError('Network error. Please check your connection.');
                setLoading(false);
                return;
            }

            // Check for barber with normalized email comparison
            const foundBarber = (barberList ?? []).find(u => {
                const barberEmail = (u.email || '').trim().toLowerCase();
                const barberPassword = (u.password || '').trim();
                const match = barberEmail === normalizedEmail && barberPassword === normalizedPassword;
                if (match) {
                    console.log('[LOGIN MATCH] Found barber:', u.email);
                }
                return match;
            });
            
            if (foundBarber) {
                const userObj = {
                    role: 'barber',
                    id: foundBarber.id ?? foundBarber._id,
                    email: foundBarber.email,
                    name: foundBarber.fullname || foundBarber.name,
                    phone: foundBarber.phone,
                    shopName: foundBarber.office_name,
                    workingHours: foundBarber.working_hours,
                    avgPrice: foundBarber.average_price,
                    ...foundBarber,
                };
                console.log('[LOGIN SUCCESS] Barber login successful:', userObj.email);
                login(userObj);
                navigate('/barber/dashboard');
                setLoading(false);
                return;
            }

            // Check for client with normalized email comparison
            const foundClient = (clientList ?? []).find(u => {
                const clientEmail = (u.email || '').trim().toLowerCase();
                const clientPassword = (u.password || '').trim();
                const match = clientEmail === normalizedEmail && clientPassword === normalizedPassword;
                if (match) {
                    console.log('[LOGIN MATCH] Found client:', u.email);
                }
                return match;
            });

            if (foundClient) {
                const userObj = {
                    role: 'client',
                    id: foundClient.id ?? foundClient._id,
                    email: foundClient.email,
                    name: foundClient.fullname || foundClient.name,
                    phone: foundClient.phone,
                    ...foundClient,
                };
                console.log('[LOGIN SUCCESS] Client login successful:', userObj.email);
                login(userObj);
                navigate('/client/dashboard');
            } else {
                console.log('[LOGIN FAILURE] No user found with matching credentials');
                setError('Invalid email or password.');
            }
        } catch (err) {
            console.error('[LOGIN ERROR] Unexpected error:', err);
            setError('Something went wrong. Please try again.');
        }

        setLoading(false);
    };

    const isFormValid = email.trim() !== '' && password.trim() !== '';

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
                        disabled={loading}
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
                        disabled={loading}
                    />
                </div>

                {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}

                <button
                    onClick={handleSignIn}
                    disabled={!isFormValid || loading}
                    className="btn-primary mt-4"
                >
                    {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <div className="text-center mt-6">
                    <p className="text-xs text-[#7D7483]">
                        Don&apos;t have an account?{' '}
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