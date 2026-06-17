import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Clock, Check, X, Calendar as CalendarIcon, AlertCircle, Phone, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { supabase } from '../../api/supabase.js';
import { formatTo24h } from '../../utils/time.js';
import { toDateStr, getBookingDateStr, formatBookingDate, addDaysToDateStr } from '../../utils/dates.js';
import { t, getStatusLabel } from '../../utils/i18n.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';
import SkeletonLoader from '../../components/SkeletonLoader.jsx';

const STATUS_TABS = [
    { key: 'all', label: 'Barchasi' },
    { key: 'pending', label: 'Kutilmoqda' },
    { key: 'accepted', label: 'Tasdiqlangan' },
    { key: 'completed', label: 'Yakunlangan' },
    { key: 'cancelled', label: 'Bekor' },
];

const statusConfig = {
    pending: {
        border: 'border-l-amber-400',
        badge: 'bg-amber-50 text-amber-700 border-amber-100',
        dot: 'bg-amber-400',
        bg: 'bg-white',
    },
    accepted: {
        border: 'border-l-emerald-500',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        dot: 'bg-emerald-500',
        bg: 'bg-white',
    },
    completed: {
        border: 'border-l-[#2563eb]',
        badge: 'bg-[#EBF4FF] text-[#1d4ed8] border-[#2563eb]/20',
        dot: 'bg-[#2563eb]',
        bg: 'bg-white',
    },
    cancelled: {
        border: 'border-l-red-300',
        badge: 'bg-red-50 text-red-500 border-red-100',
        dot: 'bg-red-400',
        bg: 'bg-[#fafafa]',
    },
    rejected: {
        border: 'border-l-gray-300',
        badge: 'bg-gray-50 text-gray-500 border-gray-100',
        dot: 'bg-gray-400',
        bg: 'bg-[#fafafa]',
    },
};

function Appointments() {
    const { user } = useAuth();
    const today = toDateStr(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [statusFilter, setStatusFilter] = useState('all');
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

        if (bookingError) { setError(bookingError); setLoading(false); return; }

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
        bookings
            .filter(b => getBookingDateStr(b) === selectedDate)
            .sort((a, b) => (a.booking_hours || '').localeCompare(b.booking_hours || '')),
        [bookings, selectedDate]
    );

    const filteredBookings = useMemo(() =>
        statusFilter === 'all' ? dateBookings : dateBookings.filter(b => b.status === statusFilter),
        [dateBookings, statusFilter]
    );

    const statusCounts = useMemo(() => {
        const counts = {};
        for (const b of dateBookings) counts[b.status] = (counts[b.status] || 0) + 1;
        return counts;
    }, [dateBookings]);

    const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
        const payload = { status: newStatus };
        if (newStatus === 'cancelled') payload.cancelled_by = 'barber';
        const { data, error } = await updateBookingStatus(bookingId, payload);
        if (!error && data) setBookings(prev => prev.map(b => b.id === bookingId ? data : b));
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
        <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 sm:px-6 sm:py-12 space-y-6 page-animate h-full pb-32 max-w-7xl mx-auto">
            <div>
                <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">{t('barber.appointments.title')}</h1>
                <p className="text-sm text-[#666] font-medium mt-1">
                    {dateBookings.length > 0
                        ? `${dateBookings.length} ta navbat • ${statusCounts.accepted || 0} tasdiqlangan • ${statusCounts.pending || 0} kutilmoqda`
                        : t('barber.appointments.selectDay')
                    }
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-2xl p-4 text-sm font-semibold">
                    <AlertCircle size={18} /><span>{error}</span>
                </div>
            )}

            {/* Date Picker */}
            <div className="bg-white border border-black/5 rounded-[28px] p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between gap-2">
                    <button
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, -1))}
                        className="w-11 h-11 bg-[#f8f8f8] border border-black/5 rounded-xl flex items-center justify-center hover:bg-[#f0f0f0] active:scale-[0.93] transition-all shrink-0"
                    >
                        <ChevronLeft size={20} className="text-[#111]" />
                    </button>

                    <div className="flex gap-1.5 flex-1 justify-center">
                        {[
                            { label: t('barber.appointments.yesterday'), value: addDaysToDateStr(today, -1) },
                            { label: t('barber.appointments.today'), value: today },
                            { label: t('barber.appointments.tomorrow'), value: addDaysToDateStr(today, 1) },
                        ].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setSelectedDate(value)}
                                className={`flex-1 px-2 sm:px-4 py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.97] min-h-[44px] ${
                                    selectedDate === value ? 'bg-[#2563eb] text-white shadow-sm' : 'bg-[#f8f8f8] text-[#666] hover:bg-[#f0f0f0]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setSelectedDate(addDaysToDateStr(selectedDate, 1))}
                        className="w-11 h-11 bg-[#f8f8f8] border border-black/5 rounded-xl flex items-center justify-center hover:bg-[#f0f0f0] active:scale-[0.93] transition-all shrink-0"
                    >
                        <ChevronRight size={20} className="text-[#111]" />
                    </button>
                </div>

                <div className="mt-3 flex justify-center">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="text-sm bg-[#f8f8f8] border border-black/5 rounded-xl px-4 py-3 font-medium text-[#111] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 min-h-[44px]"
                    />
                </div>
            </div>

            {/* Status Filter Tabs */}
            {!loading && dateBookings.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {STATUS_TABS.map(tab => {
                        const count = tab.key === 'all' ? dateBookings.length : (statusCounts[tab.key] || 0);
                        const isActive = statusFilter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setStatusFilter(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl font-bold text-xs whitespace-nowrap transition-all shrink-0 border ${
                                    isActive
                                        ? 'bg-[#111] text-white border-transparent shadow-sm'
                                        : 'bg-white text-[#666] border-black/5 hover:bg-[#f8f8f8]'
                                }`}
                            >
                                {tab.label}
                                {count > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center ${
                                        isActive ? 'bg-white/15' : 'bg-black/5'
                                    }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Bookings List */}
            <div className="space-y-3">
                {loading ? (
                    <SkeletonLoader count={5} type="list" />
                ) : filteredBookings.length === 0 ? (
                    <div className="bg-white border border-black/5 rounded-[28px] p-12 text-center">
                        <CalendarIcon size={32} className="text-[#ccc] mx-auto mb-3" />
                        <p className="font-bold text-[#111] text-sm">{t('barber.appointments.emptyTitle')}</p>
                        <p className="text-xs text-[#666] font-medium mt-1">{t('barber.appointments.emptyDesc')}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredBookings.map(booking => {
                            const client = getClientForBooking(booking);
                            const cfg = statusConfig[booking.status] || statusConfig.pending;

                            return (
                                <div
                                    key={booking.id}
                                    className={`${cfg.bg} border border-black/5 border-l-4 ${cfg.border} rounded-[24px] p-5 shadow-[0_6px_24px_rgba(0,0,0,0.04)] flex flex-col gap-4 hover:shadow-[0_12px_36px_rgba(0,0,0,0.07)] transition-all`}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2563eb]/10 to-[#1d4ed8]/5 flex items-center justify-center border border-[#2563eb]/10 shrink-0">
                                            <span className="text-[#2563eb] font-bold text-sm">
                                                {(client?.name || '?').charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setProfileClient(client)}
                                                    className="font-bold text-[#111] hover:text-[#2563eb] transition-colors text-left text-sm"
                                                >
                                                    {client?.name || booking.guest_name || t('common.client')}
                                                </button>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {getStatusLabel(booking.status)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#666] font-semibold mt-0.5 truncate">{booking.service_name || t('barber.dashboard.haircut')}</p>
                                            {(booking.guest_phone || client?.phone) && (
                                                <a
                                                    href={`tel:${booking.guest_phone || client?.phone}`}
                                                    className="text-[10px] text-[#888] font-medium mt-0.5 hover:text-[#2563eb] transition-colors flex items-center gap-1"
                                                >
                                                    <Phone size={9} />
                                                    {booking.guest_phone || client?.phone}
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-black/5 pt-3">
                                        <div className="flex items-center gap-1.5 text-[#111] font-bold text-sm">
                                            <Clock size={13} className="text-[#888]" />
                                            <span>{formatTo24h(booking.booking_hours)}</span>
                                            <span className="text-[10px] text-[#888] font-semibold ml-1">
                                                {formatBookingDate(getBookingDateStr(booking) ?? selectedDate, { style: 'short' })}
                                            </span>
                                        </div>

                                        <div className="flex gap-2">
                                            {booking.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                                                        className="h-10 px-3 bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 hover:bg-emerald-600 active:scale-[0.93] transition-all shadow-sm font-bold text-xs"
                                                    >
                                                        <Check size={14} /> Qabul
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                                        className="w-10 h-10 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 active:scale-[0.93] transition-all"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {booking.status === 'accepted' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking.id, 'completed')}
                                                        className="h-10 px-3 bg-[#2563eb] text-white rounded-xl hover:bg-[#1d4ed8] active:scale-[0.97] transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        <Check size={14} /> Yakunlash
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                                                        className="w-10 h-10 bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-red-500 active:scale-[0.93] transition-all"
                                                        title="Kelmadi / Bekor qilish"
                                                    >
                                                        <UserX size={14} />
                                                    </button>
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
