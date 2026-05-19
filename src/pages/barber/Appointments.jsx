import { useEffect, useMemo, useState, useCallback } from 'react';
import { Check, X, Clock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';
import ClientProfileModal from '../../components/ClientProfileModal.jsx';

/** Return "YYYY-MM-DD" for a Date object */
function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Extract a date string from a booking — tries booking_date, date, createdAt, created_at */
function getBookingDateStr(booking) {
    const raw =
        booking.booking_date ??
        booking.date ??
        booking.createdAt ??
        booking.created_at ??
        null;
    if (!raw) return null;
    try {
        return toDateStr(new Date(raw));
    } catch {
        return null;
    }
}

/** Short label for day offset */
function dayLabel(offset) {
    if (offset === -1) return 'Kecha';
    if (offset === 0) return 'Bugun';
    if (offset === 1) return 'Erta';
    return null;
}

// Days to show: 2 past days, today, 1 future day
const DAY_RANGE = [-2, -1, 0, 1];

function Appointments() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingUpdateId, setPendingUpdateId] = useState(null);
    const [profileModal, setProfileModal] = useState({ open: false, client: null });

    // Day selection
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

        if (bookingError) {
            setError(bookingError);
            setLoading(false);
            return;
        }

        const ownBookings = (bookingList ?? []).filter((b) =>
            bookingMatchesBarber(b.barber, user?.id) || bookingMatchesBarber(b.barber, user?._id)
        );

        setBookings(ownBookings);
        setClientsById(Object.fromEntries((clients ?? []).map((c) => [c.id, c])));
        setLoading(false);
    }, [user?.id, user?._id]);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleStatusChange = async (id, newStatus) => {
        setPendingUpdateId(id);
        const { data, error: updateError } = await updateBookingStatus(id, { status: newStatus });

        if (updateError) {
            setError(updateError);
        } else {
            setBookings(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
        }
        setPendingUpdateId(null);
    };

    const sortedBookings = useMemo(() => {
        return [...bookings]
            .filter((b) => {
                const bookingDay = getBookingDateStr(b);
                // If no date field exists, show on today only
                return bookingDay ? bookingDay === selectedDateStr : dayOffset === 0;
            })
            .sort((a, b) => compareTimes(a.booking_hours, b.booking_hours));
    }, [bookings, selectedDateStr, dayOffset]);

    const formattedDate = selectedDate.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });

    return (
        <div className="px-6 py-6 space-y-5 max-w-2xl mx-auto pb-24">
            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Jadval</h1>
                    <p className="text-gray-500 text-sm capitalize">{formattedDate}</p>
                </div>
                <div className="bg-primary/10 p-3 rounded-2xl text-center min-w-[60px]">
                    <span className="block text-[10px] font-bold text-primary uppercase leading-none mb-1">
                        {dayLabel(dayOffset) ?? selectedDate.toLocaleDateString('uz-UZ', { weekday: 'short' })}
                    </span>
                    <span className="text-xl font-black text-primary leading-none">{selectedDate.getDate()}</span>
                </div>
            </header>

            {/* Day selector strip */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {DAY_RANGE.map((offset) => {
                    const d = new Date(todayBase);
                    d.setDate(d.getDate() + offset);
                    const label = dayLabel(offset);
                    const isSelected = dayOffset === offset;
                    const isToday = offset === 0;

                    return (
                        <button
                            key={offset}
                            onClick={() => setDayOffset(offset)}
                            className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-2xl transition-all font-bold text-xs min-w-[64px] ${
                                isSelected
                                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                                    : isToday
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            <span className="text-[10px] uppercase tracking-wider leading-none mb-1">
                                {label ?? d.toLocaleDateString('uz-UZ', { weekday: 'short' })}
                            </span>
                            <span className="text-lg leading-none">{d.getDate()}</span>
                        </button>
                    );
                })}
            </div>

            {/* Booking list */}
            <div className="space-y-4">
                {loading && (
                    <div className="animate-pulse space-y-3">
                        <div className="h-20 bg-gray-100 rounded-2xl" />
                    </div>
                )}

                {sortedBookings.length > 0 ? (
                    sortedBookings.map((booking) => {
                        const client = booking.clientData || clientsById[booking.client];
                        const status = booking.status?.toLowerCase();

                        return (
                            <div key={booking.id} className="group bg-white border border-gray-100 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="text-center min-w-[50px]">
                                        <span className="block text-sm font-bold text-gray-900">{formatTo24h(booking.booking_hours)}</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Vaqt</span>
                                    </div>

                                    <div className="h-10 w-[2px] bg-gray-100 rounded-full" />

                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 text-gray-400">
                                            {client?.avatar ? <img src={client.avatar} className="rounded-full" alt="" /> : <User size={20} />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm leading-tight">{client?.name || 'Mijoz'}</h3>
                                            <p className="text-[11px] text-gray-400 font-medium">Oddiy soch turmagi</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {status === 'pending' ? (
                                            <>
                                                <button
                                                    disabled={pendingUpdateId === booking.id}
                                                    onClick={() => handleStatusChange(booking.id, 'accepted')}
                                                    className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-colors"
                                                >
                                                    <Check size={18} />
                                                </button>
                                                <button
                                                    disabled={pendingUpdateId === booking.id}
                                                    onClick={() => handleStatusChange(booking.id, 'rejected')}
                                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-colors"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </>
                                        ) : (
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                                                status === 'accepted' ? 'bg-blue-50 text-blue-600' :
                                                status === 'completed' ? 'bg-green-50 text-green-600' :
                                                'bg-gray-100 text-gray-400'
                                            }`}>
                                                {status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    !loading && (
                        <div className="text-center py-16">
                            <Clock className="mx-auto text-gray-200 mb-2" size={40} />
                            <p className="text-gray-400 font-medium">Bu kun uchun navbat yo'q</p>
                        </div>
                    )
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