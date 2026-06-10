import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { supabase } from '../../api/supabase.js';
import { normalizeBarber } from '../../api/barberApi.js';
import { uploadImage } from '../../api/uploadApi.js';
import { t } from '../../utils/i18n.js';
import { User, Phone, Clock, Coffee, ChevronRight, LogOut, X, Check, Send, ExternalLink } from 'lucide-react';
import LanguageSelector from '../../components/LanguageSelector.jsx';

function Settings() {
    const { logout, user, updateSessionUser } = useAuth();
    const navigate = useNavigate();

    // Modal state: null | 'profile' | 'hours' | 'lunch'
    const [modal, setModal] = useState(null);

    // Profile edit fields
    const [fullname, setFullname] = useState(user?.fullname || '');
    const [phone, setPhone] = useState((user?.phone || '').replace(/\D/g, '').replace(/^998/, '').slice(-9));
    const [officeName, setOfficeName] = useState(user?.office_name || '');

    const [profileFile, setProfileFile] = useState(null);
    const [profilePreview, setProfilePreview] = useState(user?.profile_img || '');

    const [photo1File, setPhoto1File] = useState(null);
    const [photo1Preview, setPhoto1Preview] = useState(user?.photo_1 || '');
    const [photo2File, setPhoto2File] = useState(null);
    const [photo2Preview, setPhoto2Preview] = useState(user?.photo_2 || '');
    const [photo3File, setPhoto3File] = useState(null);
    const [photo3Preview, setPhoto3Preview] = useState(user?.photo_3 || '');

    // Working hours
    const initialHours = user?.working_hours?.split('-').map(s => s.trim()) ?? ['09:00', '18:00'];
    const [workStart, setWorkStart] = useState(initialHours[0] || '09:00');
    const [workEnd, setWorkEnd] = useState(initialHours[1] || '18:00');

    // Lunch break
    const initialLunch = (user?.lunch_break || user?.lunchBreak || '')?.split('-').map(s => s.trim()) ?? ['13:00', '14:00'];
    const [lunchStart, setLunchStart] = useState(initialLunch[0] || '13:00');
    const [lunchEnd, setLunchEnd] = useState(initialLunch[1] || '14:00');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const cleanPhone = (v) => v.replace(/\D/g, '');
    const isPhoneValid = cleanPhone(phone).length === 9;

    const openModal = (type) => {
        setError('');
        setSuccess('');
        setModal(type);
    };

    const closeModal = () => {
        setError('');
        setModal(null);
    };

    const handleSaveProfile = async () => {
        if (!fullname || !phone || !isPhoneValid) return;
        setLoading(true);
        setError('');
        try {
            let finalProfileImg = user?.profile_img || '';
            if (profileFile) {
                const { url, error: uploadErr } = await uploadImage(profileFile, 'profiles');
                if (uploadErr || !url) { setError('Rasm yuklanmadi.'); setLoading(false); return; }
                finalProfileImg = url;
            }

            let finalPhoto1 = photo1Preview;
            if (photo1File) {
                const { url, error: uploadErr } = await uploadImage(photo1File, 'photos');
                if (uploadErr || !url) { setError('1-salon rasmi yuklanmadi.'); setLoading(false); return; }
                finalPhoto1 = url;
            }
            let finalPhoto2 = photo2Preview;
            if (photo2File) {
                const { url, error: uploadErr } = await uploadImage(photo2File, 'photos');
                if (uploadErr || !url) { setError('2-salon rasmi yuklanmadi.'); setLoading(false); return; }
                finalPhoto2 = url;
            }
            let finalPhoto3 = photo3Preview;
            if (photo3File) {
                const { url, error: uploadErr } = await uploadImage(photo3File, 'photos');
                if (uploadErr || !url) { setError('3-salon rasmi yuklanmadi.'); setLoading(false); return; }
                finalPhoto3 = url;
            }

            const payload = {
                fullname,
                phone: `+998${cleanPhone(phone)}`,
                office_name: officeName,
                profile_img: finalProfileImg,
                photo_1: finalPhoto1,
                photo_2: finalPhoto2,
                photo_3: finalPhoto3,
            };
            const { data, error: dbError } = await supabase
                .from('barbers').update(payload).eq('id', user?.id).select().single();
            if (dbError) throw dbError;
            updateSessionUser({ ...user, ...normalizeBarber(data), role: 'barber' });
            setProfileFile(null);
            setPhoto1File(null);
            setPhoto2File(null);
            setPhoto3File(null);
            setSuccess('Profil yangilandi!');
            setTimeout(() => { setSuccess(''); closeModal(); }, 1500);
        } catch (err) {
            setError(err.message || 'Xato yuz berdi');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveHours = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error: dbError } = await supabase
                .from('barbers')
                .update({ working_hours: `${workStart} - ${workEnd}` })
                .eq('id', user?.id).select().single();
            if (dbError) throw dbError;
            updateSessionUser({ ...user, ...normalizeBarber(data), role: 'barber' });
            setSuccess('Ish vaqti saqlandi!');
            setTimeout(() => { setSuccess(''); closeModal(); }, 1500);
        } catch (err) {
            setError(err.message || 'Xato yuz berdi');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveLunch = async () => {
        setLoading(true);
        setError('');
        try {
            const { data, error: dbError } = await supabase
                .from('barbers')
                .update({ lunch_break: `${lunchStart} - ${lunchEnd}` })
                .eq('id', user?.id).select().single();
            if (dbError) throw dbError;
            updateSessionUser({ ...user, ...normalizeBarber(data), role: 'barber' });
            setSuccess('Tushlik vaqti saqlandi!');
            setTimeout(() => { setSuccess(''); closeModal(); }, 1500);
        } catch (err) {
            setError(err.message || 'Xato yuz berdi');
        } finally {
            setLoading(false);
        }
    };

    const avatarLetter = (user?.fullname || 'B')[0].toUpperCase();
    const displayPhone = user?.phone ? user.phone.replace(/^\+998/, '+998 ') : '—';

    return (
        <section className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 max-w-md md:max-w-2xl mx-auto flex flex-col gap-6">
            <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em]">{t('barber.settings.title')}</h1>

            {/* Profile Card */}
            <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] p-6 flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-[#378ADD] flex items-center justify-center shrink-0 overflow-hidden shadow-lg shadow-[#378ADD]/20">
                    {profilePreview ? (
                        <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" onError={() => setProfilePreview('')} />
                    ) : (
                        <span className="text-2xl font-bold text-white">{avatarLetter}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold text-[#111] truncate">{user?.fullname || '—'}</p>
                    <p className="text-sm text-[#666] font-medium mt-0.5">{displayPhone}</p>
                    {user?.office_name && <p className="text-xs text-[#999] font-medium mt-0.5 truncate">{user.office_name}</p>}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-black/5">
                {/* Edit Profile */}
                <button
                    onClick={() => openModal('profile')}
                    className="w-full flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 active:bg-[#f8f8f8] transition-colors text-left min-h-[60px]"
                >
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                        <User size={18} className="text-[#378ADD]" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-[#111] text-sm">Profilni tahrirlash</p>
                        <p className="text-xs text-[#999] font-medium mt-0.5">Ism, telefon, salon nomi</p>
                    </div>
                    <ChevronRight size={16} className="text-[#bbb]" />
                </button>

                {/* Edit Working Hours */}
                <button
                    onClick={() => openModal('hours')}
                    className="w-full flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 active:bg-[#f8f8f8] transition-colors text-left min-h-[60px]"
                >
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                        <Clock size={18} className="text-[#378ADD]" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-[#111] text-sm">Ish vaqtini tahrirlash</p>
                        <p className="text-xs text-[#999] font-medium mt-0.5">{user?.working_hours || 'Belgilanmagan'}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#bbb]" />
                </button>

                <button
                    onClick={() => navigate('/barber/change-phone')}
                    className="w-full flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 active:bg-[#f8f8f8] transition-colors text-left min-h-[60px]"
                >
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                        <Phone size={18} className="text-[#378ADD]" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-[#111] text-sm">Telefon raqamini o'zgartirish</p>
                        <p className="text-xs text-[#999] font-medium mt-0.5">{user?.phone || 'Raqam kiritilmagan'}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#bbb]" />
                </button>

                {/* Edit Lunch Hours */}
                <button
                    onClick={() => openModal('lunch')}
                    className="w-full flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5 active:bg-[#f8f8f8] transition-colors text-left min-h-[60px]"
                >
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                        <Coffee size={18} className="text-[#378ADD]" />
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-[#111] text-sm">Tushlik vaqtini tahrirlash</p>
                        <p className="text-xs text-[#999] font-medium mt-0.5">{user?.lunch_break || user?.lunchBreak || 'Belgilanmagan'}</p>
                    </div>
                    <ChevronRight size={16} className="text-[#bbb]" />
                </button>

            </div>

            {/* Telegram Notifications */}
            <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="flex items-center gap-4 px-5 sm:px-6 py-4 sm:py-5">
                    <div className="w-10 h-10 rounded-2xl bg-[#EBF4FF] flex items-center justify-center shrink-0">
                        <Send size={18} className="text-[#378ADD]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#111] text-sm">{t('barber.settings.telegram')}</p>
                        <p className="text-xs font-medium mt-0.5">
                            {user?.telegram_chat_id ? (
                                <span className="text-green-600">✅ Ulangan</span>
                            ) : (
                                <span className="text-[#999]">Ulanmagan</span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="px-5 sm:px-6 pb-5">
                    <p className="text-xs text-[#666] font-medium leading-relaxed mb-3">
                        {t('barber.settings.telegramInstructions')}
                    </p>
                    <a
                        href="https://t.me/BarberUp_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 h-11 bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-sm rounded-2xl transition-all shadow-[0_8px_20px_rgba(55,138,221,0.2)] active:scale-[0.98]"
                    >
                        <ExternalLink size={15} />
                        @BarberUp_bot ni ochish
                    </a>
                </div>
            </div>

            <LanguageSelector />

            {/* Logout */}
            <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-4 sm:py-3.5 font-bold text-red-500 border border-red-100 rounded-2xl hover:bg-red-50 active:scale-[0.98] transition-all cursor-pointer min-h-[48px]"
            >
                <LogOut size={18} />
                {t('common.logOut')}
            </button>

            {/* ── Modals ── */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={closeModal}>
                    <div
                        className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full max-w-md p-6 shadow-2xl animate-slideUp"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-[#111]">
                                {modal === 'profile' ? 'Profilni tahrirlash' : modal === 'hours' ? 'Ish vaqti' : 'Tushlik vaqti'}
                            </h2>
                            <button onClick={closeModal} className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center active:bg-[#eee] transition-colors">
                                <X size={18} className="text-[#666]" />
                            </button>
                        </div>

                        {/* Profile Modal */}
                        {modal === 'profile' && (
                            <div className="space-y-4">
                                {/* Avatar */}
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-[#378ADD] flex items-center justify-center shrink-0 overflow-hidden">
                                        {profilePreview ? (
                                            <img src={profilePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-bold text-white">{avatarLetter}</span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-[#666] uppercase tracking-wider mb-1">Profil rasmi</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files[0];
                                                if (file) { setProfileFile(file); setProfilePreview(URL.createObjectURL(file)); }
                                            }}
                                            className="text-xs text-[#666] file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#378ADD] file:text-white file:min-h-[36px] file:cursor-pointer hover:file:bg-[#185FA5]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">To'liq ism</label>
                                    <input type="text" value={fullname} onChange={e => setFullname(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Telefon</label>
                                    <div className="flex items-center bg-[#f8f8f8] rounded-2xl px-4 border border-black/5 h-12">
                                        <span className="text-[#111] font-medium text-sm">+998</span>
                                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full ml-2 text-sm text-[#111] bg-transparent outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Salon nomi</label>
                                    <input type="text" value={officeName} onChange={e => setOfficeName(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Salon suratlari (maksimal 3 ta)</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {[
                                            { num: 1, preview: photo1Preview, setFile: setPhoto1File, setPreview: setPhoto1Preview },
                                            { num: 2, preview: photo2Preview, setFile: setPhoto2File, setPreview: setPhoto2Preview },
                                            { num: 3, preview: photo3Preview, setFile: setPhoto3File, setPreview: setPhoto3Preview },
                                        ].map((slot) => (
                                            <div key={slot.num} className="relative aspect-square rounded-2xl border border-black/5 bg-[#f8f8f8] flex flex-col items-center justify-center overflow-hidden hover:bg-black/5 transition-all cursor-pointer">
                                                {slot.preview ? (
                                                    <>
                                                        <img src={slot.preview} alt={`Salon photo ${slot.num}`} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                slot.setFile(null);
                                                                slot.setPreview('');
                                                            }}
                                                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-[10px]"
                                                        >
                                                            ×
                                                        </button>
                                                    </>
                                                ) : (
                                                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                                                        <span className="text-[20px] font-medium text-[#aaa]">+</span>
                                                        <span className="text-[9px] font-bold text-[#aaa] uppercase tracking-wider">Rasm {slot.num}</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={e => {
                                                                const file = e.target.files[0];
                                                                if (file) {
                                                                    slot.setFile(file);
                                                                    slot.setPreview(URL.createObjectURL(file));
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Working Hours Modal */}
                        {modal === 'hours' && (
                            <div className="space-y-4">
                                <p className="text-sm text-[#666] font-medium">Kunlik ish vaqtini belgilang</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Boshlanish</label>
                                        <input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all text-center" />
                                    </div>
                                    <span className="text-[#666] font-bold mt-6">—</span>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Tugash</label>
                                        <input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all text-center" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lunch Hours Modal */}
                        {modal === 'lunch' && (
                            <div className="space-y-4">
                                <p className="text-sm text-[#666] font-medium">Tushlik tanaffusi vaqtini belgilang</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Boshlanish</label>
                                        <input type="time" value={lunchStart} onChange={e => setLunchStart(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all text-center" />
                                    </div>
                                    <span className="text-[#666] font-bold mt-6">—</span>
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">Tugash</label>
                                        <input type="time" value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} className="w-full h-12 px-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-[#111] font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/40 focus:bg-white transition-all text-center" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Feedback */}
                        {error && <p className="text-red-500 text-sm font-semibold mt-3">{error}</p>}
                        {success && (
                            <div className="flex items-center gap-2 text-emerald-600 mt-3 text-sm font-semibold">
                                <Check size={16} /> {success}
                            </div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={modal === 'profile' ? handleSaveProfile : modal === 'hours' ? handleSaveHours : handleSaveLunch}
                            disabled={loading}
                            className="w-full h-12 sm:h-11 mt-5 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-50 shadow-[0_10px_25px_rgba(55,138,221,0.25)] cursor-pointer min-h-[48px]"
                        >
                            {loading ? 'Saqlanmoqda...' : 'Saqlash'}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

export default Settings;
