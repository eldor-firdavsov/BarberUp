/**
 * Parse and normalize times to strict "HH:mm" (24h) for booking + availability.
 */

function parseTimeParts(hours, minutes) {
    const h = Number(hours);
    const m = Number(minutes);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hours: h, minutes: m };
}

/**
 * Normalize any reasonable API/UI time string to "HH:mm".
 * Handles "9:00", "09:00", "14:30:00", trailing AM/PM (stripped), extra whitespace.
 */
export function formatTo24h(value) {
    if (value == null) return null;
    let text = String(value).trim();
    if (!text) return null;

    // Strip trailing AM/PM (no new UI; data sanitization only)
    text = text.replace(/\s*(AM|PM|am|pm)\s*$/i, '').trim();

    // HH:mm or HH:mm:ss
    const match = text.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) {
        const loose = text.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\b/);
        if (!loose) return null;
        return formatTo24h(`${loose[1]}:${loose[2]}`);
    }

    const parsed = parseTimeParts(match[1], match[2]);
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

/**
 * True if slot is already held by an active booking for this barber.
 */
export function isSlotTaken(bookings, slot, barberId) {
    const normalizedSlot = formatTo24h(slot);
    if (!normalizedSlot) return false;
    const barberKey = barberId != null && barberId !== '' ? String(barberId).trim() : '';

    return (bookings ?? []).some((booking) => {
        const bookingSlot = formatTo24h(booking?.booking_hours);
        const bookingBarber = normalizeRefId(booking?.barber);
        const sameBarber =
            !barberKey ||
            (bookingBarber != null && String(bookingBarber).trim() === barberKey);
        const status = String(booking?.status || 'pending').toLowerCase();
        const activeStatus = !['rejected', 'cancelled'].includes(status);
        return sameBarber && activeStatus && bookingSlot === normalizedSlot;
    });
}

function normalizeRefId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
        const t = value.trim();
        return t || null;
    }
    if (typeof value === 'object') {
        const nested = value._id ?? value.id ?? value.$oid;
        if (nested != null && nested !== value) return normalizeRefId(nested);
        if (typeof nested === 'string') return nested.trim() || null;
    }
    return String(value);
}
