import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Clock, MapPin, Star, Trash2 } from "lucide-react";
import InteractiveMap from "../../components/InteractiveMap.jsx";
import { getBarbers } from "../../api/barberApi.js";
import { getBarberReviews, deleteReview } from "../../api/reviewApi.js";
import {
    bookingMatchesBarber,
    createGuestBooking,
    getBookings,
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
        if (barberData.isWorkingNow === false) {
            setSlots([]);
            return;
        }

        const hours = barberData.working_hours || barberData.workingHours;

        if (!hours || !hours.includes("-")) return;

        const [startStr, endStr] = hours.split("-").map((s) => s.trim());

        let startMatch = startStr.match(/^(\d{1,2}):(\d{2})$/);
        let endMatch = endStr.match(/^(\d{1,2}):(\d{2})$/);

        if (!startMatch || !endMatch) return;

        let curHour = parseInt(startMatch[1], 10);
        let curMin = parseInt(startMatch[2], 10);

        const endHour = parseInt(endMatch[1], 10);
        const endMin = parseInt(endMatch[2], 10);

        let lStart = -1;
        let lEnd = -1;

        if (barberData.lunchStart && barberData.lunchEnd) {
            const [lsH, lsM] = barberData.lunchStart
                .split(":")
                .map(Number);

            const [leH, leM] = barberData.lunchEnd
                .split(":")
                .map(Number);

            lStart = lsH * 60 + lsM;
            lEnd = leH * 60 + leM;
        }

        const allSlots = [];
        const availableSlots = [];
        const todayStr = toDateStr(new Date());
        const isToday = dateStr === todayStr;

        let count = 0;
        const now = getCurrentTime();

        while (
            (curHour < endHour ||
                (curHour === endHour && curMin < endMin)) &&
            count < 100
        ) {
            const timeMins = curHour * 60 + curMin;

            const isLunch =
                lStart !== -1 &&
                timeMins >= lStart &&
                timeMins < lEnd;

            if (!isLunch) {
                const timeString = `${curHour
                    .toString()
                    .padStart(2, "0")}:${curMin
                        .toString()
                        .padStart(2, "0")}`;

                const normalized = formatTo24h(timeString);

                if (normalized) {
                    allSlots.push(normalized);
                    if (!isToday || normalized >= now) {
                        availableSlots.push(normalized);
                    }
                }
            }

            curMin += durationMins;

            while (curMin >= 60) {
                curMin -= 60;
                curHour += 1;
            }

            count++;
        }

        setSlots(availableSlots);
    }

    const handleSelectService = (service) => {
        setSelectedService(service);
        setSelectedSlot(null);

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

        const { data: latestBookings, error: latestError } = await getBookings();

        if (latestError) {
            setError(t("client.dashboard.somethingWrong"));
            return { latestBookings: [], latestError };
        }

        const busySlots = (latestBookings ?? [])
            .filter((booking) => bookingMatchesBarber(booking.barber, targetBarberId))
            .filter((booking) => bookingMatchesDate(booking, dateStr))
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

            const [
                { data, error },
                {
                    data: bookings,
                    error: bookingError,
                },
            ] = await Promise.all([
                getBarbers(),
                getBookings(),
            ]);

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

                const busySlots = (bookings ?? [])
                    .filter((booking) =>
                        bookingMatchesBarber(
                            booking.barber,
                            barberKey
                        )
                    )
                    .filter((booking) => bookingMatchesDate(booking, initialDate))
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

    const toggleSlot = (time) => {
        if (bookedSlots.includes(time)) return;

        setSelectedSlot((prev) =>
            prev === time ? null : time
        );

        setSuccessMessage("");
    };

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
                navigate(`/client/booking-status/${newBooking.id}`);
            } else {
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
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <h2 className="text-xl font-bold text-[#111]">
                    {t("client.barbershopDetails.notFound")}
                </h2>
            </div>
        );
    }

    if (loading || !barber) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center px-0 sm:px-6 py-0 sm:py-8 safe-bottom">
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
        <div className="min-h-screen bg-[#f5f5f7] flex justify-center px-0 sm:px-6 py-0 sm:py-8 safe-bottom">
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
                                            <div className="flex items-center gap-1 bg-[#f5f5f7] px-2 py-1.5 rounded-lg border border-black/5 shadow-sm">
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

                                <div className="space-y-3">
                                    {barberServices.map((service) => {
                                        const isSelected =
                                            selectedService?.id ===
                                            service.id;

                                        return (
                                            <div
                                                key={service.id}
                                                onClick={() =>
                                                    handleSelectService(
                                                        service
                                                    )
                                                }
                                                className={`p-5 rounded-3xl border cursor-pointer transition-all duration-200 flex justify-between items-center active:scale-[0.98]
                                                ${isSelected
                                                        ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_10px_30px_rgba(37,99,235,0.2)]"
                                                        : "bg-[#f8f8f8] border-black/5 hover:border-black/15 hover:shadow-sm"
                                                    }`}
                                            >
                                                <div>
                                                    <p className="font-bold">
                                                        {service.name}
                                                    </p>

                                                    <p className="text-xs opacity-70 mt-1">
                                                        {service.duration} {t("common.minutes")}
                                                    </p>
                                                </div>

                                                <p className="font-bold text-lg">
                                                    {Number(
                                                        service.price
                                                    ).toLocaleString()}{" "}
                                                    {t("common.uzs")}
                                                </p>
                                            </div>
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

                        {/* Right Column: Date Selection, Available Slots, Alerts & Booking Button */}
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                                    {t("client.barbershopDetails.selectDate")}
                                </h3>
                                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide mb-6">
                                    {dayOptions.map((day) => {
                                        const isSelected = selectedDate === day.dateStr;
                                        return (
                                            <button
                                                key={day.dateStr}
                                                type="button"
                                                onClick={() => handleSelectDate(day.dateStr)}
                                                className={`shrink-0 flex flex-col items-center min-w-[72px] py-3 px-3 rounded-2xl border transition-all font-bold active:scale-95
                                                ${isSelected
                                                        ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_8px_20px_rgba(37,99,235,0.25)]"
                                                        : "bg-[#f8f8f8] text-[#666] border-black/5 hover:border-[#2563eb]/30 hover:bg-[#eff6ff]"
                                                    }`}
                                            >
                                                <span className="text-[10px] uppercase tracking-wider leading-none mb-1 opacity-80">
                                                    {day.label}
                                                </span>
                                                <span className="text-base leading-none">
                                                    {day.dateStr.slice(-2)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[20px] font-bold text-[#111] tracking-[-0.02em]">
                                        {t("client.barbershopDetails.availableSlots")}
                                    </h3>
                                    <span className="text-xs bg-[#E6F1FB] text-[#0C447C] px-3 py-1 rounded-full font-medium">
                                        {formatBookingDate(selectedDate, { style: "short" })}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pb-2">
                                    {slots.length > 0 ? (
                                        slots.map((time) => (
                                            <label
                                                key={time}
                                                className={`flex flex-col items-center justify-center h-[88px] rounded-3xl border transition-all duration-200 cursor-pointer
                                                ${bookedSlots.includes(time)
                                                        ? "bg-[#f3f3f3] text-[#bbb] border-transparent cursor-not-allowed"
                                                        : selectedSlot === time
                                                            ? "bg-[#2563eb] text-white border-[#2563eb] shadow-[0_8px_25px_rgba(37,99,235,0.25)]"
                                                            : "bg-[#f8f8f8] border-black/5 hover:border-[#2563eb]/30 hover:bg-[#eff6ff] active:scale-[0.98]"
                                                    }`}
                                            >
                                                <span className="text-[11px] uppercase tracking-wide opacity-70">
                                                    {t("common.time")}
                                                </span>

                                                <span className="text-lg font-bold">
                                                    {time}
                                                </span>

                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={
                                                        selectedSlot ===
                                                        time
                                                    }
                                                    disabled={bookedSlots.includes(
                                                        time
                                                    )}
                                                    onChange={() =>
                                                        toggleSlot(time)
                                                    }
                                                />
                                            </label>
                                        ))
                                    ) : (
                                        <div className="col-span-3 flex flex-col items-center justify-center py-10 text-center">
                                            <Clock
                                                size={34}
                                                className="text-gray-400 mb-3"
                                            />

                                            <h3 className="font-bold text-[#111]">
                                                {t("client.barbershopDetails.noSlots")}
                                            </h3>

                                            <p className="text-sm text-[#777] mt-2">
                                                {t("client.barbershopDetails.fullyBookedDay")}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-black/5">
                                {error && (
                                    <div className="rounded-3xl border border-red-100 bg-red-50 p-5 animate-fade-in">
                                        <p className="font-semibold text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                )}

                                {successMessage && (
                                    <div className="rounded-3xl border border-green-100 bg-green-50 p-5 animate-fade-in">
                                        <p className="font-semibold text-green-700">
                                            {successMessage}
                                        </p>
                                    </div>
                                )}

                                {successMessage ? (
                                    <button
                                        onClick={() =>
                                            navigate("/client/dashboard")
                                        }
                                        className="w-full h-14 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] text-white font-bold text-[15px] transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        {t("common.home")}
                                    </button>
                                ) : (
                                    <div className="action-bar-bottom sm:relative sm:bg-transparent sm:p-0 sm:z-0">
                                        <button
                                            onClick={handleBookSession}
                                            disabled={
                                                !selectedSlot ||
                                                bookingLoading ||
                                                isBookingInProgress
                                            }
                                            className="w-full h-14 rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8] active:scale-[0.98] text-white font-bold text-[16px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(37,99,235,0.3)]"
                                        >
                                            {bookingLoading ||
                                                isBookingInProgress ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    {t("client.barbershopDetails.booking")}
                                                </>
                                            ) : (
                                                t("client.barbershopDetails.bookNow")
                                            )}
                                        </button>
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
            </div>

        </div>
    );
}