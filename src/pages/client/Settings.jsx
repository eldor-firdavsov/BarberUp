import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';
import { uploadImage } from '../../api/uploadApi.js';
import { t } from '../../utils/i18n.js';
import LanguageSelector from '../../components/LanguageSelector.jsx';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();
    const [name, setName] = useState(user?.fullname || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [profile_img, setProfileImg] = useState(user?.profile_img || '');
    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(user?.profile_img || '');
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const cleanPhone = (value) => value.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const handleProfileImageUpload = () => { };

    const handleSave = async () => {
        if (!name || !phone || !isPhoneValid) return;

        let finalProfileImg = profile_img;
        if (profileFile) {
            const { url, error: uploadErr } = await uploadImage(profileFile, 'profiles');
            if (uploadErr || !url) {
                setError(t('auth.errors.uploadProfileFailed', { error: uploadErr }));
                return;
            }
            finalProfileImg = url;
        }

        setError('');

        const payload = {
            fullname: name,
            phone: `+998${cleanPhone(phone)}`,
            profile_img: finalProfileImg
        };

        try {
            const { data, error } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', user?.id || user?._id)
                .select()
                .single();

            if (error) throw error;

            updateSessionUser({
                ...user,
                fullname: name,
                name,
                phone: `+998${cleanPhone(phone)}`,
                profile_img: finalProfileImg
            });
        } catch (err) {
            console.error('[CLIENT SETTINGS] failed:', err);
            updateSessionUser({
                ...user,
                fullname: name,
                name,
                phone: `+998${cleanPhone(phone)}`,
                profile_img: finalProfileImg
            });
        }

        setSuccess(t('client.settings.profileUpdated'));
        setTimeout(() => setSuccess(''), 3000);
    };

    const handleLogout = () => {
        logout();
    };

    return (
        <section className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 max-w-md md:max-w-2xl mx-auto flex flex-col">
            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight mb-8">{t('client.settings.title')}</h1>

            <div className="space-y-6 flex-grow">

                <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.fullName')}</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none transition-all duration-200 focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white" />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('common.mobileNumber')}</label>
                    <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-5 border border-black/5 focus-within:border-black/20 focus-within:bg-white transition-all h-14">
                        <span className="text-[#111] font-medium text-base pt-[1px]">+998</span>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full ml-2 text-base font-normal text-[#111] bg-transparent outline-none h-full" />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-[0.12em] mb-3">{t('client.settings.profileImage')}</label>
                    <div className="flex items-center gap-4">
                        {profilePreview && (
                            <img src={profilePreview} alt={t('common.profilePreview')} className="w-16 h-16 rounded-full object-cover border border-black/5" onError={(e) => e.target.style.display = 'none'} />
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

                <LanguageSelector />

                {error && <div className="rounded-3xl border border-red-100 bg-red-50 p-5"><p className="font-semibold text-red-700 text-sm text-center">{error}</p></div>}
                {success && <div className="rounded-3xl border border-green-100 bg-green-50 p-5"><p className="font-semibold text-green-700 text-sm text-center">{success}</p></div>}

                <button onClick={handleSave} disabled={!name || !phone || !isPhoneValid} className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_25px_rgba(55,138,221,0.25)] mt-6">{t('common.saveChanges')}</button>
            </div>

            <button onClick={handleLogout} className="mt-10 py-4 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 transition-all cursor-pointer">
                {t('common.logOut')}
            </button>
        </section>
    );
}

export default Settings;
