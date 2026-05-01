import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getBookings } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';

function Booking() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [barbersById, setBarbersById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            setError('');
            const [{ data: bookingList, error: bookingError }, { data: barberList }] = await Promise.all([
                getBookings(),
                getBarbers(),
            ]);
            if (!mounted) return;

            if (bookingError) {
                setError(bookingError);
                setBookings([]);
                setLoading(false);
                return;
            }

            const byId = Object.fromEntries((barberList ?? []).map((barber) => [barber.id, barber]));
            const ownBookings = (bookingList ?? []).filter((booking) => booking.client === user?.id);
            setBarbersById(byId);
            setBookings(ownBookings);
            setLoading(false);
        }
        load();
        return () => {
            mounted = false;
        };
    }, [user?.id]);

    const sortedBookings = useMemo(
        () => [...bookings].sort((a, b) => compareTimes(a.booking_hours, b.booking_hours)),
        [bookings]
    );

    return (
        <div className="px-6 py-4 space-y-6 page-animate h-full pb-24">
            <div>
                <h1 className="text-2xl font-bold text-[var(--primary)]">Bookings</h1>
                <p className="text-[var(--text-light)] text-sm mt-1">Your current and past sessions</p>
            </div>

            {loading && (
                <div className="text-center py-8">
                    <p className="text-[var(--text-muted)] font-medium">Loading bookings...</p>
                </div>
            )}

            {error && !loading && (
                <div className="text-center py-8">
                    <p className="text-red-500 font-medium">{error}</p>
                </div>
            )}

            {!loading && !error && sortedBookings.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-[var(--text-muted)] font-medium">No bookings yet</p>
                </div>
            )}

            {!loading && !error && sortedBookings.length > 0 && (
                <div className="space-y-4">
                    {sortedBookings.map((booking) => {
                        const barber = barbersById[booking.barber];
                        return (
                            <div key={booking.id} className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)]">
                                <h3 className="font-bold text-[var(--text-main)]">{barber?.shopName || barber?.name || 'Barbershop'}</h3>
                                <p className="text-sm text-[var(--text-muted)] mb-3">{barber?.name || 'Barber'}</p>
                                <div className="flex items-center gap-4 text-sm text-[var(--text-light)]">
                                    <span className="flex items-center gap-1"><Calendar size={14} /> Today</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {formatTo24h(booking.booking_hours) || '--:--'}</span>
                                </div>
                                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                                    {booking.status || 'pending'}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Booking;
