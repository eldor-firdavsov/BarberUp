import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ChevronLeft, Bell, ExternalLink, Star, MapPin, Phone } from 'lucide-react';
import { supabase } from '../../api/supabase.js';
import { normalizeBooking, updateBookingStatus } from '../../api/bookingApi.js';
import { formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, formatBookingDate } from '../../utils/dates.js';
import { submitReview } from '../../api/reviewApi.js';
import { t } from '../../utils/i18n.js';

const STEPS = ['pending', 'accepted', 'completed'];

function StatusStepper({ status }) {
    const isCancelled = status === 'cancelled' || status === 'rejected';
    const currentStep = STEPS.indexOf(status);

    if (isCancelled) {
        return (
            <div className="flex items-center justify-center gap-2 py-3">
                <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                    <XCircle size={14} />
                    <span>{status === 'rejected' ? 'Rad etildi' : 'Bekor qilindi'}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center gap-0 py-4 px-2">
            {STEPS.map((step, idx) => {
                const done = idx < currentStep;
                const active = idx === currentStep;
                const labels = { pending: 'Kutilmoqda', accepted: 'Tasdiqlandi', completed: 'Yakunlandi' };
                return (
                    <div key={step} className="flex items-center">
                        <div className="flex flex-col items-center gap-1.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                done ? 'bg-[#378ADD] border-[#378ADD]' :
                                active ? 'bg-white border-[#378ADD] shadow-[0_0_0_4px_rgba(55,138,221,0.15)]' :
                                'bg-white border-black/10'
                            }`}>
                                {done ? (
                                    <CheckCircle size={16} className="text-white" />
                                ) : active ? (
                                    <div className="w-3 h-3 rounded-full bg-[#378ADD]" />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
                                )}
                            </div>
                            <span className={`text-[9px] font-bold tracking-wide whitespace-nowrap ${
                                done || active ? 'text-[#378ADD]' : 'text-[#aaa]'
                            }`}>
                                {labels[step]}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`w-14 sm:w-20 h-0.5 mb-5 mx-1 transition-all duration-500 ${
                                idx < currentStep ? 'bg-[#378ADD]' : 'bg-black/8'
                            }`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function BookingStatus() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Review state
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const { data, error: fetchErr } = await supabase
                .from('bookings')
                .select('*, barbers(id, fullname, office_name, profile_img, address, phone)')
                .eq('id', id)
                .maybeSingle();

            if (fetchErr || !data) { setError(t('client.bookingStatus.notFoundError')); return; }
            setBooking(normalizeBooking(data));
        } catch {
            setError(t('client.bookingStatus.notFoundError'));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    useEffect(() => {
        if (!id) return;
        const channel = supabase
            .channel(`booking-status-${id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
                (payload) => {
                    if (payload.new) {
                        setBooking(prev => prev ? normalizeBooking({ ...prev, ...payload.new, barbers: prev.barbers }) : null);
                    }
                }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [id]);

    const intervalRef = useRef(null);
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (booking?.status === 'pending') fetchStatus();
        }, 5000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [booking?.status, fetchStatus]);

    const handleCancel = async () => {
        if (!booking) return;
        setCancelLoading(true);
        const { data, error: cancelErr } = await updateBookingStatus(booking.id, { status: 'cancelled', cancelled_by: 'client' });
        if (!cancelErr && data) setBooking(normalizeBooking({ ...booking, ...data, barbers: booking.barbers }));
        setCancelLoading(false);
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!booking) return;
        setReviewLoading(true);
        const barber = booking.barbers ?? booking.barberData;
        const { error: reviewErr } = await submitReview({
            barber_id: barber?.id || booking.barber,
            booking_id: booking.id,
            rating, comment,
            guest_phone: booking.guest_phone,
        });
        if (!reviewErr) setReviewSuccess(true);
        setReviewLoading(false);
    };

    if (loading && !booking) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6">
                <div className="w-12 h-12 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mb-4" />
                <p className="text-[#666] font-medium text-sm">{t('client.bookingStatus.loading')}</p>
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-white border border-black/5 rounded-[28px] flex items-center justify-center mb-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">
                    <XCircle className="text-[#999]" size={32} />
                </div>
                <h2 className="text-[22px] font-bold text-[#111] tracking-[-0.02em] mb-2">{t('client.bookingStatus.notFoundTitle')}</h2>
                <p className="text-[#666] font-medium text-sm mb-8">{t('client.bookingStatus.notFoundDesc')}</p>
                <button
                    onClick={() => navigate('/client/dashboard')}
                    className="h-14 px-8 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all"
                >
                    {t('client.bookingStatus.backHome')}
                </button>
            </div>
        );
    }

    const status = booking.status?.toLowerCase();
    const time = formatTo24h(booking.booking_hours);
    const barber = booking.barbers ?? booking.barberData ?? null;
    const barberName = barber?.office_name || barber?.fullname || t('common.theBarber');

    const themeMap = {
        pending:   { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: <Clock className="text-amber-500" size={36} />,        iconBg: 'bg-amber-100',   title: 'Tasdiqlash kutilmoqda', subtitle: `${barberName} qabul qilishini kuting. Telegram orqali xabar keladi.` },
        accepted:  { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle className="text-emerald-500" size={36} />, iconBg: 'bg-emerald-100', title: '✅ Navbat tasdiqlandi!',   subtitle: `${barberName} sizni kutmoqda.` },
        rejected:  { bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="text-red-400" size={36} />,        iconBg: 'bg-red-100',     title: '❌ Navbat rad etildi',   subtitle: 'Boshqa vaqtni tanlab, qayta bron qiling.' },
        cancelled: { bg: 'bg-gray-50',    border: 'border-gray-200',    icon: <XCircle className="text-gray-400" size={36} />,       iconBg: 'bg-gray-100',    title: 'Bron bekor qilindi',    subtitle: 'Xohlasangiz yangi bron qilishingiz mumkin.' },
        completed: { bg: 'bg-[#EBF4FF]',  border: 'border-[#378ADD]/20', icon: <CheckCircle className="text-[#378ADD]" size={36} />, iconBg: 'bg-[#378ADD]/10', title: '🎉 Xizmat yakunlandi!', subtitle: `${barberName}ga baho qoldirishni unutmang!` },
    };
    const theme = themeMap[status] ?? themeMap.pending;

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col px-4 py-8 sm:px-6 page-animate max-w-lg mx-auto">
            <button
                onClick={() => navigate('/client/dashboard')}
                className="self-start mb-6 flex items-center gap-2 text-[#666] font-semibold text-sm hover:text-[#111] transition-colors"
            >
                <ChevronLeft size={18} /> {t('common.home')}
            </button>

            {/* Status Hero */}
            <div className={`${theme.bg} border ${theme.border} rounded-[28px] p-6 mb-4 flex flex-col items-center text-center gap-4`}>
                <div className={`w-20 h-20 ${theme.iconBg} rounded-[24px] flex items-center justify-center ${status === 'pending' ? 'animate-pulse' : ''}`}>
                    {theme.icon}
                </div>
                <div>
                    <h1 className="text-xl font-bold text-[#111] tracking-[-0.02em]">{theme.title}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1 leading-relaxed">{theme.subtitle}</p>
                </div>

                {/* Stepper */}
                <StatusStepper status={status} />
            </div>

            {/* Telegram hint */}
            {status === 'pending' && (
                <div className="bg-white border border-[#378ADD]/15 rounded-[24px] p-5 flex flex-col gap-3 mb-4">
                    <div className="flex items-start gap-3">
                        <Bell size={18} className="text-[#378ADD] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#185FA5] font-medium leading-relaxed">
                            {t('client.bookingStatus.telegramHint')}
                        </p>
                    </div>
                    <a
                        href="https://t.me/BarberUp_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-xs font-bold text-[#378ADD] bg-[#EBF4FF] border border-[#378ADD]/20 rounded-xl py-3 hover:bg-[#378ADD] hover:text-white transition-all"
                    >
                        <ExternalLink size={14} />
                        {t('client.bookingStatus.connectBot')}
                    </a>
                </div>
            )}

            {/* Booking Details Card */}
            <div className="bg-white rounded-[28px] p-6 border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] mb-4">
                <p className="text-[10px] font-bold text-[#888] uppercase tracking-[0.12em] mb-4">{t('client.bookingStatus.detailsTitle')}</p>

                <div className="flex items-center gap-4 mb-5 pb-5 border-b border-black/5">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#378ADD]/15 to-[#185FA5]/10 border border-[#378ADD]/10 rounded-2xl flex items-center justify-center shrink-0">
                        <span className="text-[#378ADD] font-bold text-lg">
                            {(barber?.fullname || 'B').charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-[#111] truncate">{barber?.office_name || t('common.barbershop')}</h3>
                        <p className="text-sm text-[#666] font-medium">{barber?.fullname || t('common.barber')}</p>
                        {barber?.phone && (
                            <a href={`tel:${barber.phone}`} className="text-xs text-[#378ADD] font-semibold flex items-center gap-1 mt-0.5 hover:underline">
                                <Phone size={11} /> {barber.phone}
                            </a>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5 pb-5 border-b border-black/5">
                    <div>
                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('client.bookingStatus.service')}</p>
                        <p className="font-bold text-[#111] text-sm">{booking.service_name || t('common.defaultHaircut')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('client.bookingStatus.price')}</p>
                        <p className="font-bold text-[#111] text-sm">
                            {booking.service_price ? `${Number(booking.service_price).toLocaleString()} ${t('common.uzs')}` : t('common.dash')}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('common.time')}</p>
                        <p className="font-bold text-[#111] text-xl">{time}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-[#888] font-semibold uppercase tracking-[0.1em] mb-1">{t('common.date')}</p>
                        <p className="font-bold text-[#111] text-sm leading-tight">
                            {formatBookingDate(getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10))}
                        </p>
                    </div>
                </div>

                {status === 'accepted' && barber?.address && (
                    <div className="mt-4 pt-4 border-t border-black/5">
                        <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(barber.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-[#378ADD] font-semibold hover:underline"
                        >
                            <MapPin size={13} />
                            {barber.address}
                        </a>
                    </div>
                )}
            </div>

            {/* Cancel button */}
            {(status === 'pending' || status === 'accepted') && (
                <button
                    onClick={handleCancel}
                    disabled={cancelLoading}
                    className="w-full py-3.5 mb-4 bg-red-50 hover:bg-red-100 text-red-500 font-bold border border-red-100 rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.97] disabled:opacity-50"
                >
                    {cancelLoading ? t('common.pleaseWait') : t('common.cancel')}
                </button>
            )}

            {/* Inline Review form */}
            {status === 'completed' && (
                <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] mb-4 space-y-4">
                    <h3 className="font-bold text-[#111] text-base text-center">Baho qoldiring ⭐</h3>
                    {reviewSuccess ? (
                        <div className="text-center py-4 space-y-2">
                            <CheckCircle className="text-emerald-500 mx-auto" size={32} />
                            <p className="text-sm font-bold text-emerald-700">{t('review.thankYou')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                            <div className="flex justify-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className="p-2 min-w-[48px] min-h-[48px] flex items-center justify-center focus:outline-none transition-transform active:scale-90"
                                    >
                                        <Star
                                            size={30}
                                            className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}
                                        />
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder={t('review.placeholder')}
                                className="w-full p-4 bg-[#f8f8f8] border border-black/5 rounded-2xl text-xs font-semibold outline-none resize-none h-24 focus:border-[#185FA5]/30 focus:bg-white"
                            />
                            <button
                                type="submit"
                                disabled={reviewLoading}
                                className="w-full py-3.5 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-sm transition-all active:scale-95 disabled:opacity-50"
                            >
                                {reviewLoading ? t('common.pleaseWait') : t('review.submit')}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Book again for rejected/cancelled */}
            {(status === 'rejected' || status === 'cancelled') && barber?.id && (
                <button
                    onClick={() => navigate(`/client/book/${barber.id}`)}
                    className="w-full h-14 rounded-2xl bg-[#378ADD] hover:bg-[#185FA5] text-white font-semibold text-[15px] transition-all shadow-[0_10px_25px_rgba(55,138,221,0.25)] mb-4"
                >
                    Qayta bron qilish
                </button>
            )}

            {status !== 'pending' && (
                <button
                    onClick={() => navigate('/client/dashboard')}
                    className="w-full h-14 rounded-2xl border border-black/5 bg-white hover:bg-[#f8f8f8] text-[#111] font-semibold text-[15px] transition-all"
                >
                    {t('client.bookingStatus.backHome')}
                </button>
            )}
        </div>
    );
}

export default BookingStatus;
