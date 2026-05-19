import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { httpClient } from '../../api/httpClient.js';
import { normalizeBarber } from '../../api/barberApi.js';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();

    const [fullname, setFullname] = useState(user?.fullname || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [office_name, setOfficeName] = useState(user?.office_name || '');
    const initialHours = user?.working_hours?.split('-').map((s) => s.trim()) ?? ['', ''];
    const [workingHoursStart, setWorkingHoursStart] = useState(initialHours[0] || '');
    const [workingHoursEnd, setWorkingHoursEnd] = useState(initialHours[1] || '');
    const [average_price, setAveragePrice] = useState(user?.average_price || '');



    const [success, setSuccess] = useState('');
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const handleProfileImageUpload = () => { };
    const handleShopImageUpload = () => { };

    const handleSave = async () => {
        if (!fullname || !phone || !office_name || !workingHoursStart || !workingHoursEnd || !average_price || !isPhoneValid) return;

        const formData = new FormData();
        formData.append('fullname', fullname);
        formData.append('phone', `+998${cleanPhone(phone)}`);
        formData.append('office_name', office_name);
        formData.append('working_hours', `${workingHoursStart} - ${workingHoursEnd}`);
        formData.append('average_price', average_price);



        try {
            const response = await httpClient.put(
                `/barber/${user?.id || user?._id}`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );
            const raw = response?.data?.data ??
                response?.data;
            const updatedUser = {
                ...user,
                ...normalizeBarber(raw),
                role: 'barber',
            };
            updateSessionUser(updatedUser);
        } catch (err) {
            console.error('[SETTINGS SAVE] failed:', err);
            // Still update local session with text fields
            updateSessionUser({
                ...user,
                fullname,
                phone: `+998${cleanPhone(phone)}`,
                office_name,
                working_hours:
                    `${workingHoursStart} - ${workingHoursEnd}`,
                average_price,
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
            <h1 className="text-3xl font-bold text-[#1D0065] leading-tight mb-8">Barber Settings</h1>

            <div className="space-y-8 flex-grow">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="/Icon.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> Personal Information
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Full Name</label>
                            <input type="text" value={fullname} onChange={e => setFullname(e.target.value)} className="input-base" />
                        </div>
                        <div>
                            <label className="label-base">Mobile Number</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <span className="text-black font-medium text-base pt-[1px]">+998</span>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full ml-2 text-base font-normal text-black bg-transparent outline-none h-full" />
                            </div>
                        </div>

                    </div>
                </div>

                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="/shop.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> Business & Availability
                    </h2>
                    <div className="space-y-4">

                        <div>
                            <label className="label-base">Office Name</label>
                            <input type="text" value={office_name} onChange={e => setOfficeName(e.target.value)} className="input-base" />
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
                                <input type="text" value={average_price} onChange={e => setAveragePrice(e.target.value)} className="w-full bg-transparent outline-none text-base text-black font-normal" />
                                <span className="font-bold text-[var(--primary)] ml-2">UZS</span>
                            </div>
                        </div>

                    </div>
                </div>



                {success && <div className="text-green-600 text-sm font-bold text-center mt-4 bg-green-50 py-2 rounded-xl border border-green-200">{success}</div>}

                <button onClick={handleSave} disabled={!fullname || !phone || !office_name || !workingHoursStart || !workingHoursEnd || !average_price || !isPhoneValid} className="btn-primary mt-6">Save Changes</button>
            </div>

            <button onClick={handleLogout} className="mt-10 py-4 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer">
                Log Out
            </button>
        </section>
    );
}

export default Settings;
