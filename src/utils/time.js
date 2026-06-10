/**
 * Parse and normalize times to strict "HH:mm" (24h) for booking + availability.
 */

import { isBlockingSlotStatus } from './bookingStatus.js';

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
 * True if slot is already held by an active booking for this barber on the given day.
 * @param {string} bookingDate - YYYY-MM-DD
 */
export function isSlotTaken(bookings, slot, barberId, bookingDate) {
    const normalizedSlot = formatTo24h(slot);
    if (!normalizedSlot || !bookingDate) return false;
    const barberKey = barberId != null && barberId !== '' ? String(barberId).trim() : '';
    const todayStr = (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    })();

    return (bookings ?? []).some((booking) => {
        const bookingSlot = formatTo24h(booking?.booking_hours);
        const bookingBarber = normalizeRefId(booking?.barber);
        const sameBarber =
            !barberKey ||
            (bookingBarber != null && String(bookingBarber).trim() === barberKey);
        const status = String(booking?.status || 'pending').toLowerCase();
        const activeStatus = isBlockingSlotStatus(status);
        if (!sameBarber || !activeStatus || bookingSlot !== normalizedSlot) return false;

        let rawDate = booking?.booking_date ?? booking?.date ?? null;
        if (rawDate && typeof rawDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) {
            try {
                const d = new Date(rawDate);
                rawDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } catch {
                rawDate = null;
            }
        }
        const bookingDay = rawDate ? String(rawDate).trim().slice(0, 10) : todayStr;
        return bookingDay === bookingDate;
    });
}

/**
 * Get current time as "HH:mm" string.
 */
export function getCurrentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * True if current time falls within the given working hours range.
 * workingHours should be a string like "09:00 - 18:00".
 * Returns true if workingHours is empty/invalid (no restriction).
 */
export function isWithinWorkingHours(workingHours) {
    if (!workingHours || workingHours === 'N/A') {
        console.log('[WORK HOURS CHECK] No working hours set — no restriction');
        return true;
    }
    const parts = String(workingHours).split('-').map((s) => s.trim());
    if (!parts || parts.length < 2) {
        console.log('[WORK HOURS CHECK] Invalid working hours format — no restriction');
        return true;
    }
    const start = formatTo24h(parts[0]);
    const end = formatTo24h(parts[1]);
    if (!start || !end) {
        console.log('[WORK HOURS CHECK] Invalid working hours format — no restriction');
        return true;
    }
    const now = getCurrentTime();
    const inRange = now >= start && now < end;
    console.log(`[WORK HOURS CHECK] now=${now} range=${start}-${end} inRange=${inRange}`);
    return inRange;
}

/**
 * True if current time falls within the given lunch break range.
 * lunchStart/lunchEnd should be "HH:mm" strings or empty/null.
 * Returns false if lunch break is not configured (no restriction).
 */
export function isWithinLunchBreak(lunchStart, lunchEnd) {
    const start = formatTo24h(lunchStart);
    const end = formatTo24h(lunchEnd);
    if (!start || !end) {
        console.log('[LUNCH BREAK CHECK] No lunch break configured — no restriction');
        return false;
    }
    const now = getCurrentTime();
    const inLunch = now >= start && now < end;
    console.log(`[LUNCH BREAK CHECK] now=${now} range=${start}-${end} inLunch=${inLunch}`);
    return inLunch;
}

/**
 * Compute final work status based on priority rules:
 *   1. Manual OFF → always OFF
 *   2. Outside working hours → OFF
 *   3. Inside lunch break → OFF
 *   4. Manual ON + all checks pass → ON
 */
export function computeFinalWorkStatus(manualStatus, workingHours, lunchStart, lunchEnd) {
    if (!manualStatus) {
        console.log('[FINAL STATUS] Manual status is OFF → final=OFF');
        return false;
    }
    const inWorkHours = isWithinWorkingHours(workingHours);
    if (!inWorkHours) {
        console.log('[FINAL STATUS] Outside working hours → final=OFF');
        return false;
    }
    const inLunch = isWithinLunchBreak(lunchStart, lunchEnd);
    if (inLunch) {
        console.log('[FINAL STATUS] Inside lunch break → final=OFF');
        return false;
    }
    console.log('[FINAL STATUS] All checks passed → final=ON');
    return true;
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
