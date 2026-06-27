import { supabase } from './supabase.js';
import { formatTo24h } from '../utils/time.js';
import { toDbStatus, fromDbStatus, mapBookingError } from '../utils/bookingStatus.js';

// Helper to perform insert with fallback if database columns do not exist
async function safeInsert(table, payload, selectString = '*') {
    try {
        const { data, error } = await supabase
            .from(table)
            .insert([payload])
            .select(selectString)
            .single();

        if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
            const newPayload = { ...payload };
            let retried = false;
            const columnsToCheck = ['notes', 'reschedule_count', 'original_date', 'original_time', 'cancelled_by'];
            for (const col of columnsToCheck) {
                if (error.message.includes(`'${col}'`) || error.message.includes(`"${col}"`) || error.message.includes(col)) {
                    delete newPayload[col];
                    retried = true;
                }
            }
            if (retried) {
                console.warn(`[Supabase Safe Retry] Retrying insert on ${table} without columns due to error:`, error.message);
                return await supabase
                    .from(table)
                    .insert([newPayload])
                    .select(selectString)
                    .single();
            }
        }
        return { data, error };
    } catch (err) {
        return { data: null, error: err };
    }
}

// Helper to perform update with fallback if database columns do not exist
async function safeUpdate(table, payload, matchField, matchValue, selectString = null) {
    try {
        let query = supabase
            .from(table)
            .update(payload)
            .eq(matchField, matchValue);
        
        if (selectString) {
            query = query.select(selectString).single();
        }

        const { data, error } = await query;

        if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
            const newPayload = { ...payload };
            let retried = false;
            const columnsToCheck = ['notes', 'reschedule_count', 'original_date', 'original_time', 'cancelled_by'];
            for (const col of columnsToCheck) {
                if (error.message.includes(`'${col}'`) || error.message.includes(`"${col}"`) || error.message.includes(col)) {
                    delete newPayload[col];
                    retried = true;
                }
            }
            if (retried) {
                console.warn(`[Supabase Safe Retry] Retrying update on ${table} without columns due to error:`, error.message);
                let retryQuery = supabase
                    .from(table)
                    .update(newPayload)
                    .eq(matchField, matchValue);
                if (selectString) {
                    retryQuery = retryQuery.select(selectString).single();
                }
                return await retryQuery;
            }
        }
        return { data, error };
    } catch (err) {
        return { data: null, error: err };
    }
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

export function normalizeBookingRefId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string')     return value.trim() || null;
    if (typeof value === 'object')     return value.id || value._id || null;
    return String(value);
}

export function bookingMatchesBarber(bookingBarberField, barberId) {
    const a = normalizeBookingRefId(bookingBarberField);
    const b = normalizeBookingRefId(barberId);
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

export function bookingMatchesClient(bookingClientField, clientId) {
    const a = normalizeBookingRefId(bookingClientField);
    const b = normalizeBookingRefId(clientId);
    if (a == null || b == null) return false;
    return String(a) === String(b);
}

/**
 * Normalise a raw `bookings` row (with optional joined barbers/clients) into
 * the unified V2 app model.
 */
export function normalizeBooking(raw) {
    if (!raw) return null;

    const normalizedHours = formatTo24h(raw.booking_hours);

    // Hydrate nested join data
    let barberData = null;
    let clientData = null;

    if (raw.barbers) {
        barberData = {
            ...raw.barbers,
            name: raw.barbers.fullname || raw.barbers.name || 'Unknown',
        };
    }
    if (raw.clients) {
        clientData = {
            ...raw.clients,
            name: raw.clients.fullname || raw.clients.name || 'Unknown',
        };
    }
    if (!barberData && raw.barberData) barberData = raw.barberData;
    if (!clientData && raw.clientData) clientData = raw.clientData;

    // Normalise booking_date to YYYY-MM-DD
    let bookingDate = raw.booking_date ?? null;
    if (bookingDate && typeof bookingDate === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(bookingDate.trim())) {
        try {
            const d = new Date(bookingDate);
            bookingDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch {
            bookingDate = null;
        }
    }

    return {
        ...raw,
        id:            raw.id ?? null,
        barber:        raw.barber_id ?? raw.barber ?? null,
        client:        raw.client_id ?? raw.client ?? null,
        booking_hours: normalizedHours ?? '',
        booking_date:  bookingDate,
        status:        fromDbStatus(raw.status ?? 'pending'),
        service_name:  raw.service_name ?? '',
        service_price: raw.service_price ?? '',
        // Guest fields
        guest_name:    raw.guest_name ?? null,
        guest_phone:   raw.guest_phone ?? null,
        // Extended fields
        notes:            raw.notes ?? '',
        cancelled_by:     raw.cancelled_by ?? null,
        reschedule_count: raw.reschedule_count ?? 0,
        original_date:    raw.original_date ?? null,
        original_time:    raw.original_time ?? null,
        created_at:       raw.created_at ?? null,
        barberData,
        clientData,
    };
}

// ─── Authenticated booking (logged-in client) ─────────────────────────────────

export async function createBooking(payload) {
    const bookingDate = payload.booking_date ?? payload.bookingDate ?? null;
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate).trim())) {
        return { data: null, error: 'date_required' };
    }

    const normalizedHours = formatTo24h(payload.booking_hours);
    if (!normalizedHours) {
        return { data: null, error: 'Invalid booking time.' };
    }

    const safePayload = {
        barber_id:     normalizeBookingRefId(payload.barber),
        client_id:     normalizeBookingRefId(payload.client),
        booking_hours: normalizedHours,
        booking_date:  String(bookingDate).trim(),
        status:        'pending',
        service_name:  payload.service_name ?? null,
        service_price: payload.service_price ?? null,
        notes:         payload.notes ?? '',
    };

    try {
        const { data, error } = await safeInsert('bookings', safePayload, '*, barbers(*), clients(*)');

        if (error) {
            console.error('[BOOKING POST] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }

        return { data: normalizeBooking(data), error: null };
    } catch (err) {
        return { data: null, error: 'Failed to create booking.' };
    }
}

// ─── Guest booking (no auth required) ────────────────────────────────────────

/**
 * Create a booking for a guest (no Supabase Auth required).
 * client_id is NULL; identity is held in guest_name + guest_phone.
 */
export async function createGuestBooking(payload) {
    const bookingDate = payload.booking_date ?? payload.bookingDate ?? null;
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate).trim())) {
        return { data: null, error: 'date_required' };
    }

    const normalizedHours = formatTo24h(payload.booking_hours);
    if (!normalizedHours) {
        return { data: null, error: 'Invalid booking time.' };
    }

    if (!payload.guest_name?.trim() || !payload.guest_phone?.trim()) {
        return { data: null, error: 'Guest name and phone are required.' };
    }

    const safePayload = {
        barber_id:     normalizeBookingRefId(payload.barber_id),
        client_id:     null,
        guest_name:    payload.guest_name.trim(),
        guest_phone:   payload.guest_phone.trim(),
        booking_hours: normalizedHours,
        booking_date:  String(bookingDate).trim(),
        status:        'pending',
        service_name:  payload.service_name ?? null,
        service_price: payload.service_price ?? null,
        notes:         payload.notes ?? '',
    };

    try {
        const { data, error } = await safeInsert('bookings', safePayload, '*, barbers(id, fullname, office_name, profile_img, address, phone)');

        if (error) {
            console.error('[GUEST BOOKING POST] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }

        return { data: normalizeBooking(data), error: null };
    } catch (err) {
        return { data: null, error: 'Failed to create guest booking.' };
    }
}

/**
 * Fetch a guest's booking by ID + phone for the tracking page.
 * No auth required — identity verified by matching guest_phone.
 */
export async function getBookingByIdAndPhone(bookingId, phone) {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, barbers(id, fullname, office_name, profile_img, address, phone, status)')
            .eq('id', bookingId)
            .eq('guest_phone', phone.trim())
            .single();

        if (error) {
            console.error('[GUEST TRACK] Supabase error:', error);
            return { data: null, error: error.message };
        }

        return { data: normalizeBooking(data), error: null };
    } catch {
        return { data: null, error: 'Failed to fetch booking.' };
    }
}

// ─── Shared queries ───────────────────────────────────────────────────────────

export async function getBookings() {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, barbers(*), clients(*)');

        if (error) {
            console.error('[BOOKING GET] Supabase error:', error);
            return { data: null, error: error.message };
        }

        return { data: (data || []).map(normalizeBooking), error: null };
    } catch {
        return { data: null, error: 'Failed to fetch bookings.' };
    }
}

export async function updateBookingStatus(id, payload) {
    const safeId = normalizeBookingRefId(id);
    if (!safeId) return { data: null, error: 'Invalid booking id.' };

    const dbStatus = payload.status ? toDbStatus(payload.status) : undefined;

    // Optional: record who cancelled
    const updatePayload = dbStatus != null ? { status: dbStatus } : {};
    if (payload.cancelled_by) updatePayload.cancelled_by = payload.cancelled_by;

    try {
        const { data, error } = await safeUpdate('bookings', updatePayload, 'id', safeId, '*, barbers(*), clients(*)');

        if (error) {
            console.error('[BOOKING PATCH] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }

        return { data: normalizeBooking(data), error: null };
    } catch (err) {
        return { data: null, error: 'Failed to update booking.' };
    }
}

// ─── Scoped queries (performance) ─────────────────────────────────────────────

/**
 * Fetch bookings scoped to a specific barber.
 * Optionally filter by a single date string (YYYY-MM-DD).
 */
export async function getBookingsForBarber(barberId, dateStr = null) {
    if (!barberId) return { data: [], error: 'Invalid barber id.' };

    try {
        let query = supabase
            .from('bookings')
            .select('*, barbers(*), clients(*)')
            .eq('barber_id', barberId)
            .order('booking_date', { ascending: true })
            .order('booking_hours', { ascending: true });

        if (dateStr) {
            query = query.eq('booking_date', dateStr);
        }

        const { data, error } = await query;
        if (error) {
            console.error('[BOOKING GET BARBER] Supabase error:', error);
            return { data: [], error: error.message };
        }
        return { data: (data || []).map(normalizeBooking), error: null };
    } catch {
        return { data: [], error: 'Failed to fetch barber bookings.' };
    }
}

/**
 * Fetch all bookings for a guest client by phone number.
 */
export async function getBookingsForClient(phone) {
    if (!phone) return { data: [], error: 'Phone is required.' };

    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('*, barbers(*), clients(*)')
            .eq('guest_phone', phone.trim())
            .order('booking_date', { ascending: false })
            .order('booking_hours', { ascending: false });

        if (error) {
            console.error('[BOOKING GET CLIENT] Supabase error:', error);
            return { data: [], error: error.message };
        }
        return { data: (data || []).map(normalizeBooking), error: null };
    } catch {
        return { data: [], error: 'Failed to fetch client bookings.' };
    }
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

/**
 * Reschedule an existing booking to a new date + time.
 * Saves the original date/time for reference on first reschedule.
 * Resets status to 'pending' so the barber must re-approve.
 */
export async function rescheduleBooking(bookingId, newDate, newTime) {
    const safeId = normalizeBookingRefId(bookingId);
    if (!safeId) return { data: null, error: 'Invalid booking id.' };

    const normalizedTime = formatTo24h(newTime);
    if (!normalizedTime) return { data: null, error: 'Invalid time.' };
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return { data: null, error: 'date_required' };
    }

    try {
        // Fetch current booking to save original values
        const { data: current, error: fetchError } = await supabase
            .from('bookings')
            .select('booking_date, booking_hours, reschedule_count, original_date, original_time')
            .eq('id', safeId)
            .single();

        if (fetchError || !current) {
            return { data: null, error: 'Booking not found.' };
        }

        const { data, error } = await safeUpdate('bookings', {
            booking_date:     newDate,
            booking_hours:    normalizedTime,
            status:           'pending',
            reschedule_count: (current.reschedule_count ?? 0) + 1,
            original_date:    current.original_date ?? current.booking_date,
            original_time:    current.original_time ?? current.booking_hours,
        }, 'id', safeId, '*, barbers(*), clients(*)');

        if (error) {
            console.error('[BOOKING RESCHEDULE] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }

        return { data: normalizeBooking(data), error: null };
    } catch {
        return { data: null, error: 'Failed to reschedule booking.' };
    }
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function updateBookingNotes(bookingId, notes) {
    const safeId = normalizeBookingRefId(bookingId);
    if (!safeId) return { error: 'Invalid booking id.' };

    try {
        const { error } = await safeUpdate('bookings', { notes: notes ?? '' }, 'id', safeId);

        if (error) {
            console.error('[BOOKING NOTES] Supabase error:', error);
            return { error: error.message };
        }
        return { error: null };
    } catch {
        return { error: 'Failed to update notes.' };
    }
}

// ─── Walk-in booking (barber-initiated) ───────────────────────────────────────

/**
 * Barber creates a walk-in booking directly (auto-accepted).
 */
export async function createWalkInBooking(payload) {
    const normalizedHours = formatTo24h(payload.booking_hours);
    if (!normalizedHours) return { data: null, error: 'Invalid booking time.' };

    const bookingDate = payload.booking_date;
    if (!bookingDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(bookingDate).trim())) {
        return { data: null, error: 'date_required' };
    }

    const safePayload = {
        barber_id:     normalizeBookingRefId(payload.barber_id),
        client_id:     null,
        guest_name:    (payload.guest_name || '').trim() || 'Walk-in',
        guest_phone:   (payload.guest_phone || '').trim() || null,
        booking_hours: normalizedHours,
        booking_date:  String(bookingDate).trim(),
        status:        'accepted',
        service_name:  payload.service_name ?? null,
        service_price: payload.service_price ?? null,
        notes:         payload.notes ?? '',
    };

    try {
        const { data, error } = await safeInsert('bookings', safePayload, '*, barbers(*), clients(*)');

        if (error) {
            console.error('[WALK-IN BOOKING] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }
        return { data: normalizeBooking(data), error: null };
    } catch {
        return { data: null, error: 'Failed to create walk-in booking.' };
    }
}

// ─── Day validation ───────────────────────────────────────────────────────────

/**
 * Client-side validation: checks if the barber is working on a given date.
 * Returns { valid: boolean, reason: string|null }
 */
export function validateBookingDay(barber, dateStr) {
    if (!barber || !dateStr) return { valid: true, reason: null };

    const date = new Date(dateStr + 'T12:00:00'); // avoid TZ edge
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

    if (Array.isArray(barber.off_days) && barber.off_days.includes(dayOfWeek)) {
        return { valid: false, reason: 'dayOff' };
    }

    if (Array.isArray(barber.holiday_dates) && barber.holiday_dates.includes(dateStr)) {
        return { valid: false, reason: 'holiday' };
    }

    return { valid: true, reason: null };
}
