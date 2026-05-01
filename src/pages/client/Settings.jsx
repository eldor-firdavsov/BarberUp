import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [profileImage, setProfileImage] = useState(user?.profileImage || null);
    const [success, setSuccess] = useState('');
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setProfileImage(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        if (!name || !phone || !isPhoneValid) return;
        const updatedUser = { ...user, name, phone: `+998${cleanPhone(phone)}`, profileImage };

        updateSessionUser(updatedUser);

        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <section className="page-animate min-h-screen px-6 py-12 max-w-md mx-auto flex flex-col">
            <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-8">Client Settings</h1>

            <div className="space-y-6 flex-grow">
                <div>
                    <label className="label-base">Profile Image</label>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100" />
                    {profileImage && <img src={profileImage} alt="Profile" className="mt-3 w-20 h-20 rounded-full object-cover shadow-sm border border-gray-100" />}
                </div>

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

                {success && <div className="text-green-600 text-sm font-bold text-center mt-4 bg-green-50 py-2 rounded-xl border border-green-200">{success}</div>}

                <button onClick={handleSave} disabled={!name || !phone || !isPhoneValid} className="btn-primary mt-6">Save Changes</button>
            </div>

            <button onClick={handleLogout} className="mt-10 py-4 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer">
                Log Out
            </button>
        </section>
    );
}

export default Settings;
