import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, MapPin, User, Phone, CheckCircle2 } from "lucide-react";
import { getBarbers } from "../../api/barberApi.js";
import { bookingMatchesBarber, createGuestBooking, getBookings } from "../../api/bookingApi.js";
import { compareTimes, formatTo24h, isSlotTaken, getCurrentTime } from "../../utils/time.js";
import { isBlockingSlotStatus, formatBookingErrorMessage } from "../../utils/bookingStatus.js";
import { t } from "../../utils/i18n.js";
import { toDateStr, getBookingDayOptions, bookingMatchesDate, formatBookingDate } from "../../utils/dates.js";

const BOOKING_DAY_COUNT = 7;

export default function GuestBooking() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [barber, setBarber] = useState(null);
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [error, setError] = useState("");
    const [successBooking, setSuccessBooking] = useState(null);

    // Guest Info Form
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");

    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));

    const dayOptions = useMemo(() => getBookingDayOptions(BOOKING_DAY_COUNT), []);

    // Uzbekistan phone mask formatter (+998 XX XXX XX XX)
    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.startsWith("998")) {
            value = value.slice(3);
        }
        value = value.slice(0, 9); // max 9 digits after 998
        
        let formatted = "+998 ";
        if (value.length > 0) {
            formatted += value.slice(0, 2);
        }
        if (value.length > 2) {
            formatted += " " + value.slice(2, 5);
        }
        if (value.length > 5) {
            formatted += " " + value.slice(5, 7);
        }
        if (value.length > 7) {
            formatted += " " + value.slice(7, 9);
        }

        if (value.length === 0) {
            setGuestPhone("");
        } else {
            setGuestPhone(formatted);
        }
    };

    const cleanPhone = (phoneStr) => {
        return phoneStr.replace(/\s/g, "");
    };

    function generateSlots(barberData, durationMins = 30, dateStr = toDateStr(new Date())) {
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
            const [lsH, lsM] = barberData.lunchStart.split(":").map(Number);
            const [leH, leM] = barberData.lunchEnd.split(":").map(Number);
            lStart = lsH * 60 + lsM;
            lEnd = leH * 60 + leM;
        }

        const allSlots = [];
        const availableSlots = [];
        const todayStr = toDateStr(new Date());
        const isToday = dateStr === todayStr;
        let count = 0;
        const now = getCurrentTime();

        while ((curHour < endHour || (curHour === endHour && curMin < endMin)) && count < 100) {
            const timeMins = curHour * 60 + curMin;
            const isLunch = lStart !== -1 && timeMins >= lStart && timeMins < lEnd;

            if (!isLunch) {
                const timeString = `${curHour.toString().padStart(2, "0")}:${curMin.toString().padStart(2, "0")}`;
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

    async function refreshBookingState(targetBarberId, dateStr = selectedDate) {
        if (!targetBarberId) return { latestBookings: [], latestError: 'invalid_id' };

        const { data: latestBookings, error: latestError } = await getBookings();
        if (latestError) return { latestBookings: [], latestError };

        const busySlots = (latestBookings ?? [])
            .filter((booking) => bookingMatchesBarber(booking.barber, targetBarberId))
            .filter((booking) => bookingMatchesDate(booking, dateStr))
            .filter((booking) => isBlockingSlotStatus(booking.status))
            .map((booking) => formatTo24h(booking.booking_hours))
            .filter(Boolean);

        setBookedSlots(busySlots);
        return { latestBookings, latestError: null };
    }

    useEffect(() => {
        let isMounted = true;
        async function fetchBarber() {
            if (!id) return;
            setLoading(true);
            const [{ data }, { data: bookings }] = await Promise.all([
                getBarbers(),
                getBookings(),
            ]);

            if (!isMounted) return;

            const found = (data ?? []).find(u => u.id === id || u._id === id);
            if (found) {
                setBarber(found);
                const services = found.services?.length ? found.services : [
                    {
                        id: "default",
                        name: t("common.defaultHaircut"),
                        duration: "30",
                        price: found.average_price || "40000",
                    }
                ];
                setSelectedService(services[0]);
                generateSlots(found, 30, selectedDate);

                const busySlots = (bookings ?? [])
                    .filter(b => bookingMatchesBarber(b.barber, found.id))
                    .filter(b => bookingMatchesDate(b, selectedDate))
                    .filter(b => isBlockingSlotStatus(b.status))
                    .map(b => formatTo24h(b.booking_hours))
                    .filter(Boolean);

                setBookedSlots(busySlots);
            } else {
                setBarber("not_found");
            }
            setLoading(false);
        }

        fetchBarber();
        return () => { isMounted = false; };
    }, [id]);

    useEffect(() => {
        if (!barber || barber === "not_found") return;
        refreshBookingState(barber.id, selectedDate);
    }, [selectedDate, barber]);

    const handleSelectService = (service) => {
        setSelectedService(service);
        setSelectedSlot(null);
        if (barber) {
            generateSlots(barber, parseInt(service.duration, 10) || 30, selectedDate);
        }
    };

    const handleBookSession = async () => {
        const barberId = barber?.id || barber?._id;
        if (!barberId) return;

        if (!selectedSlot) {
            setError(t("client.barbershopDetails.selectTimeSlot"));
            return;
        }

        if (!guestName.trim()) {
            setError(t("guest.namePlaceholder") + " is required");
            return;
        }

        const phoneCleaned = cleanPhone(guestPhone);
        if (phoneCleaned.length < 13) {
            setError(t("guest.phoneError"));
            return;
        }

        setBookingLoading(true);
        setError("");

        const { latestBookings, latestError } = await refreshBookingState(barberId, selectedDate);
        if (latestError) {
            setError(t("errors.generic"));
            setBookingLoading(false);
            return;
        }

        const safeSlot = formatTo24h(selectedSlot);
        if (isSlotTaken(latestBookings, safeSlot, barberId, selectedDate)) {
            setError(t("errors.slotTaken"));
            setBookingLoading(false);
            return;
        }

        const { data: newBooking, error: bookingError } = await createGuestBooking({
            barber_id: barberId,
            guest_name: guestName,
            guest_phone: phoneCleaned,
            booking_date: selectedDate,
            booking_hours: safeSlot,
            service_name: selectedService?.name || t("common.defaultHaircut"),
            service_price: selectedService?.price ? String(selectedService.price) : String(barber.average_price || "40000"),
        });

        if (bookingError) {
            setError(formatBookingErrorMessage(bookingError, t));
        } else {
            setSuccessBooking(newBooking);
        }
        setBookingLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex justify-center items-center bg-[#f5f5f7]">
                <div className="w-8 h-8 border-2 border-black/10 border-t-[#378ADD] rounded-full animate-spin" />
            </div>
        );
    }

    if (barber === "not_found" || !barber) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <h2 className="text-xl font-bold text-[#111]">{t("client.barbershopDetails.notFound")}</h2>
            </div>
        );
    }

    if (successBooking) {
        const queryPhone = encodeURIComponent(successBooking.guest_phone || "");
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 page-animate">
                <div className="w-full max-w-md bg-white border border-black/5 rounded-[32px] p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                        <CheckCircle2 className="text-green-500" size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-[#111] tracking-tight">{t('guest.success')}</h2>
                    <p className="text-sm text-[#666] font-medium mt-3">
                        {successBooking.service_name} — {formatTo24h(successBooking.booking_hours)} ({formatBookingDate(successBooking.booking_date, { style: 'short' })})
                    </p>

                    <button
                        onClick={() => navigate(`/track/${successBooking.id}?phone=${queryPhone}`)}
                        className="w-full mt-8 py-4 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-sm transition-all duration-200 shadow-[0_10px_25px_rgba(55,138,221,0.2)] active:scale-95"
                    >
                        {t('guest.trackTitle')}
                    </button>
                </div>
            </div>
        );
    }

    const barberServices = barber.services?.length ? barber.services : [
        {
            id: "default",
            name: t("common.defaultHaircut"),
            duration: "30",
            price: barber.average_price || "40000",
        }
    ];

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex justify-center px-4 py-8 max-w-5xl mx-auto page-animate">
            <div className="w-full bg-white rounded-[32px] overflow-hidden border border-black/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)]">
                
                {/* Banner image */}
                <div className="relative h-[240px] w-full">
                    <img
                        src={barber.photo_1 || "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop"}
                        alt={barber.office_name}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-6 left-6 text-white">
                        <h2 className="text-2xl font-black tracking-tight">{barber.office_name || t('client.barbershopDetails.gentlemansAtelier')}</h2>
                        <p className="text-xs opacity-80 mt-1 font-bold">{barber.fullname}</p>
                    </div>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    
                    {/* Left Column: Guest Info & Services */}
                    <div className="space-y-6">
                        
                        {/* Guest Details Form */}
                        <div className="bg-[#f8f8f8] p-6 rounded-3xl border border-black/5 space-y-4">
                            <h3 className="text-sm font-black text-[#111] uppercase tracking-wider mb-2">{t('guest.bookTitle')}</h3>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">{t('guest.namePlaceholder')}</label>
                                <div className="relative flex items-center">
                                    <User className="absolute left-4 text-gray-400" size={16} />
                                    <input 
                                        type="text" 
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        placeholder={t('guest.namePlaceholder')}
                                        className="w-full h-12 pl-11 pr-5 bg-white border border-black/5 rounded-xl text-sm font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">{t('guest.phonePlaceholder')}</label>
                                <div className="relative flex items-center">
                                    <Phone className="absolute left-4 text-gray-400" size={16} />
                                    <input 
                                        type="tel" 
                                        value={guestPhone}
                                        onChange={handlePhoneChange}
                                        placeholder="+998 XX XXX XX XX"
                                        className="w-full h-12 pl-11 pr-5 bg-white border border-black/5 rounded-xl text-sm font-medium outline-none focus:border-[#185FA5]/30 focus:ring-2 focus:ring-[#85B7EB]/20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Services List */}
                        <div>
                            <h3 className="text-base font-bold text-[#111] mb-3">{t('client.barbershopDetails.services')}</h3>
                            <div className="space-y-2">
                                {barberServices.map(service => {
                                    const isSelected = selectedService?.id === service.id;
                                    return (
                                        <div 
                                            key={service.id}
                                            onClick={() => handleSelectService(service)}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex justify-between items-center ${
                                                isSelected 
                                                    ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-[0_5px_15px_rgba(24,95,165,0.15)]'
                                                    : 'bg-[#fafafa] border-black/5 hover:border-black/15'
                                            }`}
                                        >
                                            <div>
                                                <p className="text-sm font-bold">{service.name}</p>
                                                <p className="text-xs opacity-75 mt-0.5">{service.duration} {t('common.minutes')}</p>
                                            </div>
                                            <p className="font-bold text-sm">{Number(service.price).toLocaleString()} UZS</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Date, Slot & Submission */}
                    <div className="space-y-6">
                        
                        {/* Date selection */}
                        <div>
                            <h3 className="text-base font-bold text-[#111] mb-3">{t('client.barbershopDetails.selectDate')}</h3>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {dayOptions.map(day => {
                                    const isSelected = selectedDate === day.dateStr;
                                    return (
                                        <button
                                            key={day.dateStr}
                                            onClick={() => setSelectedDate(day.dateStr)}
                                            className={`shrink-0 flex flex-col items-center min-w-[64px] py-2.5 rounded-xl border transition-all font-bold text-xs ${
                                                isSelected 
                                                    ? 'bg-[#185FA5] text-white border-[#185FA5]'
                                                    : 'bg-white text-[#666] border-black/5 hover:border-[#378ADD]/30'
                                            }`}
                                        >
                                            <span className="text-[9px] uppercase tracking-wider mb-0.5 opacity-80">{day.label}</span>
                                            <span className="text-sm">{day.dateStr.slice(-2)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Slots Selection */}
                        <div>
                            <h3 className="text-base font-bold text-[#111] mb-3 flex items-center justify-between">
                                <span>{t('client.barbershopDetails.availableSlots')}</span>
                                <span className="text-xs bg-[#E6F1FB] text-[#0C447C] px-2.5 py-0.5 rounded-full font-bold">
                                    {formatBookingDate(selectedDate, { style: 'short' })}
                                </span>
                            </h3>

                            <div className="grid grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto">
                                {slots.length > 0 ? (
                                    slots.map(time => {
                                        const isBooked = bookedSlots.includes(time);
                                        const isSelected = selectedSlot === time;
                                        return (
                                            <button
                                                key={time}
                                                disabled={isBooked}
                                                onClick={() => setSelectedSlot(isSelected ? null : time)}
                                                className={`h-14 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center ${
                                                    isBooked
                                                        ? 'bg-[#f3f3f3] text-[#bbb] border-transparent cursor-not-allowed'
                                                        : isSelected
                                                            ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-sm'
                                                            : 'bg-white border-black/5 hover:bg-[#fafafa]'
                                                }`}
                                            >
                                                <span className="text-[9px] uppercase opacity-75 font-normal">{t('common.time')}</span>
                                                <span className="text-sm font-black mt-0.5">{time}</span>
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-3 py-6 text-center text-[#888] font-bold text-xs">
                                        {t('client.barbershopDetails.noSlots')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleBookSession}
                            disabled={bookingLoading || !selectedSlot || !guestName.trim() || guestPhone.length < 17}
                            className="w-full h-14 bg-[#378ADD] hover:bg-[#185FA5] text-white font-bold rounded-2xl text-sm transition-all shadow-[0_10px_25px_rgba(55,138,221,0.2)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {bookingLoading ? t('common.pleaseWait') : t('guest.submit')}
                        </button>

                    </div>

                </div>

            </div>
        </div>
    );
}
