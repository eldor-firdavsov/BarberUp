import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Star, Trash2 } from "lucide-react";
import InteractiveMap from "../../components/InteractiveMap.jsx";
import BookingSheet from "../../components/BookingSheet.jsx";
import { Button, Card } from "../../components/ui/index.js";
import PageContainer from "../../components/layout/PageContainer.jsx";
import { getBarbers } from "../../api/barberApi.js";
import { getBarberReviews, deleteReview } from "../../api/reviewApi.js";
import {
    bookingMatchesBarber,
    createGuestBooking,
    getBookingsForBarber,
} from "../../api/bookingApi.js";
// Telegram notifications are handled by the DB trigger on INSERT/UPDATE
// of bookings — no client-side notification calls needed.
import { useClient } from "../../context/ClientContext.jsx";
import { supabase } from "../../api/supabase.js";
import {
    compareTimes,
    formatTo24h,
    isSlotTaken,
    getCurrentTime,
    generateAvailableSlots,
} from "../../utils/time.js";
import { isBlockingSlotStatus, formatBookingErrorMessage } from "../../utils/bookingStatus.js";
import { t } from "../../utils/i18n.js";
import {
    toDateStr,
    getBookingDayOptions,
    bookingMatchesDate,
    formatBookingDate,
} from "../../utils/dates.js";

const BOOKING_DAY_COUNT = 7;

export default function BarbershopDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { clientName, clientPhone } = useClient();

    const [barber, setBarber] = useState(null);
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [isBookingInProgress, setIsBookingInProgress] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [retrying, setRetrying] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [bookingOpen, setBookingOpen] = useState(false);
    const [notes, setNotes] = useState('');

    const averageRating = useMemo(() => {
        if (!reviews.length) return 0;
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        return (sum / reviews.length).toFixed(1);
    }, [reviews]);

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm("Sharhni o'chirmoqchimisiz?")) return;
        const { error } = await deleteReview(reviewId, clientPhone);
        if (!error) {
            setReviews(prev => prev.filter(r => r.id !== reviewId));
        } else {
            alert("Xatolik yuz berdi");
        }
    };

    const dayOptions = useMemo(() => getBookingDayOptions(BOOKING_DAY_COUNT), []);

    function generateSlots(barberData, durationMins = 30, dateStr = toDateStr(new Date())) {
        const todayStr = toDateStr(new Date());
        setSlots(generateAvailableSlots(barberData, durationMins, dateStr, todayStr));
    }

    const handleSelectService = (service) => {
        setSelectedService(service);
        setSelectedSlot(null);
        setBookingOpen(true);

        if (barber) {
            const duration = service
                ? parseInt(service.duration, 10)
                : 30;

            generateSlots(barber, duration, selectedDate);
        }
    };

    const handleSelectDate = (dateStr) => {
        setSelectedDate(dateStr);
        setSelectedSlot(null);
        setSuccessMessage("");
        if (barber && barber !== "not_found") {
            const duration = selectedService
                ? parseInt(selectedService.duration, 10)
                : 30;
            generateSlots(barber, duration, dateStr);
        }
    };

    async function refreshBookingState(targetBarberId, dateStr = selectedDate) {
        if (!targetBarberId || String(targetBarberId).trim() === "") {
            setError(t("client.barbershopDetails.invalidBarberId"));
            return { latestBookings: [], latestError: t("client.barbershopDetails.invalidBarberId") };
        }

        const { data: latestBookings, error: latestError } = await getBookingsForBarber(targetBarberId, dateStr);

        if (latestError) {
            setError(t("client.dashboard.somethingWrong"));
            return { latestBookings: [], latestError };
        }

        const busySlots = (latestBookings ?? [])
            .filter((booking) => isBlockingSlotStatus(booking.status))
            .map((booking) => formatTo24h(booking.booking_hours))
            .filter(Boolean)
            .sort(compareTimes);

        setBookedSlots(busySlots);

        return { latestBookings, latestError: null };
    }

    // Keep a stable ref so the realtime callback always sees current barber/date
    const refreshRef = useRef(refreshBookingState);
    useEffect(() => { refreshRef.current = refreshBookingState; });

    useEffect(() => {
        let isMounted = true;

        async function fetchBarber() {
            if (!id || String(id).trim() === "") {
                navigate("/client/dashboard");
                return;
            }

            setLoading(true);
            setError("");
            setSuccessMessage("");

            const { data, error } = await getBarbers();

            if (!isMounted) return;

            if (error) {
                setBarber("not_found");
                setLoading(false);
                return;
            }

            let decodedId;

            try {
                decodedId = decodeURIComponent(id);
            } catch {
                setBarber("not_found");
                setLoading(false);
                return;
            }

            const found = (data ?? []).find(
                (u) =>
                    u.email === decodedId ||
                    u.id === decodedId ||
                    u._id === decodedId
            );

            if (found) {
                const barberKey = found.id ?? found._id;

                if (!barberKey) {
                    setBarber("not_found");
                    setLoading(false);
                    return;
                }

                setBarber(found);

                getBarberReviews(barberKey).then(({ data }) => {
                    if (isMounted) {
                        setReviews(data || []);
                        setReviewsLoading(false);
                    }
                });

                const list =
                    found.services &&
                        found.services.length > 0
                        ? found.services
                        : [
                            {
                                id: "default",
                                name: t("common.defaultHaircut"),
                                duration: "30",
                                price:
                                    found.average_price ??
                                    found.avgPrice ??
                                    "40000",
                            },
                        ];

                const firstService = list[0];

                setSelectedService(firstService);

                const duration = firstService
                    ? parseInt(firstService.duration, 10)
                    : 30;

                const initialDate =
                    location.state?.rebookDate &&
                        dayOptions.some((d) => d.dateStr === location.state.rebookDate)
                        ? location.state.rebookDate
                        : toDateStr(new Date());
                setSelectedDate(initialDate);
                generateSlots(found, duration, initialDate);

                const { data: bookings, error: bookingError } = await getBookingsForBarber(barberKey, initialDate);

                const busySlots = (bookings ?? [])
                    .filter((booking) => isBlockingSlotStatus(booking.status))
                    .map((booking) =>
                        formatTo24h(
                            booking.booking_hours
                        )
                    )
                    .filter(Boolean);

                setBookedSlots(busySlots);

                if (bookingError) {
                    setError(t("client.dashboard.somethingWrong"));
                }
            } else {
                setBarber("not_found");
            }

            setLoading(false);
        }

        fetchBarber();

        return () => {
            isMounted = false;
        };
    }, [id, navigate, location.state?.rebookDate]);

    // Re-fetch booked slots when the selected date changes
    useEffect(() => {
        const barberKey = barber?.id ?? barber?._id;
        if (!barberKey || barber === "not_found") return;

        let cancelled = false;
        (async () => {
            const { latestBookings } = await refreshBookingState(barberKey, selectedDate);
            if (cancelled || !latestBookings) return;
        })();

        return () => { cancelled = true; };
    }, [selectedDate, barber?.id, barber?._id]);

    // Supabase Realtime: instant slot availability updates when any booking changes for this barber
    useEffect(() => {
        const barberKey = barber?.id ?? barber?._id;
        if (!barberKey || barber === "not_found") return;

        const channelName = `bookings-barber-${barberKey}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings', filter: `barber_id=eq.${barberKey}` },
                () => {
                    // Use ref to always have latest barberKey and selectedDate in scope
                    refreshRef.current(barberKey, selectedDate);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [barber?.id, barber?._id, selectedDate]);

    const handleBookSession = async () => {
        if (!clientName || !clientPhone) {
            navigate(`/start?redirect=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        const barberKey = barber?.id ?? barber?._id;

        if (!barberKey) {
            setError(t("client.barbershopDetails.invalidBarberData"));
            return;
        }

        if (!selectedDate) {
            setError(t("client.barbershopDetails.selectDateRequired"));
            return;
        }

        if (!selectedSlot) {
            setError(t("client.barbershopDetails.selectTimeSlot"));
            return;
        }

        const safeSelectedSlot =
            formatTo24h(selectedSlot);

        if (!safeSelectedSlot) {
            setError(t("client.dashboard.somethingWrong"));
            return;
        }

        if (isBookingInProgress) return;

        setBookingLoading(true);
        setIsBookingInProgress(true);
        setError("");
        setSuccessMessage("");

        const {
            latestBookings,
            latestError,
        } = await refreshBookingState(barberKey, selectedDate);

        if (latestError) {
            setBookingLoading(false);
            return;
        }

        if (
            isSlotTaken(
                latestBookings,
                safeSelectedSlot,
                barberKey,
                selectedDate
            )
        ) {
            setError(t("client.barbershopDetails.slotBooked"));
            setBookingLoading(false);
            return;
        }

        const {
            data: newBooking,
            error: bookingError,
        } = await createGuestBooking({
            barber_id: barberKey,
            guest_name: clientName,
            guest_phone: clientPhone,
            booking_date: selectedDate,
            booking_hours: safeSelectedSlot,
            service_name:
                selectedService?.name ||
                t("common.defaultHaircut"),
            service_price: selectedService?.price
                ? String(selectedService.price)
                : String(
                    barber.average_price ??
                    barber.avgPrice ??
                    "40000"
                ),
            notes: notes.trim(),
        });

        if (bookingError) {
            setError(formatBookingErrorMessage(bookingError, t));
            await refreshBookingState(barberKey, selectedDate);
        } else {
            setBookingLoading(false);
            setIsBookingInProgress(false);

            // DB trigger on INSERT fires notifications to both barber
            // (with inline Accept/Reject buttons) and client automatically.
            if (newBooking && newBooking.id) {
                // Send the user to the in-app booking-status screen
                // so they see pending → accepted/rejected in realtime.
                setNotes('');
                navigate(`/client/booking-status/${newBooking.id}`);
            } else {
                setNotes('');
                setSuccessMessage(
                    t("client.barbershopDetails.bookingRequested")
                );
            }

            return;
        }

        setBookingLoading(false);
        setIsBookingInProgress(false);
    };

    const handleRetry = async () => {
        const barberKey = barber?.id ?? barber?._id;

        if (!barberKey) return;

        setRetrying(true);
        setError("");

        await refreshBookingState(barberKey);

        setRetrying(false);
    };

    if (barber === "not_found") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
                <h2 className="text-xl font-bold text-[#111]">
                    {t("client.barbershopDetails.notFound")}
                </h2>
            </div>
        );
    }

    if (loading || !barber) {
        return (
            <div className="min-h-screen bg-[var(--bg-base)] flex justify-center px-0 sm:px-6 py-0 sm:py-8 safe-bottom">
                <div className="w-full max-w-md md:max-w-5xl bg-white sm:rounded-[32px] overflow-hidden relative border-0 sm:border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)] animate-pulse">
                    <div className="relative h-[320px] w-full skeleton"></div>
                    <div className="relative z-10 -mt-8 bg-white rounded-t-[32px] px-6 py-7">
                        <div className="flex flex-col md:grid md:grid-cols-2 md:gap-8 space-y-8 md:space-y-0">
                            <div className="space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full skeleton ring-4 ring-[#f5f5f7]"></div>
                                    <div>
                                        <div className="h-8 w-48 skeleton rounded-lg mb-2"></div>
                                        <div className="h-4 w-24 skeleton rounded-md"></div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-24 skeleton rounded-3xl"></div>
                                    <div className="h-24 skeleton rounded-3xl"></div>
                                </div>
                                <div>
                                    <div className="h-6 w-32 skeleton rounded-md mb-4"></div>
                                    <div className="space-y-3">
                                        <div className="h-[88px] skeleton rounded-3xl"></div>
                                        <div className="h-[88px] skeleton rounded-3xl"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <div className="h-6 w-32 skeleton rounded-md mb-4"></div>
                                    <div className="flex gap-2 mb-6">
                                        <div className="h-16 w-[72px] skeleton rounded-2xl"></div>
                                        <div className="h-16 w-[72px] skeleton rounded-2xl"></div>
                                        <div className="h-16 w-[72px] skeleton rounded-2xl"></div>
                                    </div>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="h-6 w-40 skeleton rounded-md"></div>
                                        <div className="h-6 w-20 skeleton rounded-full"></div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="h-[88px] skeleton rounded-3xl"></div>
                                        <div className="h-[88px] skeleton rounded-3xl"></div>
                                        <div className="h-[88px] skeleton rounded-3xl"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const barberServices =
        barber &&
            barber !== "not_found" &&
            barber.services &&
            barber.services.length > 0
            ? barber.services
            : barber && barber !== "not_found"
                ? [
                    {
                        id: "default",
                        name: t("common.defaultHaircut"),
                        duration: "30",
                        price:
                            barber.average_price ??
                            barber.avgPrice ??
                            "40000",
                    },
                ]
                : [];

    return (
        <PageContainer
            hasHeader={false}
            hasBottomNav={false}
            extraBottom={80}
            className="flex justify-center px-0 sm:px-6 py-0 sm:py-8"
        >
            <div className="w-full max-w-md md:max-w-5xl bg-white sm:rounded-[32px] overflow-hidden relative border-0 sm:border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-5 left-5 z-10 glass hover:bg-white/90 backdrop-blur-md w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border border-white/40 active:scale-[0.9] text-white hover:text-[#111] shadow-lg"
                >
                    <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>

                <div className="relative h-[320px] w-full">
                    <img
                        src={
                            barber.office_img
                                ? barber.office_img
                                : barber.shopImage
                                    ? barber.shopImage
                                    : "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop"
                        }
                        alt={t("client.barbershopDetails.barberAlt")}
                        className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                </div>

                <div className="relative z-10 -mt-8 bg-white rounded-t-[32px] px-6 py-7">
                    <div className="flex flex-col md:grid md:grid-cols-2 md:gap-8 md:items-start space-y-8 md:space-y-0">
                        {/* Left Column: Profile, Info, Services, Location */}
                        <div className="space-y-8">
                            <div className="flex items-center gap-4">
                                {barber.profile_img ? (
                                    <img
                                        src={barber.profile_img}
                                        alt={barber.fullname}
                                        className="w-16 h-16 rounded-full object-cover ring-4 ring-[#f5f5f7]"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-[#378ADD] flex items-center justify-center ring-4 ring-[#f5f5f7]">
                                        <span className="text-white text-xl font-bold">
                                            {(
                                                barber.fullname ||
                                                barber.name ||
                                                "B"
                                            )
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">
                                            {barber.office_name ||
                                                barber.shopName ||
                                                t("client.barbershopDetails.gentlemansAtelier")}
                                        </h2>
                                        {averageRating > 0 && (
                                            <div className="flex items-center gap-1 bg-[var(--bg-base)] px-2 py-1.5 rounded-lg border border-black/5 shadow-sm">
                                                <Star size={14} className="text-amber-400 fill-amber-400" />
                                                <span className="text-[13px] font-bold text-[#111] leading-none">{averageRating}</span>
                                            </div>
                                        )}
                                        {barber.tier === 'premium' && (
                                            <span className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-400 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 uppercase tracking-wider select-none shrink-0">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19h20l-2-8-5 3.5L12 8l-3 6.5L4 11z" /></svg>
                                                <span>PREMIUM</span>
                                            </span>
                                        )}
                                        {(barber.tier === 'standard' || barber.tier === 'pro') && (
                                            <span className="bg-gradient-to-r from-[#378ADD] to-[#185FA5] text-white font-extrabold text-[9px] px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 uppercase tracking-wider select-none shrink-0">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9z" /></svg>
                                                <span>STANDART</span>
                                            </span>
                                        )}
                                    </div>

                                    <p className="text-sm text-[#666] mt-1 font-medium">
                                        {barber.fullname ||
                                            barber.name ||
                                            t("common.barber")}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                                    <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">
                                        {t("client.barbershopDetails.averagePrice")}
                                    </p>

                                    <p className="font-bold text-[#111] text-[20px]">
                                        {(
                                            barber.average_price ??
                                            barber.avgPrice ??
                                            0
                                        ).toLocaleString()}{" "}
                                        {t("common.uzs")}
                                    </p>
                                </div>

                                <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                                    <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">
                                        {t("client.barbershopDetails.workingHours")}
                                    </p>

                                    <p className="font-bold text-[#111] text-[18px]">
                                        {barber.working_hours ||
                                            barber.workingHours ||
                                            t("common.defaultWorkingHours")}
                                    </p>
                                </div>
                            </div>

                            {/* Barbershop Photos Gallery */}
                            {((barber.photos && barber.photos.length > 0) || [barber.photo_1, barber.photo_2, barber.photo_3].filter(Boolean).length > 0) && (
                                <div>
                                    <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                                        Salon suratlari
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(barber.photos || [barber.photo_1, barber.photo_2, barber.photo_3].filter(Boolean)).map((url, i) => (
                                            <div key={i} className="aspect-square rounded-3xl overflow-hidden border border-black/5 bg-[#f8f8f8] shadow-sm">
                                                <img src={url} alt={`Barbershop photo ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200 cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                                    {t("client.barbershopDetails.services")}
                                </h3>

                                <div className="space-y-2">
                                    {barberServices.map((service) => {
                                        const isSelected = selectedService?.id === service.id;
                                        return (
                                            <Card
                                                key={service.id}
                                                interactive
                                                className={`p-4 flex justify-between items-center ${isSelected ? 'ring-2 ring-[var(--brand-primary)]' : ''}`}
                                                onClick={() => handleSelectService(service)}
                                            >
                                                <div>
                                                    <p className="font-bold text-[var(--text-primary)]">{service.name}</p>
                                                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                        {service.duration} {t("common.minutes")}
                                                    </p>
                                                </div>
                                                <p className="font-bold text-[var(--text-primary)]">
                                                    {Number(service.price).toLocaleString()} {t("common.uzs")}
                                                </p>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>


                            {/* Reviews Section */}
                            <div>
                                <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em] flex items-center gap-2">
                                    Sharhlar
                                    <span className="text-sm font-medium text-[#666] bg-[#f8f8f8] px-2.5 py-0.5 rounded-full border border-black/5">{reviews.length}</span>
                                </h3>

                                {reviewsLoading ? (
                                    <div className="space-y-3">
                                        <div className="h-28 skeleton rounded-3xl"></div>
                                        <div className="h-28 skeleton rounded-3xl"></div>
                                    </div>
                                ) : reviews.length > 0 ? (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 pb-4 scrollbar-hide">
                                        {reviews.map(review => (
                                            <div key={review.id} className="p-5 rounded-3xl bg-[#f8f8f8] border border-black/5 relative group transition-all duration-200 hover:border-black/10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-bold text-sm text-[#111]">
                                                            {review.clients?.fullname || "Mehmon"}
                                                        </p>
                                                        <div className="flex text-amber-400 mt-1">
                                                            {[1,2,3,4,5].map(star => (
                                                                <Star key={star} size={12} className={star <= review.rating ? "fill-amber-400" : "text-gray-300"} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-[#999] font-medium">{new Date(review.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {review.comment && <p className="text-[13px] text-[#444] mt-2.5 leading-relaxed">{review.comment}</p>}

                                                {review.guest_phone === clientPhone && (
                                                    <button
                                                        onClick={() => handleDeleteReview(review.id)}
                                                        className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-50"
                                                        aria-label="Delete review"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-[#f8f8f8] border border-black/5 rounded-3xl p-6 text-center">
                                        <Star size={32} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm font-medium text-[#777]">Hali sharhlar yo'q</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Location Map — placed at the very bottom after booking flow */}
                    <div className="mt-8 pt-8 border-t border-black/5">
                        <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                            {t("client.barbershopDetails.location")}
                        </h3>
                        <InteractiveMap
                            coordinates={barber.location}
                            address={barber.address || barber.location?.address || t("client.barbershopDetails.addressNotProvided")}
                            shopName={barber.office_name || barber.shopName}
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-[var(--border-subtle)] safe-bottom z-20">
                    <Button
                        className="w-full"
                        size="lg"
                        onClick={() => setBookingOpen(true)}
                    >
                        {selectedService
                            ? `${t('client.barbershopDetails.bookNow')} — ${selectedService.name}`
                            : t('client.barbershopDetails.bookNow')}
                    </Button>
                </div>
            </div>

            <BookingSheet
                isOpen={bookingOpen}
                onClose={() => { if (!bookingLoading) setBookingOpen(false); }}
                services={barberServices}
                selectedService={selectedService}
                onSelectService={handleSelectService}
                dayOptions={dayOptions}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                slots={slots}
                bookedSlots={bookedSlots}
                selectedSlot={selectedSlot}
                onSelectSlot={(time) => setSelectedSlot(selectedSlot === time ? null : time)}
                error={error}
                successMessage={successMessage}
                loading={bookingLoading || isBookingInProgress}
                onConfirm={handleBookSession}
                onGoHome={() => navigate('/client/dashboard')}
                barber={barber}
                notes={notes}
                onNotesChange={setNotes}
            />
        </PageContainer>
    );
}