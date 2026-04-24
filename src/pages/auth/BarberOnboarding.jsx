import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function BarberOnboarding() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [shopName, setShopName] = useState('');
    const [workingHoursStart, setWorkingHoursStart] = useState('');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('');
    const [avgPrice, setAvgPrice] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [shopImage, setShopImage] = useState(null);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');
        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleProfileImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setProfileImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleShopImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setShopImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleFinish = () => {
        if (!name || !phone || !shopName || !workingHoursStart || !workingHoursEnd || !avgPrice) {
            setError("Please fill in all required fields.");
            return;
        }
        if (!profileImage || !shopImage) {
            setError("Image is required");
            return;
        }

        try {
            const dataStr = localStorage.getItem('onboarding_data');
            if (!dataStr) return;
            const data = JSON.parse(dataStr);

            const userObj = {
                id: data.email, // using email as a unique id
                role: 'barber',
                email: data.email,
                password: data.password,
                name,
                phone,
                shopName,
                workingHours: `${workingHoursStart} - ${workingHoursEnd}`,
                avgPrice,
                profileImage,
                shopImage
            };

            const users = JSON.parse(localStorage.getItem('users')) || [];
            const userExists = users.some(u => u.email === data.email);

            if (!userExists) {
                users.push(userObj);
                localStorage.setItem('users', JSON.stringify(users));
            }

            login(userObj);
            navigate('/barber/dashboard');
        } catch (error) {
            console.error("Failed to parse onboarding data.");
        }
    };

    return (
        <section className="page-animate min-h-screen px-6 py-10 max-w-md mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="self-start mb-6 flex items-center text-[#4C4451] font-medium"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 18l-6-6 6-6" /></svg>
                Back
            </button>
            <header className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <img src="./Scissor.png" alt="" className="w-4 h-4" />
                    <p className="text-[#1D0065] text-sm font-bold uppercase tracking-wider">Join NavbatGo</p>
                </div>
                <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-4">Set Up Your Barber Profile</h1>
                <p className="text-[#4C4451] text-md leading-relaxed">
                    Build your professional presence and start accepting bookings in Tashkent.
                </p>
            </header>

            <div className="space-y-8">
                {/* Personal Info Group */}
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="./Icon.png" alt="" className="h-5 w-5" /> Personal Information
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="input-base"
                                placeholder="e.g Aziz Raghimov"
                            />
                        </div>
                        <div>
                            <label className="label-base">Mobile Number</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <span className="text-black font-medium text-base pt-[1px]">+998</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="w-full ml-2 text-base font-normal text-black bg-transparent outline-none h-full"
                                    placeholder=" 90 123 45 67"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Profile Photo</label>
                            <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100" />
                            {profileImage && <img src={profileImage} alt="Preview" className="mt-2 w-16 h-16 rounded-full object-cover shadow-sm" />}
                        </div>
                    </div>
                </div>

                {/* Business Details Group */}
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="./shop.png" alt="" className="h-5 w-5" /> Business Details
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Barbershop Name</label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={e => setShopName(e.target.value)}
                                className="input-base"
                                placeholder="e.g Modern Atelier"
                            />
                        </div>
                        <div>
                            <label className="label-base">Working Hours</label>
                            <div className="flex items-center gap-3">
                                <input type="time" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} className="input-base text-center px-2" />
                                <span className="text-gray-400 font-bold">—</span>
                                <input type="time" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} className="input-base text-center px-2" />
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Average Price</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <input
                                    type="text"
                                    value={avgPrice}
                                    onChange={e => setAvgPrice(e.target.value)}
                                    className="w-full bg-transparent outline-none text-base text-black font-normal"
                                    placeholder="150 000"
                                />
                                <span className="font-bold text-[var(--primary)] ml-2">UZS</span>
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Shop Photo</label>
                            <input type="file" accept="image/*" onChange={handleShopImageUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100" />
                            {shopImage && <img src={shopImage} alt="Shop Preview" className="mt-2 w-full h-32 rounded-xl object-cover shadow-sm" />}
                        </div>
                    </div>
                </div>

                {error && <div className="text-red-500 text-sm font-medium mt-4 text-center">{error}</div>}

                <button
                    onClick={handleFinish}
                    disabled={!name || !phone || !shopName || !workingHoursStart || !workingHoursEnd || !avgPrice || !profileImage || !shopImage}
                    className="btn-primary"
                >
                    Complete Registration
                </button>
            </div>
        </section>
    );
}

export default BarberOnboarding;