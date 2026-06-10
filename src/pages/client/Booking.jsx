// Telegram notifications are handled by the DB trigger — no client-side calls needed.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, X, AlertCircle, RefreshCw } from 'lucide-react';
import { useClient } from '../../context/ClientContext.jsx';
import { bookingMatchesClient, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, compareDateStr, formatBookingDate } from '../../utils/dates.js';
import { isAcceptedStatus, isPendingStatus, formatBookingErrorMessage } from '../../utils/bookingStatus.js';
import { t, getStatusLabel } from '../../utils/i18n.js';

function Booking() {
    const { clientPhone } = useClient();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [barbersById, setBarbersById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelModal, setCancelModal] = useState({ open: false, bookingId: null });
    const [successMessage, setSuccessMessage] = useState('');

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        const [{ data: bookingList, error: bookingError }, { data: barberList }] = await Promise.all([
            getBookings(),
            getBarbers(),
        ]);

        if (bookingError) {
            setError(bookingError);
            setBookings([]);
            setLoading(false);
            return;
        }

        const byId = {};
        for (const barber of barberList ?? []) {
            if (barber?.id) byId[String(barber.id)] = barber;
            if (barber?._id) byId[String(barber._id)] = barber;
        }
        const ownBookings = (bookingList ?? []).filter((booking) => booking.guest_phone === clientPhone);
        setBarbersById(byId);
        setBookings(ownBookings);
        setLoading(false);
    }, [clientPhone]);

    useEffect(() => {
        loadBookings();
    }, [loadBookings]);

    // ── Supabase Realtime: instant updates when any booking changes ──
    useEffect(() => {
        if (!clientPhone) return;

        const channel = supabase
            .channel(`client-bookings-${clientPhone.replace(/\+/g, '')}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                (payload) => {
                    // Only refetch if the change involves our phone number
                    const row = payload.new || payload.old;
                    if (row?.guest_phone === clientPhone || row?.client_id) {
                        loadBookings();
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [clientPhone, loadBookings]);

    const sortedBookings = useMemo(
        () => [...bookings].sort((a, b) => {
            const dateCmp = compareDateStr(getBookingDateStr(b), getBookingDateStr(a));
            if (dateCmp !== 0) return dateCmp;
            return compareTimes(a.booking_hours, b.booking_hours);
        }),
        [bookings]
    );

    const handleCancelBooking = (bookingId) => {
        console.log('[BOOKING CANCEL] Opening confirmation for:', bookingId);
        setCancelModal({ open: true, bookingId });
    };

    const confirmCancelBooking = async () => {
        const { bookingId } = cancelModal;
        // Snapshot for notification before we clear the modal
        const target = bookings.find(b => b.id === bookingId);
        const barber = target ? barbersById[target.barber] : null;
        setCancelModal({ open: false, bookingId: null });
        const { data, error: updateError } = await updateBookingStatus(
            bookingId,
            { status: 'cancelled', cancelled_by: 'client' }
        );
        if (updateError) {
            setError(formatBookingErrorMessage(updateError, t));
        } else if (data) {
            setBookings(prev =>
                prev.map(b => b.id === bookingId ? data : b)
            );
            setSuccessMessage(t('client.bookings.cancelSuccess'));
            setTimeout(() => setSuccessMessage(''), 3000);
            // Telegram notification is sent by the DB trigger automatically
        }
    };

    const canCancelBooking = (booking) =>
        isPendingStatus(booking.status) || isAcceptedStatus(booking.status);

    const canRebook = (booking) => {
        const s = booking.status?.toLowerCase();
        return s === 'accepted' || s === 'completed';
    };

    const handleRebook = (booking) => {
        const barber = barbersById[booking.barber];
        if (!barber) return;

        console.log('[REBOOK] Navigating to barber details for rebooking:', barber.id);

        navigate(`/client/barber/${encodeURIComponent(barber.id)}`, {
            state: {
                rebookFrom: booking.booking_hours,
                rebookDate: getBookingDateStr(booking) ?? undefined,
                previousBooking: booking
            }
        });
    };

    const statusStyles = {
        cancelled: { bg: 'bg-red-50', text: 'text-red-600', label: getStatusLabel('cancelled') },
        accepted: { bg: 'bg-[#f8f8f8]', text: 'text-[#111]', label: getStatusLabel('accepted') },
        active: { bg: 'bg-[#f8f8f8]', text: 'text-[#111]', label: getStatusLabel('accepted') },
        rejected: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: getStatusLabel('rejected') },
        pending: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: getStatusLabel('pending') },
        completed: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: getStatusLabel('completed') },
        in_progress: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]', label: getStatusLabel('in_progress') },
    };

    return (
        <div className="px-4 py-8 sm:px-6 space-y-6 page-animate max-w-md md:max-w-6xl mx-auto pb-24">
            <div>
                <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('client.bookings.title')}</h1>
                <p className="text-sm text-[#666] font-medium mt-1">{t('client.bookings.subtitle')}</p>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-28 skeleton rounded-3xl" />
                    ))}
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                    <p className="font-semibold text-red-700 text-sm">{error}</p>
                </div>
            )}

            {/* Success */}
            {successMessage && (
                <div className="rounded-3xl border border-green-100 bg-green-50 p-5">
                    <p className="font-semibold text-green-700 text-sm">{successMessage}</p>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && sortedBookings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 bg-white border border-black/5 rounded-3xl flex items-center justify-center mb-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                        <Calendar className="text-[#ccc]" size={28} />
                    </div>
                    <p className="font-bold text-[#111] text-sm">{t('client.bookings.emptyTitle')}</p>
                    <p className="text-[#666] text-xs mt-1 font-medium">{t('client.bookings.emptyDesc')}</p>
                </div>
            )}

            {/* Booking List */}
            {!loading && !error && sortedBookings.length > 0 && (
                <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4">
                    {sortedBookings.map((booking) => {
                        const barber = barbersById[booking.barber];
                        const isCancellable = canCancelBooking(booking);
                        const canRebookBooking = canRebook(booking);
                        const statusKey = booking.status?.toLowerCase() || 'pending';
                        const statusStyle = statusStyles[statusKey] ?? statusStyles.pending;

                        return (
                            <div key={booking.id} className="bg-white rounded-[24px] p-5 border border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all duration-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 min-w-0 mr-3">
                                        <h3 className="font-bold text-[#111] truncate">{barber?.office_name || barber?.shopName || t('common.barbershop')}</h3>
                                        <p className="text-sm text-[#666] font-medium mt-0.5">{barber?.fullname || barber?.name || t('common.barber')}</p>
                                        {booking.service_name && (
                                            <p className="text-xs text-[#888] mt-1 font-semibold">
                                                {booking.service_name}{booking.service_price ? ` · ${Number(booking.service_price).toLocaleString()} UZS` : ''}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex gap-1.5 shrink-0">
                                        {isCancellable && (
                                            <button
                                                onClick={() => handleCancelBooking(booking.id)}
                                                className="w-10 sm:w-9 h-10 sm:h-9 flex items-center justify-center bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl active:bg-red-50 active:text-red-500 active:border-red-100 transition-all"
                                                title={t('client.bookings.cancelBookingTitle')}
                                            >
                                                <X size={17} />
                                            </button>
                                        )}
                                        {canRebookBooking && (
                                            <button
                                                onClick={() => handleRebook(booking)}
                                                className="w-10 sm:w-9 h-10 sm:h-9 flex items-center justify-center bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl active:bg-[#f0f0f0] active:text-[#111] transition-all"
                                                title={t('client.bookings.rebookTitle')}
                                            >
                                                <RefreshCw size={17} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-[#888] font-medium mb-4">
                                    <span className="flex items-center gap-1.5">
                                        <Calendar size={13} />
                                        {formatBookingDate(getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10))}
                                    </span>
                                    <span className="flex items-center gap-1.5"><Clock size={13} /> {formatTo24h(booking.booking_hours) || '--:--'}</span>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider border border-black/5 ${statusStyle.bg} ${statusStyle.text} min-h-[28px] flex items-center`}>
                                        {statusStyle.label}
                                    </span>
                                    {canRebookBooking && (
                                        <button
                                            onClick={() => handleRebook(booking)}
                                            className="text-[#111] text-xs font-bold flex items-center gap-1.5 active:opacity-70 transition-opacity min-h-[36px] px-2"
                                        >
                                            <RefreshCw size={13} />
                                            {t('client.bookings.rebook')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Cancel Confirmation Modal */}
            {cancelModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0" onClick={() => setCancelModal({ open: false, bookingId: null })}>
                    <div className="bg-white rounded-t-[32px] sm:rounded-[32px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full p-7 animate-slideUp" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="text-[#888]" size={22} />
                            </div>
                            <h3 className="text-[18px] font-bold text-[#111] tracking-[-0.02em]">{t('client.bookings.cancelTitle')}</h3>
                        </div>
                        <p className="text-sm text-[#666] font-medium mb-7 leading-relaxed">
                            {t('client.bookings.cancelConfirm')}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModal({ open: false, bookingId: null })}
                                className="flex-1 h-12 sm:h-13 px-4 py-3 border border-black/5 rounded-2xl text-[#111] font-semibold text-sm active:bg-[#f8f8f8] transition-all bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)] min-h-[48px]"
                            >
                                {t('client.bookings.keepBooking')}
                            </button>
                            <button
                                onClick={confirmCancelBooking}
                                className="flex-1 h-12 sm:h-13 px-4 py-3 bg-[#378ADD] text-white rounded-2xl font-semibold text-sm active:bg-[#185FA5] transition-all shadow-[0_8px_20px_rgba(55,138,221,0.25)] min-h-[48px]"
                            >
                                {t('client.bookings.cancelBooking')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Booking;
