import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { httpClient, getApiError } from '../../api/httpClient.js';

function BarberOnboarding() {
    const [fullname, setFullname] = useState('');
    const [phone, setPhone] = useState('');
    const [office_name, setOfficeName] = useState('');
    const [office_description, setOfficeDescription] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [average_price, setAveragePrice] = useState('');
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

    const handleFinish = async () => {
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

        try {
            const dataStr = localStorage.getItem('onboarding_data');

            if (!dataStr) {
                setError('Missing onboarding data.');
                return;
            }

            const data = JSON.parse(dataStr);

            setLoading(true);
            setError('');

            const payload = {
                fullname: fullname.trim(),
                email: data.email,
                password: data.password,
                phone: `+998${phoneDigits}`,
                office_name: office_name.trim(),
                office_description: office_description.trim(),
                working_hours: `${startTime} - ${endTime}`,
                average_price: average_price.trim(),
            };

            const response = await httpClient.post('/barber', payload);

            const raw = response?.data?.data ?? response?.data;

            const barberUser = {
                ...raw,
                role: 'barber',
                id: raw?.id ?? raw?._id,
            };

            if (!barberUser?.id) {
                setError('Failed to create account.');
                return;
            }

            localStorage.removeItem('onboarding_data');

            login(barberUser);

            navigate('/barber/dashboard');

        } catch (err) {
            setError(getApiError(err, 'Failed to create account.'));
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
                Back
            </button>

            <header className="mb-10">
                <h1 className="text-3xl font-bold text-[#1D0065] mb-4">
                    Set Up Your Barber Profile
                </h1>

                <p className="text-[#4C4451]">
                    Build your professional presence and start accepting bookings.
                </p>
            </header>

            <div className="space-y-6">

                <div>
                    <label className="label-base">Full Name</label>

                    <input
                        type="text"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        className="input-base"
                        placeholder="Aziz Raghimov"
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="label-base">Phone Number</label>

                    <div className="flex items-center gap-2">
                        <span>+998</span>

                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="input-base"
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
                    <label className="label-base">Office Name</label>

                    <input
                        type="text"
                        value={office_name}
                        onChange={(e) => setOfficeName(e.target.value)}
                        className="input-base"
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="label-base">Office Description</label>

                    <textarea
                        value={office_description}
                        onChange={(e) => setOfficeDescription(e.target.value)}
                        className="input-base min-h-[100px]"
                        disabled={loading}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="input-base"
                        disabled={loading}
                    />

                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="input-base"
                        disabled={loading}
                    />
                </div>

                <div>
                    <label className="label-base">Average Price</label>

                    <input
                        type="text"
                        value={average_price}
                        onChange={(e) => setAveragePrice(e.target.value)}
                        className="input-base"
                        placeholder="40000"
                        disabled={loading}
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-center text-sm">
                        {error}
                    </p>
                )}

                <button
                    onClick={handleFinish}
                    disabled={loading}
                    className="btn-primary w-full"
                >
                    {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>

            </div>
        </section>
    );
}

export default BarberOnboarding;