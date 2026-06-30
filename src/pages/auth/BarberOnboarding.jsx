import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useClient } from '../../context/ClientContext.jsx';
import { createBarber } from '../../api/barberApi.js';
import { uploadImage } from '../../api/uploadApi.js';
import { t } from '../../utils/i18n.js';
import { User, Store, Scissors, Check, ChevronRight, ChevronLeft, Plus, X, Image } from 'lucide-react';
import MapPicker from '../../components/MapPicker.jsx';

const STEPS = [
    { key: 'personal', icon: User, label: 'Shaxsiy' },
    { key: 'shop', icon: Store, label: 'Salon' },
    { key: 'services', icon: Scissors, label: 'Xizmatlar' },
    { key: 'review', icon: Check, label: 'Tasdiqlash' },
];
const serviceDurationOptions = [
    { value: '15', label: '15 min' },
    { value: '30', label: '30 min' },
    { value: '45', label: '45 min' },
    { value: '60', label: '1 soat' },
    { value: '75', label: '1 s 15 min' },
    { value: '90', label: '1 s 30 min' },
    { value: '120', label: '2 soat' },
];

function BarberOnboarding() {
    const [step, setStep] = useState(0);
    const [fullname, setFullname] = useState(() => {
        try {
            const data = JSON.parse(localStorage.getItem('onboarding_data') || '{}');
            return data.fullname || '';
        } catch { return ''; }
    });
    const [phone, setPhone] = useState(() => {
        try {
            const data = JSON.parse(localStorage.getItem('onboarding_data') || '{}');
            return data.phone ? data.phone.replace('+998', '') : '';
        } catch { return ''; }
    });
    const [office_name, setOfficeName] = useState('');
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [officeFiles, setOfficeFiles] = useState([null, null, null]);
    const [officePreviews, setOfficePreviews] = useState([null, null, null]);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [address, setAddress] = useState('');
    const [coordinates, setCoordinates] = useState(null);
    const [services, setServices] = useState([{ id: 1, name: '', duration: '30', price: '' }]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [direction, setDirection] = useState('next');

    const navigate = useNavigate();
    const { login } = useAuth();
    const { identify } = useClient();

    useEffect(() => {
        if (!localStorage.getItem('onboarding_data')) {
            navigate('/');
        }
    }, [navigate]);

    const cleanPhone = (v) => v.replace(/\D/g, '');
    const phoneDigits = cleanPhone(phone);
    const isPhoneValid = phoneDigits.length === 9;
    const formattedPhone = `+998${phoneDigits}`;

    const validServices = services.filter(s => s.name.trim() && s.price.trim());
    const avgPrice = validServices.length > 0
        ? Math.round(validServices.reduce((sum, s) => sum + Number(s.price), 0) / validServices.length)
        : 0;

    const canGoNext = () => {
        switch (step) {
            case 0: return fullname.trim() && isPhoneValid;
            case 1: return office_name.trim() && startTime && endTime;
            case 2: return validServices.length > 0;
            default: return true;
        }
    };

    const goNext = () => {
        if (!canGoNext()) return;
        if (step === 0 && !fullname.trim()) { setError('Ism kiriting'); return; }
        if (step === 0 && !isPhoneValid) { setError('Telefon raqamni to\'liq kiriting'); return; }
        if (step === 1 && !office_name.trim()) { setError('Salon nomini kiriting'); return; }
        if (step === 1 && (!startTime || !endTime)) { setError('Ish vaqtini belgilang'); return; }
        if (step === 2 && validServices.length === 0) { setError('Kamida bitta xizmat qo\'shing'); return; }
        setError('');
        setDirection('next');
        setStep(s => Math.min(s + 1, STEPS.length - 1));
    };

    const goBack = () => {
        setError('');
        setDirection('prev');
        setStep(s => Math.max(s - 1, 0));
    };

    const handleAddService = () => {
        const maxId = services.length > 0 ? Math.max(...services.map(s => s.id)) : 0;
        setServices([...services, { id: maxId + 1, name: '', duration: '30', price: '' }]);
    };

    const handleRemoveService = (id) => {
        if (services.length > 1) setServices(services.filter(s => s.id !== id));
    };

    const handleUpdateService = (id, field, value) => {
        setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleFinish = async () => {
        if (validServices.length === 0) { setError(t('auth.errors.addValidService')); return; }
        setLoading(true);
        setError('');

        try {
            let finalProfileImg = '';
            if (profileFile) {
                const { url, error: uploadErr } = await uploadImage(profileFile, 'profiles');
                if (!uploadErr && url) finalProfileImg = url;
            }
            const finalOfficeImgs = ['', '', ''];
            for (let i = 0; i < 3; i++) {
                if (officeFiles[i]) {
                    const { url, error: uploadErr } = await uploadImage(officeFiles[i], 'offices');
                    if (!uploadErr && url) {
                        finalOfficeImgs[i] = url;
                    }
                }
            }

            const payload = {
                fullname: fullname.trim(),
                phone: formattedPhone,
                shopName: office_name.trim(),
                profile_img: finalProfileImg,
                office_img: finalOfficeImgs[0],
                photo_1: finalOfficeImgs[0],
                photo_2: finalOfficeImgs[1],
                photo_3: finalOfficeImgs[2],
                workingHours: `${startTime} - ${endTime}`,
                avgPrice: String(avgPrice),
                services: validServices,
                address: address.trim(),
                location: coordinates ? { address: address.trim(), type: 'Point', coordinates } : null,
            };

            const { data: barberUser, error: createError } = await createBarber(payload);
            if (createError || !barberUser) {
                setError(createError || t('auth.errors.createAccountFailed'));
                setLoading(false);
                return;
            }

            localStorage.removeItem('onboarding_data');
            identify(fullname.trim(), formattedPhone);
            login({ ...barberUser, role: 'barber' });
            navigate('/barber/dashboard');
        } catch {
            setError(t('auth.errors.createAccountFailed'));
        } finally {
            setLoading(false);
        }
    };

    const slideClass = direction === 'next'
        ? 'animate-[slideInRight_0.3s_ease-out]'
        : 'animate-[slideInLeft_0.3s_ease-out]';

    return (
        <section className="min-h-screen bg-[#f5f5f7] flex justify-center items-start px-4 py-6 sm:px-6 sm:py-10">
            <div className="w-full max-w-md md:max-w-2xl bg-white rounded-[32px] border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                <div className="px-6 py-6 sm:px-8 sm:py-8">

                    {/* Top bar */}
                    <div className="flex items-center gap-3 mb-6">
                        <button
                            onClick={() => step === 0 ? navigate('/register') : goBack()}
                            className="w-10 h-10 rounded-full bg-[#f8f8f8] flex items-center justify-center hover:bg-[#f0f0f0] transition-all shrink-0 border border-black/5"
                        >
                            <ChevronLeft size={18} className="text-[#111]" />
                        </button>
                        <div className="flex-1">
                            <div className="flex gap-1.5">
                                {STEPS.map((s, i) => (
                                    <div key={s.key} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-[#378ADD]' : 'bg-[#e8e8e8]'}`} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step indicator with icons */}
                    <div className="flex justify-between mb-8">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            const isActive = i === step;
                            const isDone = i < step;
                            return (
                                <div key={s.key} className="flex flex-col items-center gap-1.5">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                        isActive ? 'bg-[#378ADD] text-white shadow-[0_4px_12px_rgba(55,138,221,0.3)]' :
                                        isDone ? 'bg-[#378ADD]/10 text-[#378ADD]' :
                                        'bg-[#f5f5f7] text-[#bbb]'
                                    }`}>
                                        {isDone ? <Check size={16} /> : <Icon size={16} />}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#378ADD]' : isDone ? 'text-[#378ADD]/60' : 'text-[#bbb]'}`}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className={slideClass}>
                        {/* Step 0: Personal Info */}
                        {step === 0 && (
                            <div className="space-y-6">
                                <header className="text-center">
                                    <h1 className="text-[24px] font-bold text-[#111] tracking-[-0.03em]">Shaxsiy ma'lumotlar</h1>
                                    <p className="text-sm text-[#666] font-medium mt-1">Ismingiz va telefon raqamingiz</p>
                                </header>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">{t('common.fullName')}</label>
                                    <input
                                        type="text"
                                        value={fullname}
                                        onChange={e => setFullname(e.target.value)}
                                        placeholder="Aziz Rahimov"
                                        className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                        disabled={loading}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">{t('common.phone')}</label>
                                    <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-[#185FA5]/30 focus-within:bg-white transition-all h-14">
                                        <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                            placeholder="90 123 45 67"
                                            className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full"
                                            disabled={loading}
                                        />
                                    </div>
                                    {phone && !isPhoneValid && (
                                        <p className="text-red-500 text-xs mt-1.5 font-medium">9 ta raqam kiriting</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 1: Shop Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <header className="text-center">
                                    <h1 className="text-[24px] font-bold text-[#111] tracking-[-0.03em]">Salon ma'lumotlari</h1>
                                    <p className="text-sm text-[#666] font-medium mt-1">Salon nomi, ish vaqti va rasmlar</p>
                                </header>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">{t('auth.barberOnboarding.officeName')}</label>
                                    <input
                                        type="text"
                                        value={office_name}
                                        onChange={e => setOfficeName(e.target.value)}
                                        placeholder="Gentleman's Atelier"
                                        className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white"
                                        disabled={loading}
                                        autoFocus
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">Boshlanish</label>
                                        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                            className="w-full h-14 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white text-center"
                                            disabled={loading} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">Tugash</label>
                                        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                            className="w-full h-14 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white text-center"
                                            disabled={loading} />
                                    </div>
                                </div>

                                {/* Image uploads */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <ImageUpload
                                            label="Profil rasmi"
                                            preview={profilePreview}
                                            onSelect={(file, url) => { setProfileFile(file); setProfilePreview(url); }}
                                            disabled={loading}
                                        />
                                        <div>
                                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">Salon rasmlari (3 tagacha)</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[0, 1, 2].map((idx) => (
                                                    <ImageUploadMini
                                                        key={idx}
                                                        index={idx + 1}
                                                        preview={officePreviews[idx]}
                                                        onSelect={(file, url) => {
                                                            const newFiles = [...officeFiles];
                                                            newFiles[idx] = file;
                                                            setOfficeFiles(newFiles);
                                                            const newPreviews = [...officePreviews];
                                                            newPreviews[idx] = url;
                                                            setOfficePreviews(newPreviews);
                                                        }}
                                                        disabled={loading}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Location Picker */}
                                <div className="pt-5 border-t border-black/5 space-y-3">
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-1">Salon manzili (xaritadan tanlang)</label>
                                    <MapPicker
                                        initialLocation={address ? { address, coordinates } : null}
                                        onLocationChange={(loc) => {
                                            setAddress(loc.address);
                                            setCoordinates(loc.coordinates);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Services */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <header className="text-center">
                                    <h1 className="text-[24px] font-bold text-[#111] tracking-[-0.03em]">Xizmatlar</h1>
                                    <p className="text-sm text-[#666] font-medium mt-1">Xizmatlaringizni qo'shing</p>
                                </header>

                                {/* Live average price card */}
                                {validServices.length > 0 && (
                                    <div className="bg-[#EBF4FF] rounded-2xl p-4 border border-[#378ADD]/10 text-center">
                                        <p className="text-[11px] font-bold text-[#666] uppercase tracking-wider mb-1">O'rtacha narx</p>
                                        <p className="text-[22px] font-bold text-[#111]">{avgPrice.toLocaleString()} UZS</p>
                                        <p className="text-[11px] text-[#666] font-medium">{validServices.length} ta xizmat asosida</p>
                                    </div>
                                )}

                                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                    {services.map((service) => (
                                        <div key={service.id} className="p-4 bg-[#f8f8f8] rounded-2xl border border-black/5 relative transition-all hover:border-black/10">
                                            {services.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveService(service.id)}
                                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-md z-10"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={service.name}
                                                    onChange={e => handleUpdateService(service.id, 'name', e.target.value)}
                                                    placeholder="Xizmat nomi (masalan, Soch olish)"
                                                    className="w-full bg-white border border-black/5 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 transition-all"
                                                    disabled={loading}
                                                />
                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <select
                                                            value={service.duration}
                                                            onChange={e => handleUpdateService(service.id, 'duration', e.target.value)}
                                                            className="w-full bg-white border border-black/5 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 transition-all"
                                                            disabled={loading}
                                                        >
                                                            {serviceDurationOptions.map(o => (
                                                                <option key={o.value} value={o.value}>{o.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type="number"
                                                            value={service.price}
                                                            onChange={e => handleUpdateService(service.id, 'price', e.target.value)}
                                                            placeholder="Narx"
                                                            className="w-full bg-white border border-black/5 rounded-xl px-3 py-2.5 text-sm outline-none pl-7 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 transition-all"
                                                            disabled={loading}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddService}
                                    className="w-full py-3 flex items-center justify-center gap-2 bg-[#f8f8f8] text-[#378ADD] font-bold rounded-2xl border-2 border-dashed border-[#378ADD]/20 hover:bg-[#EBF4FF] hover:border-[#378ADD]/40 transition-all"
                                    disabled={loading}
                                >
                                    <Plus size={16} />
                                    {t('auth.barberOnboarding.addService')}
                                </button>
                            </div>
                        )}

                        {/* Step 3: Review */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <header className="text-center">
                                    <h1 className="text-[24px] font-bold text-[#111] tracking-[-0.03em]">Ma'lumotlarni tekshirish</h1>
                                    <p className="text-sm text-[#666] font-medium mt-1">Barcha ma'lumotlaringizni tekshirib oling</p>
                                </header>

                                <div className="space-y-3">
                                    <ReviewRow icon={User} label="Ism" value={fullname} />
                                    <ReviewRow icon={User} label="Telefon" value={formattedPhone} />
                                    <ReviewRow icon={Store} label="Salon" value={office_name} />
                                    <ReviewRow icon={Store} label="Ish vaqti" value={`${startTime} - ${endTime}`} />
                                    {profilePreview && <ReviewRow icon={Image} label="Profil rasmi" value="Mavjud" />}
                                    {officePreviews.some(Boolean) && <ReviewRow icon={Image} label="Salon rasmlari" value={`${officePreviews.filter(Boolean).length} ta yuklandi`} />}
                                </div>

                                <div className="bg-[#f8f8f8] rounded-2xl p-4">
                                    <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-2">Xizmatlar ({validServices.length})</p>
                                    <div className="space-y-2">
                                        {validServices.map(s => (
                                            <div key={s.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-black/5">
                                                <span className="text-sm font-medium text-[#111]">{s.name}</span>
                                                <span className="text-sm font-bold text-[#378ADD]">{Number(s.price).toLocaleString()} UZS</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
                                        <span className="text-xs font-bold text-[#666] uppercase tracking-wider">O'rtacha narx</span>
                                        <span className="text-lg font-bold text-[#111]">{avgPrice.toLocaleString()} UZS</span>
                                    </div>
                                </div>

                                {error && (
                                    <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                                        <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={handleFinish}
                                    disabled={loading}
                                    className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                                >
                                    {loading ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('auth.barberOnboarding.creatingAccount')}</>
                                    ) : t('auth.barberOnboarding.completeRegistration')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Navigation buttons (steps 0-2) */}
                    {step < 3 && (
                        <div className="mt-8 space-y-3">
                            {error && (
                                <div className="rounded-3xl border border-red-100 bg-red-50 p-4">
                                    <p className="font-semibold text-red-700 text-sm text-center">{error}</p>
                                </div>
                            )}
                            <button
                                onClick={goNext}
                                disabled={!canGoNext() || loading}
                                className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                            >
                                {step === STEPS.length - 2 ? 'Tekshirish' : 'Davom etish'}
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function ImageUpload({ label, preview, onSelect, disabled }) {
    const [drag, setDrag] = useState(false);
    return (
        <div>
            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-2.5">{label}</label>
            <div
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={e => {
                    e.preventDefault(); setDrag(false);
                    const file = e.dataTransfer.files[0];
                    if (file) onSelect(file, URL.createObjectURL(file));
                }}
                className={`relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all cursor-pointer overflow-hidden ${
                    drag ? 'border-[#378ADD] bg-[#EBF4FF]' : preview ? 'border-transparent bg-[#f8f8f8]' : 'border-black/10 bg-[#f8f8f8] hover:border-[#378ADD]/30'
                }`}
                onClick={() => document.getElementById(label)?.click()}
            >
                {preview ? (
                    <>
                        <img src={preview} alt={label} className="w-full h-full object-cover absolute inset-0" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full">O'zgartirish</span>
                        </div>
                    </>
                ) : (
                    <>
                        <Image size={24} className="text-[#bbb]" />
                        <span className="text-[11px] text-[#999] font-medium text-center px-2">{label} yuklash</span>
                    </>
                )}
                <input id={label} type="file" accept="image/*" className="hidden" disabled={disabled}
                    onChange={e => {
                        const file = e.target.files[0];
                        if (file) onSelect(file, URL.createObjectURL(file));
                    }}
                />
            </div>
        </div>
    );
}

function ImageUploadMini({ index, preview, onSelect, disabled }) {
    const label = `Salon rasmi #${index}`;
    return (
        <div>
            <div
                className={`relative aspect-square rounded-xl border border-dashed flex flex-col items-center justify-center gap-1 transition-all cursor-pointer overflow-hidden ${
                    preview ? 'border-transparent bg-[#f8f8f8]' : 'border-black/10 bg-[#f8f8f8] hover:border-[#378ADD]/30'
                }`}
                onClick={() => document.getElementById(`office-img-${index}`)?.click()}
            >
                {preview ? (
                    <>
                        <img src={preview} alt={label} className="w-full h-full object-cover absolute inset-0" />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-[8px] font-bold bg-black/50 px-1 py-0.5 rounded-full">O'zgartirish</span>
                        </div>
                    </>
                ) : (
                    <>
                        <Plus size={14} className="text-[#bbb]" />
                        <span className="text-[8px] text-[#999] font-medium">Rasm #{index}</span>
                    </>
                )}
                <input id={`office-img-${index}`} type="file" accept="image/*" className="hidden" disabled={disabled}
                    onChange={e => {
                        const file = e.target.files[0];
                        if (file) onSelect(file, URL.createObjectURL(file));
                    }}
                />
            </div>
        </div>
    );
}

function ReviewRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-center gap-3 p-3 bg-[#f8f8f8] rounded-2xl border border-black/5">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 border border-black/5">
                <Icon size={16} className="text-[#666]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{label}</p>
                <p className="text-sm font-semibold text-[#111] truncate">{value}</p>
            </div>
        </div>
    );
}

export default BarberOnboarding;
