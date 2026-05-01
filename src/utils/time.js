function parseTimeParts(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
}

export function formatTo24h(value) {
    const parsed = parseTimeParts(value);
    if (!parsed) return null;
    return `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`;
}

export function compareTimes(a, b) {
    const ta = formatTo24h(a);
    const tb = formatTo24h(b);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return ta.localeCompare(tb);
}

export function isSlotTaken(bookings, slot, barberId) {
    const normalizedSlot = formatTo24h(slot);
    if (!normalizedSlot) return false;
    return (bookings ?? []).some((booking) => {
        const bookingSlot = formatTo24h(booking?.booking_hours);
        const sameBarber = !barberId || booking?.barber === barberId;
        const activeStatus = !['rejected', 'cancelled'].includes(String(booking?.status || '').toLowerCase());
        return sameBarber && activeStatus && bookingSlot === normalizedSlot;
    });
}
