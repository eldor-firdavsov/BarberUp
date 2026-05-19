import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, X, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { bookingMatchesClient, getBookings, updateBookingStatus } from '../../api/bookingApi.js';
import { getBarbers } from '../../api/barberApi.js';
import { compareTimes, formatTo24h } from '../../utils/time.js';

function Booking() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [barbersById, setBarbersById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [cancelModal, setCancelModal] = useState({ open: false, bookingId: null });
    const [successMessage, setSuccessMessage] = useState('');

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

            const byId = {};
            for (const barber of barberList ?? []) {
                if (barber?.id) byId[String(barber.id)] = barber;
                if (barber?._id) byId[String(barber._id)] = barber;
            }
            const ownBookings = (bookingList ?? []).filter((booking) => bookingMatchesClient(booking.client, user?.id));
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

    const handleCancelBooking = (bookingId) => {
        console.log('[BOOKING CANCEL] Opening confirmation for:', bookingId);
        setCancelModal({ open: true, bookingId });
    };

    const confirmCancelBooking = async () => {
        const { bookingId } = cancelModal;
        setCancelModal({ open: false, bookingId: null });
        const { data, error: updateError } = await updateBookingStatus(
            bookingId,
            { status: 'rejected' }
        );
        if (updateError) {
            setError(updateError);
        } else if (data) {
            setBookings(prev =>
                prev.map(b => b.id === bookingId ? data : b)
            );
            setSuccessMessage('Booking cancelled successfully');
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    };

    const canCancelBooking = (booking) => {
        return booking.status === 'pending';
    };

    const canRebook = (booking) => {
        return booking.status === 'accepted' || booking.status === 'completed';
    };

    const handleRebook = (booking) => {
        const barber = barbersById[booking.barber];
        if (!barber) return;

        console.log('[REBOOK] Navigating to barber details for rebooking:', barber.id);

        // Navigate to barber details page with rebooking context
        navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`, {
            state: {
                rebookFrom: booking.booking_hours,
                previousBooking: booking
            }
        });
    };

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

            {successMessage && (
                <div className="text-center py-4">
                    <p className="text-green-600 font-medium bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                        {successMessage}
                    </p>
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
                        const isCancellable = canCancelBooking(booking);
                        const canRebookBooking = canRebook(booking);
                        return (
                            <div key={booking.id} className="bg-white p-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-[var(--border-color)]">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-[var(--text-main)]">{barber?.shopName || barber?.name || 'Barbershop'}</h3>
                                        <p className="text-sm text-[var(--text-muted)]">{barber?.name || 'Barber'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {isCancellable && (
                                            <button
                                                onClick={() => handleCancelBooking(booking.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Cancel booking"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                        {canRebookBooking && (
                                            <button
                                                onClick={() => handleRebook(booking)}
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                title="Book again"
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-[var(--text-light)] mb-3">
                                    <span className="flex items-center gap-1"><Calendar size={14} /> Today</span>
                                    <span className="flex items-center gap-1"><Clock size={14} /> {formatTo24h(booking.booking_hours) || '--:--'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold uppercase tracking-wider">
                                        <span className={`px-2 py-1 rounded-md ${booking.status === 'cancelled'
                                            ? 'bg-red-100 text-red-700'
                                            : booking.status === 'accepted'
                                                ? 'bg-green-100 text-green-700'
                                                : booking.status === 'rejected'
                                                    ? 'bg-gray-100 text-gray-700'
                                                    : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {booking.status || 'pending'}
                                        </span>
                                    </p>
                                    {canRebookBooking && (
                                        <button
                                            onClick={() => handleRebook(booking)}
                                            className="text-blue-500 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors"
                                        >
                                            <RefreshCw size={14} />
                                            Rebook
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Cancel Booking Confirmation Modal */}
            {cancelModal.open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="text-red-600" size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--text-main)]">Cancel Booking</h3>
                        </div>
                        <p className="text-[var(--text-light)] mb-6">
                            Are you sure you want to cancel this booking? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModal({ open: false, bookingId: null })}
                                className="flex-1 px-4 py-2 border border-[var(--border-color)] rounded-lg text-[var(--text-main)] hover:bg-gray-50 transition-colors"
                            >
                                Keep Booking
                            </button>
                            <button
                                onClick={confirmCancelBooking}
                                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Cancel Booking
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Booking;
