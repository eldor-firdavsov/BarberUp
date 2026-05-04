import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createBarber } from '../../api/barberApi.js';

function BarberOnboarding() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [shopName, setShopName] = useState('');
    const [workingHoursStart, setWorkingHoursStart] = useState('');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('');
    const [avgPrice, setAvgPrice] = useState('');
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
        if (!name.trim() || !phone.trim() || !shopName.trim() || !workingHoursStart || !workingHoursEnd || !avgPrice.trim()) {
            setError("Please fill in all required fields.");
            return;
        }
        if (!isPhoneValid) {
            setError('Please enter a valid 9-digit phone number.');
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
                name,
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
                shopName,
                workingHours: `${workingHoursStart} - ${workingHoursEnd}`,
                avgPrice,
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
                name: apiBarber?.name ?? name,
                phone: apiBarber?.phone ?? phone,
                shopName: apiBarber?.shopName ?? shopName,
                workingHours: apiBarber?.workingHours ?? `${workingHoursStart} - ${workingHoursEnd}`,
                avgPrice: apiBarber?.avgPrice ?? avgPrice,
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
                                value={name}
                                onChange={e => setName(e.target.value)}
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
                            <label className="label-base">Barbershop Name</label>
                            <input
                                type="text"
                                value={shopName}
                                onChange={e => setShopName(e.target.value)}
                                className="input-base"
                                placeholder="e.g Modern Atelier"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="label-base">Working Hours</label>
                            <div className="flex items-center gap-3">
                                <input type="time" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} className="input-base text-center px-2" disabled={loading} />
                                <span className="text-gray-400 font-bold">—</span>
                                <input type="time" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} className="input-base text-center px-2" disabled={loading} />
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
                                    disabled={loading}
                                />
                                <span className="font-bold text-[var(--primary)] ml-2">UZS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {error && <div className="text-red-500 text-sm font-medium mt-4 text-center">{error}</div>}

                <button
                    onClick={handleFinish}
                    disabled={!name.trim() || !phone.trim() || !shopName.trim() || !workingHoursStart || !workingHoursEnd || !avgPrice.trim() || !isPhoneValid || loading}
                    className="btn-primary"
                >
                    {loading ? 'Creating account…' : 'Complete Registration'}
                </button>
            </div>
        </section>
    );
}

export default BarberOnboarding;