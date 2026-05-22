import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, MapPin } from "lucide-react";
import { getBarbers } from "../../api/barberApi.js";
import {
    bookingMatchesBarber,
    createBooking,
    getBookings,
} from "../../api/bookingApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
    compareTimes,
    formatTo24h,
    isSlotTaken,
    getCurrentTime,
} from "../../utils/time.js";

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
    const [isBookingInProgress, setIsBookingInProgress] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [retrying, setRetrying] = useState(false);
    const [isTomorrow, setIsTomorrow] = useState(false);
    const [selectedService, setSelectedService] = useState(null);

    function generateSlots(barberData, durationMins = 30) {
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
        const todaySlots = [];

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

                    if (normalized >= now) {
                        todaySlots.push(normalized);
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

        if (todaySlots.length === 0 && allSlots.length > 0) {
            setSlots(allSlots);
            setIsTomorrow(true);
        } else {
            setSlots(todaySlots);
            setIsTomorrow(false);
        }
    }

    const handleSelectService = (service) => {
        setSelectedService(service);
        setSelectedSlot(null);

        if (barber) {
            const duration = service
                ? parseInt(service.duration, 10)
                : 30;

            generateSlots(barber, duration);
        }
    };

    async function refreshBookingState(targetBarberId) {
        if (!targetBarberId || String(targetBarberId).trim() === "") {
            setError("Invalid barber ID");

            return {
                latestBookings: [],
                latestError: "Invalid barber ID",
            };
        }

        const {
            data: latestBookings,
            error: latestError,
        } = await getBookings();

        if (latestError) {
            setError("Something went wrong");

            return {
                latestBookings: [],
                latestError,
            };
        }

        const busySlots = (latestBookings ?? [])
            .filter((booking) =>
                bookingMatchesBarber(
                    booking.barber,
                    targetBarberId
                )
            )
            .filter(
                (booking) =>
                    !["rejected", "cancelled"].includes(
                        String(booking.status || "").toLowerCase()
                    )
            )
            .map((booking) =>
                formatTo24h(booking.booking_hours)
            )
            .filter(Boolean)
            .sort(compareTimes);

        setBookedSlots(busySlots);

        return {
            latestBookings,
            latestError: null,
        };
    }

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

                const list =
                    found.services &&
                        found.services.length > 0
                        ? found.services
                        : [
                            {
                                id: "default",
                                name: "Regular Haircut",
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

                generateSlots(found, duration);

                const busySlots = (bookings ?? [])
                    .filter((booking) =>
                        bookingMatchesBarber(
                            booking.barber,
                            barberKey
                        )
                    )
                    .filter(
                        (booking) =>
                            ![
                                "rejected",
                                "cancelled",
                            ].includes(
                                String(
                                    booking.status || ""
                                ).toLowerCase()
                            )
                    )
                    .map((booking) =>
                        formatTo24h(
                            booking.booking_hours
                        )
                    )
                    .filter(Boolean);

                setBookedSlots(busySlots);

                if (bookingError) {
                    setError("Something went wrong");
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
    }, [id, navigate]);

    const toggleSlot = (time) => {
        if (bookedSlots.includes(time)) return;

        setSelectedSlot((prev) =>
            prev === time ? null : time
        );

        setSuccessMessage("");
    };

    const handleBookSession = async () => {
        if (!user) {
            navigate("/login");
            return;
        }

        const barberKey = barber?.id ?? barber?._id;

        if (!barberKey) {
            setError("Invalid barber data");
            return;
        }

        if (!selectedSlot) {
            setError("Please select a time slot");
            return;
        }

        const safeSelectedSlot =
            formatTo24h(selectedSlot);

        if (!safeSelectedSlot) {
            setError("Something went wrong");
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
        } = await refreshBookingState(barberKey);

        if (latestError) {
            setBookingLoading(false);
            return;
        }

        if (
            isSlotTaken(
                latestBookings,
                safeSelectedSlot,
                barberKey
            )
        ) {
            setError("This time slot is already booked.");
            setBookingLoading(false);
            return;
        }

        const {
            data: newBooking,
            error: bookingError,
        } = await createBooking({
            barber: barberKey,
            client: user.id,
            booking_hours: safeSelectedSlot,
            service_name:
                selectedService?.name ||
                "Regular Haircut",
            service_price: selectedService?.price
                ? String(selectedService.price)
                : String(
                    barber.average_price ??
                    barber.avgPrice ??
                    "40000"
                ),
        });

        if (bookingError) {
            const duplicateMessage =
                String(bookingError).toLowerCase();

            if (
                duplicateMessage.includes("duplicate") ||
                duplicateMessage.includes("exists") ||
                duplicateMessage.includes("already") ||
                duplicateMessage.includes("taken") ||
                duplicateMessage.includes("booked")
            ) {
                setError(
                    "This time slot is already booked."
                );
            } else {
                setError(bookingError);
            }

            await refreshBookingState(barberKey);
        } else {
            setBookingLoading(false);
            setIsBookingInProgress(false);

            if (
                newBooking &&
                (newBooking.id || newBooking._id)
            ) {
                navigate(
                    `/client/booking-status/${newBooking.id || newBooking._id
                    }`
                );
            } else {
                setSuccessMessage(
                    "Booking requested. Waiting for barber approval..."
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
                    Barber not found
                </h2>
            </div>
        );
    }

    if (loading || !barber) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex justify-center items-center">
                <p className="text-[#777] font-medium">
                    Loading barber details...
                </p>
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
                        name: "Regular Haircut",
                        duration: "30",
                        price:
                            barber.average_price ??
                            barber.avgPrice ??
                            "40000",
                    },
                ]
                : [];

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex justify-center px-3 py-5 sm:px-6 sm:py-8">
            <div className="w-full max-w-md bg-white rounded-[32px] overflow-hidden relative border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]">

                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-5 left-5 z-10 bg-white/20 hover:bg-white/30 backdrop-blur-md w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 border border-white/20"
                >
                    <svg
                        width="20"
                        height="20"
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
                        alt="barber"
                        className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                </div>

                <div className="relative z-10 -mt-8 bg-white rounded-t-[32px] px-6 py-7 space-y-8">

                    <div className="flex items-center gap-4">
                        {barber.profile_img ? (
                            <img
                                src={barber.profile_img}
                                alt={barber.fullname}
                                className="w-16 h-16 rounded-full object-cover ring-4 ring-[#f5f5f7]"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center ring-4 ring-[#f5f5f7]">
                                <span className="text-white text-lg font-bold">
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
                            <h2 className="text-[28px] font-bold text-[#111] tracking-[-0.03em] leading-tight">
                                {barber.office_name ||
                                    barber.shopName ||
                                    "Gentleman's Atelier"}
                            </h2>

                            <p className="text-sm text-[#666] mt-1 font-medium">
                                {barber.fullname ||
                                    barber.name ||
                                    "Barber"}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">

                        <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">
                                Average Price
                            </p>

                            <p className="font-bold text-[#111] text-[20px]">
                                {(
                                    barber.average_price ??
                                    barber.avgPrice ??
                                    0
                                ).toLocaleString()}{" "}
                                UZS
                            </p>
                        </div>

                        <div className="bg-[#f8f8f8] rounded-3xl p-5 border border-black/5">
                            <p className="text-[11px] font-semibold text-[#888] uppercase tracking-[0.12em] mb-2">
                                Working Hours
                            </p>

                            <p className="font-bold text-[#111] text-[18px]">
                                {barber.working_hours ||
                                    barber.workingHours ||
                                    "09:00 - 21:00"}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                            Services
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
                                        className={`p-5 rounded-3xl border cursor-pointer transition-all duration-200 flex justify-between items-center
                                        ${isSelected
                                                ? "bg-black text-white border-black shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
                                                : "bg-[#fafafa] border-black/5 hover:border-black/20"
                                            }`}
                                    >
                                        <div>
                                            <p className="font-bold">
                                                {service.name}
                                            </p>

                                            <p className="text-xs opacity-70 mt-1">
                                                {service.duration} mins
                                            </p>
                                        </div>

                                        <p className="font-bold text-lg">
                                            {Number(
                                                service.price
                                            ).toLocaleString()}{" "}
                                            UZS
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[20px] font-bold text-[#111] tracking-[-0.02em]">
                                Available Slots
                            </h3>

                            {isTomorrow && (
                                <span className="text-xs bg-black text-white px-3 py-1 rounded-full font-medium">
                                    Tomorrow
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto pb-2">
                            {slots.length > 0 ? (
                                slots.map((time) => (
                                    <label
                                        key={time}
                                        className={`flex flex-col items-center justify-center h-[88px] rounded-3xl border transition-all duration-200
                                        ${bookedSlots.includes(
                                            time
                                        )
                                                ? "bg-[#f3f3f3] text-[#bbb] border-transparent cursor-not-allowed"
                                                : selectedSlot ===
                                                    time
                                                    ? "bg-black text-white border-black scale-[1.03] shadow-[0_10px_25px_rgba(0,0,0,0.18)]"
                                                    : "bg-white border-black/5 hover:border-black/15 hover:bg-[#fafafa]"
                                            }`}
                                    >
                                        <span className="text-[11px] uppercase tracking-wide opacity-70">
                                            Time
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
                                        No available slots
                                    </h3>

                                    <p className="text-sm text-[#777] mt-2">
                                        This barber is fully booked today.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[20px] font-bold text-[#111] mb-4 tracking-[-0.02em]">
                            Location
                        </h3>

                        <div className="mt-3 p-4 bg-[#f8f8f8] rounded-3xl border border-black/5">
                            <p className="text-sm text-[#555] font-medium flex items-center gap-2">
                                <MapPin
                                    size={16}
                                    className="text-gray-400"
                                />

                                {barber.address ||
                                    barber.location
                                        ?.address ||
                                    "Address not provided"}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-3xl border border-red-100 bg-red-50 p-5">
                            <p className="font-semibold text-red-700">
                                {error}
                            </p>
                        </div>
                    )}

                    {successMessage && (
                        <div className="rounded-3xl border border-green-100 bg-green-50 p-5">
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
                            className="w-full h-14 rounded-2xl bg-black hover:bg-[#111] text-white font-semibold text-[15px] transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            Home
                        </button>
                    ) : (
                        <button
                            onClick={handleBookSession}
                            disabled={
                                !selectedSlot ||
                                bookingLoading ||
                                isBookingInProgress
                            }
                            className="w-full h-14 rounded-2xl bg-black hover:bg-[#111] text-white font-semibold text-[15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.12)]"
                        >
                            {bookingLoading ||
                                isBookingInProgress ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Booking...
                                </>
                            ) : (
                                "Book Now"
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}