import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Phone, CheckCircle2 } from "lucide-react";
import { getBarbers } from "../../api/barberApi.js";
import { bookingMatchesBarber, createGuestBooking, getBookings } from "../../api/bookingApi.js";
import { formatTo24h, isSlotTaken, generateAvailableSlots } from "../../utils/time.js";
import { isBlockingSlotStatus, formatBookingErrorMessage } from "../../utils/bookingStatus.js";
import { t } from "../../utils/i18n.js";
import { toDateStr, getBookingDayOptions, bookingMatchesDate, formatBookingDate } from "../../utils/dates.js";
import BookingSheet from "../../components/BookingSheet.jsx";
import { Button, Card } from "../../components/ui/index.js";
import PageContainer from "../../components/layout/PageContainer.jsx";

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
    const [bookingOpen, setBookingOpen] = useState(true);

    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");

    const [selectedService, setSelectedService] = useState(null);
    const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));

    const dayOptions = useMemo(() => getBookingDayOptions(BOOKING_DAY_COUNT), []);

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.startsWith("998")) value = value.slice(3);
        value = value.slice(0, 9);

        let formatted = "+998 ";
        if (value.length > 0) formatted += value.slice(0, 2);
        if (value.length > 2) formatted += " " + value.slice(2, 5);
        if (value.length > 5) formatted += " " + value.slice(5, 7);
        if (value.length > 7) formatted += " " + value.slice(7, 9);

        setGuestPhone(value.length === 0 ? "" : formatted);
    };

    const cleanPhone = (phoneStr) => phoneStr.replace(/\s/g, "");

    function generateSlots(barberData, durationMins = 30, dateStr = toDateStr(new Date())) {
        setSlots(generateAvailableSlots(barberData, durationMins, dateStr, toDateStr(new Date())));
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
            const [{ data }, { data: bookings }] = await Promise.all([getBarbers(), getBookings()]);

            if (!isMounted) return;

            const found = (data ?? []).find(u => u.id === id || u._id === id);
            if (found) {
                setBarber(found);
                const services = found.services?.length ? found.services : [{
                    id: "default",
                    name: t("common.defaultHaircut"),
                    duration: "30",
                    price: found.average_price || "40000",
                }];
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
        if (barber) generateSlots(barber, parseInt(service.duration, 10) || 30, selectedDate);
    };

    const handleSelectDate = (dateStr) => {
        setSelectedDate(dateStr);
        setSelectedSlot(null);
        if (barber) {
            const duration = selectedService ? parseInt(selectedService.duration, 10) : 30;
            generateSlots(barber, duration, dateStr);
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
            setBookingOpen(false);
        }
        setBookingLoading(false);
    };

    if (loading) {
        return (
            <PageContainer
                hasHeader={false}
                hasBottomNav={false}
                className="flex justify-center px-4 py-8 max-w-md mx-auto page-animate"
            >
                <div className="w-full bg-white rounded-[var(--radius-xl)] overflow-hidden border border-[var(--border-subtle)]">
                    <div className="h-[200px] w-full skeleton" />
                    <div className="p-6 space-y-4">
                        <div className="h-12 w-full skeleton rounded-xl" />
                        <div className="h-12 w-full skeleton rounded-xl" />
                    </div>
                </div>
            </PageContainer>
        );
    }

    if (barber === "not_found" || !barber) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{t("client.barbershopDetails.notFound")}</h2>
            </div>
        );
    }

    if (successBooking) {
        const queryPhone = encodeURIComponent(successBooking.guest_phone || "");
        return (
            <PageContainer
                hasHeader={false}
                hasBottomNav={false}
                className="flex items-center justify-center p-6 page-animate"
            >
                <Card className="w-full max-w-md p-8 text-center">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100">
                        <CheckCircle2 className="text-green-500" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)]">{t('guest.success')}</h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-3">
                        {successBooking.service_name} — {formatTo24h(successBooking.booking_hours)} ({formatBookingDate(successBooking.booking_date, { style: 'short' })})
                    </p>
                    <Button className="w-full mt-8" size="lg" onClick={() => navigate(`/track/${successBooking.id}?phone=${queryPhone}`)}>
                        {t('guest.trackTitle')}
                    </Button>
                </Card>
            </PageContainer>
        );
    }

    const barberServices = barber.services?.length ? barber.services : [{
        id: "default",
        name: t("common.defaultHaircut"),
        duration: "30",
        price: barber.average_price || "40000",
    }];

    const guestForm = (
        <div className="space-y-3 pb-2 border-b border-[var(--border-subtle)]">
            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">{t('guest.bookTitle')}</h3>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder={t('guest.namePlaceholder')}
                    className="w-full h-11 pl-10 pr-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)]"
                />
            </div>
            <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                <input
                    type="tel"
                    value={guestPhone}
                    onChange={handlePhoneChange}
                    placeholder="+998 XX XXX XX XX"
                    className="w-full h-11 pl-10 pr-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)]"
                />
            </div>
        </div>
    );

    return (
        <PageContainer
            hasHeader={false}
            hasBottomNav={false}
            className="page-animate"
        >
            <div className="relative h-[220px] w-full max-w-md mx-auto">
                <img
                    src={barber.photo_1 || "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop"}
                    alt={barber.office_name}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 text-white">
                    <h2 className="text-2xl font-bold">{barber.office_name || t('client.barbershopDetails.gentlemansAtelier')}</h2>
                    <p className="text-sm opacity-90 mt-1">{barber.fullname}</p>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-4">
                <Button className="w-full" size="lg" onClick={() => setBookingOpen(true)}>
                    {t('guest.submit')}
                </Button>
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
                loading={bookingLoading}
                onConfirm={handleBookSession}
                confirmLabel={t('guest.submit')}
            >
                {guestForm}
            </BookingSheet>
        </PageContainer>
    );
}
