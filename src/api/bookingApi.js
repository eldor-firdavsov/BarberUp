import { getApiError, httpClient } from './httpClient.js';
import { formatTo24h } from '../utils/time.js';

/** Same rules as time-layer ref matching: string id or populated { _id } */
export function normalizeBookingRefId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'string') {
        const t = value.trim();
        return t || null;
    }
    if (typeof value === 'object') {
        const nested = value._id ?? value.id ?? value.$oid;
        if (nested != null && nested !== value) return normalizeBookingRefId(nested);
        if (typeof nested === 'string') return nested.trim() || null;
    }
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

function normalizeId(value) {
    return normalizeBookingRefId(value);
}

export function normalizeBooking(raw) {
    if (!raw) return null;
    const normalizedHours = formatTo24h(raw.booking_hours);
    if (!normalizedHours && raw.booking_hours != null) {
        console.warn('[BOOKING CHECK] Unparseable booking_hours, raw=', raw.booking_hours);
    }

    // Handle both ID references and populated objects
    let barberId = null;
    let clientId = null;

    if (raw.barber) {
        if (typeof raw.barber === 'string') {
            barberId = raw.barber;
        } else if (typeof raw.barber === 'object') {
            barberId = raw.barber._id ?? raw.barber.id;
        }
    }

    if (raw.client) {
        if (typeof raw.client === 'string') {
            clientId = raw.client;
        } else if (typeof raw.client === 'object') {
            clientId = raw.client._id ?? raw.client.id;
        }
    }

    // Normalize status - backend uses 'active' for 'accepted'
    let normalizedStatus = raw.status ?? 'pending';
    if (normalizedStatus === 'active') {
        normalizedStatus = 'accepted';
    }

    console.log('[BOOKING NORMALIZE] id=', raw._id, 'barberId=', barberId, 'clientId=', clientId, 'status=', normalizedStatus);

    return {
        ...raw,
        id: raw._id ?? raw.id ?? null,
        barber: normalizeId(barberId),
        client: normalizeId(clientId),
        booking_hours: normalizedHours ?? '',
        status: normalizedStatus,
        // Keep original objects for reference if needed, with normalized name fields
        barberData: typeof raw.barber === 'object' ? {
            ...raw.barber,
            id: raw.barber._id ?? raw.barber.id ?? null,
            name: raw.barber.fullname || raw.barber.name || 'Unknown',
        } : null,
        clientData: typeof raw.client === 'object' ? {
            ...raw.client,
            id: raw.client._id ?? raw.client.id ?? null,
            name: raw.client.fullname || raw.client.name || 'Unknown',
        } : null,
    };
}

export async function createBooking(payload) {
    const safePayload = {
        ...payload,
        booking_hours: formatTo24h(payload?.booking_hours) ?? payload?.booking_hours,
    };
    console.log('[BOOKING POST]', safePayload);
    try {
        const response = await httpClient.post('/booking', safePayload);
        const data = normalizeBooking(response?.data?.data ?? response?.data);
        console.log('[BOOKING POST] ok', data);
        return { data, error: null };
    } catch (error) {
        console.error('[BOOKING POST] failed', getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to create booking.') };
    }
}

export async function getBookings() {
    try {
        const response = await httpClient.get('/booking');
        const rawList = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? []);
        const list = rawList.map(normalizeBooking);
        console.log('[BOOKING REFETCH] count=', list.length);
        return { data: list, error: null };
    } catch (error) {
        console.error('[BOOKING REFETCH] GET failed', getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to fetch bookings.') };
    }
}

// Map frontend status names → backend enum values
// Backend only accepts: pending | active | rejected | completed
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
    if (safeId == null || safeId === '') {
        console.error('[404 DEBUG] updateBookingStatus blocked: invalid id', id);
        return { data: null, error: 'Invalid booking id.' };
    }

    // Normalize status to backend-accepted enum if payload contains a status field
    let safePayload = payload;
    if (payload && typeof payload === 'object' && payload.status) {
        const mapped = STATUS_MAP[String(payload.status).toLowerCase()];
        safePayload = { ...payload, status: mapped ?? payload.status };
    }

    console.log('[BOOKING PATCH]', safeId, safePayload);
    try {
        const response = await httpClient.patch(`/booking/${safeId}`, safePayload);
        return { data: normalizeBooking(response?.data?.data ?? response?.data), error: null };
    } catch (error) {
        console.error('[404 DEBUG] PATCH /booking/:id failed', safeId, getApiError(error));
        return { data: null, error: getApiError(error, 'Failed to update booking.') };
    }
}
