import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { httpClient } from '../../api/httpClient.js';
import { getApiError } from '../../api/httpClient.js';

function ClientOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
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

    const handleProfileImageUpload = (e) => {
        // Removed as per request
    };

    const handleFinish = async () => {
        if (!fullname.trim() || !phone.trim()) {
            setError("Please fill in all required fields.");
            return;
        }
        if (!isPhoneValid) {
            setError('Please enter a valid 9-digit phone number.');
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

            // Build request payload
            let payload = {
                fullname,
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
            };

            console.log('[ClientOnboarding] POST payload created');

            let clientUser = null;

            try {
                const response = await httpClient.post(
                    '/client',
                    payload,
                    { headers: { 'Content-Type': 'application/json' } }
                );
                const raw = response?.data?.data ?? response?.data;
                clientUser = {
                    ...raw,
                    id: raw?._id ?? raw?.id,
                    role: 'client',
                };
                console.log('[ClientOnboarding] success:', clientUser?.email);
            } catch (err) {
                setError(getApiError(err, 'Failed to create account.'));
                setLoading(false);
                return;
            }

            if (!clientUser || !clientUser.id) {
                setError('Account creation failed. Please try again.');
                setLoading(false);
                return;
            }

            const userObj = {
                ...clientUser,
                role: 'client',
                id: clientUser.id ?? clientUser._id,
            };

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

    const isFormValid = fullname.trim() !== '' && phone.trim() !== '' && isPhoneValid;

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
                        value={fullname}
                        onChange={e => setFullname(e.target.value)}
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