import { useEffect, useMemo, useState, useCallback } from 'react';
import { Check, X, Clock, User, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';

function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getBookingDateStr(booking) {
    const raw = booking.booking_date ?? booking.date ?? booking.createdAt ?? booking.created_at ?? null;
    if (!raw) return null;
    try { return toDateStr(new Date(raw)); } catch { return null; }
}

const DAY_RANGE = [-2, -1, 0, 1];

const DAY_LABELS = { '-1': 'Kecha', '0': 'Bugun', '1': 'Erta' };

function Appointments() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingUpdateId, setPendingUpdateId] = useState(null);
    const [profileModal, setProfileModal] = useState({ open: false, client: null });
    const [dayOffset, setDayOffset] = useState(0);

    const todayBase = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const selectedDate = useMemo(() => {
        const d = new Date(todayBase);
        d.setDate(d.getDate() + dayOffset);
        return d;
    }, [dayOffset, todayBase]);

    const selectedDateStr = useMemo(() => toDateStr(selectedDate), [selectedDate]);

    const loadData = useCallback(async () => {
        const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
            getBookings(),
            getClients(),
        ]);

        if (bookingError) { setError(bookingError); setLoading(false); return; }

        const own = (bookingList ?? []).filter((b) =>
            bookingMatchesBarber(b.barber, user?.id) || bookingMatchesBarber(b.barber, user?._id)
        );

        setBookings(own);
        setClientsById(Object.fromEntries((clients ?? []).map((c) => [c.id, c])));
        setLoading(false);
    }, [user?.id, user?._id]);

    useEffect(() => {
        loadData();
        const iv = setInterval(loadData, 10000);
        return () => clearInterval(iv);
    }, [loadData]);

    const handleStatusChange = async (id, newStatus) => {
        setPendingUpdateId(id);
        const { error: updateError } = await updateBookingStatus(id, { status: newStatus });
        if (updateError) { setError(updateError); }
        else { setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b)); }
        setPendingUpdateId(null);
    };

    const sortedBookings = useMemo(() =>
        [...bookings]
            .filter((b) => {
                const day = getBookingDateStr(b);
                return day ? day === selectedDateStr : dayOffset === 0;
            })
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings, selectedDateStr, dayOffset]
    );

    return (
        <div className="px-6 py-4 space-y-6 page-animate max-w-2xl mx-auto pb-24">

            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Jadval</h1>
                    <p className="text-gray-500 font-medium text-sm mt-0.5">
                        {selectedDate.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <div className="bg-primary/10 rounded-2xl px-4 py-2 text-center">
                    <span className="block text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-1">
                        {DAY_LABELS[String(dayOffset)] ?? selectedDate.toLocaleDateString('uz-UZ', { weekday: 'short' })}
                    </span>
                    <span className="text-2xl font-bold text-primary leading-none">{selectedDate.getDate()}</span>
                </div>
            </div>

            {/* Day selector */}
            <div>
                <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-3">Kun tanlang</p>
                <div className="flex gap-2">
                    {DAY_RANGE.map((offset) => {
                        const d = new Date(todayBase);
                        d.setDate(d.getDate() + offset);
                        const label = DAY_LABELS[String(offset)];
                        const isSelected = dayOffset === offset;

                        return (
                            <button
                                key={offset}
                                onClick={() => setDayOffset(offset)}
                                className={`flex-1 flex flex-col items-center py-3 rounded-2xl transition-all font-bold border ${isSelected
                                    ? 'bg-primary text-gray-500 border-primary shadow-lg shadow-primary/20'
                                    : 'bg-white text-gray-500 border-gray-100 hover:border-primary/30'
                                    }`}
                            >
                                <span className="text-[10px] uppercase tracking-wider leading-none mb-1 opacity-80">
                                    {label ?? d.toLocaleDateString('uz-UZ', { weekday: 'short' })}
                                </span>
                                <span className="text-base leading-none">{d.getDate()}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-500 text-sm font-medium px-4 py-3 rounded-2xl">
                    {error}
                </div>
            )}

            {/* Booking list */}
            <div>
                <p className="text-xs font-bold uppercase text-gray-400 tracking-widest mb-3">Navbatlar</p>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-20 skeleton rounded-3xl" />
                        ))}
                    </div>
                ) : sortedBookings.length > 0 ? (
                    <div className="space-y-3">
                        {sortedBookings.map((booking) => {
                            const client = booking.clientData || clientsById[booking.client];
                            const status = booking.status?.toLowerCase();

                            return (
                                <div
                                    key={booking.id}
                                    className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all"
                                >
                                    {/* Time */}
                                    <div className="text-center min-w-[48px]">
                                        <span className="block text-sm font-bold text-gray-900">
                                            {formatTo24h(booking.booking_hours)}
                                        </span>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">vaqt</span>
                                    </div>

                                    <div className="w-px h-10 bg-gray-100 rounded-full" />

                                    {/* Client */}
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                            {client?.avatar
                                                ? <img src={client.avatar} className="w-10 h-10 rounded-2xl object-cover" alt="" />
                                                : <span className="text-primary font-bold text-sm">{client?.name?.charAt(0)?.toUpperCase() || <User size={18} />}</span>
                                            }
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm leading-tight">
                                                {client?.name || 'Mijoz'}
                                            </h3>
                                            <p className="text-[11px] text-gray-400 font-medium">
                                                {booking.service_name || 'Soch turmagi'} {booking.service_price ? `(${Number(booking.service_price).toLocaleString()} UZS)` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 shrink-0">
                                        {status === 'pending' ? (
                                            <>
                                                <button
                                                    disabled={pendingUpdateId === booking.id}
                                                    onClick={() => handleStatusChange(booking.id, 'accepted')}
                                                    className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <Check size={16} />
                                                </button>
                                                <button
                                                    disabled={pendingUpdateId === booking.id}
                                                    onClick={() => handleStatusChange(booking.id, 'rejected')}
                                                    className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider ${status === 'accepted' ? 'bg-blue-50 text-blue-600' :
                                                status === 'completed' ? 'bg-green-50 text-green-600' :
                                                    status === 'in_progress' ? 'bg-primary/10 text-primary' :
                                                        'bg-gray-100 text-gray-400'
                                                }`}>
                                                {status === 'accepted' ? 'Tasdiqlandi' :
                                                    status === 'completed' ? 'Tugadi' :
                                                        status === 'in_progress' ? 'Jarayonda' :
                                                            status === 'rejected' ? 'Rad etildi' :
                                                                status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mb-4 border border-gray-100">
                            <CalendarDays className="text-gray-300" size={28} />
                        </div>
                        <p className="font-bold text-gray-700 text-sm">Navbat yo'q</p>
                        <p className="text-gray-400 text-xs mt-1">Bu kun uchun birorta ham navbat topilmadi</p>
                    </div>
                )}
            </div>

            <ClientProfileModal
                client={profileModal.client}
                isOpen={profileModal.open}
                onClose={() => setProfileModal({ open: false, client: null })}
            />
        </div>
    );
}

export default Appointments;
