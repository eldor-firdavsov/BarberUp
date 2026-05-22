import { supabase } from './supabase.js';
import { formatTo24h } from '../utils/time.js';

export function normalizeBookingRefId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'object') return value.id || value._id || null;
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

export function normalizeBooking(raw) {
    if (!raw) return null;
    const normalizedHours = formatTo24h(raw.booking_hours);

    // map Supabase relation objects
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

    // fallback mapping if old data shapes are passed
    if (!barberData && raw.barberData) barberData = raw.barberData;
    if (!clientData && raw.clientData) clientData = raw.clientData;

    let normalizedStatus = raw.status ?? 'pending';
    if (normalizedStatus === 'active') normalizedStatus = 'accepted';

    return {
        ...raw,
        id: raw.id ?? null,
        barber: raw.barber_id ?? raw.barber ?? null,
        client: raw.client_id ?? raw.client ?? null,
        booking_hours: normalizedHours ?? '',
        status: normalizedStatus,
        service_name: raw.service_name ?? '',
        service_price: raw.service_price ?? '',
        barberData,
        clientData,
    };
}

export async function createBooking(payload) {
    const safePayload = {
        barber_id: normalizeBookingRefId(payload.barber),
        client_id: normalizeBookingRefId(payload.client),
        booking_hours: formatTo24h(payload.booking_hours),
        status: 'pending',
        service_name: payload.service_name ?? null,
        service_price: payload.service_price ?? null
    };
    
    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([safePayload])
            .select('*, barbers(*), clients(*)')
            .single();

        if (error) {
            console.error('[BOOKING POST] Supabase error:', error);
            return { data: null, error: error.message };
        }

        return { data: normalizeBooking(data), error: null };
    } catch (err) {
        return { data: null, error: 'Failed to create booking.' };
    }
}

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
    } catch (err) {
        return { data: null, error: 'Failed to fetch bookings.' };
    }
}

const STATUS_MAP = {
    accepted:    'active',
    in_progress: 'active',
    cancelled:   'rejected',
    completed:   'completed',
    pending:     'pending',
    rejected:    'rejected',
};

export async function updateBookingStatus(id, payload) {
    const safeId = normalizeBookingRefId(id);
    if (!safeId) return { data: null, error: 'Invalid booking id.' };

    let mappedStatus = payload.status;
    if (payload.status) {
        mappedStatus = STATUS_MAP[String(payload.status).toLowerCase()] ?? payload.status;
    }

    try {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status: mappedStatus })
            .eq('id', safeId)
            .select('*, barbers(*), clients(*)')
            .single();

        if (error) {
            console.error('[BOOKING PATCH] Supabase error:', error);
            return { data: null, error: error.message };
        }

        return { data: normalizeBooking(data), error: null };
    } catch (err) {
        return { data: null, error: 'Failed to update booking.' };
    }
}
