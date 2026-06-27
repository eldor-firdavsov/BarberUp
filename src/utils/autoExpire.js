/**
 * autoExpire.js
 * Client-side utilities for handling expired pending bookings.
 */

/**
 * Returns true if a pending booking's time slot has passed (10+ min ago).
 * Uses local timezone.
 */
export function isBookingExpired(booking) {
    if (!booking) return false;
    const s = String(booking.status ?? '').toLowerCase();
    if (s !== 'pending') return false;
    if (!booking.booking_date || !booking.booking_hours) return false;

    try {
        const bookingDateTime = new Date(
            `${booking.booking_date}T${booking.booking_hours}:00`
        );
        if (isNaN(bookingDateTime.getTime())) return false;

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        return bookingDateTime < tenMinutesAgo;
    } catch {
        return false;
    }
}

/**
 * Returns a new bookings array with expired pending bookings
 * marked as status: 'expired' for local UI display only.
 * Does NOT mutate the originals.
 */
export function markExpiredBookings(bookings) {
    if (!Array.isArray(bookings)) return bookings;
    return bookings.map(b =>
        isBookingExpired(b) ? { ...b, status: 'expired' } : b
    );
}
