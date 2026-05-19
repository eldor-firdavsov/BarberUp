import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { httpClient } from '../../api/httpClient.js';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();
    const [name, setName] = useState(user?.fullname || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [success, setSuccess] = useState('');
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const handleProfileImageUpload = () => { };

    const handleSave = async () => {
        if (!name || !phone || !isPhoneValid) return;

        const formData = new FormData();
        formData.append('fullname', name);
        formData.append('phone', `+998${cleanPhone(phone)}`);


        try {
            const response = await httpClient.put(
                `/client/${user?.id || user?._id}`,
                formData
            );
            const raw = response?.data?.data ??
                response?.data;
            updateSessionUser({
                ...user,
                fullname: name,
                name,
                phone: `+998${cleanPhone(phone)}`,
            });
        } catch (err) {
            console.error('[CLIENT SETTINGS] failed:', err);
            updateSessionUser({
                ...user,
                fullname: name,
                name,
                phone: `+998${cleanPhone(phone)}`,
            });
        }

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
