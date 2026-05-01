import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createClient } from '../../api/clientApi.js';

function ClientOnboarding() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [profileImage, setProfileImage] = useState(null);
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

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileImage(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFinish = async () => {
        if (!name.trim() || !phone.trim()) {
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
                console.error('[ClientOnboarding] No onboarding_data in localStorage');
                return;
            }
            const data = JSON.parse(dataStr);
            console.log('[ClientOnboarding] onboarding_data:', data);

            setLoading(true);
            setError('');

            const payload = {
                fullname: name,
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
            };
            console.log('[ClientOnboarding] POST payload:', payload);

            const { data: apiUser, error: apiError } = await createClient(payload);

            console.log('[ClientOnboarding] API response → data:', apiUser, '| error:', apiError);

            if (apiError) {
                console.error('[ClientOnboarding] API error:', apiError);
                setError(apiError);
                return;
            }

            // Build the session user object from the API response
            const userObj = {
                role: 'client',
                email: apiUser?.email ?? data.email,
                name: apiUser?.fullname ?? name,
                phone: apiUser?.phone ?? phone,
                profileImage,
                id: apiUser?.id ?? apiUser?._id ?? null,
                ...(apiUser ?? {}),
            };
            console.log('[ClientOnboarding] userObj for session:', userObj);

            // Clean up temp onboarding data
            localStorage.removeItem('onboarding_data');

            login(userObj);
            navigate('/client/dashboard');
        } catch (err) {
            console.error('[ClientOnboarding] unexpected error:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = name.trim() !== '' && phone.trim() !== '' && isPhoneValid;

    return (
        <section className="page-animate min-h-screen flex flex-col px-6 py-12 max-w-md mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="self-start mb-6 flex items-center text-[#4C4451] font-medium"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M15 18l-6-6 6-6" /></svg>
                Back
            </button>

            <header className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <img src="./Scissor.png" alt="blue scissor icon" className="w-4 h-4" />
                    <p className="text-[#1D0065] text-sm font-bold uppercase tracking-wider">Join NavbatGo</p>
                </div>
                <h1 className="text-3xl font-bold text-[#1D0065] leading-tight">
                    Set Up Your Client Profile
                </h1>
            </header>

            <div className="space-y-6 flex-grow">
                <h2 className="flex items-center gap-2 text-lg font-bold text-[#1D0065] mb-2">
                    <img src="./Icon.png" alt="" className="h-5 w-5" /> Personal Information
                </h2>

                <div>
                    <label className="label-base">Full Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g Aziz Raghimov"
                        className="input-base"
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
                            placeholder=" 90 123 45 67"
                            className="w-full ml-2 text-base font-normal text-black bg-transparent outline-none h-full"
                            disabled={loading}
                        />
                    </div>
                    {phone.trim() !== '' && !isPhoneValid && (
                        <p className="text-red-500 text-xs mt-1">Please enter 9 digits after +998</p>
                    )}
                </div>

                <div>
                    <label className="label-base">Profile Image</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={loading}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-[#1D0065] hover:file:bg-gray-100"
                    />
                    {profileImage && (
                        <img src={profileImage} alt="Preview" className="mt-3 w-16 h-16 rounded-full object-cover shadow-sm border border-gray-100" />
                    )}
                </div>

                {error && <div className="text-red-500 text-sm font-medium mt-2 text-center">{error}</div>}
            </div>

            <button
                onClick={handleFinish}
                disabled={!isFormValid || loading}
                className="btn-primary mt-8"
            >
                {loading ? 'Creating account…' : 'Continue'}
            </button>
        </section>
    );
}

export default ClientOnboarding;