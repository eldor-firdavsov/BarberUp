import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Check, X, Calendar as CalendarIcon, AlertCircle, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { supabase } from '../../api/supabase.js';
import { formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, formatBookingDate, addDaysToDateStr } from '../../utils/dates.js';
import { t, getStatusLabel } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';

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
        const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        if (bookingError) {
            setError(bookingError);
            setLoading(false);
            return;
        }

        const filtered = (bookingList ?? []).filter(b =>
            bookingMatchesBarber(b.barber, user?.id) || bookingMatchesBarber(b.barber, user?._id)
        );

        setBookings(filtered);
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
        bookings.filter(b => getBookingDateStr(b) === selectedDate)
            .sort((a, b) => {
                const timeA = a.booking_hours || '';
                const timeB = b.booking_hours || '';
                return timeA.localeCompare(timeB);
            }),
        [bookings, selectedDate]
    );

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        const payload = { status: newStatus };
        if (newStatus === 'cancelled') payload.cancelled_by = 'barber';
        const { data, error } = await updateBookingStatus(bookingId, payload);
        if (!error && data) {
            setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
        }
    }, []);

    const getClientForBooking = (booking) => {
        if (booking.clientData || booking.client) {
            const c = clientsById[booking.client] || booking.clientData;
            if (c) return { id: c.id, name: c.name || c.fullname, phone: c.phone, email: c.email, createdAt: c.createdAt };
        }
        if (booking.guest_name) {
            return { id: `guest_${booking.id}`, name: booking.guest_name, phone: booking.guest_phone || '' };
        }
        return null;
    };

    const statusStyles = {
        pending: { bg: 'bg-yellow-50 border-yellow-200 text-yellow-700', dot: 'bg-yellow-500' },
        accepted: { bg: 'bg-blue-50 border-blue-200 text-blue-700', dot: 'bg-[#378ADD]' },
        completed: { bg: 'bg-green-50 border-green-200 text-green-700', dot: 'bg-green-500' },
        cancelled: { bg: 'bg-red-50 border-red-200 text-red-500', dot: 'bg-red-400' },
        rejected: { bg: 'bg-gray-50 border-gray-200 text-gray-500', dot: 'bg-gray-400' },
    };

    return (
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 space-y-8 page-animate h-full pb-24 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.appointments.title')}</h1>
                    <p className="text-sm text-[#666] font-medium mt-1">{t('barber.appointments.selectDay')}</p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm font-semibold">
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}

            <div className="bg-white border border-black/5 rounded-[28px] p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <button
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, -1))}
                        className="w-11 h-11 sm:w-10 sm:h-10 bg-[#f8f8f8] border border-black/5 rounded-xl flex items-center justify-center hover:bg-[#f0f0f0] active:scale-[0.93] transition-all shrink-0"
                    >
                        <ChevronLeft size={20} className="text-[#111]" />
                    </button>

                    <div className="flex gap-1.5 sm:gap-2 flex-1 justify-center">
                        {[
                            { label: t('barber.appointments.yesterday'), value: addDaysToDateStr(today, -1) },
                            { label: t('barber.appointments.today'), value: today },
                            { label: t('barber.appointments.tomorrow'), value: addDaysToDateStr(today, 1) },
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setSelectedDate(value)}
                                className={`flex-1 sm:flex-none px-2 sm:px-4 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-[11px] transition-all active:scale-[0.97] min-h-[44px] ${
                                    selectedDate === value
                                        ? 'bg-[#378ADD] text-white shadow-sm'
                                        : 'bg-[#f8f8f8] text-[#666] hover:bg-[#f0f0f0]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, 1))}
                        className="w-11 h-11 sm:w-10 sm:h-10 bg-[#f8f8f8] border border-black/5 rounded-xl flex items-center justify-center hover:bg-[#f0f0f0] active:scale-[0.93] transition-all shrink-0"
                    >
                        <ChevronRight size={20} className="text-[#111]" />
                    </button>
                </div>

                <div className="mt-3 sm:mt-4 flex justify-center">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm bg-[#f8f8f8] border border-black/5 rounded-xl px-4 py-3 sm:py-2.5 font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#378ADD]/30 min-h-[44px]"
                    />
                </div>
                <p className="text-[10px] text-[#aaa] font-medium text-center mt-2 sm:hidden">
                    ← {t('barber.appointments.swipeHint')} →
                </p>
            </div>

            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white border border-black/5 rounded-[28px] p-12 text-center">
                        <div className="w-8 h-8 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm font-medium text-[#666]">{t('common.loading')}</p>
                    </div>
                ) : dateBookings.length === 0 ? (
                    <div className="bg-white border border-black/5 rounded-[28px] p-12 text-center">
                        <CalendarIcon size={32} className="text-[#ccc] mx-auto mb-3" />
                        <p className="font-bold text-[#111] text-sm">{t('barber.appointments.emptyTitle')}</p>
                        <p className="text-xs text-[#666] font-medium mt-1">{t('barber.appointments.emptyDesc')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {dateBookings.map(booking => {
                            const client = getClientForBooking(booking);
                            const s = statusStyles[booking.status] || statusStyles.pending;
                            return (
                                <div key={booking.id} className="bg-white border border-black/5 rounded-[28px] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] flex flex-col gap-4 hover:shadow-[0_15px_50px_rgba(0,0,0,0.06)] transition-all">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-[#f8f8f8] flex items-center justify-center border border-black/5 shrink-0">
                                            <span className="text-[#111] font-bold text-sm">
                                                {(client?.name || '?').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <button
                                                onClick={() => setProfileClient(client)}
                                                className="font-bold text-[#111] truncate hover:text-[#378ADD] transition-colors text-left"
                                            >
                                                {client?.name || booking.guest_name || t('common.client')}
                                            </button>
                                            <p className="text-xs text-[#666] font-semibold mt-0.5 flex items-center gap-2">
                                                <span>{booking.service_name || t('barber.dashboard.haircut')}</span>
                                                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                                                <span className={s.text}>{getStatusLabel(booking.status)}</span>
                                            </p>
                                            {booking.guest_phone && (
                                                <p className="text-[10px] text-[#888] font-medium mt-0.5">{booking.guest_phone}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-black/5 pt-3.5">
                                        <div className="flex items-center gap-1.5 text-[#111] font-bold text-xs">
                                            <Clock size={14} className="text-[#888]" />
                                            <span>{formatTo24h(booking.booking_hours)}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            {booking.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                                                        className="w-10 sm:w-9 h-10 sm:h-9 bg-[#378ADD] text-white rounded-xl flex items-center justify-center hover:bg-[#185FA5] active:scale-[0.93] transition-all shadow-sm"
                                                        title={t('common.accept')}><Check size={18} /></button>
                                                    <button onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                                        className="w-10 sm:w-9 h-10 sm:h-9 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 active:scale-[0.93] transition-all"
                                                        title={t('common.reject')}><X size={18} /></button>
                                                </>
                                            )}
                                            {booking.status === 'accepted' && (
                                                <>
                                                    <button onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                                        className="h-10 sm:h-9 px-4 bg-[#378ADD] text-white rounded-xl hover:bg-[#185FA5] active:scale-[0.97] transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm min-h-[44px]">
                                                        <Check size={14} /><span>{t('barber.dashboard.finish')}</span>
                                                    </button>
                                                    <button onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                                        className="w-10 sm:w-9 h-10 sm:h-9 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 active:scale-[0.93] transition-all"
                                                        title={t('common.cancel')}><X size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <ClientProfileModal client={profileClient} isOpen={!!profileClient} onClose={() => setProfileClient(null)} />
        </div>
    );
}

export default Appointments;
