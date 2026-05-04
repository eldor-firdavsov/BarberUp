import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBarbers } from "../../api/barberApi.js";
import { bookingMatchesBarber, createBooking, getBookings } from "../../api/bookingApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { compareTimes, formatTo24h, isSlotTaken } from "../../utils/time.js";

export default function BarbershopDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [barber, setBarber] = useState(null);
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [retrying, setRetrying] = useState(false);

    function generateSlots(barberData) {
        if (barberData.isWorkingNow === false) {
            setSlots([]);
            return;
        }

        const hours = barberData.workingHours;
        if (!hours || !hours.includes('-')) return;
        const [startStr, endStr] = hours.split('-').map(s => s.trim());

        let startMatch = startStr.match(/^(\d{1,2}):(\d{2})$/);
        let endMatch = endStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!startMatch || !endMatch) return;

        let curHour = parseInt(startMatch[1], 10);
        let curMin = parseInt(startMatch[2], 10);
        const endHour = parseInt(endMatch[1], 10);
        const endMin = parseInt(endMatch[2], 10);

        let lStart = -1, lEnd = -1;
        if (barberData.lunchStart && barberData.lunchEnd) {
            const [lsH, lsM] = barberData.lunchStart.split(':').map(Number);
            const [leH, leM] = barberData.lunchEnd.split(':').map(Number);
            lStart = lsH * 60 + lsM;
            lEnd = leH * 60 + leM;
        }

        const newSlots = [];
        let count = 0;
        while ((curHour < endHour || (curHour === endHour && curMin < endMin)) && count < 100) {
            const timeMins = curHour * 60 + curMin;
            const isLunch = lStart !== -1 && (timeMins >= lStart && timeMins < lEnd);

            if (!isLunch) {
                const timeString = `${curHour.toString().padStart(2, '0')}:${curMin.toString().padStart(2, '0')}`;
                const normalized = formatTo24h(timeString);
                if (normalized) newSlots.push(normalized);
            }

            curMin += 30;
            if (curMin >= 60) {
                curMin -= 60;
                curHour += 1;
            }
            count++;
        }
        setSlots(newSlots);
    }

    async function refreshBookingState(targetBarberId) {
        console.log('[BOOKING REFETCH] barberId=', targetBarberId);
        
        if (!targetBarberId || String(targetBarberId).trim() === '') {
            console.error('[BOOKING REFETCH] Invalid barber ID provided');
            setError('Invalid barber ID');
            return { latestBookings: [], latestError: 'Invalid barber ID' };
        }
        
        const { data: latestBookings, error: latestError } = await getBookings();
        if (latestError) {
            setError('Something went wrong');
            return { latestBookings: [], latestError };
        }
        const busySlots = (latestBookings ?? [])
            .filter((booking) => bookingMatchesBarber(booking.barber, targetBarberId))
            .filter((booking) => !['rejected', 'cancelled'].includes(String(booking.status || '').toLowerCase()))
            .map((booking) => formatTo24h(booking.booking_hours))
            .filter(Boolean)
            .sort(compareTimes);
        console.log('[BOOKING CHECK] bookedSlots (server)=', busySlots);
        setBookedSlots(busySlots);
        return { latestBookings, latestError: null };
    }

    useEffect(() => {
        let isMounted = true;
        async function fetchBarber() {
            if (!id || String(id).trim() === '') {
                console.error('[404 DEBUG] BarbershopDetails: missing route id');
                navigate('/client/dashboard');
                return;
            }
            setLoading(true);
            setError('');
            setSuccessMessage('');
            console.log('[BarbershopDetails] fetching barber for id:', id);
            const [{ data, error }, { data: bookings, error: bookingError }] = await Promise.all([
                getBarbers(),
                getBookings()
            ]);
            if (!isMounted) return;

            if (error) {
                console.error('[BarbershopDetails] fetch error:', error);
                setBarber('not_found');
                setLoading(false);
                return;
            }

            let decodedId;
            try {
                decodedId = decodeURIComponent(id);
            } catch (error) {
                console.error('[BarbershopDetails] Invalid URI encoding:', id, error);
                setBarber('not_found');
                setLoading(false);
                return;
            }
            
            // Match by email or by _id/id
            const found = (data ?? []).find(
                u => u.email === decodedId || u.id === decodedId || u._id === decodedId
            );
            console.log('[BarbershopDetails] found barber:', found);

            if (found) {
                const barberKey = found.id ?? found._id;
                if (!barberKey) {
                    console.error('[404 DEBUG] Barber record has no id', found);
                    setBarber('not_found');
                    setLoading(false);
                    return;
                }
                setBarber(found);
                generateSlots(found);
                const busySlots = (bookings ?? [])
                    .filter((booking) => bookingMatchesBarber(booking.barber, barberKey))
                    .filter((booking) => !['rejected', 'cancelled'].includes(String(booking.status || '').toLowerCase()))
                    .map((booking) => formatTo24h(booking.booking_hours))
                    .filter(Boolean);
                console.log('[BOOKING CHECK] initial bookedSlots=', busySlots);
                setBookedSlots(busySlots);
                if (bookingError) {
                    setError('Something went wrong');
                }
            } else {
                setBarber('not_found');
            }
            setLoading(false);
        }
        fetchBarber();
        return () => { isMounted = false; };
    }, [id, navigate]);

    const toggleSlot = (time) => {
        if (bookedSlots.includes(time)) return;
        setSelectedSlot((prev) => (prev === time ? null : time));
        setSuccessMessage('');
    };

    const handleBookNow = async () => {
        const barberKey = barber?.id ?? barber?._id;
        if (!selectedSlot || !barberKey || !user?.id) {
            console.error('[404 DEBUG] Book flow blocked missing data', { barberKey, userId: user?.id });
            return;
        }
        const safeSelectedSlot = formatTo24h(selectedSlot);
        if (!safeSelectedSlot) {
            setError('Something went wrong');
            return;
        }
        setBookingLoading(true);
        setError('');
        setSuccessMessage('');

        // Preflight: latest server state — do NOT POST if slot already taken
        const { latestBookings, latestError } = await refreshBookingState(barberKey);
        if (latestError) {
            setBookingLoading(false);
            return;
        }
        console.log('[BOOKING CHECK] pre-POST slot=', safeSelectedSlot, 'taken=', isSlotTaken(latestBookings, safeSelectedSlot, barberKey));
        if (isSlotTaken(latestBookings, safeSelectedSlot, barberKey)) {
            setError('This time slot is already booked.');
            setBookingLoading(false);
            return;
        }

        const { error: bookingError } = await createBooking({
            barber: barberKey,
            client: user.id,
            booking_hours: safeSelectedSlot,
        });
        if (bookingError) {
            const duplicateMessage = String(bookingError).toLowerCase();
            if (
                duplicateMessage.includes('duplicate') ||
                duplicateMessage.includes('exists') ||
                duplicateMessage.includes('already') ||
                duplicateMessage.includes('taken') ||
                duplicateMessage.includes('booked')
            ) {
                setError('This time slot is already booked.');
            } else {
                setError(bookingError);
            }
            await refreshBookingState(barberKey);
        } else {
            console.log('[BOOKING POST] success, refetching');
            await refreshBookingState(barberKey);
            setSuccessMessage('Booking confirmed');
            setSelectedSlot(null);
        }
        setBookingLoading(false);
    };

    const handleRetry = async () => {
        const barberKey = barber?.id ?? barber?._id;
        if (!barberKey) return;
        setRetrying(true);
        setError('');
        await refreshBookingState(barberKey);
        setRetrying(false);
    };

    if (barber === 'not_found') {
        return (
            <div className="min-h-screen bg-[var(--background)] flex justify-center items-center p-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Barber not found</h2>
            </div>
        );
    }

    if (loading || !barber) return <div className="p-10 text-center animate-pulse"><p className="text-gray-500 font-medium">Loading barber details...</p></div>;

    return (
        <div className="min-h-screen bg-[var(--background)] flex justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-full max-w-md bg-[var(--card-bg)] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative transition-all duration-500">
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-5 left-5 z-20 w-10 h-10 bg-[var(--card-bg)] opacity-90 rounded-full flex items-center justify-center shadow-sm backdrop-blur-md cursor-pointer hover:opacity-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <div className="relative h-64 w-full">
                    <img
                        src={barber.shopImage || barber.profileImage || "https://placehold.co/600x400/purple/white?text=Shop+Cover"}
                        alt="barber"
                        className="w-full h-full object-cover rounded-b-[2rem]"
                        onError={(e) => { e.currentTarget.src = "https://placehold.co/600x400/purple/white?text=Shop+Cover"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent w-full h-full object-cover rounded-b-[2rem]"></div>
                </div>

                <div className="p-6 space-y-7 -mt-4 relative z-10 bg-[var(--card-bg)] rounded-[2rem]">
                    <div>
                        <h2 className="text-2xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight">
                            {barber.shopName || "Gentleman's Atelier"}
                        </h2>
                        <p className="text-sm font-medium text-[var(--text-secondary)] mt-1">{barber.name || "Barber"}</p>
                    </div>

                    <div className="flex justify-between items-center bg-[var(--background)] opacity-90 rounded-2xl p-4 text-sm border border-[var(--border)]">
                        <div className="flex flex-col gap-1">
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">Average Price</p>
                            <p className="font-bold text-[var(--text-primary)] text-base">{barber.avgPrice || "150,000 UZS"}</p>
                        </div>
                        <div className="w-[1px] h-8 bg-[var(--border)]"></div>
                        <div className="flex flex-col gap-1 items-end">
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">Today</p>
                            <p className="font-bold text-[var(--text-primary)] text-base">{barber.workingHours || "09:00 - 21:00"}</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-[var(--text-primary)] text-lg">
                                Available Slots
                            </h3>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
                            {slots.length > 0 ? slots.map((time) => (
                                <label
                                    key={time}
                                    className={`min-w-[100px] flex flex-col items-center justify-center px-4 py-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-105
                  ${bookedSlots.includes(time)
                                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                                            : selectedSlot === time
                                            ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg transform scale-105"
                                            : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md"
                                        }`}
                                >
                                    <span className="text-small font-medium uppercase tracking-wider">
                                        Time
                                    </span>
                                    <span className="text-h3 font-bold">{time}</span>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedSlot === time}
                                        disabled={bookedSlots.includes(time)}
                                        onChange={() => toggleSlot(time)}
                                    />
                                    {bookedSlots.includes(time) && (
                                        <div className="text-small text-gray-400 mt-1">Booked</div>
                                    )}
                                    {selectedSlot === time && (
                                        <div className="text-small text-white/90 mt-1">Selected</div>
                                    )}
                                </label>
                            )) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">
                                        <Clock size={32} className="text-gray-400" />
                                    </div>
                                    <h3 className="empty-state-title">No available slots</h3>
                                    <p className="empty-state-description">
                                        This barber is fully booked today. Please try another day.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-1">Location</p>
                        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">
                            {barber.location || "Amir Temur Avenue 108, Tashkent"}
                        </p>

                        <div className="w-full h-28 bg-[var(--background)] border border-[var(--border)] rounded-2xl flex items-center justify-center text-[var(--text-secondary)] text-sm font-medium">
                            Map Preview
                        </div>
                    </div>

                    {error && (
                        <div className="error-container">
                            <div className="error-container-header">
                                <svg className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="error-title">Booking Failed</span>
                            </div>
                            <p className="error-message">{error}</p>
                            <div className="error-actions">
                                <button
                                    onClick={handleRetry}
                                    disabled={retrying || bookingLoading}
                                    className="btn-primary"
                                >
                                    {retrying ? (
                                        <>
                                            <div className="spinner"></div>
                                            Retrying...
                                        </>
                                    ) : (
                                        'Retry'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                    {successMessage && (
                        <div className="success-container">
                            <div className="success-container-header">
                                <svg className="success-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="success-title">Booking Confirmed!</span>
                            </div>
                            <p className="success-message">
                                Your appointment has been successfully booked. You'll receive a confirmation shortly.
                            </p>
                        </div>
                    )}
                    <button
                        onClick={handleBookNow}
                        disabled={!selectedSlot || bookingLoading}
                        className="btn-primary w-full"
                    >
                        {bookingLoading ? (
                            <>
                                <div className="spinner"></div>
                                Booking...
                            </>
                        ) : (
                            'Book Now'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
