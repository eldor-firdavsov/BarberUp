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
        return () => { mounted = false; };
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
            { status: 'cancelled' }
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
        return booking.status === 'pending' || booking.status === 'accepted';
    };

    const canRebook = (booking) => {
        return booking.status === 'accepted' || booking.status === 'completed';
    };

    const handleRebook = (booking) => {
        const barber = barbersById[booking.barber];
        if (!barber) return;

        console.log('[REBOOK] Navigating to barber details for rebooking:', barber.id);

        navigate(`/barber/${encodeURIComponent(barber.id ?? barber.email)}`, {
            state: {
                rebookFrom: booking.booking_hours,
                previousBooking: booking
            }
        });
    };

    const statusStyles = {
        cancelled: { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelled' },
        accepted: { bg: 'bg-[#f8f8f8]', text: 'text-[#111]', label: 'Accepted' },
        rejected: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: 'Rejected' },
        pending: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: 'Pending' },
        completed: { bg: 'bg-[#f8f8f8]', text: 'text-[#666]', label: 'Completed' },
        in_progress: { bg: 'bg-black', text: 'text-white', label: 'In Progress' },
    };

    return (
        <div className="px-4 py-8 sm:px-6 space-y-6 page-animate max-w-md mx-auto pb-24">
            <div>
                <h1 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">Bookings</h1>
                <p className="text-sm text-[#666] font-medium mt-1">Your current and past sessions</p>
            </div>

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
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
                    <p className="font-bold text-[#111] text-sm">No bookings yet</p>
                    <p className="text-[#666] text-xs mt-1 font-medium">Your sessions will appear here</p>
                </div>
            )}

            {/* Booking List */}
            {!loading && !error && sortedBookings.length > 0 && (
                <div className="space-y-3">
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
                                        <h3 className="font-bold text-[#111] truncate">{barber?.office_name || barber?.shopName || 'Barbershop'}</h3>
                                        <p className="text-sm text-[#666] font-medium mt-0.5">{barber?.fullname || barber?.name || 'Barber'}</p>
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
                                                className="w-9 h-9 flex items-center justify-center bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all"
                                                title="Cancel booking"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                        {canRebookBooking && (
                                            <button
                                                onClick={() => handleRebook(booking)}
                                                className="w-9 h-9 flex items-center justify-center bg-[#f8f8f8] border border-black/5 text-[#888] rounded-xl hover:bg-[#f0f0f0] hover:text-[#111] transition-all"
                                                title="Book again"
                                            >
                                                <RefreshCw size={15} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-[#888] font-medium mb-4">
                                    <span className="flex items-center gap-1.5"><Calendar size={13} /> Today</span>
                                    <span className="flex items-center gap-1.5"><Clock size={13} /> {formatTo24h(booking.booking_hours) || '--:--'}</span>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-wider border border-black/5 ${statusStyle.bg} ${statusStyle.text}`}>
                                        {statusStyle.label}
                                    </span>
                                    {canRebookBooking && (
                                        <button
                                            onClick={() => handleRebook(booking)}
                                            className="text-[#111] text-xs font-bold flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                                        >
                                            <RefreshCw size={13} />
                                            Rebook
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
                    <div className="bg-white rounded-[32px] border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full p-7">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 bg-[#f8f8f8] border border-black/5 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="text-[#888]" size={22} />
                            </div>
                            <h3 className="text-[18px] font-bold text-[#111] tracking-[-0.02em]">Cancel Booking</h3>
                        </div>
                        <p className="text-sm text-[#666] font-medium mb-7 leading-relaxed">
                            Are you sure you want to cancel this booking? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setCancelModal({ open: false, bookingId: null })}
                                className="flex-1 h-13 px-4 py-3 border border-black/5 rounded-2xl text-[#111] font-semibold text-sm hover:bg-[#f8f8f8] transition-all bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
                            >
                                Keep Booking
                            </button>
                            <button
                                onClick={confirmCancelBooking}
                                className="flex-1 h-13 px-4 py-3 bg-black text-white rounded-2xl font-semibold text-sm hover:bg-[#111] transition-all shadow-[0_8px_20px_rgba(0,0,0,0.15)]"
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
