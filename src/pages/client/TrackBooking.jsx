import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getBookingByIdAndPhone, updateBookingStatus } from '../../api/bookingApi.js';
import { fromDbStatus } from '../../utils/bookingStatus.js';
import { submitReview } from '../../api/reviewApi.js';
import { t } from '../../utils/i18n.js';
import { Clock, MapPin, Calendar, Star, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { formatBookingDate } from '../../utils/dates.js';
import { supabase } from '../../api/supabase.js';

function TrackBooking() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [phone, setPhone] = useState(searchParams.get('phone') || '');
    const [verified, setVerified] = useState(!!searchParams.get('phone'));
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Review state
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);

    // Cancel action loading
    const [cancelLoading, setCancelLoading] = useState(false);

    const loadBooking = async (phoneVal) => {
        setLoading(true);
        setError('');
        try {
            const { data, error: fetchErr } = await getBookingByIdAndPhone(id, phoneVal.replace(/\s/g, ""));
            if (fetchErr || !data) {
                setError(t('guest.bookingNotFound'));
            } else {
                setBooking(data);
                setVerified(true);
            }
        } catch (err) {
            console.error('[TRACK FETCH EXCEPTION]', err);
            setError(t('guest.bookingNotFound'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (verified && phone) {
            loadBooking(phone);
        }
    }, [id, verified]);

    // Supabase Realtime: live booking status updates (no refresh needed)
    useEffect(() => {
        if (!id || !verified) return;

        const channel = supabase
            .channel(`track-booking-${id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${id}` },
                (payload) => {
                    // Merge raw DB row — normalize status so UI stays consistent
                    if (payload.new) {
                        setBooking(prev => prev ? {
                            ...prev,
                            ...payload.new,
                            status: fromDbStatus(payload.new.status ?? prev.status),
                        } : prev);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [id, verified]);

    // Polling safety net (5 s) while pending — mirrors BookingStatus.jsx
    const pollRef = useRef(null);
    useEffect(() => {
        if (!verified || !phone) return;
        pollRef.current = setInterval(() => {
            if (booking?.status === 'pending') loadBooking(phone);
        }, 5000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booking?.status, verified, phone]);

    const handleVerifySubmit = (e) => {
        e.preventDefault();
        if (!phone.trim()) return;
        loadBooking(phone);
    };

    const handleCancel = async () => {
        if (!booking) return;
        setCancelLoading(true);
        setError('');
        try {
            const { data, error: cancelErr } = await updateBookingStatus(booking.id, {
                status: 'cancelled',
                cancelled_by: 'client'
            });
            if (cancelErr) {
                setError(cancelErr);
            } else {
                setBooking(data);
            }
        } catch (err) {
            setError('Failed to cancel booking.');
        } finally {
            setCancelLoading(false);
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!booking) return;
        setReviewLoading(true);
        try {
            const { error: reviewErr } = await submitReview({
                barber_id: booking.barber,
                booking_id: booking.id,
                rating,
                comment,
                guest_phone: booking.guest_phone,
            });
            if (reviewErr) {
                setError(reviewErr);
            } else {
                setReviewSuccess(true);
            }
        } catch (err) {
            setError('Failed to submit review.');
        } finally {
            setReviewLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <div className="w-8 h-8 border-4 border-[#378ADD] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // ── Phone Verification screen ──
    if (!verified) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 page-animate">
                <div className="w-full max-w-md bg-white border border-black/5 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
                    <h2 className="text-xl font-black text-[#111] tracking-tight text-center mb-2">{t('guest.trackTitle')}</h2>
                    <p className="text-xs text-[#666] font-medium text-center mb-6">{t('guest.phoneVerify')}</p>

                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                        <div>
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="+998 XX XXX XX XX"
                                className="w-full h-14 px-5 bg-[#f8f8f8] border border-black/5 rounded-2xl text-base font-medium outline-none text-center focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/20 min-h-[52px]"
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 text-center flex items-center justify-center gap-2">
                                <AlertCircle size={14} />{error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!phone.trim()}
                            className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-sm transition-all duration-200 active:scale-[0.97] disabled:opacity-50 min-h-[52px]"
                        >
                            {t('guest.verify')}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    if (!booking) return null;

    // Determine status badge color
    let statusColor = 'bg-yellow-50 text-yellow-600 border-yellow-100';
    let StatusIcon = Clock;
    if (booking.status === 'accepted') {
        statusColor = 'bg-blue-50 text-blue-600 border-blue-100';
        StatusIcon = CheckCircle;
    } else if (booking.status === 'completed') {
        statusColor = 'bg-green-50 text-green-600 border-green-100';
        StatusIcon = CheckCircle;
    } else if (booking.status === 'cancelled' || booking.status === 'rejected') {
        statusColor = 'bg-red-50 text-red-600 border-red-100';
        StatusIcon = XCircle;
    }

    const clientName = booking.guest_name || 'Mehmon';

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-6 max-w-md mx-auto space-y-6 page-animate pb-24 safe-bottom">

            {/* Logo or Title */}
            <div className="text-center">
                <h1 className="text-2xl font-black text-[#111] tracking-tight">{t('guest.trackTitle')}</h1>
                <p className="text-xs text-[#666] font-medium mt-1">ID: {booking.id.slice(0, 8)}...</p>
            </div>

            {/* Main Booking Info Card */}
            <div className="bg-white border border-black/5 rounded-[32px] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.04)] space-y-5">

                {/* Header: Barber profile & shop */}
                <div className="flex items-center gap-3.5 border-b border-black/5 pb-4">
                    <div className="w-12 h-12 bg-[#378ADD]/10 text-[#378ADD] rounded-2xl flex items-center justify-center shrink-0 border border-[#378ADD]/10">
                        <span className="font-extrabold text-lg">{(booking.barberData?.fullname || 'B').charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-[#111] truncate">{booking.barberData?.office_name || 'Saloon'}</h3>
                        <p className="text-xs text-[#666] font-semibold mt-0.5">{booking.barberData?.fullname}</p>
                    </div>
                </div>

                {/* Details list */}
                <div className="space-y-3.5">
                    <div className="flex items-center gap-3 text-[#555] font-medium text-sm">
                        <Calendar size={16} className="text-[#888]" />
                        <span>{formatBookingDate(booking.booking_date, { style: 'full' })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[#555] font-medium text-sm">
                        <Clock size={16} className="text-[#888]" />
                        <span>{booking.booking_hours}</span>
                    </div>
                    {booking.barberData?.address && (
                        <div className="flex items-start gap-3 text-[#555] font-medium text-sm">
                            <MapPin size={16} className="text-[#888] shrink-0 mt-0.5" />
                            <span>{booking.barberData.address}</span>
                        </div>
                    )}
                </div>

                {/* Status Badge */}
                <div className="border-t border-black/5 pt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#888] uppercase tracking-wider">Holati</span>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black uppercase tracking-wider ${statusColor}`}>
                        <StatusIcon size={12} />
                        <span>{t(`status.${booking.status}`)}</span>
                    </div>
                </div>

                {/* Cancel button if pending/accepted */}
                {(booking.status === 'pending' || booking.status === 'accepted') && (
                    <button
                        onClick={handleCancel}
                        disabled={cancelLoading}
                        className="w-full mt-4 py-4 sm:py-3.5 bg-red-50 hover:bg-red-100 text-red-500 font-bold border border-red-100 rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 active:scale-[0.97] disabled:opacity-50 min-h-[48px]"
                    >
                        {cancelLoading ? t('common.pleaseWait') : t('common.cancel')}
                    </button>
                )}
            </div>

            {/* ── Review Form (only if completed and not reviewed yet) ── */}
            {booking.status === 'completed' && (
                <div className="bg-white border border-black/5 rounded-[32px] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.04)] space-y-4">
                    <h3 className="font-bold text-[#111] text-base text-center">{t('review.title')}</h3>

                    {reviewSuccess ? (
                        <div className="text-center py-4 space-y-2">
                            <CheckCircle className="text-emerald-500 mx-auto" size={32} />
                            <p className="text-sm font-bold text-emerald-800">{t('review.thankYou')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                            {/* Stars rating selection */}
                            <div className="flex justify-center gap-2 sm:gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className="focus:outline-none transition-transform active:scale-90 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                    >
                                        <Star
                                            size={30}
                                            className={`${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                                                }`}
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

                            {error && (
                                <p className="text-xs font-bold text-red-500 text-center">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={reviewLoading}
                                className="w-full py-3.5 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 active:scale-95 disabled:opacity-50"
                            >
                                {reviewLoading ? t('common.pleaseWait') : t('review.submit')}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Back to Home CTA */}
            <button
                onClick={() => navigate('/')}
                className="w-full py-4 bg-transparent border border-black/5 hover:bg-black/5 text-[#111] font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-200 active:scale-95"
            >
                {t('layout.barber.home')}
            </button>

        </div>
    );
}

export default TrackBooking;
