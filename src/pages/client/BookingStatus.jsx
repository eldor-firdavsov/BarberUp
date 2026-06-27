import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ChevronLeft, Bell, ExternalLink, Star, MapPin, Phone, RefreshCw, FileText, Clock } from 'lucide-react';
import { supabase } from '../../api/supabase.js';
import { normalizeBooking, updateBookingStatus } from '../../api/bookingApi.js';
import { formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, formatBookingDate } from '../../utils/dates.js';
import { submitReview } from '../../api/reviewApi.js';
import { t } from '../../utils/i18n.js';
import { AppHeader, Button, Card } from '../../components/ui/index.js';
import RescheduleSheet from '../../components/RescheduleSheet.jsx';
import PageContainer from '../../components/layout/PageContainer.jsx';

function BookingStatus() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [cancelLoading, setCancelLoading] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [countdown, setCountdown] = useState(null);

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
            <div className="min-h-screen bg-[var(--bg-base)] p-4 space-y-4 max-w-lg mx-auto">
                <div className="h-32 skeleton rounded-[var(--radius-card)]" />
                <div className="h-48 skeleton rounded-[var(--radius-card)]" />
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 text-center">
                <XCircle className="text-[var(--text-tertiary)] mb-4" size={40} />
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t('client.bookingStatus.notFoundTitle')}</h2>
                <p className="text-[var(--text-secondary)] text-sm mb-6">{t('client.bookingStatus.notFoundDesc')}</p>
                <Button onClick={() => navigate('/client/dashboard')}>{t('client.bookingStatus.backHome')}</Button>
            </div>
        );
    }

    const status = booking.status?.toLowerCase();
    const time = formatTo24h(booking.booking_hours);
    const dateLabel = formatBookingDate(getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10));
    const barber = booking.barbers ?? booking.barberData ?? null;

    const noticeMap = {
        rejected: t('client.bookingStatus.rejectedNotice'),
        cancelled: t('client.bookingStatus.cancelledNotice'),
        pending: t('client.bookingStatus.pendingNotice'),
    };

    return (
        <PageContainer
            hasHeader={true}
            hasBottomNav={false}
            className="max-w-lg mx-auto flex flex-col"
        >
            <AppHeader
                title={t('client.bookingStatus.detailsTitle')}
                onBack={() => navigate('/client/bookings')}
            />

            <div className="p-4 space-y-4 flex-1 pb-8">
                {/* Appointment receipt — time first */}
                <Card className="p-6 text-center">
                    <p className="text-[var(--text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">
                        {t('common.appointmentAt', { date: dateLabel, time: '' }).replace(' · ', '')}
                    </p>
                    <p className="appointment-time text-4xl mb-1">{time}</p>
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">{dateLabel}</p>
                    {noticeMap[status] && (
                        <p className={`text-xs mt-4 px-3 py-2 rounded-[var(--radius-md)] ${
                            status === 'rejected' || status === 'cancelled'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-[var(--brand-primary-light)] text-[var(--brand-primary-dark)]'
                        }`}>
                            {noticeMap[status]}
                        </p>
                    )}
                </Card>

                {status === 'pending' && (
                    <Card className="p-4">
                        <div className="flex items-start gap-3">
                            <Bell size={18} className="text-[var(--brand-primary)] shrink-0 mt-0.5" />
                            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('client.bookingStatus.telegramHint')}</p>
                        </div>
                        <a
                            href="https://t.me/BarberUp_bot"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-[var(--brand-primary)] bg-[var(--brand-primary-light)] rounded-[var(--radius-md)] py-3"
                        >
                            <ExternalLink size={14} />
                            {t('client.bookingStatus.connectBot')}
                        </a>
                    </Card>
                )}

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

                <Card className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-[var(--brand-primary-light)] rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
                            <span className="text-[var(--brand-primary)] font-bold">
                                {(barber?.fullname || 'B').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-[var(--text-primary)] truncate">{barber?.office_name || t('common.barbershop')}</h3>
                            <p className="text-sm text-[var(--text-secondary)]">{barber?.fullname || t('common.barber')}</p>
                            {barber?.phone && (
                                <a href={`tel:${barber.phone}`} className="text-xs text-[var(--brand-primary)] flex items-center gap-1 mt-0.5">
                                    <Phone size={11} /> {barber.phone}
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)]">
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">{t('client.bookingStatus.service')}</p>
                            <p className="font-bold text-sm">{booking.service_name || t('common.defaultHaircut')}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase mb-1">{t('client.bookingStatus.price')}</p>
                            <p className="font-bold text-sm">
                                {booking.service_price ? `${Number(booking.service_price).toLocaleString()} ${t('common.uzs')}` : t('common.dash')}
                            </p>
                        </div>
                    </div>

                    {barber?.address && (status === 'accepted' || status === 'pending') && (
                        <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(barber.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-[var(--brand-primary)] font-semibold pt-3 border-t border-[var(--border-subtle)]"
                        >
                            <MapPin size={13} />
                            {barber.address}
                        </a>
                    )}
                </Card>

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
                    barber={barber}
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
                                    className="w-full p-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none resize-none h-24"
                                />
                                <Button type="submit" className="w-full" disabled={reviewLoading}>
                                    {reviewLoading ? t('common.pleaseWait') : t('review.submit')}
                                </Button>
                            </form>
                        )}
                    </Card>
                )}

                {(status === 'rejected' || status === 'cancelled') && barber?.id && (
                    <Button className="w-full" onClick={() => navigate(`/client/barber/${barber.id}`)}>
                        {t('client.bookings.rebook')}
                    </Button>
                )}
            </div>
        </PageContainer>
    );
}

export default BookingStatus;
