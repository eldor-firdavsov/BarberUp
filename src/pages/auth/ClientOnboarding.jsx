import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { createClient } from '../../api/clientApi.js';
import { uploadImage } from '../../api/uploadApi.js';

function ClientOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
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

            let finalProfileImg = '';
            if (profileFile) {
                const { url, error: uploadErr } = await uploadImage(profileFile, 'profiles');
                if (uploadErr) {
                    setError('Failed to upload profile image: ' + uploadErr);
                    setLoading(false);
                    return;
                }
                finalProfileImg = url;
            }

            // Build request payload
            let payload = {
                fullname,
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
                profile_img: finalProfileImg
            };

            console.log('[ClientOnboarding] POST payload created');

            let clientUser = null;

            try {
                const { data: clientUserRes, error: createError } = await createClient(payload);

                if (createError) {
                    setError(createError);
                    setLoading(false);
                    return;
                }

                clientUser = clientUserRes;
                console.log('[ClientOnboarding] success:', clientUser?.email);
            } catch (err) {
                setError('Failed to create account.');
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
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 py-8 sm:px-6 sm:py-12">
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
                        <div className="flex items-center gap-2 mb-4">
                            <img src="./Scissor.png" alt="scissor icon" className="w-4 h-4" />
                            <p className="text-[#111] text-sm font-bold uppercase tracking-[0.12em]">Join NavbatGo</p>
                        </div>
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">
                            Set Up Your Client Profile
                        </h1>
                    </header>

                    <div className="space-y-6">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-[#111] mb-2">
                            <img src="./Icon.png" alt="" className="h-5 w-5" /> Personal Information
                        </h2>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Full Name</label>
                            <input
                                type="text"
                                value={fullname}
                                onChange={e => setFullname(e.target.value)}
                                placeholder="e.g Aziz Raghimov"
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-black/20 focus:bg-white"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">Mobile Number</label>
                            <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all h-14">
                                <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder=" 90 123 45 67"
                                    className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                    disabled={loading}
                                />
                            </div>
                            {phone.trim() !== '' && !isPhoneValid && (
                                <p className="text-red-500 text-xs mt-1">Please enter 9 digits after +998</p>
                            )}
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

                        {error && (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleFinish}
                        disabled={!isFormValid || loading}
                        className="w-full h-14 rounded-2xl bg-black hover:bg-[#111] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
                    >
                        {loading ? 'Creating account…' : 'Continue'}
                    </button>
                </div>
            </div>
        </section>
    );
}

export default ClientOnboarding;