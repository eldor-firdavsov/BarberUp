import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getBookingByIdAndPhone, updateBookingStatus } from '../../api/bookingApi.js';
import { fromDbStatus } from '../../utils/bookingStatus.js';
import { submitReview } from '../../api/reviewApi.js';
import { t } from '../../utils/i18n.js';
import { Calendar, Star, CheckCircle, AlertCircle, Phone, MapPin, RefreshCw, FileText, Clock, XCircle } from 'lucide-react';
import InteractiveMap from '../../components/InteractiveMap.jsx';
import { formatBookingDate } from '../../utils/dates.js';
import { formatTo24h } from '../../utils/time.js';
import { supabase } from '../../api/supabase.js';
import { AppHeader, Button, Card } from '../../components/ui/index.js';
import RescheduleSheet from '../../components/RescheduleSheet.jsx';
import PageContainer from '../../components/layout/PageContainer.jsx';
import { isBookingExpired } from '../../utils/autoExpire.js';

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
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [countdown, setCountdown] = useState(null);

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
    }, [booking?.status, verified, phone]);

    // Countdown timer for pending bookings (15 min)
    useEffect(() => {
        if (booking?.status !== 'pending' || !booking?.created_at) return;

        const TIMEOUT_MS = 15 * 60 * 1000;
        const created = new Date(booking.created_at);
        if (isNaN(created.getTime())) return;

        const expiresAt = created.getTime() + TIMEOUT_MS;

        const tick = () => {
            const remaining = Math.max(0, expiresAt - Date.now());
            if (remaining > 0) {
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
            } else {
                setCountdown(null);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [booking?.status, booking?.created_at]);

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
        return <div className="min-h-screen bg-[var(--bg-base)] p-4 max-w-lg mx-auto space-y-4"><div className="h-32 skeleton rounded-[var(--radius-card)]" /></div>;
    }

    if (!verified) {
        return (
            <PageContainer
                hasHeader={false}
                hasBottomNav={false}
                className="flex items-center justify-center p-6"
            >
                <Card className="w-full max-w-md p-6">
                    <div className="text-center mb-6">
                        <Phone size={28} className="text-[var(--brand-primary)] mx-auto mb-3" />
                        <h2 className="text-xl font-bold">{t('guest.trackTitle')}</h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('guest.phoneVerify')}</p>
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); if (phone.trim()) loadBooking(phone); }} className="space-y-4">
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+998 XX XXX XX XX"
                            className="w-full h-14 px-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] text-center font-bold tracking-wide"
                        />
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-[var(--radius-md)] flex items-center justify-center gap-2">
                                <AlertCircle size={14} />{error}
                            </div>
                        )}
                        <Button type="submit" className="w-full" disabled={!phone.trim()}>{t('guest.verify')}</Button>
                    </form>
                </Card>
            </PageContainer>
        );
    }

    if (!booking) return null;

    const status = booking.status?.toLowerCase();
    const notice = {
        rejected: t('client.bookingStatus.rejectedNotice'),
        cancelled: t('client.bookingStatus.cancelledNotice'),
        pending: t('client.bookingStatus.pendingNotice'),
    }[status];

    return (
        <PageContainer
            hasHeader={true}
            hasBottomNav={false}
            className="max-w-lg mx-auto flex flex-col"
        >
            <AppHeader title={t('guest.trackTitle')} subtitle={`#${booking.id?.slice(0, 8)?.toUpperCase()}`} />

            <div className="p-4 space-y-4 pb-8">
                <Card className="p-6 text-center">
                    <p className="appointment-time text-4xl">{formatTo24h(booking.booking_hours)}</p>
                    <p className="text-sm font-semibold text-[var(--text-secondary)] mt-1 flex items-center justify-center gap-1.5">
                        <Calendar size={14} />
                        {formatBookingDate(booking.booking_date, { style: 'full' })}
                    </p>
                    {notice && (
                        <p className={`text-xs mt-4 px-3 py-2 rounded-[var(--radius-md)] ${
                            status === 'rejected' || status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]'
                        }`}>{notice}</p>
                    )}
                </Card>

                <Card className="p-5 space-y-4">
                    <div>
                        <h3 className="font-bold">{booking.barberData?.office_name || 'Saloon'}</h3>
                        <p className="text-sm text-[var(--text-secondary)]">{booking.barberData?.fullname}</p>
                        {booking.barberData?.phone && (
                            <a href={`tel:${booking.barberData.phone}`} className="text-xs text-[var(--brand-primary)] flex items-center gap-1 mt-1">
                                <Phone size={11} /> {booking.barberData.phone}
                            </a>
                        )}
                    </div>
                    {booking.barberData?.address && (
                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                            <MapPin size={12} className="text-[var(--brand-primary)]" />
                            {booking.barberData.address}
                        </p>
                    )}
                    <InteractiveMap
                        coordinates={booking.barberData?.location}
                        address={booking.barberData?.address || t('client.barbershopDetails.addressNotProvided')}
                        shopName={booking.barberData?.office_name}
                    />
                </Card>

                {/* Pending countdown timer */}
                {status === 'pending' && countdown && (
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-amber-50 flex items-center justify-center shrink-0">
                                <Clock size={18} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-700">{t('booking.countdown')}</p>
                                <p className="text-xs text-amber-600 font-mono mt-0.5">{countdown}</p>
                            </div>
                        </div>
                    </Card>
                )}
                {status === 'pending' && !countdown && booking?.created_at && (
                    <Card className="p-4 border-red-100 bg-red-50">
                        <div className="flex items-center gap-3">
                            <XCircle size={18} className="text-red-500 shrink-0" />
                            <p className="text-sm font-semibold text-red-700">{t('booking.countdownExpired')}</p>
                        </div>
                    </Card>
                )}

                {/* Notes display */}
                {booking.notes && (
                    <Card className="p-4">
                        <div className="flex items-start gap-3">
                            <FileText size={16} className="text-[var(--text-tertiary)] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">{t('booking.notes')}</p>
                                <p className="text-sm text-[var(--text-primary)]">{booking.notes}</p>
                            </div>
                        </div>
                    </Card>
                )}

                {(status === 'pending' || status === 'accepted') && (
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setRescheduleOpen(true)}>
                            <RefreshCw size={14} className="mr-1.5" />
                            {t('booking.reschedule')}
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={handleCancel} disabled={cancelLoading}>
                            {cancelLoading ? t('common.pleaseWait') : t('common.cancel')}
                        </Button>
                    </div>
                )}

                <RescheduleSheet
                    booking={booking}
                    barber={booking.barberData}
                    isOpen={rescheduleOpen}
                    onClose={() => setRescheduleOpen(false)}
                    onSuccess={(updated) => {
                        setBooking(updated);
                        setRescheduleOpen(false);
                    }}
                />

                {status === 'completed' && (
                    <Card className="p-5 space-y-4">
                        <h3 className="font-bold text-center">{t('review.title')}</h3>
                        {reviewSuccess ? (
                            <div className="text-center py-4">
                                <CheckCircle className="text-emerald-500 mx-auto mb-2" size={32} />
                                <p className="text-sm font-bold text-emerald-700">{t('review.thankYou')}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleReviewSubmit} className="space-y-4">
                                <div className="flex justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <button key={star} type="button" onClick={() => setRating(star)} className="p-2">
                                            <Star size={28} className={star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'} />
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder={t('review.placeholder')}
                                    className="w-full p-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm resize-none h-24"
                                />
                                <Button type="submit" className="w-full" disabled={reviewLoading}>
                                    {reviewLoading ? t('common.pleaseWait') : t('review.submit')}
                                </Button>
                            </form>
                        )}
                    </Card>
                )}

                <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                    {t('layout.barber.home')}
                </Button>
            </div>
        </PageContainer>
    );
}

export default TrackBooking;
