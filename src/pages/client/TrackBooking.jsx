import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getBookingByIdAndPhone, updateBookingStatus } from '../../api/bookingApi.js';
import { fromDbStatus } from '../../utils/bookingStatus.js';
import { submitReview } from '../../api/reviewApi.js';
import { t } from '../../utils/i18n.js';
import { Clock, MapPin, Calendar, Star, CheckCircle, AlertCircle, XCircle, Phone, Zap } from 'lucide-react';
import InteractiveMap from '../../components/InteractiveMap.jsx';
import { formatBookingDate } from '../../utils/dates.js';
import { supabase } from '../../api/supabase.js';

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
                const labels = { pending: 'Yuborildi', accepted: 'Tasdiqlandi', completed: 'Yakunlandi' };
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
                                    <div className={`w-3 h-3 rounded-full bg-[#378ADD] ${step === 'pending' ? 'animate-pulse' : ''}`} />
                                ) : (
                                    <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
                                )}
                            </div>
                            <span className={`text-[9px] font-bold tracking-wide whitespace-nowrap ${done || active ? 'text-[#378ADD]' : 'text-[#aaa]'}`}>
                                {labels[step]}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`w-12 sm:w-16 h-0.5 mb-5 mx-1 transition-all duration-700 ${idx < currentStep ? 'bg-[#378ADD]' : 'bg-black/8'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ── Live countdown for accepted bookings ──────────────────────────────────── */
function Countdown({ bookingDate, bookingHours }) {
    const [label, setLabel] = useState('');

    useEffect(() => {
        const calc = () => {
            if (!bookingDate || !bookingHours) return;
            const [h, m] = bookingHours.split(':').map(Number);
            const appt = new Date(bookingDate);
            appt.setHours(h, m, 0, 0);
            const diff = appt - Date.now();
            if (diff <= 0) { setLabel('Vaqt keldi!'); return; }
            const totalMins = Math.floor(diff / 60000);
            const hours = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            if (hours > 0) setLabel(`${hours}s ${mins}d qoldi`);
            else setLabel(`${mins} daqiqa qoldi`);
        };
        calc();
        const iv = setInterval(calc, 30000);
        return () => clearInterval(iv);
    }, [bookingDate, bookingHours]);

    if (!label) return null;
    return (
        <div className="flex items-center justify-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl py-3 px-5">
            <Zap size={15} className="text-emerald-500 shrink-0" />
            <span className="text-emerald-700 font-bold text-sm">{label}</span>
        </div>
    );
}

function TrackBooking() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [phone, setPhone] = useState(searchParams.get('phone') || '');
    const [verified, setVerified] = useState(!!searchParams.get('phone'));
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);

    const loadBooking = async (phoneVal) => {
        setLoading(true);
        setError('');
        try {
            const { data, error: fetchErr } = await getBookingByIdAndPhone(id, phoneVal.replace(/\s/g, ''));
            if (fetchErr || !data) setError(t('guest.bookingNotFound'));
            else { setBooking(data); setVerified(true); }
        } catch {
            setError(t('guest.bookingNotFound'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (verified && phone) loadBooking(phone); }, [id, verified]);

    useEffect(() => {
        if (!id || !verified) return;
        const channel = supabase
            .channel(`track-booking-${id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
                (payload) => {
                    if (payload.new) {
                        setBooking(prev => prev ? {
                            ...prev, ...payload.new,
                            status: fromDbStatus(payload.new.status ?? prev.status),
                        } : prev);
                    }
                }
            )
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [id, verified]);

    const pollRef = useRef(null);
    useEffect(() => {
        if (!verified || !phone) return;
        pollRef.current = setInterval(() => {
            if (booking?.status === 'pending') loadBooking(phone);
        }, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booking?.status, verified, phone]);

    const handleCancel = async () => {
        if (!booking) return;
        setCancelLoading(true);
        const { data, error: cancelErr } = await updateBookingStatus(booking.id, { status: 'cancelled', cancelled_by: 'client' });
        if (!cancelErr && data) setBooking(data);
        setCancelLoading(false);
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!booking) return;
        setReviewLoading(true);
        const { error: reviewErr } = await submitReview({
            barber_id: booking.barber,
            booking_id: booking.id,
            rating, comment,
            guest_phone: booking.guest_phone,
        });
        if (!reviewErr) setReviewSuccess(true);
        setReviewLoading(false);
    };

    if (loading && !booking) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 max-w-lg mx-auto space-y-4 page-animate">
                <div className="h-16 w-1/2 mx-auto skeleton rounded-xl mb-6" />
                <div className="h-32 w-full skeleton rounded-[28px]" />
                <div className="h-64 w-full skeleton rounded-[28px]" />
                <div className="h-14 w-full skeleton rounded-2xl" />
            </div>
        );
    }

    // Phone Verification screen
    if (!verified) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 page-animate">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-[#378ADD]/10 rounded-[20px] flex items-center justify-center mx-auto mb-4">
                            <Phone size={28} className="text-[#378ADD]" />
                        </div>
                        <h2 className="text-2xl font-black text-[#111] tracking-tight mb-2">{t('guest.trackTitle')}</h2>
                        <p className="text-sm text-[#666] font-medium">{t('guest.phoneVerify')}</p>
                    </div>

                    <div className="bg-white border border-black/5 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                        <form onSubmit={(e) => { e.preventDefault(); if (phone.trim()) loadBooking(phone); }} className="space-y-4">
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+998 XX XXX XX XX"
                                className="w-full h-16 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-lg font-bold outline-none text-center tracking-widest focus:border-[#378ADD]/30 focus:ring-2 focus:ring-[#378ADD]/10"
                            />

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 text-center flex items-center justify-center gap-2">
                                    <AlertCircle size={14} />{error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={!phone.trim()}
                                className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-base transition-all duration-200 active:scale-[0.97] disabled:opacity-40 shadow-[0_10px_25px_rgba(55,138,221,0.25)]"
                            >
                                {t('guest.verify')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (!booking) return null;

    const statusBg = {
        pending:   'bg-amber-50 border-amber-200',
        accepted:  'bg-emerald-50 border-emerald-200',
        completed: 'bg-[#EBF4FF] border-[#378ADD]/20',
        cancelled: 'bg-red-50 border-red-100',
        rejected:  'bg-gray-50 border-gray-200',
    }[booking.status] || 'bg-amber-50 border-amber-200';

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 max-w-lg mx-auto space-y-4 page-animate pb-24">

            {/* Header */}
            <div className="text-center pt-2">
                <h1 className="text-2xl font-black text-[#111] tracking-tight">{t('guest.trackTitle')}</h1>
                <p className="text-xs text-[#999] font-mono mt-1"># {booking.id?.slice(0, 8)?.toUpperCase()}</p>
            </div>

            {/* Status + Stepper Hero */}
            <div className={`${statusBg} border rounded-[28px] p-6 flex flex-col items-center gap-3`}>
                <StatusStepper status={booking.status} />
                {booking.status === 'accepted' && (
                    <Countdown bookingDate={booking.booking_date} bookingHours={booking.booking_hours} />
                )}
            </div>

            {/* Main Booking Info Card */}
            <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.04)] space-y-5">

                {/* Barber header */}
                <div className="flex items-center gap-3.5 pb-4 border-b border-black/5">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#378ADD]/15 to-[#185FA5]/10 text-[#378ADD] rounded-2xl flex items-center justify-center shrink-0 border border-[#378ADD]/10">
                        <span className="font-extrabold text-lg">{(booking.barberData?.fullname || 'B').charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[#111] truncate">{booking.barberData?.office_name || 'Saloon'}</h3>
                        <p className="text-xs text-[#666] font-semibold mt-0.5">{booking.barberData?.fullname}</p>
                        {booking.barberData?.phone && (
                            <a href={`tel:${booking.barberData.phone}`} className="text-xs text-[#378ADD] font-semibold flex items-center gap-1 mt-0.5 hover:underline">
                                <Phone size={10} /> {booking.barberData.phone}
                            </a>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[#555] font-semibold text-sm">
                        <Calendar size={16} className="text-[#888] shrink-0" />
                        <span>{formatBookingDate(booking.booking_date, { style: 'full' })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#555] font-semibold text-sm">
                        <Clock size={16} className="text-[#888] shrink-0" />
                        <span className="font-bold text-[#111] text-lg">{booking.booking_hours}</span>
                    </div>
                </div>

                {/* Map integration */}
                <div className="border-t border-black/5 pt-4">
                    <InteractiveMap
                        coordinates={booking.barberData?.location}
                        address={booking.barberData?.address || booking.barberData?.location?.address || t('client.barbershopDetails.addressNotProvided')}
                        shopName={booking.barberData?.office_name}
                    />
                </div>

                {/* Status badge */}
                <div className="border-t border-black/5 pt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#888] uppercase tracking-wider">Holati</span>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider ${
                        {
                            pending:   'bg-amber-50 text-amber-600 border-amber-100',
                            accepted:  'bg-emerald-50 text-emerald-600 border-emerald-100',
                            completed: 'bg-[#EBF4FF] text-[#185FA5] border-[#378ADD]/20',
                            cancelled: 'bg-red-50 text-red-500 border-red-100',
                            rejected:  'bg-gray-50 text-gray-500 border-gray-200',
                        }[booking.status] || 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                        {t(`status.${booking.status}`)}
                    </div>
                </div>

                {/* Cancel button */}
                {(booking.status === 'pending' || booking.status === 'accepted') && (
                    <button
                        onClick={handleCancel}
                        disabled={cancelLoading}
                        className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-500 font-bold border border-red-100 rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-[0.97] disabled:opacity-50"
                    >
                        {cancelLoading ? t('common.pleaseWait') : t('common.cancel')}
                    </button>
                )}
            </div>

            {/* Review form */}
            {booking.status === 'completed' && (
                <div className="bg-white border border-black/5 rounded-[28px] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.04)] space-y-4">
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
                                        <Star size={30} className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
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

            {/* Back button */}
            <button
                onClick={() => navigate('/')}
                className="w-full py-4 bg-white border border-black/5 hover:bg-[#f8f8f8] text-[#111] font-bold rounded-2xl text-xs uppercase tracking-wider transition-all active:scale-95"
            >
                {t('layout.barber.home')}
            </button>
        </div>
    );
}

export default TrackBooking;
