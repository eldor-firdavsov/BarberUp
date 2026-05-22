import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createBarber } from '../../api/barberApi.js';
import { uploadImage } from '../../api/uploadApi.js';

function BarberOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [office_name, setOfficeName] = useState('');
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [officeFile, setOfficeFile] = useState(null);
    const [officePreview, setOfficePreview] = useState(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [average_price, setAveragePrice] = useState('');
    const [services, setServices] = useState([{ id: Date.now(), name: '', duration: '30', price: '' }]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const cleanPhone = (value) => value.replace(/\D/g, '');
    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');

        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleAddService = () => {
        setServices([...services, { id: Date.now(), name: '', duration: '30', price: '' }]);
    };

    const handleRemoveService = (id) => {
        if (services.length > 1) {
            setServices(services.filter(s => s.id !== id));
        }
    };

    const handleUpdateService = (id, field, value) => {
        setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleFinish = async () => {
        const validServices = services.filter(s => s.name.trim() !== '' && s.price.trim() !== '');

        if (
            !fullname.trim() ||
            !phone.trim() ||
            !office_name.trim() ||
            !startTime.trim() ||
            !endTime.trim() ||
            !average_price.trim() ||
            !isPhoneValid
        ) {
            setError('Please fill in all required fields.');
            return;
        }

        if (validServices.length === 0) {
            setError('Please add at least one valid service with a name and price.');
            return;
        }

        try {
            const dataStr = localStorage.getItem('onboarding_data');

            if (!dataStr) {
                setError('Missing onboarding data.');
                return;
            }

            const data = JSON.parse(dataStr);

            setLoading(true);
            setError('');

            let finalProfileImg = '';
            if (profileFile) {
                const { url, error: profileUploadErr } = await uploadImage(profileFile, 'profiles');
                if (!profileUploadErr && url) {
                    finalProfileImg = url;
                }
            }

            let finalOfficeImg = '';
            if (officeFile) {
                const { url, error: officeUploadErr } = await uploadImage(officeFile, 'offices');
                if (!officeUploadErr && url) {
                    finalOfficeImg = url;
                }
            }

            const payload = {
                fullname: fullname.trim(),
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
                shopName: office_name.trim(),
                profile_img: finalProfileImg,
                office_img: finalOfficeImg,
                workingHours: `${startTime} - ${endTime}`,
                avgPrice: average_price.trim(),
                services: validServices
            };

            const { data: barberUser, error: createError } = await createBarber(payload);

            if (createError || !barberUser) {
                setError(createError || 'Failed to create account.');
                return;
            }

            localStorage.removeItem('onboarding_data');

            login(barberUser);

            navigate('/barber/dashboard');

        } catch (err) {
            setError('Failed to create account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-start px-4 py-8 sm:px-6 sm:py-12">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <header>
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                            Set Up Your Barber Profile
                        </h1>
                        <p className="text-sm text-[#666] font-medium">
                            Build your professional presence and start accepting bookings.
                        </p>
                    </header>

                    <div className="space-y-6">

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Full Name</label>
                            <input
                                type="text"
                                value={fullname}
                                onChange={(e) => setFullname(e.target.value)}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                placeholder="Aziz Raghimov"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Phone Number</label>
                            <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all h-14">
                                <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                    placeholder="901234567"
                                    disabled={loading}
                                />
                            </div>
                            {phone && !isPhoneValid && (
                                <p className="text-red-500 text-sm mt-1">
                                    Please enter 9 digits.
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Office Name</label>
                            <input
                                type="text"
                                value={office_name}
                                onChange={(e) => setOfficeName(e.target.value)}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Profile Image (Optional)</label>
                            <div className="flex items-center gap-4">
                                {profilePreview && (
                                    <img src={profilePreview} alt="Profile preview" className="w-16 h-16 rounded-full object-cover border border-black/5" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setProfileFile(file);
                                            setProfilePreview(URL.createObjectURL(file));
                                        }
                                    }}
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-[#111]"
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Office Image (Optional)</label>
                            <div className="flex items-center gap-4">
                                {officePreview && (
                                    <img src={officePreview} alt="Office preview" className="w-16 h-16 rounded-xl object-cover border border-black/5" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            setOfficeFile(file);
                                            setOfficePreview(URL.createObjectURL(file));
                                        }
                                    }}
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-[#111]"
                                    disabled={loading}
                                />
                            </div>
                        </div>



                        <div className="w-full flex flex-col gap-1">
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Services</label>
                            <div className="space-y-4">
                                {services.map((service, index) => (
                                    <div key={service.id} className="p-4 bg-[#f8f8f8] rounded-2xl border border-black/5 relative">
                                        {services.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveService(service.id)}
                                                className="absolute top-2 right-2 text-red-500 bg-red-50 hover:bg-red-100 w-6 h-6 rounded-full flex justify-center items-center font-bold text-sm"
                                                title="Remove service"
                                            >
                                                &times;
                                            </button>
                                        )}
                                        <div className="space-y-3">
                                            <div>
                                                <input
                                                    type="text"
                                                    value={service.name}
                                                    onChange={(e) => handleUpdateService(service.id, 'name', e.target.value)}
                                                    placeholder="Service Name (e.g., Haircut)"
                                                    className="w-full bg-white border border-black/5 rounded-xl px-3 py-2 text-sm outline-none focus:border-black/20"
                                                    disabled={loading}
                                                />
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="flex-1">
                                                    <select
                                                        value={service.duration}
                                                        onChange={(e) => handleUpdateService(service.id, 'duration', e.target.value)}
                                                        className="w-full bg-white border border-black/5 rounded-xl px-3 py-2 text-sm outline-none focus:border-black/20"
                                                        disabled={loading}
                                                    >
                                                        <option value="15">15 mins</option>
                                                        <option value="30">30 mins</option>
                                                        <option value="45">45 mins</option>
                                                        <option value="60">1 hr</option>
                                                        <option value="75">1 hr 15 mins</option>
                                                        <option value="90">1 hr 30 mins</option>
                                                        <option value="120">2 hrs</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="number"
                                                        value={service.price}
                                                        onChange={(e) => handleUpdateService(service.id, 'price', e.target.value)}
                                                        placeholder="Price"
                                                        className="w-full bg-white border border-black/5 rounded-xl px-3 py-2 text-sm outline-none pl-7 focus:border-black/20"
                                                        disabled={loading}
                                                    />
                                                    <span className="absolute left-3 top-[10px] text-gray-500 text-sm">$</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddService}
                                    className="w-full py-2 bg-[#f8f8f8] text-[#111] font-bold rounded-xl border border-black/5 hover:bg-[#f0f0f0] transition-colors"
                                    disabled={loading}
                                >
                                    + Add Another Service
                                </button>
                            </div>
                        </div>

                        <div className="w-full flex flex-col gap-1">
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3" htmlFor="start">Start Time</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                disabled={loading}
                            />
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3 mt-4" htmlFor="end">End Time</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Average Price</label>
                            <input
                                type="text"
                                value={average_price}
                                onChange={(e) => setAveragePrice(e.target.value)}
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                placeholder="40000"
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleFinish}
                            disabled={loading}
                            className="w-full h-14 rounded-2xl bg-black hover:bg-[#111] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
                        >
                            {loading ? 'Creating Account...' : 'Complete Registration'}
                        </button>

                    </div>
                </div>
            </div>
        </section>
    );
}

export default BarberOnboarding;