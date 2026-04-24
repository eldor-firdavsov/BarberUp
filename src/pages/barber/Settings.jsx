import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function Settings() {
    const { logout, user, login } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [shopName, setShopName] = useState('');
    const [workingHoursStart, setWorkingHoursStart] = useState('');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('');
    const [avgPrice, setAvgPrice] = useState('');
    const [profileImage, setProfileImage] = useState(null);
    const [shopImage, setShopImage] = useState(null);

    // New Availability Controls
    const [isWorkingNow, setIsWorkingNow] = useState(true);
    const [lunchStart, setLunchStart] = useState('');
    const [lunchEnd, setLunchEnd] = useState('');

    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPhone(user.phone || '');
            setShopName(user.shopName || '');
            if (user.workingHours) {
                const [start, end] = user.workingHours.split('-').map(s => s.trim());
                setWorkingHoursStart(start || '');
                setWorkingHoursEnd(end || '');
            }
            setAvgPrice(user.avgPrice || '');
            setProfileImage(user.profileImage || null);
            setShopImage(user.shopImage || null);
            setIsWorkingNow(user.isWorkingNow !== false); // default true
            setLunchStart(user.lunchStart || '');
            setLunchEnd(user.lunchEnd || '');
        }
    }, [user]);

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

    const handleSave = () => {
        if (!name || !phone || !shopName || !workingHoursStart || !workingHoursEnd || !avgPrice) return;
        const updatedUser = {
            ...user,
            name,
            phone,
            shopName,
            workingHours: `${workingHoursStart} - ${workingHoursEnd}`,
            avgPrice,
            profileImage,
            shopImage,
            isWorkingNow,
            lunchStart,
            lunchEnd
        };

        // Update LocalStorage array
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const updatedUsers = users.map(u => u.email === user.email ? updatedUser : u);
        localStorage.setItem('users', JSON.stringify(updatedUsers));

        // Update Current User
        login(updatedUser);

        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <section className="page-animate min-h-screen px-6 py-12 max-w-md mx-auto flex flex-col">
            <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-8">Barber Settings</h1>

            <div className="space-y-8 flex-grow">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="/Icon.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> Personal Information
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Full Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" />
                        </div>
                        <div>
                            <label className="label-base">Mobile Number</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <span className="text-black font-medium text-base pt-[1px]">+998</span>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full ml-2 text-base font-normal text-black bg-transparent outline-none h-full" />
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Profile Image</label>
                            <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100" />
                            {profileImage && <img src={profileImage} alt="Profile" className="mt-3 w-16 h-16 rounded-full object-cover shadow-sm" />}
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="/shop.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> Business & Availability
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-white px-5 py-3 border border-[var(--border-color)] rounded-[var(--radius-standard)] shadow-sm">
                            <label className="font-semibold text-sm text-[var(--text-muted)] cursor-pointer select-none" onClick={() => setIsWorkingNow(!isWorkingNow)}>Working Now</label>
                            <div
                                onClick={() => setIsWorkingNow(!isWorkingNow)}
                                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isWorkingNow ? 'bg-[#1D0065]' : 'bg-gray-300'}`}
                            >
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isWorkingNow ? 'translate-x-6' : ''}`}></div>
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Barbershop Name</label>
                            <input type="text" value={shopName} onChange={e => setShopName(e.target.value)} className="input-base" />
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
                            <label className="label-base">Lunch Break <span className="text-gray-400 font-normal">(Optional)</span></label>
                            <div className="flex items-center gap-3">
                                <input type="time" value={lunchStart} onChange={e => setLunchStart(e.target.value)} className="input-base text-center px-2" />
                                <span className="text-gray-400 font-bold">—</span>
                                <input type="time" value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} className="input-base text-center px-2" />
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Average Price</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <input type="text" value={avgPrice} onChange={e => setAvgPrice(e.target.value)} className="w-full bg-transparent outline-none text-base text-black font-normal" />
                                <span className="font-bold text-[var(--primary)] ml-2">UZS</span>
                            </div>
                        </div>
                        <div>
                            <label className="label-base">Shop Image</label>
                            <input type="file" accept="image/*" onChange={handleShopImageUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100" />
                            {shopImage && <img src={shopImage} alt="Shop" className="mt-3 w-full h-32 rounded-xl object-cover shadow-sm" />}
                        </div>
                    </div>
                </div>

                {success && <div className="text-green-600 text-sm font-bold text-center mt-4 bg-green-50 py-2 rounded-xl border border-green-200">{success}</div>}

                <button onClick={handleSave} disabled={!name || !phone || !shopName || !workingHoursStart || !workingHoursEnd || !avgPrice || !profileImage || !shopImage} className="btn-primary mt-6">Save Changes</button>
            </div>

            <button onClick={handleLogout} className="mt-10 py-4 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer">
                Log Out
            </button>
        </section>
    );
}

export default Settings;
