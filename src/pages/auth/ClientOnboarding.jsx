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
            try {
                const dataStr = localStorage.getItem('onboarding_data');
                if (!dataStr) return;
                const data = JSON.parse(dataStr);

                const userObj = {
                    role: 'client',
                    email: data.email,
                    password: data.password,
                    name,
                    phone
                };

                const users = JSON.parse(localStorage.getItem('users')) || [];
                const userExists = users.some(u => u.email === data.email);

                if (!userExists) {
                    users.push(userObj);
                    localStorage.setItem('users', JSON.stringify(users));
                }

                login(userObj);
                navigate('/client/dashboard');
            } catch (error) {
                console.error("Failed to parse onboarding data.");
            }
        }
    };

    return (
        <>
            <section className="mt-15 mx-auto justify-items-center">
                <div className="flex flex-col justify-items-center ">
                    <div className="flex items-center gap-2">
                        <img src="./Scissor.png" alt="blue scissor icon" className="w-3 h-3" />
                        <p className="text-[#1D0065] font-bold">Join NavbatGo</p>
                    </div>

                    <h1 className="text-[36px] text-start font-bold text-[#1D0065] leading-none my-5">
                        Set Up Your Client <br />Profile
                    </h1>
                </div>

                <h1 className="flex items-center mt-15 mb-5 mr-13 gap-2 text-[20px] font-semibold">
                    <img src="./Icon.png" alt="" className="h-4 w-4" />Personal Information
                </h1>

                <div className="flex flex-col justify-items-center ">
                    <div className="flex flex-col mb-5 ">
                        <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Full name</h1>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g Aziz Raghimov"
                            className="pl-5 pr-15 py-3 font-semibold rounded-xl"
                        />
                    </div>

                    <div className="ml-10">
                        <h1 className="font-semibold text-[14px] text-[#4C4451] mb-2">Mobile Number</h1>
                        <div className="flex items-center ml-5">
                            <p>+998</p>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder=" 90 123 45 67"
                                className="ml-2 pr-15 py-2 rounded-xl text-[16px] font-regular text-[#000000]"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleFinish}
                        className="flex justify-items-center mt-20 font-medium bg-[#1D0065] text-white px-30 py-3 rounded-xl cursor-pointer"
                    >
                        Continue
                    </button>
                </div>
            </section>
        </>
    );
}

export default ClientOnboarding;