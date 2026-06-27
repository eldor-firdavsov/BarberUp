// Telegram notifications are handled by the DB trigger — no client-side calls needed.
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import { useClient } from '../../context/ClientContext.jsx';
import { getBookingsForClient, updateBookingStatus } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { supabase } from '../../api/supabase.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import { getBookingDateStr, compareDateStr, formatBookingDate } from '../../utils/dates.js';
import { isAcceptedStatus, isPendingStatus, formatBookingErrorMessage } from '../../utils/bookingStatus.js';
import { t } from '../../utils/i18n.js';
import { SegmentedControl, ListRow, Button, EmptyState, Sheet } from '../../components/ui/index.js';
import { markExpiredBookings } from '../../utils/autoExpire.js';
import PageContainer from '../../components/layout/PageContainer.jsx';

function Booking() {
    const { clientPhone } = useClient();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [barbersById, setBarbersById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelModal, setCancelModal] = useState({ open: false, bookingId: null });
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('active');

    const loadBookings = useCallback(async () => {
        setLoading(true);
        setError('');
        const [{ data: bookingList, error: bookingError }, { data: barberList }] = await Promise.all([
            getBookingsForClient(clientPhone),
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
        setBarbersById(byId);
        setBookings(markExpiredBookings(bookingList ?? []));
        setLoading(false);
    }, [clientPhone]);

    useEffect(() => { loadBookings(); }, [loadBookings]);

    useEffect(() => {
        if (!clientPhone) return;
        const channel = supabase
            .channel(`client-bookings-realtime-${clientPhone.replace(/\+/g, '')}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
                const row = payload.new || payload.old;
                if (row?.guest_phone === clientPhone || row?.client_id) loadBookings();
            })
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

    const activeBookings = useMemo(() =>
        sortedBookings.filter(b => {
            const s = b.status?.toLowerCase();
            return s === 'pending' || s === 'accepted' || s === 'in_progress';
        }),
        [sortedBookings]
    );

    const historyBookings = useMemo(() =>
        sortedBookings.filter(b => {
            const s = b.status?.toLowerCase();
            return s === 'completed' || s === 'cancelled' || s === 'rejected';
        }),
        [sortedBookings]
    );

    const currentBookings = activeTab === 'active' ? activeBookings : historyBookings;

    const confirmCancelBooking = async () => {
        const { bookingId } = cancelModal;
        setCancelModal({ open: false, bookingId: null });
        const { data, error: updateError } = await updateBookingStatus(
            bookingId,
            { status: 'cancelled', cancelled_by: 'client' }
        );
        if (updateError) {
            setError(formatBookingErrorMessage(updateError, t));
        } else if (data) {
            setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
            setSuccessMessage(t('client.bookings.cancelSuccess'));
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const handleRebook = (booking, e) => {
        e.stopPropagation();
        const barber = barbersById[booking.barber];
        if (!barber) return;
        navigate(`/client/barber/${encodeURIComponent(barber.id)}`, {
            state: {
                rebookFrom: booking.booking_hours,
                rebookDate: getBookingDateStr(booking) ?? undefined,
                previousBooking: booking,
            },
        });
    };

    return (
        <PageContainer
            hasHeader={true}
            hasBottomNav={true}
            extraBottom={16}
            className="max-w-lg md:max-w-2xl mx-auto space-y-5 page-animate"
        >
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{t('client.bookings.title')}</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{t('client.bookings.subtitle')}</p>
            </div>

            {error && (
                <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-4 flex items-center gap-2 text-sm font-semibold text-red-600">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="rounded-[var(--radius-lg)] border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 animate-slideDown">
                    {successMessage}
                </div>
            )}

            <SegmentedControl
                value={activeTab}
                onChange={setActiveTab}
                options={[
                    { value: 'active', label: t('client.bookings.tabActive'), badge: activeBookings.length },
                    { value: 'history', label: t('client.bookings.tabHistory'), badge: historyBookings.length },
                ]}
            />

            {loading && (
                <div className="space-y-3">
                    {[1, 2].map(i => (
                        <div key={i} className="h-20 bg-[var(--bg-input)] rounded-[var(--radius-card)] animate-pulse" />
                    ))}
                </div>
            )}

            {!loading && !error && currentBookings.length === 0 && (
                <EmptyState
                    icon={ShoppingBag}
                    title={activeTab === 'active' ? t('client.bookings.emptyActive') : t('client.bookings.emptyHistory')}
                    description={activeTab === 'active' ? t('client.bookings.emptyActiveDesc') : t('client.bookings.emptyHistoryDesc')}
                    action={activeTab === 'active' && (
                        <Button onClick={() => navigate('/client/dashboard')}>{t('client.bookings.browseBarbers')}</Button>
                    )}
                />
            )}

            {!loading && !error && currentBookings.length > 0 && (
                <div className="space-y-3">
                    {currentBookings.map((booking) => {
                        const barber = barbersById[booking.barber];
                        const statusKey = booking.status?.toLowerCase() || 'pending';
                        const isCancellable = isPendingStatus(booking.status) || isAcceptedStatus(booking.status);
                        const canRebook = statusKey === 'completed' || statusKey === 'cancelled' || statusKey === 'rejected';
                        const dateStr = getBookingDateStr(booking) ?? new Date().toISOString().slice(0, 10);

                        return (
                            <ListRow
                                key={booking.id}
                                time={formatTo24h(booking.booking_hours)}
                                date={formatBookingDate(dateStr, { style: 'short' })}
                                title={booking.service_name || t('common.defaultHaircut')}
                                subtitle={`${barber?.office_name || t('common.barbershop')} · ${barber?.fullname || ''}`}
                                onClick={() => navigate(`/client/booking-status/${booking.id}`)}
                                actions={
                                    <div className="flex flex-col gap-2">
                                        {isCancellable && (
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); setCancelModal({ open: true, bookingId: booking.id }); }}
                                            >
                                                {t('common.cancel')}
                                            </Button>
                                        )}
                                        {canRebook && (
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={(e) => handleRebook(booking, e)}
                                            >
                                                <RefreshCw size={12} className="mr-1" />
                                                {t('client.bookings.rebook')}
                                            </Button>
                                        )}
                                    </div>
                                }
                            />
                        );
                    })}
                </div>
            )}

            <Sheet
                isOpen={cancelModal.open}
                onClose={() => setCancelModal({ open: false, bookingId: null })}
                title={t('client.bookings.cancelTitle')}
                footer={
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setCancelModal({ open: false, bookingId: null })}>
                            {t('client.bookings.keepBooking')}
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={confirmCancelBooking}>
                            {t('client.bookings.cancelBooking')}
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-[var(--text-secondary)]">{t('client.bookings.cancelConfirm')}</p>
            </Sheet>
        </PageContainer>
    );
}

export default Booking;
