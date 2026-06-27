import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Calendar as CalendarIcon, AlertCircle, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getBookingsForBarber, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { supabase } from '../../api/supabase.js';
import { formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, formatBookingDate, addDaysToDateStr } from '../../utils/dates.js';
import { t } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';
import { ListRow, Button, Card, EmptyState } from '../../components/ui/index.js';
import PageContainer from '../../components/layout/PageContainer.jsx';

function Appointments() {
    const { user } = useAuth();
    const today = toDateStr(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileClient, setProfileClient] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        const barberId = user?.id ?? user?._id;
        if (!barberId) { setLoading(false); return; }

        const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
            getBookingsForBarber(barberId),
            getClients(),
        ]);

        if (bookingError) { setError(bookingError); setLoading(false); return; }

        setBookings(bookingList ?? []);
        setClientsById(Object.fromEntries((clients ?? []).map(c => [c.id, c])));
        setLoading(false);
    }, [user?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel(`barber-appointments-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${user.id}` }, loadData)
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [loadData, user?.id]);

    const dateBookings = useMemo(() =>
        bookings
            .filter(b => getBookingDateStr(b) === selectedDate)
            .sort((a, b) => (a.booking_hours || '').localeCompare(b.booking_hours || '')),
        [bookings, selectedDate]
    );

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        const payload = { status: newStatus };
        if (newStatus === 'cancelled') payload.cancelled_by = 'barber';
        const { data, error: updateError } = await updateBookingStatus(bookingId, payload);
        if (!updateError && data) setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
    }, []);

    const getClientForBooking = (booking) => {
        if (booking.clientData || booking.client) {
            const c = clientsById[booking.client] || booking.clientData;
            if (c) return { id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt };
        }
        if (booking.guest_name) return { id: `guest_${booking.id}`, name: booking.guest_name, phone: booking.guest_phone || '' };
        return null;
    };

    return (
        <PageContainer
            hasHeader={true}
            hasBottomNav={true}
            extraBottom={16}
            className="max-w-2xl mx-auto space-y-5 page-animate"
        >
            <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('barber.appointments.title')}</h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                    {dateBookings.length > 0
                        ? `${dateBookings.length} ${t('barber.appointments.timeLabel')}`
                        : t('barber.appointments.selectDay')}
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-[var(--radius-lg)] p-4 text-sm font-semibold">
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}

            <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, -1))}
                        className="w-10 h-10 bg-[var(--bg-input)] rounded-[var(--radius-md)] flex items-center justify-center"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex gap-1 flex-1 justify-center">
                        {[
                            { label: t('barber.appointments.yesterday'), value: addDaysToDateStr(today, -1) },
                            { label: t('barber.appointments.today'), value: today },
                            { label: t('barber.appointments.tomorrow'), value: addDaysToDateStr(today, 1) },
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setSelectedDate(value)}
                                className={`flex-1 px-2 py-2.5 rounded-[var(--radius-md)] font-semibold text-xs min-h-[40px] ${
                                    selectedDate === value ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-secondary)]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, 1))}
                        className="w-10 h-10 bg-[var(--bg-input)] rounded-[var(--radius-md)] flex items-center justify-center"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
                <div className="mt-3 flex justify-center">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-4 py-2.5 font-medium min-h-[40px]"
                    />
                </div>
            </Card>

            <div className="space-y-3">
                {loading ? (
                    <SkeletonLoader count={5} type="list" />
                ) : dateBookings.length === 0 ? (
                    <EmptyState
                        icon={CalendarIcon}
                        title={t('barber.appointments.emptyTitle')}
                        description={t('barber.appointments.emptyDesc')}
                    />
                ) : (
                    dateBookings.map((booking) => {
                        const client = getClientForBooking(booking);
                        const clientName = client?.name || booking.guest_name || t('common.client');
                        return (
                            <ListRow
                                key={booking.id}
                                time={formatTo24h(booking.booking_hours)}
                                date={formatBookingDate(selectedDate, { style: 'short' })}
                                title={clientName}
                                subtitle={booking.service_name || t('barber.dashboard.haircut')}
                                onClick={() => setProfileClient(client)}
                                actions={
                                    <>
                                        {booking.status === 'pending' && (
                                            <>
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'accepted'); }}>
                                                    <Check size={14} className="mr-1" /> {t('common.accept')}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'rejected'); }}>
                                                    <X size={14} />
                                                </Button>
                                            </>
                                        )}
                                        {booking.status === 'accepted' && (
                                            <>
                                                <Button size="sm" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'completed'); }}>
                                                    {t('barber.dashboard.finish')}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleStatusUpdate(booking.id, 'cancelled'); }}>
                                                    <UserX size={14} />
                                                </Button>
                                            </>
                                        )}
                                    </>
                                }
                            />
                        );
                    })
                )}
            </div>

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </PageContainer>
    );
}

export default Appointments;
