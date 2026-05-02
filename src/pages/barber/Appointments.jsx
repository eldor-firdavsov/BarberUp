import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, Check, X, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesBarber, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getClients } from '../../api/clientApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';

function Appointments() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [clientsById, setClientsById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pendingUpdateId, setPendingUpdateId] = useState(null);

    useEffect(() => {
        let mounted = true;
        async function load() {
            console.log('[APPOINTMENTS] Loading appointments data...');
            setLoading(true);
            setError('');
            const [{ data: bookingList, error: bookingError }, { data: clients }] = await Promise.all([
                getBookings(),
                getClients(),
            ]);
            if (!mounted) return;
            if (bookingError) {
                setError(bookingError);
                setBookings([]);
                setLoading(false);
                return;
            }
            const ownBookings = (bookingList ?? []).filter((booking) => bookingMatchesBarber(booking.barber, user?.id));
            console.log('[APPOINTMENTS] Filtered bookings for barber:', ownBookings.length);
            setBookings(ownBookings);
            setClientsById(Object.fromEntries((clients ?? []).map((client) => [client.id, client])));
            setLoading(false);
        }
        load();
        
        // Set up periodic refresh for real-time updates
        const refreshInterval = setInterval(load, 8000); // Refresh every 8 seconds
        
        return () => {
            mounted = false;
            clearInterval(refreshInterval);
        };
    }, [user?.id]);

    const handleStatusUpdate = async (id, newStatus) => {
        if (id == null || String(id).trim() === '') {
            console.error('[404 DEBUG] handleStatusUpdate: invalid booking id', id);
            return;
        }
        setPendingUpdateId(id);
        const { data, error: updateError } = await updateBookingStatus(id, { status: newStatus });
        if (updateError) {
            setError(updateError);
        } else if (data) {
            setBookings((prev) => prev.map((booking) => (booking.id === id ? data : booking)));
        }
        setPendingUpdateId(null);
    };

    const sortedBookings = useMemo(
        () => [...bookings].sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings]
    );

    return (
        <div className="px-6 py-4 space-y-6 page-animate h-full pb-24">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--primary)]">Schedule</h1>
                    <p className="text-[var(--text-light)] text-sm mt-1">Manage your appointments</p>
                </div>
                <div className="bg-[var(--primary)]/10 text-[var(--primary)] p-3 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-xs font-bold uppercase">{new Date().toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-xl font-black leading-none">{new Date().getDate()}</span>
                </div>
            </div>

            {/* Date Selector (Visual Only) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                {[0, 1, 2, 3, 4].map((offset) => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    const isToday = offset === 0;
                    return (
                        <div key={offset} className={`min-w-[60px] p-3 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${isToday ? 'bg-[var(--primary)] text-white shadow-md' : 'bg-white border border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                            <span className="text-xs font-medium mb-1">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-lg font-bold">{d.getDate()}</span>
                        </div>
                    );
                })}
            </div>

            {/* Timeline View */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mx-1">Today's Schedule</h2>
                {loading && <p className="text-[var(--text-muted)] font-medium">Loading schedule...</p>}
                {error && <p className="text-red-500 font-medium">{error}</p>}

                {!loading && !error && sortedBookings.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)] overflow-hidden divide-y divide-[var(--border-color)]">
                    {sortedBookings.map((booking) => (
                        <div key={booking.id} className="p-4 flex gap-4">
                            {/* Time Column */}
                            <div className="flex flex-col items-center w-16 pt-1">
                                <span className="font-bold text-[var(--text-main)] text-sm">{formatTo24h(booking.booking_hours) || '--:--'}</span>
                                <span className="text-xs text-[var(--text-light)]">TIME</span>
                            </div>

                            {/* Divider Line */}
                            <div className="w-px bg-gray-200 relative">
                                <div className={`absolute top-2 -left-1 w-2.5 h-2.5 rounded-full ${booking.status === 'accepted' ? 'bg-green-500' : booking.status === 'pending' ? 'bg-orange-400' : 'bg-red-500'}`} />
                            </div>

                            {/* Booking Card */}
                            <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <img src="https://i.pravatar.cc/150?u=client" alt={booking.clientData?.name || booking.clientData?.fullname || clientsById[booking.client]?.name || booking.client} className="w-8 h-8 rounded-full" />
                                        <div>
                                            <h3 className="font-bold text-[var(--text-main)] text-sm">{booking.clientData?.name || booking.clientData?.fullname || clientsById[booking.client]?.name || 'Client'}</h3>
                                            <p className="text-xs text-[var(--text-light)]">Session</p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {booking.status === 'accepted' && (
                                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">Confirmed</span>
                                    )}
                                    {booking.status === 'rejected' && (
                                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">Rejected</span>
                                    )}
                                    {booking.status === 'pending' && (
                                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                                            <Clock size={10} /> Pending
                                        </span>
                                    )}
                                </div>

                                {/* Actions for Pending */}
                                {booking.status === 'pending' && (
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                                            disabled={pendingUpdateId === booking.id}
                                            className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white text-xs font-bold py-2 rounded-lg transition-transform active:scale-95"
                                        >
                                            <Check size={14} /> Accept
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(booking.id, 'rejected')}
                                            disabled={pendingUpdateId === booking.id}
                                            className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-700 text-xs font-bold py-2 rounded-lg transition-transform active:scale-95"
                                        >
                                            <X size={14} /> Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    </div>
                )}
                {!loading && !error && sortedBookings.length === 0 && (
                    <p className="text-[var(--text-muted)] font-medium">No bookings found.</p>
                )}
            </div>

        </div>
    );
}

export default Appointments;
