import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createBarber } from '../../api/barberApi.js';
import MapPicker from '../../components/MapPicker.jsx';

function BarberOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [office_name, setOfficeName] = useState('');
    const [office_description, setOfficeDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [average_price, setAveragePrice] = useState('');
    const [location, setLocation] = useState({ address: '', coordinates: [69.2401, 41.2995] }); // Default: Tashkent
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;

    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const data = localStorage.getItem('onboarding_data');
        if (!data) {
            navigate('/');
        }
    }, [navigate]);

    const handleFinish = async () => {
        if (!fullname.trim() || !phone.trim() || !office_name.trim() || !startTime.trim() || !endTime.trim() || !average_price.trim()) {
            setError("Please fill in all required fields.");
            return;
        }
        if (!isPhoneValid) {
            setError('Please enter a valid 9-digit phone number.');
            return;
        }
        if (!location.address) {
            setError('Please provide your office address.');
            return;
        }

        // Input length validation to prevent UI overflow
        if (fullname.trim().length > 100) {
            setError('Name must be less than 100 characters.');
            return;
        }

        if (phone.trim().length > 20) {
            setError('Phone number must be less than 20 characters.');
            return;
        }

        if (office_name.trim().length > 200) {
            setError('Office name must be less than 200 characters.');
            return;
        }

        if (office_description.trim().length > 1000) {
            setError('Office description must be less than 1000 characters.');
            return;
        }

        if (startTime.trim().length > 50) {
            setError('Working hours must be less than 50 characters.');
            return;
        }

        if (location.address.length > 500) {
            setError('Address must be less than 500 characters.');
            return;
        }

        try {
            const dataStr = localStorage.getItem('onboarding_data');
            if (!dataStr) {
                console.error('[BarberOnboarding] No onboarding_data in localStorage');
                return;
            }
            const data = JSON.parse(dataStr);
            console.log('[BarberOnboarding] onboarding_data:', data);

            setLoading(true);
            setError('');

            const barberData = {
                fullname,
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
                office_name,
                office_description,
                working_hours: `${startTime} - ${endTime}`,
                average_price,
                status: 'active',
                address: location.address,
                coordinates: location.coordinates,
            };
            console.log('[BarberOnboarding] barberData (frontend format):', barberData);

            const { data: apiBarber, error: apiError } = await createBarber(barberData);

            console.log('[BarberOnboarding] API response → data:', apiBarber, '| error:', apiError);

            if (apiError) {
                console.error('[BarberOnboarding] API error:', apiError);
                setError(apiError);
                setLoading(false);
                return;
            }

            // Build session user from the normalised API response
            const userObj = {
                role: 'barber',
                id: apiBarber?.id ?? apiBarber?._id ?? data.email,
                email: apiBarber?.email ?? data.email,
                fullname: apiBarber?.fullname ?? fullname,
                phone: apiBarber?.phone ?? `+998${phoneDigits}`,
                office_name: apiBarber?.office_name ?? office_name,
                office_description: apiBarber?.office_description ?? office_description,
                working_hours: apiBarber?.working_hours ?? working_hours,
                average_price: apiBarber?.average_price ?? average_price,
                status: apiBarber?.status ?? 'active',
                address: apiBarber?.address ?? location.address,
                coordinates: apiBarber?.coordinates ?? location.coordinates,
                ...(apiBarber ?? {}),
            };
            console.log('[BarberOnboarding] userObj for session:', userObj);

            localStorage.removeItem('onboarding_data');
            login(userObj);
            navigate('/barber/dashboard');
        } catch (err) {
            console.error('[BarberOnboarding] unexpected error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
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
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="./Icon.png" alt="" className="h-5 w-5" /> Personal Information
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Full Name</label>
                            <input
                                type="text"
                                value={fullname}
                                onChange={e => setFullname(e.target.value)}
                                className="input-base"
                                placeholder="e.g Aziz Raghimov"
                                disabled={loading}
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
                                    disabled={loading}
                                />
                            </div>
                            {phone.trim() !== '' && !isPhoneValid && (
                                <p className="text-red-500 text-xs mt-1">Please enter 9 digits after +998</p>
                            )}
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-5">
                        <img src="./shop.png" alt="" className="h-5 w-5" /> Business Details
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="label-base">Office Name</label>
                            <input
                                type="text"
                                value={office_name}
                                onChange={e => setOfficeName(e.target.value)}
                                className="input-base"
                                placeholder="Barbershop Name"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="label-base">Office Description</label>
                            <textarea
                                value={office_description}
                                onChange={e => setOfficeDescription(e.target.value)}
                                className="input-base min-h-[80px] resize-none"
                                placeholder="Describe your barbershop..."
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="label-base">Working Hours</label>

                            <div className="grid grid-cols-2 gap-4">

                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium text-gray-600">
                                        Opening
                                    </span>

                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        disabled={loading}
                                        className="
                h-14
                w-full
                px-4
                rounded-2xl
                border border-gray-200
                bg-white
                text-gray-900
                font-medium
                outline-none
                transition-all
                duration-200
                focus:border-violet-600
                focus:ring-4
                focus:ring-violet-100
                disabled:opacity-50
                disabled:cursor-not-allowed
                shadow-sm
            "
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium text-gray-600">
                                        Closing
                                    </span>

                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        disabled={loading}
                                        className="
                h-14
                w-full
                px-4
                rounded-2xl
                border border-gray-200
                bg-white
                text-gray-900
                font-medium
                outline-none
                transition-all
                duration-200
                focus:border-violet-600
                focus:ring-4
                focus:ring-violet-100
                disabled:opacity-50
                disabled:cursor-not-allowed
                shadow-sm
            "
                                    />
                                </div>

                            </div>
                        </div>

                        <div>
                            <label className="label-base">Average Price</label>
                            <div className="flex items-center bg-[var(--bg-input)] rounded-[var(--radius-standard)] px-5 border border-[var(--border-color)] focus-within:border-[var(--primary)] focus-within:bg-white transition-all h-[var(--input-height)]">
                                <input
                                    type="text"
                                    value={average_price}
                                    onChange={e => setAveragePrice(e.target.value)}
                                    className="w-full bg-transparent outline-none text-base text-black font-normal"
                                    placeholder="40,000"
                                    disabled={loading}
                                />
                                <span className="font-bold text-[var(--primary)] ml-2">so'm</span>
                            </div>
                        </div>

                        <div>
                            <label className="label-base">Office Location</label>
                            <MapPicker
                                onLocationChange={setLocation}
                                initialLocation={location}
                            />
                        </div>
                    </div>
                </div>

                {error && <div className="text-red-500 text-sm font-medium mt-4 text-center">{error}</div>}

                <button
                    onClick={handleFinish}
                    disabled={!fullname.trim() || !phone.trim() || !office_name.trim() || !startTime.trim() || !endTime.trim() || !average_price.trim() || !location.address.trim() || !isPhoneValid || loading}
                    className="btn-primary"
                >
                    {loading ? 'Creating account…' : 'Complete Registration'}
                </button>
            </div>
        </section>
    );
}

export default BarberOnboarding;