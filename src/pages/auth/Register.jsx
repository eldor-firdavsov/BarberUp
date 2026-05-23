import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../utils/i18n.js";

function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const data = localStorage.getItem("onboarding_data");
        if (!data) {
            navigate("/");
        }
    }, [navigate]);

    const handleContinue = async () => {
        if (!email || !password) {
            setError(t("auth.errors.fieldsEmpty"));
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError(t("auth.errors.invalidEmail"));
            return;
        }
        if (password.length < 6) {
            setError(t("auth.errors.passwordMin"));
            return;
        }

        const data = JSON.parse(localStorage.getItem("onboarding_data") || 'null');
        if (!data?.role) {
            setError(t('auth.errors.selectRoleFirst'));
            navigate('/');
            return;
        }
        console.log('[Register] role:', data?.role, '| email:', email);

        setLoading(true);
        setError('');

        // Normalize email and password to match login normalization
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password.trim();

        const updatedData = { ...data, email: normalizedEmail, password: normalizedPassword };
        localStorage.setItem("onboarding_data", JSON.stringify(updatedData));
        setLoading(false);

        if (data.role === "client") {
            navigate("/onboarding/client");
        } else if (data.role === "barber") {
            navigate("/onboarding/barber");
        }
    };

    const isFormValid = email.trim() !== "" && password.trim() !== "";

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-center px-4 py-8 sm:px-6 sm:py-12">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-8">
                    <button
                        onClick={() => navigate('/')}
                        className="w-11 h-11 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all duration-200 border border-black/5"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>

                    <div className="text-center">
                        <img src="./Scissor.png" alt={t('common.scissorIcon')} className="mx-auto mb-6 h-10 w-10" />
                        <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-3">
                            {t('auth.register.title')}
                        </h1>
                        <p className="text-sm text-[#666] font-medium">
                            {t('auth.register.subtitle')}
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.email')}</label>
                            <input
                                type="email"
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                placeholder={t('auth.register.emailPlaceholder')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.password')}</label>
                            <input
                                type="password"
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                placeholder={t('auth.register.passwordPlaceholder')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleContinue}
                            disabled={!isFormValid || loading}
                            className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                        >
                            {loading ? t('auth.register.checking') : t('auth.register.signUp')}
                        </button>

                        <div className="text-center">
                            <p className="text-sm text-[#666]">
                                {t('auth.register.hasAccount')}{" "}
                                <Link to="/login" className="font-bold text-[#378ADD] hover:text-[#185FA5] hover:underline transition-all">
                                    {t('auth.register.signIn')}
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Register;