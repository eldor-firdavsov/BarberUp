import { supabase } from './supabase.js';
import { formatTo24h } from '../utils/time.js';
import { toDbStatus, fromDbStatus, mapBookingError } from '../utils/bookingStatus.js';

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
    };

    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([safePayload])
            .select('*, barbers(*), clients(*)')
            .single();

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
    };

    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([safePayload])
            .select('*, barbers(id, fullname, office_name, profile_img, address, phone)')
            .single();

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
        const { data, error } = await supabase
            .from('bookings')
            .update(updatePayload)
            .eq('id', safeId)
            .select('*, barbers(*), clients(*)')
            .single();

        if (error) {
            console.error('[BOOKING PATCH] Supabase error:', error);
            return { data: null, error: mapBookingError(error) };
        }

        return { data: normalizeBooking(data), error: null };
    } catch {
        return { data: null, error: 'Failed to update booking.' };
    }
}
