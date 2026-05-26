import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';
import { normalizeBarber } from '../../api/barberApi.js';
import { uploadImage } from '../../api/uploadApi.js';
import { t } from '../../utils/i18n.js';
import LanguageSelector from '../../components/LanguageSelector.jsx';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();

    const [fullname, setFullname] = useState(user?.fullname || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [office_name, setOfficeName] = useState(user?.office_name || '');
    const initialHours = user?.working_hours?.split('-').map((s) => s.trim()) ?? ['', ''];
    const [workingHoursStart, setWorkingHoursStart] = useState(initialHours[0] || '');
    const [workingHoursEnd, setWorkingHoursEnd] = useState(initialHours[1] || '');
    const [average_price, setAveragePrice] = useState(user?.average_price || '');
    const [profile_img, setProfileImg] = useState(user?.profile_img || '');
    const [office_img, setOfficeImg] = useState(user?.office_img || '');
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(user?.profile_img || '');
    const [officeFile, setOfficeFile] = useState(null);
    const [officePreview, setOfficePreview] = useState(user?.office_img || '');



    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const handleProfileImageUpload = () => { };
    const handleShopImageUpload = () => { };

    const handleSave = async () => {
        if (!fullname || !phone || !office_name || !workingHoursStart || !workingHoursEnd || !average_price || !isPhoneValid) return;

        let finalProfileImg = profile_img;
        if (profileFile) {
            const { url, error: profileUploadErr } = await uploadImage(profileFile, 'profiles');
            if (profileUploadErr || !url) {
                setError(t('auth.errors.uploadProfileFailed', { error: profileUploadErr }));
                return;
            }
            finalProfileImg = url;
        }

        let finalOfficeImg = office_img;
        if (officeFile) {
            const { url, error: officeUploadErr } = await uploadImage(officeFile, 'offices');
            if (officeUploadErr || !url) {
                setError(t('auth.errors.uploadOfficeFailed', { error: officeUploadErr }));
                return;
            }
            finalOfficeImg = url;
        }

        setError('');

        const payload = {
            fullname,
            phone: `+998${cleanPhone(phone)}`,
            office_name,
            working_hours: `${workingHoursStart} - ${workingHoursEnd}`,
            average_price,
            profile_img: finalProfileImg,
            office_img: (() => {
                const services = user?.services ?? [];
                if (services.length > 0) {
                    return JSON.stringify({ url: finalOfficeImg, services });
                }
                return finalOfficeImg;
            })()
        };

        try {
            const { data, error } = await supabase
                .from('barbers')
                .update(payload)
                .eq('id', user?.id || user?._id)
                .select()
                .single();

            if (error) throw error;

            const updatedUser = {
                ...user,
                ...normalizeBarber(data),
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
                profile_img: finalProfileImg,
                office_img: finalOfficeImg
            });
        }

        setSuccess(t('barber.settings.profileUpdated'));
        setTimeout(() => setSuccess(''), 3000);
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <section className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 max-w-md md:max-w-2xl mx-auto flex flex-col">
            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-8">{t('barber.settings.title')}</h1>

            <div className="space-y-8 flex-grow">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#111] mb-5">
                        <img src="/Icon.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> {t('barber.settings.personalInfo')}
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.fullName')}</label>
                            <input type="text" value={fullname} onChange={e => setFullname(e.target.value)} className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.mobileNumber')}</label>
                            <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all h-14">
                                <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('barber.settings.profileImage')}</label>
                            <div className="flex items-center gap-4">
                                {profilePreview && (
                                    <img src={profilePreview} alt="Profile preview" className="w-16 h-16 rounded-full object-cover border border-black/5" onError={(e) => e.target.style.display = 'none'} />
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
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#378ADD] file:text-white hover:file:bg-[#185FA5]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-[#111] mb-5">
                        <img src="/shop.png" alt="" className="h-5 w-5" onError={(e) => e.target.style.display = 'none'} /> {t('barber.settings.businessAvailability')}
                    </h2>
                    <div className="space-y-4">

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('barber.settings.officeName')}</label>
                            <input type="text" value={office_name} onChange={e => setOfficeName(e.target.value)} className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('barber.settings.officeImage')}</label>
                            <div className="flex items-center gap-4">
                                {officePreview && (
                                    <img src={officePreview} alt="Office preview" className="w-16 h-16 rounded-xl object-cover border border-black/5" onError={(e) => e.target.style.display = 'none'} />
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
                                    className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#378ADD] file:text-white hover:file:bg-[#185FA5]"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('barber.settings.workingHours')}</label>
                            <div className="flex items-center gap-3">
                                <input type="time" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white text-center" />
                                <span className="text-[#666] font-bold">{t('common.dash')}</span>
                                <input type="time" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white text-center" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('barber.settings.averagePrice')}</label>
                            <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all h-14">
                                <input type="text" value={average_price} onChange={e => setAveragePrice(e.target.value)} className="w-full bg-transparent outline-none text-base text-[#111] font-normal" />
                                <span className="font-bold text-[#111] ml-2">{t('common.uzs')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                <LanguageSelector />

                {error && <div className="rounded-3xl border border-red-100 bg-red-50 p-5"><p className="font-semibold text-red-700 text-sm text-center">{error}</p></div>}
                {success && <div className="rounded-3xl border border-green-100 bg-green-50 p-5"><p className="font-semibold text-green-700 text-sm text-center">{success}</p></div>}

                <button onClick={handleSave} disabled={!fullname || !phone || !office_name || !workingHoursStart || !workingHoursEnd || !average_price || !isPhoneValid} className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(55,138,221,0.25)] mt-6">{t('common.saveChanges')}</button>
            </div>

            <button onClick={handleLogout} className="mt-10 py-4 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer">
                {t('common.logOut')}
            </button>
        </section>
    );
}

export default Settings;
