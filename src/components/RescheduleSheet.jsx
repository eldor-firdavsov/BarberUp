import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { rescheduleBooking, validateBookingDay, getBookingsForBarber } from '../api/bookingApi.js';
import { formatTo24h, isSlotTaken, generateAvailableSlots } from '../utils/time.js';
import { isBlockingSlotStatus } from '../utils/bookingStatus.js';
import { toDateStr, getBookingDayOptions, bookingMatchesDate, formatBookingDate } from '../utils/dates.js';
import { t } from '../utils/i18n.js';
import { Sheet, Button, Chip, Card } from './ui/index.js';

const RESCHEDULE_DAY_COUNT = 7;

/**
 * RescheduleSheet — lets a client pick a new date + time for an existing booking.
 * On confirm: calls rescheduleBooking(), resets status to pending.
 *
 * Props:
 *   booking   — the current booking object
 *   barber    — barber object (for slots + off-day validation)
 *   isOpen    — boolean
 *   onClose   — () => void
 *   onSuccess — (updatedBooking) => void
 */
export default function RescheduleSheet({ booking, barber, isOpen, onClose, onSuccess }) {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [slots, setSlots] = useState([]);
    const [bookedSlots, setBookedSlots] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const dayOptions = useMemo(() => getBookingDayOptions(RESCHEDULE_DAY_COUNT), []);

    // Generate slots when date changes
    useEffect(() => {
        if (!selectedDate || !barber) return;

        const duration = booking?.service_name
            ? parseInt(barber.services?.find(s => s.name === booking.service_name)?.duration, 10) || 30
            : 30;

        const todayStr = toDateStr(new Date());
        const generated = generateAvailableSlots(barber, duration, selectedDate, todayStr);
        setSlots(generated);
        setSelectedSlot(null);

        // Fetch booked slots for this date
        (async () => {
            const barberId = barber?.id ?? barber?._id;
            if (!barberId) return;

            const { data: barberBookings } = await getBookingsForBarber(barberId, selectedDate);
            const busy = (barberBookings ?? [])
                .filter(b => b.id !== booking?.id) // exclude current booking
                .filter(b => isBlockingSlotStatus(b.status))
                .map(b => formatTo24h(b.booking_hours))
                .filter(Boolean);

            setBookedSlots(busy);
        })();
    }, [selectedDate, barber, booking?.id, booking?.service_name]);

    const handleConfirm = async () => {
        if (!selectedDate || !selectedSlot || !booking?.id) return;

        setLoading(true);
        setError('');

        const { data, error: err } = await rescheduleBooking(booking.id, selectedDate, selectedSlot);

        if (err) {
            setError(typeof err === 'string' ? err : t('errors.generic'));
            setLoading(false);
            return;
        }

        setLoading(false);
        onSuccess?.(data);
        onClose?.();
    };

    if (!isOpen) return null;

    const footerContent = (
        <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose}>
                {t('common.cancel')}
            </Button>
            <Button
                className="flex-1"
                disabled={!selectedDate || !selectedSlot || loading}
                onClick={handleConfirm}
            >
                {loading ? t('common.pleaseWait') : t('booking.reschedule')}
            </Button>
        </div>
    );

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={t('booking.rescheduleConfirm')}
            footer={footerContent}
        >
            <div className="space-y-6">
                {/* Current booking info */}
                <Card className="p-4">
                    <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                        {t('booking.current')}
                    </p>
                    <p className="font-bold text-[var(--text-primary)]">
                        {formatTo24h(booking?.booking_hours)} — {formatBookingDate(booking?.booking_date, { style: 'short' })}
                    </p>
                    {booking?.service_name && (
                        <p className="text-sm text-[var(--text-secondary)] mt-0.5">{booking.service_name}</p>
                    )}
                    {booking?.reschedule_count > 0 && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                            <RefreshCw size={11} /> {booking.reschedule_count}x {t('booking.reschedule').toLowerCase()}
                        </p>
                    )}
                </Card>

                {/* Date picker */}
                <section>
                    <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                        {t('client.barbershopDetails.selectDate')}
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                        {dayOptions.map((day) => {
                            const validation = validateBookingDay(barber, day.dateStr);
                            const isOff = !validation.valid;
                            return (
                                <Chip
                                    key={day.dateStr}
                                    selected={selectedDate === day.dateStr}
                                    disabled={isOff}
                                    onClick={() => !isOff && setSelectedDate(day.dateStr)}
                                    className="flex-col min-w-[64px] py-2.5 shrink-0"
                                >
                                    <span className="text-[10px] uppercase opacity-80">
                                        {isOff ? t('booking.dayOff') : day.label}
                                    </span>
                                    <span>{day.dateStr.slice(-2)}</span>
                                </Chip>
                            );
                        })}
                    </div>
                </section>

                {/* Time slots */}
                {selectedDate && (
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                                {t('client.barbershopDetails.availableSlots')}
                            </h3>
                            <span className="text-xs font-semibold text-[var(--brand-primary)] bg-[var(--brand-primary-light)] px-2.5 py-1 rounded-full">
                                {formatBookingDate(selectedDate, { style: 'short' })}
                            </span>
                        </div>

                        {slots.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {slots.map((time) => {
                                    const booked = bookedSlots.includes(time);
                                    return (
                                        <Chip
                                            key={time}
                                            selected={selectedSlot === time}
                                            disabled={booked}
                                            onClick={() => setSelectedSlot(selectedSlot === time ? null : time)}
                                            className="flex-col py-3 h-auto"
                                        >
                                            <span className="text-[10px] uppercase opacity-70 font-normal">{t('common.time')}</span>
                                            <span className="text-base">{time}</span>
                                        </Chip>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-8 text-center">
                                <Clock size={28} className="text-[var(--text-tertiary)] mb-2" />
                                <p className="font-bold text-[var(--text-primary)]">{t('client.barbershopDetails.noSlots')}</p>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">{t('booking.noSlots')}</p>
                            </div>
                        )}
                    </section>
                )}

                {error && (
                    <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">{error}</p>
                    </div>
                )}

            </div>
        </Sheet>
    );
}
