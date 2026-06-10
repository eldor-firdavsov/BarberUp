/**
 * BarberUp V2 — Booking Status Utilities
 *
 * V2 simplified status enum: pending | accepted | rejected | cancelled | completed
 * Removed: in_progress, no_show, active (bajarildi)
 */

/** All valid V2 booking status values */
export const BOOKING_STATUSES = {
    PENDING:   'pending',
    ACCEPTED:  'accepted',
    REJECTED:  'rejected',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
};

/** Barber availability statuses stored in Supabase `barbers.status` */
export const BARBER_STATUS = {
    available:    'available',
    working_busy: 'working-busy',
    lunch:        'lunch',
    closed:       'closed',
};

// ─── Status helpers ───────────────────────────────────────────────────────────

/** True if this status should block a calendar time slot from being re-booked. */
export function isBlockingSlotStatus(status) {
    const s = String(status ?? '').toLowerCase();
    return s === 'pending' || s === 'accepted';
}

/** True if the booking is in a terminal (unchangeable) state. */
export function isTerminalStatus(status) {
    const s = String(status ?? '').toLowerCase();
    return ['rejected', 'cancelled', 'completed'].includes(s);
}

/** True if the booking is currently accepted (confirmed but not finished). */
export function isAcceptedStatus(status) {
    return String(status ?? '').toLowerCase() === 'accepted';
}

/** True if the booking is awaiting barber response. */
export function isPendingStatus(status) {
    return String(status ?? '').toLowerCase() === 'pending';
}

/**
 * Returns the display-ready status string for a booking.
 * V2: no more dynamic "in_progress" computation — status is always what's in the DB.
 */
export function getDisplayStatus(booking) {
    if (!booking) return 'pending';
    const s = String(booking.status ?? 'pending').toLowerCase();

    // Legacy compatibility: map old status values if any stale rows appear
    if (s === 'active')     return 'accepted';
    if (s === 'bajarildi')  return 'completed';
    if (s === 'in_progress') return 'completed'; // show as completed in V2 UI
    if (s === 'no_show')    return 'cancelled';  // show as cancelled in V2 UI

    return s;
}

// ─── DB ↔ UI status mapping ───────────────────────────────────────────────────

/**
 * Map a UI status string to the value stored in Supabase.
 * V2: DB values match UI values directly (no more 'active'/'bajarildi' aliases).
 */
export function toDbStatus(status) {
    const s = String(status ?? 'pending').toLowerCase();
    // Handle legacy input gracefully
    if (s === 'active')      return 'accepted';
    if (s === 'bajarildi')   return 'completed';
    if (s === 'in_progress') return 'completed';
    if (s === 'no_show')     return 'cancelled';
    // V2 pass-through
    if (['pending', 'accepted', 'rejected', 'cancelled', 'completed'].includes(s)) return s;
    return 'pending';
}

/**
 * Map a raw DB status to the UI status used across the app.
 * V2: mostly pass-through; handles legacy aliases for safety.
 */
export function fromDbStatus(status) {
    const s = String(status ?? 'pending').toLowerCase();
    if (s === 'active')      return 'accepted';
    if (s === 'bajarildi')   return 'completed';
    if (s === 'in_progress') return 'completed';
    if (s === 'no_show')     return 'cancelled';
    return s;
}

// ─── Error mapping ────────────────────────────────────────────────────────────

/**
 * Map Supabase/Postgres errors to i18n key codes used in the UI.
 * Returns a short code that callers pass to t() or formatBookingErrorMessage().
 */
export function mapBookingError(error) {
    if (!error) return null;
    const message = typeof error === 'string' ? error : error.message ?? String(error);
    const lower   = message.toLowerCase();
    const code    = error?.code ?? '';

    // Free tier booking limit reached (raised by DB trigger)
    if (
        lower.includes('free_tier_limit_reached') ||
        lower.includes('FREE_TIER_LIMIT_REACHED')
    ) {
        return 'free_tier_limit';
    }

    // Duplicate slot (unique index violation)
    if (
        code === '23505' ||
        lower.includes('duplicate') ||
        lower.includes('unique') ||
        lower.includes('bookings_barber_date_time_active_uidx')
    ) {
        return 'slot_taken';
    }

    // Past date constraint
    if (
        code === '23514' ||
        lower.includes('bookings_date_not_past') ||
        lower.includes('check constraint')
    ) {
        return 'past_date';
    }

    if (lower.includes('booking date is required')) {
        return 'date_required';
    }

    return message;
}

/**
 * Resolve a booking error code/message to a translated display string.
 * @param {*} error - Raw error from API
 * @param {Function} t - i18n translate function
 */
export function formatBookingErrorMessage(error, t) {
    const code = mapBookingError(error) ?? String(error ?? '');
    switch (code) {
        case 'slot_taken':
            return t('errors.slotTaken');
        case 'past_date':
            return t('client.barbershopDetails.pastDate');
        case 'date_required':
            return t('client.barbershopDetails.selectDateRequired');
        case 'free_tier_limit':
            return t('errors.freeTierLimit');
        default: {
            const lower = code.toLowerCase();
            if (lower.includes('duplicate') || lower.includes('unique') ||
                lower.includes('already')   || lower.includes('taken') ||
                lower.includes('booked')) {
                return t('errors.slotTaken');
            }
            if (lower.includes('date') && lower.includes('past')) {
                return t('client.barbershopDetails.pastDate');
            }
            return code || t('errors.generic');
        }
    }
}

// Keep this export so existing callers of the old DB_STATUS don't crash
// while the rest of the codebase is being migrated.
/** @deprecated Use BOOKING_STATUSES instead */
export const DB_STATUS = {
    pending:     'pending',
    active:      'accepted',   // V1 alias
    rejected:    'rejected',
    cancelled:   'cancelled',
    completed:   'completed',
    in_progress: 'completed',  // V1 alias — maps to completed in V2
    no_show:     'cancelled',  // V1 alias — maps to cancelled in V2
};
