import { useState, useMemo } from 'react';
import { UserPlus, Phone, User, FileText } from 'lucide-react';
import { createWalkInBooking } from '../api/bookingApi.js';
import { formatTo24h, generateAvailableSlots } from '../utils/time.js';
import { toDateStr } from '../utils/dates.js';
import { t } from '../utils/i18n.js';
import { Sheet, Button, Chip, Card } from './ui/index.js';

/**
 * WalkInBookingSheet — barber registers a walk-in client directly.
 * The booking is created with status = 'accepted'.
 *
 * Props:
 *   barber    — barber object (for services list + slot generation)
 *   isOpen    — boolean
 *   onClose   — () => void
 *   onSuccess — (newBooking) => void
 */
export default function WalkInBookingSheet({ barber, isOpen, onClose, onSuccess }) {
    const today = toDateStr(new Date());

    // Default time = current time rounded down to nearest 30min slot
    const defaultTime = useMemo(() => {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = now.getMinutes() < 30 ? '00' : '30';
        return `${h}:${m}`;
    }, []);

    const [guestName, setGuestName]   = useState('');
    const [guestPhone, setGuestPhone] = useState('');
    const [service, setService]       = useState(null);
    const [time, setTime]             = useState(defaultTime);
    const [notes, setNotes]           = useState('');
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');

    // Generate time slots from barber schedule
    const slots = useMemo(() => {
        if (!barber) return [];
        return generateAvailableSlots(barber, 30, today, today);
    }, [barber, today]);

    const barberServices = useMemo(() => {
        if (barber?.services?.length) return barber.services;
        return [{
            id: 'default',
            name: t('common.defaultHaircut'),
            duration: '30',
            price: barber?.average_price || '40000',
        }];
    }, [barber]);

    // Auto-select first service if none selected
    const selectedService = service || barberServices[0] || null;

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.startsWith('998')) value = value.slice(3);
        value = value.slice(0, 9);

        let formatted = '+998 ';
        if (value.length > 0) formatted += value.slice(0, 2);
        if (value.length > 2) formatted += ' ' + value.slice(2, 5);
        if (value.length > 5) formatted += ' ' + value.slice(5, 7);
        if (value.length > 7) formatted += ' ' + value.slice(7, 9);

        setGuestPhone(value.length === 0 ? '' : formatted);
    };

    const handleSubmit = async () => {
        if (!guestName.trim()) {
            setError(t('guest.namePlaceholder') + ' — ' + t('errors.generic'));
            return;
        }
        if (!selectedService || !time) {
            setError(t('errors.generic'));
            return;
        }

        setLoading(true);
        setError('');

        const cleanPhone = guestPhone.replace(/\s/g, '');

        const { data, error: err } = await createWalkInBooking({
            barber_id:     barber?.id ?? barber?._id,
            guest_name:    guestName.trim(),
            guest_phone:   cleanPhone || null,
            booking_date:  today,
            booking_hours: time,
            service_name:  selectedService.name,
            service_price: String(selectedService.price || barber?.average_price || '40000'),
            notes:         notes.trim(),
        });

        setLoading(false);

        if (err) {
            setError(typeof err === 'string' ? err : t('errors.generic'));
            return;
        }

        onSuccess?.(data);
        // Reset form
        setGuestName('');
        setGuestPhone('');
        setNotes('');
        setTime(defaultTime);
        setService(null);
        onClose?.();
    };

    if (!isOpen) return null;

    const footerContent = (
        <Button
            className="w-full"
            size="lg"
            disabled={!guestName.trim() || loading}
            onClick={handleSubmit}
        >
            <UserPlus size={16} className="mr-2" />
            {loading ? t('common.pleaseWait') : t('booking.walkInSuccess')}
        </Button>
    );

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={t('barber.walkIn.title')}
            footer={footerContent}
        >
            <div className="space-y-5">
                {/* Guest name */}
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                    <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder={t('guest.namePlaceholder')}
                        className="w-full h-12 pl-10 pr-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)]"
                    />
                </div>

                {/* Guest phone (optional) */}
                <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" size={16} />
                    <input
                        type="tel"
                        value={guestPhone}
                        onChange={handlePhoneChange}
                        placeholder={`+998 XX XXX XX XX (${t('common.optional')})`}
                        className="w-full h-12 pl-10 pr-4 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)]"
                    />
                </div>

                {/* Service selector */}
                <section>
                    <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                        {t('client.barbershopDetails.services')}
                    </h3>
                    <div className="space-y-2">
                        {barberServices.map((s) => {
                            const isSelected = selectedService?.id === s.id || selectedService?.name === s.name;
                            return (
                                <Card
                                    key={s.id || s.name}
                                    interactive
                                    className={`p-4 flex justify-between items-center ${isSelected ? 'ring-2 ring-[var(--brand-primary)] bg-[var(--brand-primary-light)]' : ''}`}
                                    onClick={() => setService(s)}
                                >
                                    <div>
                                        <p className="font-bold text-[var(--text-primary)]">{s.name}</p>
                                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                            {s.duration} {t('common.minutes')}
                                        </p>
                                    </div>
                                    <p className="font-bold text-[var(--text-primary)]">
                                        {Number(s.price).toLocaleString()} {t('common.uzs')}
                                    </p>
                                </Card>
                            );
                        })}
                    </div>
                </section>

                {/* Time slot picker */}
                <section>
                    <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                        {t('common.time')}
                    </h3>
                    <div className="grid grid-cols-4 gap-2">
                        {slots.map((slot) => (
                            <Chip
                                key={slot}
                                selected={time === slot}
                                onClick={() => setTime(slot)}
                                className="py-2.5"
                            >
                                {slot}
                            </Chip>
                        ))}
                    </div>
                </section>

                {/* Optional notes */}
                <div className="relative">
                    <FileText className="absolute left-3 top-3 text-[var(--text-tertiary)]" size={16} />
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('booking.notesPlaceholder')}
                        rows={2}
                        className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)] resize-none"
                    />
                </div>

                {error && (
                    <div className="rounded-[var(--radius-lg)] border border-red-100 bg-red-50 p-4">
                        <p className="text-sm font-semibold text-red-700">{error}</p>
                    </div>
                )}

            </div>
        </Sheet>
    );
}
