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
        
            <section className="mt-10 mx-auto">
                <div className="flex-col text-center ">
                    <img src="./Scissor.png" alt="blue scissor icon" className="mx-auto mb-10" />
                    <h1 className="text-[36px] font-bold text-[#1D0065] leading-none my-5">Login to your <br />accaunt</h1>
                    <p className="text-[16px] text-[#4C4451] text-center">Enter your email and <br />password</p>
                </div>
                <div className="flex-col justify-items-center mt-10">
                    <div className="flex-col mb-5">
                        <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Email</h1>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="pl-5 pr-15 py-3 rounded-4xl text-[16px] font-regular text-[#000000]"
                        />
                    </div>
                    <div>
                        <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Password</h1>
                        <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Enter your password" className="pl-5 pr-15 py-3 rounded-4xl text-[16px] font-regular text-[#000000]" />
                    </div>
                    <button onClick={handleSignIn} className="flex justify-items-center mt-5 font-medium bg-[#1D0065] text-white px-28 py-3 rounded-3xl cursor-pointer">Sign In</button>
                    {error && <div style={{ color: 'red' }}>{error}</div>}
                </div>
                <div className="flex-col justify-items-center mt-3">
                    <div className="ml-38 leading-none  text-right">
                        <p className="text-[11px] text-[#7D7483]">Not have an accaunt?</p>
                        <a onClick={() => navigate('/register')} href="#" className="text-[11px] font-semibold text-[#1D0065] ">Sign Up</a>
                    </div>
                </div>
            </section>

            
    
    );
}

export default Login;
