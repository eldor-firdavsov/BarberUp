import { Clock, FileText } from 'lucide-react';
import { Sheet, Button, Chip, Card } from './ui/index.js';
import { t } from '../utils/i18n.js';
import { formatBookingDate } from '../utils/dates.js';
import { validateBookingDay } from '../api/bookingApi.js';

export function BookingSheet({
    isOpen,
    onClose,
    services = [],
    selectedService,
    onSelectService,
    dayOptions = [],
    selectedDate,
    onSelectDate,
    slots = [],
    bookedSlots = [],
    selectedSlot,
    onSelectSlot,
    error,
    successMessage,
    loading,
    onConfirm,
    confirmLabel,
    children,
    onGoHome,
    barber = null,
    notes = '',
    onNotesChange,
}) {
    const footerContent = successMessage ? (
        <div className="space-y-3">
            <div className="rounded-[var(--radius-lg)] border border-green-100 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-700">{successMessage}</p>
            </div>
            <Button className="w-full" size="lg" onClick={onGoHome}>
                {t('common.home')}
            </Button>
        </div>
    ) : (
        <Button
            className="w-full"
            size="lg"
            disabled={!selectedSlot || loading}
            onClick={onConfirm}
        >
            {loading ? t('client.barbershopDetails.booking') : (confirmLabel || t('client.barbershopDetails.bookNow'))}
        </Button>
    );

    return (
        <Sheet
            isOpen={isOpen}
            onClose={onClose}
            title={t('client.barbershopDetails.bookNow')}
            footer={footerContent}
        >
            <div className="space-y-6">
                {children}

                {services.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                            {t('client.barbershopDetails.services')}
                        </h3>
                        <div className="space-y-2">
                            {services.map((service) => {
                                const selected = selectedService?.id === service.id;
                                return (
                                    <Card
                                        key={service.id}
                                        interactive
                                        className={`p-4 flex justify-between items-center ${selected ? 'ring-2 ring-[var(--brand-primary)] bg-[var(--brand-primary-light)]' : ''}`}
                                        onClick={() => onSelectService?.(service)}
                                    >
                                        <div>
                                            <p className="font-bold text-[var(--text-primary)]">{service.name}</p>
                                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                                {service.duration} {t('common.minutes')}
                                            </p>
                                        </div>
                                        <p className="font-bold text-[var(--text-primary)]">
                                            {Number(service.price).toLocaleString()} {t('common.uzs')}
                                        </p>
                                    </Card>
                                );
                            })}
                        </div>
                    </section>
                )}

                <section>
                    <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                        {t('client.barbershopDetails.selectDate')}
                    </h3>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                        {dayOptions.map((day) => {
                            const validation = barber ? validateBookingDay(barber, day.dateStr) : { valid: true };
                            const isOff = !validation.valid;
                            return (
                                <Chip
                                    key={day.dateStr}
                                    selected={selectedDate === day.dateStr}
                                    disabled={isOff}
                                    onClick={() => !isOff && onSelectDate?.(day.dateStr)}
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
                                        onClick={() => onSelectSlot?.(time)}
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
                            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('client.barbershopDetails.fullyBookedDay')}</p>
                        </div>
                    )}
                </section>

                {/* Optional notes / special requests */}
                {onNotesChange && (
                    <section>
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                            {t('booking.notes')}
                        </h3>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-[var(--text-tertiary)]" size={16} />
                            <textarea
                                value={notes}
                                onChange={(e) => onNotesChange(e.target.value)}
                                placeholder={t('booking.notesPlaceholder')}
                                rows={2}
                                className="w-full pl-10 pr-4 py-3 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm outline-none focus:border-[var(--brand-primary)] resize-none"
                            />
                        </div>
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

export default BookingSheet;
